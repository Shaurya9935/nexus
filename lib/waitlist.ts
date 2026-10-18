import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { waitlistEntries, waitlistRateLimits } from "@/db/waitlist";
import { env, isAllowedEmail } from "@/lib/env";
import { log } from "@/lib/logger";

const IP_LIMIT_MAX = 5;
const IP_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const GLOBAL_LIMIT_MAX = 200;
const GLOBAL_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "***";
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const firstChar = local.charAt(0);
  return `${firstChar}***@${domain}`;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: "ip" | "global";
}

/**
 * Checks and increments DB-backed rate limits for waitlist submissions:
 * - Max 5 submissions per IP per hour.
 * - Global cap of 200 submissions per day.
 */
export async function checkWaitlistRateLimit(ip: string): Promise<RateLimitResult> {
  const now = new Date();
  const cleanIp = ip.trim().replace(/^::ffff:/, ""); // Normalize IPv4-mapped IPv6
  const ipKey = `ip:${cleanIp}`;
  const todayUtc = now.toISOString().slice(0, 10);
  const globalKey = `global:${todayUtc}`;

  return await db.transaction(async (tx) => {
    // 1. Check IP rate limit
    const [ipRow] = await tx
      .select({ count: waitlistRateLimits.count, expiresAt: waitlistRateLimits.expiresAt })
      .from(waitlistRateLimits)
      .where(eq(waitlistRateLimits.key, ipKey));

    if (ipRow && ipRow.expiresAt.getTime() > now.getTime()) {
      if (ipRow.count >= IP_LIMIT_MAX) {
        return { allowed: false, reason: "ip" };
      }
      await tx
        .update(waitlistRateLimits)
        .set({ count: sql`${waitlistRateLimits.count} + 1` })
        .where(eq(waitlistRateLimits.key, ipKey));
    } else {
      const expiresAt = new Date(now.getTime() + IP_LIMIT_WINDOW_MS);
      await tx
        .insert(waitlistRateLimits)
        .values({ key: ipKey, count: 1, expiresAt })
        .onConflictDoUpdate({
          target: waitlistRateLimits.key,
          set: { count: 1, expiresAt },
        });
    }

    // 2. Check Global daily limit
    const [globalRow] = await tx
      .select({ count: waitlistRateLimits.count, expiresAt: waitlistRateLimits.expiresAt })
      .from(waitlistRateLimits)
      .where(eq(waitlistRateLimits.key, globalKey));

    if (globalRow && globalRow.expiresAt.getTime() > now.getTime()) {
      if (globalRow.count >= GLOBAL_LIMIT_MAX) {
        return { allowed: false, reason: "global" };
      }
      await tx
        .update(waitlistRateLimits)
        .set({ count: sql`${waitlistRateLimits.count} + 1` })
        .where(eq(waitlistRateLimits.key, globalKey));
    } else {
      const expiresAt = new Date(now.getTime() + GLOBAL_LIMIT_WINDOW_MS);
      await tx
        .insert(waitlistRateLimits)
        .values({ key: globalKey, count: 1, expiresAt })
        .onConflictDoUpdate({
          target: waitlistRateLimits.key,
          set: { count: 1, expiresAt },
        });
    }

    return { allowed: true };
  });
}

/**
 * Idempotently inserts a new waitlist entry.
 * If the email already exists in any status, it returns success without error.
 */
export async function submitWaitlistEntry({
  email,
  source = "landing",
  note,
}: {
  email: string;
  source?: string;
  note?: string;
}): Promise<{ success: boolean; created: boolean }> {
  const cleanEmail = email.trim().toLowerCase();

  const [existing] = await db
    .select({ id: waitlistEntries.id })
    .from(waitlistEntries)
    .where(eq(waitlistEntries.email, cleanEmail))
    .limit(1);

  if (existing) {
    log.info("[waitlist] Existing entry submitted (idempotent)", {
      email: maskEmail(cleanEmail),
      id: existing.id,
    });
    return { success: true, created: false };
  }

  const [inserted] = await db
    .insert(waitlistEntries)
    .values({
      email: cleanEmail,
      status: "pending",
      source,
      note: note || null,
    })
    .onConflictDoNothing()
    .returning({ id: waitlistEntries.id });

  log.info("[waitlist] New entry added", {
    email: maskEmail(cleanEmail),
    id: inserted?.id,
  });

  return { success: true, created: Boolean(inserted) };
}

/**
 * Checks if an email is permitted to register and sign in:
 * - Returns true if in ALLOWED_EMAILS (owner fallback).
 * - Returns true if in waitlist_entries with status === 'approved'.
 * - Returns false otherwise.
 */
export async function isEmailPermittedToAccess(email?: string | null): Promise<boolean> {
  // If open signup mode is active, everyone is permitted
  if (env.SIGNUP_MODE === "open") {
    return true;
  }

  if (!email || typeof email !== "string") return false;
  const cleanEmail = email.trim().toLowerCase();

  // 1. Owner / config fallback bypass
  if (isAllowedEmail(cleanEmail)) {
    return true;
  }

  // 2. Database waitlist check
  const [entry] = await db
    .select({ status: waitlistEntries.status })
    .from(waitlistEntries)
    .where(eq(waitlistEntries.email, cleanEmail))
    .limit(1);

  return entry?.status === "approved";
}

/**
 * Sends an optional invitation email via Resend if RESEND_API_KEY and MAIL_FROM are configured.
 */
export async function sendInviteEmail(
  entryId: string,
  email: string
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
    return { success: false, skipped: true, error: "Resend email credentials not configured" };
  }

  const cleanEmail = email.trim().toLowerCase();
  const signupUrl = `${env.APP_URL}/register`;

  const textContent = `You're in!

Your early access request for Nexus has been approved. You can now create your account and get started:

${signupUrl}

Important Google OAuth Notice:
Because Nexus is currently in private beta test mode, Google may show an "unverified app" screen when connecting your account. Click "Advanced" and proceed to grant permissions.

--
You received this invitation because you requested early access at Nexus.
`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>You're in! Welcome to Nexus</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7F5F0; color: #1A1917; padding: 40px 20px; margin: 0;">
  <table align="center" width="100%" max-width="560px" style="max-width: 560px; background: #FFFFFF; border-radius: 14px; border: 1px solid #E8E4DC; padding: 36px 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
    <tr>
      <td>
        <h1 style="font-size: 22px; font-weight: 600; margin-top: 0; color: #1A1917; letter-spacing: -0.02em;">You're in! Welcome to Nexus.</h1>
        <p style="font-size: 14px; line-height: 1.6; color: #6B6762; margin-top: 14px;">
          Your early access request has been approved. You can now create your account and run your inbox and calendar from one command center.
        </p>
        <div style="margin: 28px 0;">
          <a href="${signupUrl}" style="background-color: #5046B8; color: #FFFFFF; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; display: inline-block;">
            Create your account &rarr;
          </a>
        </div>
        <div style="background-color: #FAF8F4; border-left: 3px solid #5046B8; padding: 12px 16px; border-radius: 6px; margin: 24px 0;">
          <p style="font-size: 12px; line-height: 1.5; color: #6B6762; margin: 0;">
            <strong style="color: #1A1917;">Google Connection Notice:</strong> Because Nexus is currently in private beta testing, Google may present an "unverified app" screen when you connect Gmail or Google Calendar. Click <em>Advanced</em> &rarr; <em>Go to Nexus</em> to authorize.
          </p>
        </div>
        <hr style="border: none; border-top: 1px solid #E8E4DC; margin: 28px 0 16px;">
        <p style="font-size: 11px; color: #9B9691; margin: 0;">
          You received this email because you requested early access on the Nexus landing page.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [cleanEmail],
        subject: "You're in! Welcome to Nexus early access",
        text: textContent,
        html: htmlContent,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Unknown Resend error");
      log.error("[waitlist/invite] Resend API error", {
        status: res.status,
        error: errText,
        email: maskEmail(cleanEmail),
      });
      return { success: false, error: `Resend returned ${res.status}: ${errText}` };
    }

    // Update invitedAt timestamp
    await db
      .update(waitlistEntries)
      .set({ invitedAt: new Date() })
      .where(eq(waitlistEntries.id, entryId));

    log.info("[waitlist/invite] Invite email sent successfully", {
      email: maskEmail(cleanEmail),
      entryId,
    });

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("[waitlist/invite] Failed to dispatch email", {
      error: msg,
      email: maskEmail(cleanEmail),
    });
    return { success: false, error: msg };
  }
}
