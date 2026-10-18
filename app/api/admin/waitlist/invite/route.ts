import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { waitlistEntries } from "@/db/waitlist";
import { isAdminEmail } from "@/lib/env";
import { sendInviteEmail, maskEmail } from "@/lib/waitlist";
import { log } from "@/lib/logger";

const inviteSchema = z.object({
  id: z.string().min(1, "Entry ID is required"),
});

export async function POST(request: Request) {
  const reqHeaders = await headers();
  const sessionData = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!sessionData?.user?.email || !isAdminEmail(sessionData.user.email)) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { id } = parsed.data;

    const [entry] = await db
      .select({ id: waitlistEntries.id, email: waitlistEntries.email, status: waitlistEntries.status })
      .from(waitlistEntries)
      .where(eq(waitlistEntries.id, id))
      .limit(1);

    if (!entry) {
      return NextResponse.json({ error: "Waitlist entry not found" }, { status: 404 });
    }

    if (entry.status !== "approved") {
      return NextResponse.json(
        { error: "Cannot send invite to unapproved entry. Approve first." },
        { status: 400 }
      );
    }

    const result = await sendInviteEmail(entry.id, entry.email);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send invite email" },
        { status: 500 }
      );
    }

    log.info("[admin/waitlist/invite] Manual invite sent", {
      adminEmail: maskEmail(sessionData.user.email),
      recipient: maskEmail(entry.email),
      id: entry.id,
    });

    return NextResponse.json({ success: true, message: "Invite email sent successfully" });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error("[admin/waitlist/invite] Error sending invite", { error: errorMsg });
    return NextResponse.json({ error: "Failed to send invite" }, { status: 500 });
  }
}
