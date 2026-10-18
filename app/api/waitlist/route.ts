import { NextResponse } from "next/server";
import { z } from "zod";
import { PLACEHOLDER_DOMAINS } from "@/lib/validation/email";
import { checkWaitlistRateLimit, submitWaitlistEntry, maskEmail } from "@/lib/waitlist";
import { log } from "@/lib/logger";

const MAX_BODY_BYTES = 1024; // 1 KB max request body

const waitlistSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Email must be 254 characters or fewer")
    .email("Enter a valid email address")
    .refine((val) => {
      const parts = val.split("@");
      if (parts.length !== 2) return false;
      const domain = parts[1];
      return !PLACEHOLDER_DOMAINS.has(domain);
    }, {
      message: "Please enter a valid, active email address.",
    }),
  website: z.string().optional().default(""), // Honeypot field
});

export async function POST(request: Request) {
  try {
    // 1. Check Content-Length if provided
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
      log.warn("[waitlist/submit] Request body exceeds 1 KB limit", {
        contentLength,
      });
      return NextResponse.json(
        { error: "Payload too large. Request body must be under 1 KB." },
        { status: 413 }
      );
    }

    // 2. Read body text and verify byte size
    const rawText = await request.text().catch(() => "");
    if (Buffer.byteLength(rawText, "utf8") > MAX_BODY_BYTES) {
      log.warn("[waitlist/submit] Request payload body exceeded 1 KB", {
        bytes: Buffer.byteLength(rawText, "utf8"),
      });
      return NextResponse.json(
        { error: "Payload too large. Request body must be under 1 KB." },
        { status: 413 }
      );
    }

    // 3. Rate limiting check (DB-backed: 5/IP/hr, 200 global/day)
    const forwarded = request.headers.get("x-forwarded-for");
    const clientIp = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";

    const rateResult = await checkWaitlistRateLimit(clientIp);
    if (!rateResult.allowed) {
      log.warn("[waitlist/submit] Rate limit exceeded", {
        outcome: "rate_limited",
        reason: rateResult.reason,
      });
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    // 4. Parse JSON
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const validation = waitlistSchema.safeParse(parsedBody);
    if (!validation.success) {
      const firstIssue = validation.error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message || "Invalid input." },
        { status: 400 }
      );
    }

    const { email, website } = validation.data;

    // 5. Honeypot check: If website is filled out, silently discard and return success
    if (website && website.trim().length > 0) {
      log.info("[waitlist/submit] Honeypot triggered", {
        outcome: "honeypot_ignored",
      });
      // Non-enumerating success response
      return NextResponse.json({
        success: true,
        message: "You're on the list. We'll email you when your invite is ready.",
      });
    }

    // 6. Idempotent save in waitlist_entries
    await submitWaitlistEntry({ email, source: "landing" });

    log.info("[waitlist/submit] Waitlist submission processed", {
      outcome: "success",
      email: maskEmail(email),
    });

    return NextResponse.json({
      success: true,
      message: "You're on the list. We'll email you when your invite is ready.",
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error("[waitlist/submit] Internal error processing waitlist submission", {
      error: errorMsg,
    });
    return NextResponse.json(
      { error: "Something went wrong, try again." },
      { status: 500 }
    );
  }
}
