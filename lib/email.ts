import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { maskEmail } from "@/lib/waitlist";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  devCode?: string;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Sends a transactional email using Resend's REST API with native fetch.
 * - Redacts sensitive data in logs (only logs masked recipient, outcome, and duration).
 * - Never returns raw provider errors to callers.
 * - Falls back to server console output in development when RESEND_API_KEY is not configured.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  devCode,
}: SendEmailOptions): Promise<SendEmailResult> {
  const startTime = Date.now();
  const masked = maskEmail(to);

  // In development ONLY, if no Resend API key is configured, log code to server console for testing
  if (!env.RESEND_API_KEY) {
    if (env.NODE_ENV !== "production") {
      const codeToPrint = devCode || text.match(/\b\d{6}\b/)?.[0] || "[NO_CODE_FOUND]";
      console.log("\n========================================================");
      console.log(`[DEV EMAIL] Recipient : ${masked}`);
      console.log(`[DEV EMAIL] Subject   : ${subject}`);
      console.log(`[DEV EMAIL] Code      : ${codeToPrint}`);
      console.log("========================================================\n");

      log.info("[email] Dev email simulated (no RESEND_API_KEY)", {
        email: masked,
        outcome: "dev_simulated",
        durationMs: Date.now() - startTime,
      });

      return { success: true, id: `dev-${Date.now()}` };
    }

    log.error("[email] RESEND_API_KEY is missing in production", {
      email: masked,
      outcome: "missing_api_key",
      durationMs: Date.now() - startTime,
    });
    return { success: false, error: "Email delivery service unavailable" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [to],
        subject,
        html,
        text,
      }),
    });

    const durationMs = Date.now() - startTime;

    if (!res.ok) {
      log.error("[email] Resend API returned error status", {
        email: masked,
        status: res.status,
        outcome: "provider_error",
        durationMs,
      });
      return { success: false, error: "Failed to send email" };
    }

    const data = (await res.json().catch(() => null)) as { id?: string } | null;
    log.info("[email] Email sent successfully", {
      email: masked,
      outcome: "success",
      durationMs,
    });

    return { success: true, id: data?.id };
  } catch {
    const durationMs = Date.now() - startTime;
    log.error("[email] Network error while contacting Resend", {
      email: masked,
      outcome: "network_error",
      durationMs,
    });
    return { success: false, error: "Failed to send email" };
  }
}
