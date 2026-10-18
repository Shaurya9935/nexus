import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { corsair } from "@/lib/corsair";
import {
  corsairAccounts,
  corsairEntities,
  corsairEvents,
  corsairPermissions,
} from "@/db/corsair";
import { conversations, chatMessages } from "@/db/conversation";
import { user, session, account } from "@/db/auth";
import { userOnboarding } from "@/db/onboarding";
import { aiUsage } from "@/db/ai-usage";
import { waitlistEntries } from "@/db/waitlist";
import { log } from "@/lib/logger";

export interface RevocationResult {
  revoked: boolean;
  error?: string;
}

export interface DeletedCounts {
  corsairAccounts: number;
  corsairEntities: number;
  corsairEvents: number;
  corsairPermissions: number;
  conversations: number;
  chatMessages: number;
  onboarding?: number;
  aiUsage?: number;
  waitlist?: number;
  sessions?: number;
  accounts?: number;
  users?: number;
}

/**
 * Verifies whether the user has a password and whether the supplied password is correct.
 * Social-only users have no password in the account table.
 */
export async function verifyUserPassword(
  userId: string,
  password?: string
): Promise<{ ok: boolean; hasPassword: boolean; error?: string }> {
  const accounts = await db
    .select({
      id: account.id,
      providerId: account.providerId,
      password: account.password,
    })
    .from(account)
    .where(eq(account.userId, userId));

  const credentialAccount = accounts.find((a) => a.password !== null && a.password !== undefined);

  if (!credentialAccount) {
    // User signed up with a social provider and has no password
    return { ok: true, hasPassword: false };
  }

  if (!password || typeof password !== "string") {
    return { ok: false, hasPassword: true, error: "Password is required to confirm this action" };
  }

  try {
    const ctx = await auth.$context;
    const isValid = await ctx.password.verify({
      password,
      hash: credentialAccount.password as string,
    });

    if (!isValid) {
      return { ok: false, hasPassword: true, error: "Incorrect password" };
    }

    return { ok: true, hasPassword: true };
  } catch (err) {
    log.error("[account] Password verification failed", { error: err });
    return { ok: false, hasPassword: true, error: "Failed to verify password" };
  }
}

/**
 * Revokes Google OAuth tokens for all connected Google integrations.
 * Revocation failure is recorded but does not block the deletion process.
 */
export async function revokeGoogleTokens(
  tenantId: string
): Promise<Record<string, RevocationResult>> {
  const results: Record<string, RevocationResult> = {};
  const plugins = ["gmail", "googlecalendar"] as const;

  for (const plugin of plugins) {
    try {
      const tenantCorsair = corsair.withTenant(tenantId);
      const pluginInstance = (tenantCorsair as Record<string, unknown>)[plugin] as
        | { keys?: { get_refresh_token?: () => Promise<string | null>; get_access_token?: () => Promise<string | null> } }
        | undefined;

      if (!pluginInstance?.keys) {
        continue;
      }

      let tokenToRevoke: string | null = null;
      if (typeof pluginInstance.keys.get_refresh_token === "function") {
        tokenToRevoke = await pluginInstance.keys.get_refresh_token().catch(() => null);
      }
      if (!tokenToRevoke && typeof pluginInstance.keys.get_access_token === "function") {
        tokenToRevoke = await pluginInstance.keys.get_access_token().catch(() => null);
      }

      if (tokenToRevoke) {
        const revokeRes = await fetch(
          `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokenToRevoke)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
          }
        );

        if (revokeRes.ok) {
          results[plugin] = { revoked: true };
        } else {
          const errText = await revokeRes.text().catch(() => "Unknown error");
          results[plugin] = { revoked: false, error: `Google returned ${revokeRes.status}: ${errText}` };
        }
      } else {
        results[plugin] = { revoked: false, error: "No OAuth token found to revoke" };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results[plugin] = { revoked: false, error: msg };
    }
  }

  return results;
}

/**
 * Deletes all stored and synced user data (entities, events, accounts, permissions, conversations, messages)
 * in a single atomic database transaction.
 * Retains user row, auth sessions, and auth credentials.
 */
export async function deleteUserData(
  userId: string
): Promise<{ deletedCounts: DeletedCounts; revocations: Record<string, RevocationResult> }> {
  // 1. Revoke tokens with external providers first
  const revocations = await revokeGoogleTokens(userId);

  // 2. Perform DB deletion in a single transaction
  const deletedCounts: DeletedCounts = {
    corsairAccounts: 0,
    corsairEntities: 0,
    corsairEvents: 0,
    corsairPermissions: 0,
    conversations: 0,
    chatMessages: 0,
  };

  await db.transaction(async (tx) => {
    // A. Corsair Accounts & Entities/Events
    const userAccs = await tx
      .select({ id: corsairAccounts.id })
      .from(corsairAccounts)
      .where(eq(corsairAccounts.tenantId, userId));

    if (userAccs.length > 0) {
      const accountIds = userAccs.map((a) => a.id);

      const entRes = await tx
        .delete(corsairEntities)
        .where(inArray(corsairEntities.accountId, accountIds))
        .returning({ id: corsairEntities.id });
      deletedCounts.corsairEntities = entRes.length;

      const evRes = await tx
        .delete(corsairEvents)
        .where(inArray(corsairEvents.accountId, accountIds))
        .returning({ id: corsairEvents.id });
      deletedCounts.corsairEvents = evRes.length;

      const accRes = await tx
        .delete(corsairAccounts)
        .where(eq(corsairAccounts.tenantId, userId))
        .returning({ id: corsairAccounts.id });
      deletedCounts.corsairAccounts = accRes.length;
    }

    // B. Corsair Permissions
    const permRes = await tx
      .delete(corsairPermissions)
      .where(eq(corsairPermissions.tenantId, userId))
      .returning({ id: corsairPermissions.id });
    deletedCounts.corsairPermissions = permRes.length;

    // C. Conversations & Chat Messages
    const userConvs = await tx
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.userId, userId));

    if (userConvs.length > 0) {
      const convIds = userConvs.map((c) => c.id);

      const msgRes = await tx
        .delete(chatMessages)
        .where(inArray(chatMessages.conversationId, convIds))
        .returning({ id: chatMessages.id });
      deletedCounts.chatMessages = msgRes.length;

      const convRes = await tx
        .delete(conversations)
        .where(eq(conversations.userId, userId))
        .returning({ id: conversations.id });
      deletedCounts.conversations = convRes.length;
    }

    // D. Onboarding
    const onbRes = await tx
      .delete(userOnboarding)
      .where(eq(userOnboarding.userId, userId))
      .returning({ id: userOnboarding.id });
    deletedCounts.onboarding = onbRes.length;

    // E. AI Usage
    const aiUsageRes = await tx
      .delete(aiUsage)
      .where(eq(aiUsage.userId, userId))
      .returning({ id: aiUsage.id });
    deletedCounts.aiUsage = aiUsageRes.length;

    // F. Waitlist entries
    const [userForData] = await tx
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, userId));
    if (userForData?.email) {
      const wlRes = await tx
        .delete(waitlistEntries)
        .where(eq(waitlistEntries.email, userForData.email.toLowerCase()))
        .returning({ id: waitlistEntries.id });
      deletedCounts.waitlist = wlRes.length;
    }
  });

  log.info("[account] deleteUserData completed", {
    userId,
    counts: deletedCounts,
    revocations,
  });

  return { deletedCounts, revocations };
}

/**
 * Deletes all user data AND deletes the auth sessions, accounts, and user row.
 */
export async function deleteFullAccount(
  userId: string
): Promise<{ deletedCounts: DeletedCounts; revocations: Record<string, RevocationResult> }> {
  // 1. Revoke tokens with external providers
  const revocations = await revokeGoogleTokens(userId);

  // 2. Perform DB deletion in a single atomic transaction
  const deletedCounts: DeletedCounts = {
    corsairAccounts: 0,
    corsairEntities: 0,
    corsairEvents: 0,
    corsairPermissions: 0,
    conversations: 0,
    chatMessages: 0,
    sessions: 0,
    accounts: 0,
    users: 0,
  };

  await db.transaction(async (tx) => {
    // A. Corsair Accounts & Entities/Events
    const userAccs = await tx
      .select({ id: corsairAccounts.id })
      .from(corsairAccounts)
      .where(eq(corsairAccounts.tenantId, userId));

    if (userAccs.length > 0) {
      const accountIds = userAccs.map((a) => a.id);

      const entRes = await tx
        .delete(corsairEntities)
        .where(inArray(corsairEntities.accountId, accountIds))
        .returning({ id: corsairEntities.id });
      deletedCounts.corsairEntities = entRes.length;

      const evRes = await tx
        .delete(corsairEvents)
        .where(inArray(corsairEvents.accountId, accountIds))
        .returning({ id: corsairEvents.id });
      deletedCounts.corsairEvents = evRes.length;

      const accRes = await tx
        .delete(corsairAccounts)
        .where(eq(corsairAccounts.tenantId, userId))
        .returning({ id: corsairAccounts.id });
      deletedCounts.corsairAccounts = accRes.length;
    }

    // B. Corsair Permissions
    const permRes = await tx
      .delete(corsairPermissions)
      .where(eq(corsairPermissions.tenantId, userId))
      .returning({ id: corsairPermissions.id });
    deletedCounts.corsairPermissions = permRes.length;

    // C. Conversations & Chat Messages
    const userConvs = await tx
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.userId, userId));

    if (userConvs.length > 0) {
      const convIds = userConvs.map((c) => c.id);

      const msgRes = await tx
        .delete(chatMessages)
        .where(inArray(chatMessages.conversationId, convIds))
        .returning({ id: chatMessages.id });
      deletedCounts.chatMessages = msgRes.length;

      const convRes = await tx
        .delete(conversations)
        .where(eq(conversations.userId, userId))
        .returning({ id: conversations.id });
      deletedCounts.conversations = convRes.length;
    }

    // D. Onboarding
    const onbRes = await tx
      .delete(userOnboarding)
      .where(eq(userOnboarding.userId, userId))
      .returning({ id: userOnboarding.id });
    deletedCounts.onboarding = onbRes.length;

    // E. AI Usage
    const aiUsageRes = await tx
      .delete(aiUsage)
      .where(eq(aiUsage.userId, userId))
      .returning({ id: aiUsage.id });
    deletedCounts.aiUsage = aiUsageRes.length;

    // F. Auth Sessions
    const sessRes = await tx
      .delete(session)
      .where(eq(session.userId, userId))
      .returning({ id: session.id });
    deletedCounts.sessions = sessRes.length;

    // E. Auth Accounts
    const accRes = await tx
      .delete(account)
      .where(eq(account.userId, userId))
      .returning({ id: account.id });
    deletedCounts.accounts = accRes.length;

    // F. Waitlist entries
    const [userForFull] = await tx
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, userId));
    if (userForFull?.email) {
      const wlRes = await tx
        .delete(waitlistEntries)
        .where(eq(waitlistEntries.email, userForFull.email.toLowerCase()))
        .returning({ id: waitlistEntries.id });
      deletedCounts.waitlist = wlRes.length;
    }

    // G. User row
    const userRes = await tx
      .delete(user)
      .where(eq(user.id, userId))
      .returning({ id: user.id });
    deletedCounts.users = userRes.length;
  });

  log.info("[account] deleteFullAccount completed", {
    userId,
    counts: deletedCounts,
    revocations,
  });

  return { deletedCounts, revocations };
}
