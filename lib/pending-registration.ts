import { eq, lt } from "drizzle-orm";
import { z } from "zod";
import type { GenericEndpointContext } from "better-auth";
import { APIError } from "better-auth/api";
import { hashPassword, verifyPassword, generateRandomString } from "better-auth/crypto";
import { setSessionCookie } from "better-auth/cookies";
import { db } from "@/lib/db";
import * as schema from "@/db/auth";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { maskEmail, isEmailPermittedToAccess } from "@/lib/waitlist";
import { sendEmail } from "@/lib/email";
import { renderVerificationEmail } from "@/lib/email-templates/verification";
import { checkAndIncrementVerificationRateLimit } from "@/lib/verification-rate-limit";

const registerBodySchema = z.object({
  name: z.string().trim().min(1, "Full name is required.").max(100, "Name is too long."),
  email: z.string().trim().toLowerCase().max(254, "Email is too long.").email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128, "Password is too long."),
});

const verifyBodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  otp: z.string().trim().min(6, "Code must be 6 digits.").max(6, "Code must be 6 digits."),
});

const resendBodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

/**
 * Clean up expired pending registrations.
 * Removes any pending registration where otpExpiresAt is in the past.
 */
export async function cleanupExpiredPendingRegistrations(): Promise<number> {
  const now = new Date();
  try {
    const deleted = await db
      .delete(schema.pendingRegistrations)
      .where(lt(schema.pendingRegistrations.otpExpiresAt, now))
      .returning({ id: schema.pendingRegistrations.id });

    if (deleted.length > 0) {
      log.info("[auth/pending-registration] Cleaned up expired pending registrations", {
        count: deleted.length,
      });
    }
    return deleted.length;
  } catch (error) {
    log.warn("[auth/pending-registration] Failed to clean up expired pending registrations", {
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * Handle new pending registration:
 * 1. Validate inputs
 * 2. Check if a verified user with this email already exists
 * 3. Check waitlist permissions if in invite mode
 * 4. Enforce rate limiting on verification emails
 * 5. Hash password (scrypt) & hash OTP (scrypt)
 * 6. Store pending registration (upsert by email)
 * 7. Dispatch verification email with OTP
 *
 * NOTE: DOES NOT insert into user or account tables.
 */
export async function registerPendingUser(params: {
  name: string;
  email: string;
  password: string;
  clientIp?: string;
}) {
  const parsed = registerBodySchema.safeParse(params);
  if (!parsed.success) {
    const firstMsg = parsed.error.issues[0]?.message || "Invalid registration input.";
    throw new APIError("BAD_REQUEST", { message: firstMsg });
  }

  const { name, email, password } = parsed.data;
  const masked = maskEmail(email);

  // 1. Check if a verified account already exists with this email
  const [existingUser] = await db
    .select({
      id: schema.user.id,
      email: schema.user.email,
      emailVerified: schema.user.emailVerified,
    })
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1);

  if (existingUser?.emailVerified) {
    log.warn("[auth/pending-registration] Registration rejected for existing verified user", {
      email: masked,
    });
    throw new APIError("UNPROCESSABLE_ENTITY", {
      message: "An account with this email already exists.",
    });
  }

  // 2. In invite mode, check waitlist approval
  if (env.SIGNUP_MODE === "invite") {
    const permitted = await isEmailPermittedToAccess(email);
    if (!permitted) {
      log.warn("[auth/pending-registration] Blocked unapproved registration in invite mode", {
        email: masked,
      });
      throw new APIError("FORBIDDEN", {
        message: "Nexus is in private beta. Request access on the home page.",
      });
    }
  }

  // 3. Rate limiting check (cooldown, hourly limits, global daily cap)
  const rateLimitRes = await checkAndIncrementVerificationRateLimit({
    email,
    ip: params.clientIp,
  });

  if (!rateLimitRes.allowed) {
    log.warn("[auth/pending-registration] Verification OTP rate limited", {
      email: masked,
      reason: rateLimitRes.reason,
    });
    if (rateLimitRes.reason === "global_daily") {
      throw new APIError("TOO_MANY_REQUESTS", {
        message: "We're sending a lot of emails right now. Please try again later.",
      });
    }
    if (rateLimitRes.reason === "cooldown") {
      throw new APIError("TOO_MANY_REQUESTS", {
        message: rateLimitRes.message || "Please wait before requesting another code.",
      });
    }
    throw new APIError("TOO_MANY_REQUESTS", {
      message: rateLimitRes.message || "Too many attempts. Please try again later.",
    });
  }

  // 4. Prune any expired pending registrations
  await cleanupExpiredPendingRegistrations();

  // 5. Cryptographically secure password and OTP hashing
  const passwordHash = await hashPassword(password);
  const otp = generateRandomString(6, "0-9");
  const otpHash = await hashPassword(otp);

  const now = new Date();
  const otpExpiresAt = new Date(now.getTime() + 600 * 1000); // 10 minutes

  // 6. Upsert into pending_registrations table
  await db
    .insert(schema.pendingRegistrations)
    .values({
      id: crypto.randomUUID(),
      email,
      name,
      passwordHash,
      otpHash,
      otpExpiresAt,
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.pendingRegistrations.email,
      set: {
        name,
        passwordHash,
        otpHash,
        otpExpiresAt,
        attemptCount: 0,
        updatedAt: now,
      },
    });

  // 7. Render and dispatch email
  const { html, text } = renderVerificationEmail({ code: otp });
  await sendEmail({
    to: email,
    subject: "Verify your email - Nexus",
    html,
    text,
    devCode: otp,
  });

  log.info("[auth/pending-registration] Temporary pending registration created and OTP sent", {
    email: masked,
  });

  return {
    success: true,
    message: "Verification code sent.",
  };
}

/**
 * Handle OTP verification and finalize user creation:
 * 1. Validate OTP format
 * 2. Look up pending registration
 * 3. Verify OTP against hash, enforce attempt count and expiration
 * 4. On match:
 *    - Remove any stale legacy unverified user record with the same email
 *    - Insert new verified user into user table (emailVerified: true)
 *    - Insert password credential into account table
 *    - Delete pending_registration record
 *    - Create session & set signed session cookie
 */
export async function verifyPendingUser(params: {
  email: string;
  otp: string;
  ctx: GenericEndpointContext;
}) {
  const parsed = verifyBodySchema.safeParse({
    email: params.email,
    otp: params.otp,
  });

  if (!parsed.success) {
    const firstMsg = parsed.error.issues[0]?.message || "Invalid verification code.";
    throw new APIError("BAD_REQUEST", { message: firstMsg });
  }

  const { email, otp } = parsed.data;
  const masked = maskEmail(email);

  // Prune any expired pending registrations
  await cleanupExpiredPendingRegistrations();

  const [pending] = await db
    .select()
    .from(schema.pendingRegistrations)
    .where(eq(schema.pendingRegistrations.email, email))
    .limit(1);

  if (pending) {
    // Check expiration
    if (pending.otpExpiresAt.getTime() < Date.now()) {
      await db
        .delete(schema.pendingRegistrations)
        .where(eq(schema.pendingRegistrations.id, pending.id));
      throw new APIError("BAD_REQUEST", {
        message: "The verification code has expired. Please request a new code.",
      });
    }

    // Check maximum attempt count
    if (pending.attemptCount >= 5) {
      log.warn("[auth/pending-registration] Exceeded max verification attempts", {
        email: masked,
        attempts: pending.attemptCount,
      });
      throw new APIError("FORBIDDEN", {
        message: "Too many attempts, request a new code.",
      });
    }

    // Verify OTP against stored hash
    const isValid = await verifyPassword({
      hash: pending.otpHash,
      password: otp,
    });

    if (!isValid) {
      const nextCount = pending.attemptCount + 1;
      await db
        .update(schema.pendingRegistrations)
        .set({
          attemptCount: nextCount,
          updatedAt: new Date(),
        })
        .where(eq(schema.pendingRegistrations.id, pending.id));

      log.warn("[auth/pending-registration] Invalid OTP attempt", {
        email: masked,
        attempt: nextCount,
      });

      if (nextCount >= 5) {
        throw new APIError("FORBIDDEN", {
          message: "Too many attempts, request a new code.",
        });
      }

      throw new APIError("BAD_REQUEST", {
        message: "Invalid or expired code.",
      });
    }

    // OTP verified successfully!
    // Finalize permanent user account creation:
    // If a stale unverified user record exists from legacy registrations, remove it
    const [staleUser] = await db
      .select({ id: schema.user.id, emailVerified: schema.user.emailVerified })
      .from(schema.user)
      .where(eq(schema.user.email, email))
      .limit(1);

    if (staleUser) {
      if (staleUser.emailVerified) {
        throw new APIError("BAD_REQUEST", {
          message: "An account with this email already exists.",
        });
      }
      await db.delete(schema.user).where(eq(schema.user.id, staleUser.id));
    }

    const userId = params.ctx.context.generateId?.({ model: "user" }) || crypto.randomUUID();
    const now = new Date();

    // 1. Create permanent verified user
    const [newUser] = await db
      .insert(schema.user)
      .values({
        id: userId,
        name: pending.name,
        email: pending.email,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // 2. Create credential account with the pre-hashed password
    const accountId = params.ctx.context.generateId?.({ model: "account" }) || crypto.randomUUID();
    await db.insert(schema.account).values({
      id: accountId,
      userId: newUser.id,
      accountId: newUser.id,
      providerId: "credential",
      issuer: "local:credential",
      password: pending.passwordHash,
      createdAt: now,
      updatedAt: now,
    });

    // 3. Remove temporary pending registration
    await db
      .delete(schema.pendingRegistrations)
      .where(eq(schema.pendingRegistrations.id, pending.id));

    // 4. Create Better Auth session and set signed session cookie
    const session = await params.ctx.context.internalAdapter.createSession(newUser.id);
    await setSessionCookie(params.ctx, {
      session,
      user: newUser,
    });

    log.info("[auth/pending-registration] User account permanently created and session established", {
      email: masked,
      userId: newUser.id,
    });

    return {
      status: true,
      token: session.token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        emailVerified: newUser.emailVerified,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
      },
    };
  }

  // Fallback for legacy unverified users created before this fix
  const [legacyUser] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1);

  if (legacyUser && !legacyUser.emailVerified) {
    const identifier = `email-verification:${email}`;
    const [verRow] = await db
      .select()
      .from(schema.verification)
      .where(eq(schema.verification.identifier, identifier))
      .limit(1);

    if (verRow) {
      if (verRow.expiresAt.getTime() < Date.now()) {
        await db.delete(schema.verification).where(eq(schema.verification.id, verRow.id));
        throw new APIError("BAD_REQUEST", {
          message: "Invalid or expired code.",
        });
      }

      const [storedHash, attemptsStr] = verRow.value.split(":");
      const attempts = parseInt(attemptsStr || "0", 10);
      if (attempts >= 5) {
        throw new APIError("FORBIDDEN", {
          message: "Too many attempts, request a new code.",
        });
      }

      const isValid = await verifyPassword({
        hash: storedHash,
        password: otp,
      });

      if (!isValid) {
        await db
          .update(schema.verification)
          .set({ value: `${storedHash}:${attempts + 1}` })
          .where(eq(schema.verification.id, verRow.id));
        throw new APIError("BAD_REQUEST", {
          message: "Invalid or expired code.",
        });
      }

      // Mark legacy user verified
      await db
        .update(schema.user)
        .set({ emailVerified: true })
        .where(eq(schema.user.id, legacyUser.id));
      await db.delete(schema.verification).where(eq(schema.verification.id, verRow.id));

      const session = await params.ctx.context.internalAdapter.createSession(legacyUser.id);
      await setSessionCookie(params.ctx, {
        session,
        user: { ...legacyUser, emailVerified: true },
      });

      return {
        status: true,
        token: session.token,
        user: {
          id: legacyUser.id,
          name: legacyUser.name,
          email: legacyUser.email,
          emailVerified: true,
        },
      };
    }
  }

  throw new APIError("BAD_REQUEST", {
    message: "No pending registration found or the code has expired. Please sign up again.",
  });
}

/**
 * Handle Resend OTP:
 * 1. Checks rate limits (cooldown, hourly, daily)
 * 2. If a pending registration exists, generates fresh OTP, hashes it, updates record, and sends email.
 * 3. Returns non-enumerating generic success response.
 */
export async function resendPendingRegistrationOTP(params: {
  email: string;
  clientIp?: string;
}) {
  const parsed = resendBodySchema.safeParse({ email: params.email });
  if (!parsed.success) {
    return {
      success: true,
      message: "If this email can be used, we've sent a code.",
    };
  }

  const { email } = parsed.data;
  const masked = maskEmail(email);

  await cleanupExpiredPendingRegistrations();

  const [pending] = await db
    .select()
    .from(schema.pendingRegistrations)
    .where(eq(schema.pendingRegistrations.email, email))
    .limit(1);

  if (!pending) {
    // Non-enumerating response
    return {
      success: true,
      message: "If this email can be used, we've sent a code.",
    };
  }

  // Rate limit check
  const rateLimitRes = await checkAndIncrementVerificationRateLimit({
    email,
    ip: params.clientIp,
  });

  if (!rateLimitRes.allowed) {
    log.warn("[auth/pending-registration] Resend OTP rate limited", {
      email: masked,
      reason: rateLimitRes.reason,
    });
    if (rateLimitRes.reason === "cooldown") {
      throw new APIError("TOO_MANY_REQUESTS", {
        message: rateLimitRes.message || "Please wait before requesting another code.",
      });
    }
    throw new APIError("TOO_MANY_REQUESTS", {
      message: rateLimitRes.message || "Too many attempts. Please try again later.",
    });
  }

  // Generate fresh OTP & hash
  const otp = generateRandomString(6, "0-9");
  const otpHash = await hashPassword(otp);
  const now = new Date();
  const otpExpiresAt = new Date(now.getTime() + 600 * 1000); // 10 minutes

  await db
    .update(schema.pendingRegistrations)
    .set({
      otpHash,
      otpExpiresAt,
      attemptCount: 0,
      updatedAt: now,
    })
    .where(eq(schema.pendingRegistrations.id, pending.id));

  const { html, text } = renderVerificationEmail({ code: otp });
  await sendEmail({
    to: email,
    subject: "Verify your email - Nexus",
    html,
    text,
    devCode: otp,
  });

  log.info("[auth/pending-registration] Fresh OTP dispatched for pending registration", {
    email: masked,
  });

  return {
    success: true,
    message: "If this email can be used, we've sent a code.",
  };
}
