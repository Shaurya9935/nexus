import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { eq, desc, inArray, sql, and, or, ilike } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { waitlistEntries } from "@/db/waitlist";
import { user, session } from "@/db/auth";
import { env, isAdminEmail } from "@/lib/env";
import { sendInviteEmail, maskEmail } from "@/lib/waitlist";
import { log } from "@/lib/logger";

async function verifyAdminSession() {
  const reqHeaders = await headers();
  const sessionData = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!sessionData?.user?.email || !isAdminEmail(sessionData.user.email)) {
    return null;
  }

  return sessionData;
}

export async function GET(request: Request) {
  const sessionData = await verifyAdminSession();
  if (!sessionData) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const searchParam = searchParams.get("search")?.trim().toLowerCase();

    // 1. Fetch counts
    const countRows = await db
      .select({
        status: waitlistEntries.status,
        count: sql<number>`count(*)::int`,
      })
      .from(waitlistEntries)
      .groupBy(waitlistEntries.status);

    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;

    for (const row of countRows) {
      if (row.status === "pending") pendingCount = row.count;
      else if (row.status === "approved") approvedCount = row.count;
      else if (row.status === "rejected") rejectedCount = row.count;
    }

    const totalCount = pendingCount + approvedCount + rejectedCount;

    // 2. Build filter conditions
    const conditions = [];

    if (statusParam && ["pending", "approved", "rejected"].includes(statusParam)) {
      conditions.push(eq(waitlistEntries.status, statusParam as "pending" | "approved" | "rejected"));
    }

    if (searchParam) {
      conditions.push(
        or(
          ilike(waitlistEntries.email, `%${searchParam}%`),
          ilike(waitlistEntries.note, `%${searchParam}%`)
        )
      );
    }

    const entries = await db
      .select()
      .from(waitlistEntries)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(waitlistEntries.createdAt));

    return NextResponse.json({
      entries,
      counts: {
        total: totalCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
      resendConfigured: Boolean(env.RESEND_API_KEY && env.MAIL_FROM),
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error("[admin/waitlist] Failed to fetch waitlist entries", { error: errorMsg });
    return NextResponse.json({ error: "Failed to load waitlist entries" }, { status: 500 });
  }
}

const patchSchema = z.object({
  ids: z.array(z.string()).min(1, "At least one ID is required"),
  status: z.enum(["approved", "rejected", "pending"]),
  sendInvite: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const sessionData = await verifyAdminSession();
  if (!sessionData) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const { ids, status: newStatus, sendInvite } = parsed.data;

    // Fetch existing entries to know emails
    const targets = await db
      .select({ id: waitlistEntries.id, email: waitlistEntries.email })
      .from(waitlistEntries)
      .where(inArray(waitlistEntries.id, ids));

    if (targets.length === 0) {
      return NextResponse.json({ error: "No matching entries found" }, { status: 404 });
    }

    const now = new Date();
    const updateValues: Record<string, unknown> = {
      status: newStatus,
    };

    if (newStatus === "approved") {
      updateValues.approvedAt = now;
    } else {
      updateValues.approvedAt = null;
    }

    await db
      .update(waitlistEntries)
      .set(updateValues)
      .where(inArray(waitlistEntries.id, ids));

    // If revoked (approved -> pending or rejected), invalidate sessions for existing users
    if (newStatus === "pending" || newStatus === "rejected") {
      for (const target of targets) {
        const [existingUser] = await db
          .select({ id: user.id })
          .from(user)
          .where(eq(user.email, target.email.toLowerCase()));

        if (existingUser) {
          await db.delete(session).where(eq(session.userId, existingUser.id));
          log.info("[admin/waitlist] Invalidated sessions for revoked user", {
            email: maskEmail(target.email),
            userId: existingUser.id,
          });
        }
      }
    }

    // If approved and sendInvite is requested (or Resend configured), dispatch email
    let invitesSent = 0;
    if (newStatus === "approved" && (sendInvite || (env.RESEND_API_KEY && env.MAIL_FROM))) {
      for (const target of targets) {
        const inviteRes = await sendInviteEmail(target.id, target.email);
        if (inviteRes.success) {
          invitesSent++;
        }
      }
    }

    log.info("[admin/waitlist] Updated waitlist entries", {
      adminEmail: maskEmail(sessionData.user.email),
      count: targets.length,
      newStatus,
      invitesSent,
    });

    return NextResponse.json({
      success: true,
      updatedCount: targets.length,
      invitesSent,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error("[admin/waitlist] Failed to update waitlist entries", { error: errorMsg });
    return NextResponse.json({ error: "Failed to update waitlist entries" }, { status: 500 });
  }
}

const deleteSchema = z.object({
  ids: z.array(z.string()).min(1, "At least one ID is required"),
});

export async function DELETE(request: Request) {
  const sessionData = await verifyAdminSession();
  if (!sessionData) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const { ids } = parsed.data;

    const deleted = await db
      .delete(waitlistEntries)
      .where(inArray(waitlistEntries.id, ids))
      .returning({ id: waitlistEntries.id });

    log.info("[admin/waitlist] Deleted waitlist entries", {
      adminEmail: maskEmail(sessionData.user.email),
      deletedCount: deleted.length,
    });

    return NextResponse.json({
      success: true,
      deletedCount: deleted.length,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error("[admin/waitlist] Failed to delete waitlist entries", { error: errorMsg });
    return NextResponse.json({ error: "Failed to delete waitlist entries" }, { status: 500 });
  }
}
