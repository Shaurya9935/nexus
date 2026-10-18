import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { verificationRateLimits } from "@/db/auth";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { maskEmail } from "@/lib/waitlist";

const COOLDOWN_SECONDS = 60;
const EMAIL_HOURLY_LIMIT = 5;
const EMAIL_HOURLY_WINDOW_MS = 60 * 60 * 1000;
const IP_HOURLY_LIMIT = 10;
const IP_HOURLY_WINDOW_MS = 60 * 60 * 1000;
const GLOBAL_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

export type VerificationRateLimitErrorType =
  | "cooldown"
  | "email_hourly"
  | "ip_hourly"
  | "global_daily";

export interface VerificationRateLimitResult {
  allowed: boolean;
  reason?: VerificationRateLimitErrorType;
  retryAfterSeconds?: number;
  message?: string;
}

/**
 * Checks and records rate limits for email verification OTP dispatch:
 * 1. 60-second cooldown per email address
 * 2. Max 5 verification emails per hour per email address
 * 3. Max 10 verification emails per hour per client IP
 * 4. Global daily cap on verification emails across the system (default: 100)
 */
export async function checkAndIncrementVerificationRateLimit({
  email,
  ip,
}: {
  email: string;
  ip?: string;
}): Promise<VerificationRateLimitResult> {
  const now = new Date();
  const cleanEmail = email.trim().toLowerCase();
  const masked = maskEmail(cleanEmail);
  const cleanIp = ip ? ip.trim().replace(/^::ffff:/, "") : undefined;

  const cooldownKey = `cooldown:${cleanEmail}`;
  const emailKey = `email:${cleanEmail}`;
  const ipKey = cleanIp && cleanIp !== "unknown" ? `ip:${cleanIp}` : undefined;
  const todayUtc = now.toISOString().slice(0, 10);
  const globalKey = `global:${todayUtc}`;

  return await db.transaction(async (tx) => {
    // 1. Check Resend Cooldown (60 seconds)
    const [cooldownRow] = await tx
      .select({ expiresAt: verificationRateLimits.expiresAt })
      .from(verificationRateLimits)
      .where(eq(verificationRateLimits.key, cooldownKey));

    if (cooldownRow && cooldownRow.expiresAt.getTime() > now.getTime()) {
      const remainingSec = Math.max(
        1,
        Math.ceil((cooldownRow.expiresAt.getTime() - now.getTime()) / 1000)
      );
      log.warn("[verification/rate-limit] Cooldown active for email", {
        email: masked,
        retryAfterSeconds: remainingSec,
      });
      return {
        allowed: false,
        reason: "cooldown",
        retryAfterSeconds: remainingSec,
        message: `Please wait ${remainingSec} seconds before requesting a new code.`,
      };
    }

    // 2. Check Per-Email Hourly Limit (max 5/hr)
    const [emailRow] = await tx
      .select({
        count: verificationRateLimits.count,
        expiresAt: verificationRateLimits.expiresAt,
      })
      .from(verificationRateLimits)
      .where(eq(verificationRateLimits.key, emailKey));

    if (emailRow && emailRow.expiresAt.getTime() > now.getTime()) {
      if (emailRow.count >= EMAIL_HOURLY_LIMIT) {
        log.warn("[verification/rate-limit] Per-email hourly limit exceeded", {
          email: masked,
          count: emailRow.count,
          limit: EMAIL_HOURLY_LIMIT,
        });
        return {
          allowed: false,
          reason: "email_hourly",
          message: "Too many verification requests for this email. Please try again later.",
        };
      }
    }

    // 3. Check Per-IP Hourly Limit (max 10/hr)
    if (ipKey) {
      const [ipRow] = await tx
        .select({
          count: verificationRateLimits.count,
          expiresAt: verificationRateLimits.expiresAt,
        })
        .from(verificationRateLimits)
        .where(eq(verificationRateLimits.key, ipKey));

      if (ipRow && ipRow.expiresAt.getTime() > now.getTime()) {
        if (ipRow.count >= IP_HOURLY_LIMIT) {
          log.warn("[verification/rate-limit] Per-IP hourly limit exceeded", {
            ip: cleanIp,
            count: ipRow.count,
            limit: IP_HOURLY_LIMIT,
          });
          return {
            allowed: false,
            reason: "ip_hourly",
            message: "Too many verification requests from your network. Please try again later.",
          };
        }
      }
    }

    // 4. Check Global Daily Cap (default 100/day)
    const [globalRow] = await tx
      .select({
        count: verificationRateLimits.count,
        expiresAt: verificationRateLimits.expiresAt,
      })
      .from(verificationRateLimits)
      .where(eq(verificationRateLimits.key, globalKey));

    if (globalRow && globalRow.expiresAt.getTime() > now.getTime()) {
      if (globalRow.count >= env.EMAIL_DAILY_CAP) {
        log.warn("[verification/rate-limit] Global daily verification email cap reached", {
          count: globalRow.count,
          cap: env.EMAIL_DAILY_CAP,
        });
        return {
          allowed: false,
          reason: "global_daily",
          message: "We're sending a lot of emails right now. Please try again later.",
        };
      }
    }

    // All checks passed -> Record/Increment in Database
    // A. Set Cooldown row
    const cooldownExpiresAt = new Date(now.getTime() + COOLDOWN_SECONDS * 1000);
    await tx
      .insert(verificationRateLimits)
      .values({
        key: cooldownKey,
        count: 1,
        lastSentAt: now,
        expiresAt: cooldownExpiresAt,
      })
      .onConflictDoUpdate({
        target: verificationRateLimits.key,
        set: {
          count: 1,
          lastSentAt: now,
          expiresAt: cooldownExpiresAt,
        },
      });

    // B. Increment / Set Email hourly row
    if (emailRow && emailRow.expiresAt.getTime() > now.getTime()) {
      await tx
        .update(verificationRateLimits)
        .set({
          count: sql`${verificationRateLimits.count} + 1`,
          lastSentAt: now,
        })
        .where(eq(verificationRateLimits.key, emailKey));
    } else {
      const emailExpiresAt = new Date(now.getTime() + EMAIL_HOURLY_WINDOW_MS);
      await tx
        .insert(verificationRateLimits)
        .values({
          key: emailKey,
          count: 1,
          lastSentAt: now,
          expiresAt: emailExpiresAt,
        })
        .onConflictDoUpdate({
          target: verificationRateLimits.key,
          set: {
            count: 1,
            lastSentAt: now,
            expiresAt: emailExpiresAt,
          },
        });
    }

    // C. Increment / Set IP hourly row
    if (ipKey) {
      const [existingIpRow] = await tx
        .select({ expiresAt: verificationRateLimits.expiresAt })
        .from(verificationRateLimits)
        .where(eq(verificationRateLimits.key, ipKey));

      if (existingIpRow && existingIpRow.expiresAt.getTime() > now.getTime()) {
        await tx
          .update(verificationRateLimits)
          .set({
            count: sql`${verificationRateLimits.count} + 1`,
            lastSentAt: now,
          })
          .where(eq(verificationRateLimits.key, ipKey));
      } else {
        const ipExpiresAt = new Date(now.getTime() + IP_HOURLY_WINDOW_MS);
        await tx
          .insert(verificationRateLimits)
          .values({
            key: ipKey,
            count: 1,
            lastSentAt: now,
            expiresAt: ipExpiresAt,
          })
          .onConflictDoUpdate({
            target: verificationRateLimits.key,
            set: {
              count: 1,
              lastSentAt: now,
              expiresAt: ipExpiresAt,
            },
          });
      }
    }

    // D. Increment / Set Global daily row
    if (globalRow && globalRow.expiresAt.getTime() > now.getTime()) {
      await tx
        .update(verificationRateLimits)
        .set({
          count: sql`${verificationRateLimits.count} + 1`,
          lastSentAt: now,
        })
        .where(eq(verificationRateLimits.key, globalKey));
    } else {
      const globalExpiresAt = new Date(now.getTime() + GLOBAL_DAILY_WINDOW_MS);
      await tx
        .insert(verificationRateLimits)
        .values({
          key: globalKey,
          count: 1,
          lastSentAt: now,
          expiresAt: globalExpiresAt,
        })
        .onConflictDoUpdate({
          target: verificationRateLimits.key,
          set: {
            count: 1,
            lastSentAt: now,
            expiresAt: globalExpiresAt,
          },
        });
    }

    return { allowed: true };
  });
}
