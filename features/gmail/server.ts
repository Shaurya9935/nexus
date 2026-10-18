import { getCorsairTenant } from "@/lib/corsair-client";
import { db } from "@/lib/db";
import { corsairAccounts, corsairEntities, corsairIntegrations } from "@/db/corsair";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import crypto from "crypto";
import { corsair, type TenantCorsair } from "@/lib/corsair";
import { log } from "@/lib/logger";
import type { EmailResult } from "./types";

export interface ThreadMessageItem {
  id: string;
  from: string;
  to?: string;
  date?: string;
  snippet?: string;
  bodyText?: string;
  bodyHtml?: string;
}

export interface EnrichedThread {
  id: string;
  entity_id: string;
  snippet: string;
  subject: string;
  from: string;
  createdAt: string;
  created_at: string;
  updated_at: string;
  unread: boolean;
  historyId?: string;
  messagesCount?: number;
  body?: string;
  bodyHtml?: string;
  messages?: ThreadMessageItem[];
  starred?: boolean;
  labelIds?: string[];
}

const GMAIL_SYNC_STATE_ENTITY_TYPE = "gmail_sync_state";
const GMAIL_SYNC_STATE_ENTITY_ID = "inbox";
const GMAIL_SYNC_INTERVAL_MS = 15 * 60 * 1000;

function decodeBase64Url(base64UrlStr: string): string {
  try {
    const base64 = base64UrlStr.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(base64, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

export interface ParsedBody {
  text?: string;
  html?: string;
}

export interface GmailHeader {
  name?: string;
  value?: string;
}

export interface GmailMessagePart {
  mimeType?: string;
  body?: {
    data?: string;
    size?: number;
  };
  parts?: GmailMessagePart[];
  headers?: GmailHeader[];
}

export interface GmailMessage {
  id?: string;
  threadId?: string;
  snippet?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: GmailMessagePart;
}

interface CachedThreadData {
  id?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  snippet?: string;
  subject?: string;
  from?: string;
  unread?: boolean;
  historyId?: string;
  messagesCount?: number;
  body?: string;
  bodyHtml?: string;
  messages?: ThreadMessageItem[];
  starred?: boolean;
  labelIds?: string[];
  [key: string]: unknown;
}

function getMessageHeader(message: GmailMessage | undefined, name: string): string | undefined {
  return message?.payload?.headers?.find(
    (header) => header.name?.toLowerCase() === name.toLowerCase()
  )?.value;
}

/** Prefer the latest message received by the user over a later sent reply. */
function getLatestIncomingMessage(messages: GmailMessage[]): GmailMessage | undefined {
  return [...messages].reverse().find((message) => !message.labelIds?.includes("SENT")) ?? messages.at(-1);
}

function getMessageTime(message: GmailMessage | undefined, fallback?: string): string {
  if (message?.internalDate) {
    const date = new Date(Number(message.internalDate));
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  if (fallback) {
    const date = new Date(fallback);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  return new Date().toISOString();
}

function hasUsableThreadMetadata(thread: EnrichedThread | undefined): boolean {
  return Boolean(
    thread &&
      thread.from &&
      thread.from !== "Unknown Sender" &&
      thread.from !== "Gmail User" &&
      thread.subject &&
      thread.subject !== "No Subject"
  );
}

export function parseMessagePart(part?: GmailMessagePart): ParsedBody {
  if (!part) return {};

  let text: string | undefined;
  let html: string | undefined;

  const mimeType = (part.mimeType || "").toLowerCase();
  const data = part.body?.data;

  if (data) {
    const decoded = decodeBase64Url(data);
    if (mimeType === "text/html") {
      html = decoded;
    } else if (mimeType === "text/plain") {
      text = decoded;
    }
  }

  if (Array.isArray(part.parts)) {
    for (const subPart of part.parts) {
      const parsed = parseMessagePart(subPart);
      if (parsed.html && !html) html = parsed.html;
      if (parsed.text && !text) text = parsed.text;
    }
  }

  return { text, html };
}

/**
 * Retrieve the Gmail account ID for a given user tenant ID from corsairAccounts.
 */
export async function getGmailAccountId(userId: string): Promise<string | null> {
  try {
    const accts = await db
      .select({ id: corsairAccounts.id })
      .from(corsairAccounts)
      .innerJoin(corsairIntegrations, eq(corsairAccounts.integrationId, corsairIntegrations.id))
      .where(
        and(
          eq(corsairAccounts.tenantId, userId),
          eq(corsairIntegrations.name, "gmail")
        )
      )
      .limit(1);
    return accts[0]?.id || null;
  } catch (err) {
    log.warn("Failed to get Gmail account ID", { error: err });
    return null;
  }
}

/**
 * Read cached threads directly from PostgreSQL corsair_entities.
 * Returns fully enriched threads with from/subject/unread/body intact.
 */
export async function getInboxThreadsFromDb(userId: string): Promise<EnrichedThread[]> {
  try {
    const accountId = await getGmailAccountId(userId);
    if (!accountId) return [];

    const rows = await db
      .select()
      .from(corsairEntities)
      .where(
        and(
          eq(corsairEntities.accountId, accountId),
          eq(corsairEntities.entityType, "threads")
        )
      )
      .orderBy(desc(corsairEntities.updatedAt));

    const threads: EnrichedThread[] = [];
    const seenThreadIds = new Set<string>();
    for (const row of rows) {
      const d = (row.data || {}) as CachedThreadData;
      const threadId = row.entityId || d.id || "";
      // Earlier development builds could create duplicate rows during
      // overlapping syncs. Prefer the newest version and hide older copies.
      if (!threadId || seenThreadIds.has(threadId)) continue;
      seenThreadIds.add(threadId);
      const ts =
        d.createdAt ||
        d.created_at ||
        (row.createdAt ? row.createdAt.toISOString() : new Date().toISOString());

      const isStarred =
        d.starred !== undefined
          ? Boolean(d.starred)
          : Array.isArray(d.labelIds)
          ? d.labelIds.includes("STARRED")
          : false;

      threads.push({
        id: threadId,
        entity_id: threadId,
        snippet: d.snippet || "",
        subject: d.subject || "",
        from: d.from || "",
        createdAt: typeof ts === "string" ? ts : new Date(ts).toISOString(),
        created_at: typeof ts === "string" ? ts : new Date(ts).toISOString(),
        updated_at: typeof ts === "string" ? ts : new Date(ts).toISOString(),
        unread: d.unread !== undefined ? Boolean(d.unread) : true,
        historyId: d.historyId,
        messagesCount: d.messagesCount || (Array.isArray(d.messages) ? d.messages.length : 1),
        body: d.body || d.snippet || "",
        bodyHtml: d.bodyHtml || "",
        messages: d.messages || [],
        starred: isStarred,
        labelIds: Array.isArray(d.labelIds) ? d.labelIds : (isStarred ? ["STARRED"] : []),
      });
    }

    // Sort by latest createdAt first safely
    threads.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });
    return threads;
  } catch (err) {
    log.warn("Error reading threads from DB", { error: err });
    return [];
  }
}

/**
 * Read cached threads from DB that have the STARRED label or starred flag, newest first.
 */
export async function getStarredThreadsFromDb(userId: string): Promise<EnrichedThread[]> {
  try {
    const accountId = await getGmailAccountId(userId);
    if (!accountId) return [];

    const rows = await db
      .select()
      .from(corsairEntities)
      .where(
        and(
          eq(corsairEntities.accountId, accountId),
          eq(corsairEntities.entityType, "threads")
        )
      )
      .orderBy(desc(corsairEntities.updatedAt));

    const threads: EnrichedThread[] = [];
    const seenThreadIds = new Set<string>();
    for (const row of rows) {
      const d = (row.data || {}) as CachedThreadData;
      const threadId = row.entityId || d.id || "";
      if (!threadId || seenThreadIds.has(threadId)) continue;

      const isStarred =
        d.starred !== undefined
          ? Boolean(d.starred)
          : Array.isArray(d.labelIds)
          ? d.labelIds.includes("STARRED")
          : false;

      if (!isStarred) continue;
      seenThreadIds.add(threadId);

      const ts =
        d.createdAt ||
        d.created_at ||
        (row.createdAt ? row.createdAt.toISOString() : new Date().toISOString());

      threads.push({
        id: threadId,
        entity_id: threadId,
        snippet: d.snippet || "",
        subject: d.subject || "",
        from: d.from || "",
        createdAt: typeof ts === "string" ? ts : new Date(ts).toISOString(),
        created_at: typeof ts === "string" ? ts : new Date(ts).toISOString(),
        updated_at: typeof ts === "string" ? ts : new Date(ts).toISOString(),
        unread: d.unread !== undefined ? Boolean(d.unread) : true,
        historyId: d.historyId,
        messagesCount: d.messagesCount || (Array.isArray(d.messages) ? d.messages.length : 1),
        body: d.body || d.snippet || "",
        bodyHtml: d.bodyHtml || "",
        messages: d.messages || [],
        starred: true,
        labelIds: Array.isArray(d.labelIds) ? d.labelIds : ["STARRED"],
      });
    }

    // Sort by latest createdAt first safely
    threads.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });
    return threads;
  } catch (err) {
    log.warn("Error reading starred threads from DB", { error: err });
    return [];
  }
}

/**
 * Persist fully enriched threads into PostgreSQL corsair_entities.
 */
export async function saveEnrichedThreadsToDb(accountId: string, threads: EnrichedThread[]) {
  for (const thread of threads) {
    try {
      const existing = await db
        .select({ id: corsairEntities.id })
        .from(corsairEntities)
        .where(
          and(
            eq(corsairEntities.accountId, accountId),
            eq(corsairEntities.entityType, "threads"),
            eq(corsairEntities.entityId, thread.id)
          )
        )
        .orderBy(desc(corsairEntities.updatedAt))
        .limit(1);

      const dataToSave = {
        id: thread.id,
        entity_id: thread.id,
        snippet: thread.snippet,
        subject: thread.subject,
        from: thread.from,
        createdAt: thread.createdAt,
        created_at: thread.created_at,
        updated_at: thread.updated_at,
        unread: thread.unread,
        historyId: thread.historyId,
        messagesCount: thread.messagesCount,
        body: thread.body,
        bodyHtml: thread.bodyHtml,
        messages: thread.messages,
        starred: thread.starred,
        labelIds: thread.labelIds,
      };

      if (existing.length > 0) {
        await db
          .update(corsairEntities)
          .set({
            data: dataToSave,
            updatedAt: new Date(),
          })
          .where(eq(corsairEntities.id, existing[0].id));
      } else {
        await db.insert(corsairEntities).values({
          id: crypto.randomUUID(),
          accountId,
          entityId: thread.id,
          entityType: "threads",
          version: "1.0.0",
          data: dataToSave,
          createdAt: new Date(thread.createdAt || Date.now()),
          updatedAt: new Date(),
        });
      }
    } catch (err) {
      log.warn("Failed to save thread to DB", { threadId: thread.id, error: err });
      // A successful Gmail response is not a successful sync unless it was
      // persisted. Propagate this so callers do not silently keep serving
      // stale cache data.
      throw err;
    }
  }
}

async function getLastGmailSyncAt(accountId: string): Promise<Date | null> {
  const row = await db
    .select({ data: corsairEntities.data })
    .from(corsairEntities)
    .where(
      and(
        eq(corsairEntities.accountId, accountId),
        eq(corsairEntities.entityType, GMAIL_SYNC_STATE_ENTITY_TYPE),
        eq(corsairEntities.entityId, GMAIL_SYNC_STATE_ENTITY_ID)
      )
    )
    .limit(1);

  const value = (row[0]?.data as { lastSyncedAt?: unknown } | undefined)?.lastSyncedAt;
  if (typeof value !== "string") return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function markGmailSyncComplete(accountId: string): Promise<void> {
  const existing = await db
    .select({ id: corsairEntities.id })
    .from(corsairEntities)
    .where(
      and(
        eq(corsairEntities.accountId, accountId),
        eq(corsairEntities.entityType, GMAIL_SYNC_STATE_ENTITY_TYPE),
        eq(corsairEntities.entityId, GMAIL_SYNC_STATE_ENTITY_ID)
      )
    )
    .limit(1);

  const data = { lastSyncedAt: new Date().toISOString() };
  if (existing[0]) {
    await db
      .update(corsairEntities)
      .set({ data, updatedAt: new Date() })
      .where(eq(corsairEntities.id, existing[0].id));
    return;
  }

  await db.insert(corsairEntities).values({
    id: crypto.randomUUID(),
    accountId,
    entityId: GMAIL_SYNC_STATE_ENTITY_ID,
    entityType: GMAIL_SYNC_STATE_ENTITY_TYPE,
    version: "1.0.0",
    data,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

const GMAIL_SYNC_LOCK_ENTITY_TYPE = "gmail_sync_lock";
const GMAIL_SYNC_LOCK_ENTITY_ID = "inbox_lock";

async function acquireGmailSyncLock(accountId: string, ttlMs = 120_000): Promise<boolean> {
  const now = new Date();
  try {
    const existing = await db
      .select({ id: corsairEntities.id, updatedAt: corsairEntities.updatedAt })
      .from(corsairEntities)
      .where(
        and(
          eq(corsairEntities.accountId, accountId),
          eq(corsairEntities.entityType, GMAIL_SYNC_LOCK_ENTITY_TYPE),
          eq(corsairEntities.entityId, GMAIL_SYNC_LOCK_ENTITY_ID)
        )
      )
      .limit(1);

    if (existing[0]) {
      const elapsed = now.getTime() - existing[0].updatedAt.getTime();
      if (elapsed < ttlMs) {
        // Concurrency guard: sync currently in progress
        return false;
      }
      // Stale lock: update timestamp to take over
      await db
        .update(corsairEntities)
        .set({ updatedAt: now })
        .where(eq(corsairEntities.id, existing[0].id));
      return true;
    }

    await db.insert(corsairEntities).values({
      id: crypto.randomUUID(),
      accountId,
      entityId: GMAIL_SYNC_LOCK_ENTITY_ID,
      entityType: GMAIL_SYNC_LOCK_ENTITY_TYPE,
      version: "1.0.0",
      data: { lockedAt: now.toISOString() },
      createdAt: now,
      updatedAt: now,
    });
    return true;
  } catch {
    return false;
  }
}

async function releaseGmailSyncLock(accountId: string): Promise<void> {
  try {
    await db
      .delete(corsairEntities)
      .where(
        and(
          eq(corsairEntities.accountId, accountId),
          eq(corsairEntities.entityType, GMAIL_SYNC_LOCK_ENTITY_TYPE),
          eq(corsairEntities.entityId, GMAIL_SYNC_LOCK_ENTITY_ID)
        )
      );
  } catch (err) {
    log.warn("Failed to release Gmail sync lock", { error: err });
  }
}

/**
 * Read threads from the local DB for the currently authenticated user.
 */
export async function getInboxThreads(): Promise<EnrichedThread[]> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user?.id) {
      return [];
    }
    return await getInboxThreadsFromDb(session.user.id);
  } catch (err) {
    log.warn("DB thread fetch failed", { error: err });
    return [];
  }
}

/**
 * Fetch a single full thread by ID. Checks local DB cache first before hitting Gmail API.
 */
export async function getThreadById(threadId: string): Promise<EnrichedThread | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  // Check DB cache first
  try {
    const accountId = await getGmailAccountId(session.user.id);
    if (accountId) {
      const row = await db
        .select()
        .from(corsairEntities)
        .where(
          and(
            eq(corsairEntities.accountId, accountId),
            eq(corsairEntities.entityType, "threads"),
            eq(corsairEntities.entityId, threadId)
          )
        )
        .orderBy(desc(corsairEntities.updatedAt))
        .limit(1);

      if (row.length > 0) {
        const d = (row[0].data || {}) as CachedThreadData;
        if (d.body || d.bodyHtml) {
          return {
            id: threadId,
            entity_id: threadId,
            snippet: d.snippet || "",
            subject: d.subject || "",
            from: d.from || "",
            createdAt: d.createdAt || row[0].createdAt.toISOString(),
            created_at: d.createdAt || row[0].createdAt.toISOString(),
            updated_at: d.updatedAt ? row[0].updatedAt.toISOString() : new Date().toISOString(),
            unread: d.unread !== undefined ? Boolean(d.unread) : true,
            historyId: d.historyId,
            messagesCount: d.messagesCount || 1,
            body: d.body || "",
            bodyHtml: d.bodyHtml || "",
            messages: d.messages || [],
          };
        }
      }
    }
  } catch (err) {
    log.warn("DB check in getThreadById failed", { error: err });
  }

  // Not in DB or missing body: fetch from Gmail API using strict session tenant
  const corsairClient = corsair.withTenant(session.user.id);
  try {
    const full = await corsairClient.gmail.api.threads.get({ id: threadId, format: "full" });
    if (!full || !full.id) return null;

    const messages: GmailMessage[] = full.messages || [];
    let primaryBodyHtml = "";
    let primaryBodyText = "";

    const parsedMessages: ThreadMessageItem[] = messages.map((msg: GmailMessage) => {
      const getMsgHeader = (name: string): string | undefined => {
        return (msg.payload?.headers || []).find(
          (h: GmailHeader) => h.name?.toLowerCase() === name.toLowerCase()
        )?.value;
      };

      const { text, html } = parseMessagePart(msg.payload);
      if (html) primaryBodyHtml = html;
      if (text) primaryBodyText = text;

      return {
        id: msg.id || "",
        from: getMsgHeader("from") || "Unknown Sender",
        to: getMsgHeader("to"),
        date: getMsgHeader("date"),
        snippet: msg.snippet || "",
        bodyText: text || msg.snippet || "",
        bodyHtml: html || "",
      };
    });

    const lastMsg = messages[messages.length - 1] || {};
    const firstMsg = messages[0] || {};
    const latestIncomingMessage = getLatestIncomingMessage(messages);
    const getHeader = (name: string): string | undefined => {
      let h = (lastMsg?.payload?.headers || []).find(
        (h: GmailHeader) => h.name?.toLowerCase() === name.toLowerCase()
      );
      if (h) return h.value;
      h = (firstMsg?.payload?.headers || []).find(
        (h: GmailHeader) => h.name?.toLowerCase() === name.toLowerCase()
      );
      if (h) return h.value;
      for (const msg of messages) {
        h = (msg.payload?.headers || []).find(
          (h: GmailHeader) => h.name?.toLowerCase() === name.toLowerCase()
        );
        if (h) return h.value;
      }
      return undefined;
    };

    const subject = getHeader("subject") || full.snippet?.slice(0, 60) || "No Subject";
    const fromRaw =
      getMessageHeader(latestIncomingMessage, "from") ||
      getHeader("from") ||
      "Unknown Sender";
    const dateRaw = getHeader("date");
    const createdAt = getMessageTime(latestIncomingMessage, dateRaw);
    const isUnread = messages.some((m: GmailMessage) => m.labelIds?.includes("UNREAD"));

    const enrichedResult: EnrichedThread = {
      id: full.id,
      entity_id: full.id,
      snippet: full.snippet || lastMsg.snippet || "",
      subject,
      from: fromRaw,
      createdAt,
      created_at: createdAt,
      updated_at: createdAt,
      unread: isUnread,
      historyId: full.historyId,
      messagesCount: messages.length,
      body: primaryBodyText || full.snippet || "",
      bodyHtml: primaryBodyHtml || "",
      messages: parsedMessages,
    };

    // Persist before responding. Background writes made this endpoint report
    // success even when the cache write failed, causing repeated Gmail reads.
    try {
      const session = await auth.api.getSession({
        headers: await headers(),
      });
      if (session?.user?.id) {
        const accountId = await getGmailAccountId(session.user.id);
        if (accountId) {
          await saveEnrichedThreadsToDb(accountId, [enrichedResult]);
        }
      }
    } catch (err) {
      log.warn("Failed to cache thread", { threadId, error: err });
    }

    return enrichedResult;
  } catch (err) {
    log.error("Failed to get thread", { threadId, error: err });
    return null;
  }
}

/**
 * Process items in small concurrent batches with an inter-batch pause.
 */
async function batchedMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  batchSize = 2,
  delayMs = 250
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    if (i + batchSize < items.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return results;
}

/**
 * Reusable helper to fetch full thread details from Gmail API and enrich it into EnrichedThread.
 */
export async function enrichThreadFromGmail(
  corsairClient: TenantCorsair,
  t: { id: string; snippet?: string; historyId?: string },
  forceStarred?: boolean
): Promise<EnrichedThread | null> {
  try {
    const full = await corsairClient.gmail.api.threads.get({ id: t.id, format: "full" });
    const messages: GmailMessage[] = full?.messages || [];
    const lastMsg = messages[messages.length - 1] || {};
    const firstMsg = messages[0] || {};
    const latestIncomingMessage = getLatestIncomingMessage(messages);

    const getHeader = (name: string): string | undefined => {
      let h = (lastMsg?.payload?.headers || []).find(
        (h: GmailHeader) => h.name?.toLowerCase() === name.toLowerCase()
      );
      if (h) return h.value;
      h = (firstMsg?.payload?.headers || []).find(
        (h: GmailHeader) => h.name?.toLowerCase() === name.toLowerCase()
      );
      if (h) return h.value;
      for (const msg of messages) {
        h = (msg.payload?.headers || []).find(
          (h: GmailHeader) => h.name?.toLowerCase() === name.toLowerCase()
        );
        if (h) return h.value;
      }
      return undefined;
    };

    const subject = getHeader("subject") || t.snippet?.slice(0, 60) || "No Subject";
    const fromRaw =
      getMessageHeader(latestIncomingMessage, "from") ||
      getHeader("from") ||
      "Unknown Sender";
    const dateRaw = getHeader("date");
    const createdAt = getMessageTime(latestIncomingMessage, dateRaw);
    const isUnread = messages.some((m: GmailMessage) => m.labelIds?.includes("UNREAD"));

    const allLabelIds = Array.from(
      new Set(messages.flatMap((m: GmailMessage) => m.labelIds || []))
    );
    const isStarred = Boolean(forceStarred || allLabelIds.includes("STARRED"));

    // Extract full email bodies
    let bodyHtml = "";
    let bodyText = "";
    for (let i = messages.length - 1; i >= 0; i--) {
      const { html, text } = parseMessagePart(messages[i]?.payload);
      if (html && !bodyHtml) bodyHtml = html;
      if (text && !bodyText) bodyText = text;
      if (bodyHtml && bodyText) break;
    }

    const parsedMessages: ThreadMessageItem[] = messages.map((msg: GmailMessage) => {
      const getMsgH = (name: string): string | undefined => {
        return (msg.payload?.headers || []).find(
          (h: GmailHeader) => h.name?.toLowerCase() === name.toLowerCase()
        )?.value;
      };
      const { text, html } = parseMessagePart(msg.payload);
      return {
        id: msg.id || "",
        from: getMsgH("from") || "Unknown Sender",
        to: getMsgH("to"),
        date: getMsgH("date"),
        snippet: msg.snippet || "",
        bodyText: text || msg.snippet || "",
        bodyHtml: html || "",
      };
    });

    return {
      id: t.id,
      entity_id: t.id,
      snippet: t.snippet || (lastMsg.snippet as string | undefined) || "",
      subject,
      from: fromRaw,
      createdAt,
      created_at: createdAt,
      updated_at: createdAt,
      unread: isUnread,
      historyId: t.historyId,
      messagesCount: messages.length,
      body: bodyText || t.snippet || "",
      bodyHtml: bodyHtml || "",
      messages: parsedMessages,
      starred: isStarred,
      labelIds: allLabelIds,
    };
  } catch (err) {
    log.warn("Failed to enrich thread", { threadId: t.id, error: err });
    return null;
  }
}

/**
 * Smart sync:
 * 1. Makes 1 threads.list call to the Gmail API.
 * 2. Checks local DB: skips threads.get only when the cached Gmail historyId
 *    matches the list result. A changed historyId means labels, unread state,
 *    messages, or metadata changed and the cache must be refreshed.
 * 3. Only calls threads.get for new/changed threads, batched safely.
 * 4. Saves newly fetched threads into the DB.
 * 5. Returns all threads from the DB.
 */
export async function syncInboxThreadsFromApi(
  limitOrTenantId: number | string = 10,
  options: { force?: boolean; limit?: number } = {}
): Promise<EnrichedThread[]> {
  const isTenantId = typeof limitOrTenantId === "string";
  const explicitTenantId = isTenantId ? limitOrTenantId : undefined;
  const limit = options.limit ?? (typeof limitOrTenantId === "number" ? limitOrTenantId : 10);
  const force = options.force ?? false;

  let userId: string | undefined = explicitTenantId;
  let accountId: string | null = null;
  let existingDbThreads: EnrichedThread[] = [];

  if (explicitTenantId) {
    try {
      accountId = await getGmailAccountId(explicitTenantId);
      if (accountId) {
        existingDbThreads = await getInboxThreadsFromDb(explicitTenantId);
      }
    } catch (err) {
      log.warn("Could not load user account for DB caching", { error: err });
    }
  } else {
    try {
      const session = await auth.api.getSession({
        headers: await headers(),
      });
      userId = session?.user?.id;
      if (userId) {
        accountId = await getGmailAccountId(userId);
        if (accountId) {
          existingDbThreads = await getInboxThreadsFromDb(userId);
        }
      }
    } catch (err) {
      log.warn("Could not load user account for DB caching", { error: err });
    }
  }

  if (!userId) {
    throw new Error("Unauthorized");
  }

  if (!accountId) {
    throw new Error("Gmail is not connected for this user");
  }

  // Keep normal page loads cache-only until the scheduled refresh is due.
  // `force` is reserved for an explicit user refresh or AI queries.
  const cacheNeedsRepair = existingDbThreads.some(
    (thread) => !hasUsableThreadMetadata(thread)
  );

  if (!force && existingDbThreads.length > 0 && !cacheNeedsRepair) {
    const lastSyncedAt = await getLastGmailSyncAt(accountId);
    if (lastSyncedAt && Date.now() - lastSyncedAt.getTime() < GMAIL_SYNC_INTERVAL_MS) {
      return existingDbThreads;
    }
  }

  // Concurrency guard: avoid duplicate concurrent sync runs for the same user
  const lockAcquired = await acquireGmailSyncLock(accountId);
  if (!lockAcquired) {
    return existingDbThreads;
  }

  try {
    const corsairClient = explicitTenantId
      ? corsair.withTenant(explicitTenantId)
      : await getCorsairTenant();

    // 1. Single threads.list call (1 API call)
    let rawThreads: { id?: string; snippet?: string; historyId?: string }[] = [];
    try {
      const res = await corsairClient.gmail.api.threads.list({ maxResults: limit });
      rawThreads = res?.threads ?? [];
    } catch (err) {
      log.warn("Gmail threads.list failed, falling back to cached DB threads", { error: err });
      return existingDbThreads;
    }

    if (!rawThreads.length) {
      await markGmailSyncComplete(accountId);
      return existingDbThreads;
    }

    // 2. Fetch newly discovered threads and cached threads whose Gmail history changed.
    const cachedMap = new Map<string, EnrichedThread>(
      existingDbThreads.map((t) => [t.id, t])
    );

    const threadsToFetch: { id: string; snippet?: string; historyId?: string }[] = [];
    const cachedThreadsToRestore: EnrichedThread[] = [];

    for (const t of rawThreads) {
      if (!t.id) continue;
      const cached = cachedMap.get(t.id);
      const hasUsableCache = hasUsableThreadMetadata(cached);
      const hasChangedOnGmail = Boolean(
        t.historyId && cached?.historyId !== t.historyId
      );

      // Keep historyId incremental sync so it stays cheap when nothing changed.
      if (!hasUsableCache || hasChangedOnGmail) {
        threadsToFetch.push({ id: t.id, snippet: t.snippet, historyId: t.historyId });
      } else if (cached) {
        cachedThreadsToRestore.push({
          ...cached,
          snippet: t.snippet || cached.snippet,
          historyId: t.historyId || cached.historyId,
        });
      }
    }

    if (cachedThreadsToRestore.length > 0) {
      await saveEnrichedThreadsToDb(accountId, cachedThreadsToRestore);
    }

    // 3. Fetch ONLY uncached threads, batched safely
    if (threadsToFetch.length > 0) {
      const newlyEnriched = await batchedMap(
        threadsToFetch,
        (t) => enrichThreadFromGmail(corsairClient, t),
        2,   // batch size 2
        250  // 250ms pause between batches
      );

      const validNew = newlyEnriched.filter((t): t is EnrichedThread => t !== null);

      // Save newly enriched threads to DB
      if (accountId && validNew.length > 0) {
        await saveEnrichedThreadsToDb(accountId, validNew);
      }
    }

    // Only mark the sync after all changed threads were durably written.
    await markGmailSyncComplete(accountId);

    // 4. Return the updated list from the DB
    if (userId) {
      const updated = await getInboxThreadsFromDb(userId);
      if (updated.length > 0) {
        return updated;
      }
    }

    return existingDbThreads;
  } finally {
    await releaseGmailSyncLock(accountId);
  }
}

export interface StarredThreadsResult {
  threads: EnrichedThread[];
  nextPageToken?: string;
  stale?: boolean;
}

/**
 * Get starred email threads for a tenant.
 * 1. Reads cached starred threads from DB.
 * 2. Refreshes live from Gmail API (`labelIds: ["STARRED"]`), enriches, and upserts to cache.
 * 3. If Gmail refresh fails, returns cached starred threads with `stale: true` without throwing.
 */
export async function getStarredThreads(
  tenantId: string,
  options: { limit?: number; pageToken?: string; cachedOnly?: boolean } = {}
): Promise<StarredThreadsResult> {
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 50);
  const pageToken = options.pageToken;

  // 1. Return cached threads that have the STARRED label from the DB cache, newest first
  const cachedStarred = await getStarredThreadsFromDb(tenantId);

  if (options.cachedOnly) {
    return {
      threads: cachedStarred,
      nextPageToken: undefined,
      stale: false,
    };
  }

  const accountId = await getGmailAccountId(tenantId);
  if (!accountId) {
    return {
      threads: cachedStarred,
      nextPageToken: undefined,
      stale: false,
    };
  }

  // 2. Also refresh from Gmail so older starred threads not in the cache appear
  try {
    const corsairClient = corsair.withTenant(tenantId);
    const res = await corsairClient.gmail.api.threads.list({
      labelIds: ["STARRED"],
      maxResults: limit,
      ...(pageToken ? { pageToken } : {}),
    });

    const rawThreads = res?.threads || [];
    const nextPageToken = res?.nextPageToken;

    if (!rawThreads.length) {
      return {
        threads: pageToken ? [] : cachedStarred,
        nextPageToken: undefined,
        stale: false,
      };
    }

    const cachedMap = new Map<string, EnrichedThread>(
      cachedStarred.map((t) => [t.id, t])
    );

    const threadsToFetch: { id: string; snippet?: string; historyId?: string }[] = [];
    const unchangedThreads: EnrichedThread[] = [];

    for (const t of rawThreads) {
      if (!t.id) continue;
      const cached = cachedMap.get(t.id);
      const hasUsable = hasUsableThreadMetadata(cached);
      const hasChanged = Boolean(t.historyId && cached?.historyId !== t.historyId);

      if (!hasUsable || hasChanged) {
        threadsToFetch.push({ id: t.id, snippet: t.snippet, historyId: t.historyId });
      } else if (cached) {
        unchangedThreads.push({
          ...cached,
          snippet: t.snippet || cached.snippet,
          historyId: t.historyId || cached.historyId,
          starred: true,
        });
      }
    }

    let newlyEnriched: EnrichedThread[] = [];
    if (threadsToFetch.length > 0) {
      const enrichedResults = await batchedMap(
        threadsToFetch,
        (t) => enrichThreadFromGmail(corsairClient, t, true),
        2,
        250
      );
      newlyEnriched = enrichedResults.filter((t): t is EnrichedThread => t !== null);
      if (newlyEnriched.length > 0) {
        await saveEnrichedThreadsToDb(accountId, newlyEnriched);
      }
    }

    // If pageToken was requested (pagination), return the threads for this page
    if (pageToken) {
      const pageThreads = [...newlyEnriched, ...unchangedThreads];
      pageThreads.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      });
      return {
        threads: pageThreads,
        nextPageToken,
        stale: false,
      };
    }

    // For first page: re-query all cached starred from DB to ensure complete ordered list
    const updatedStarred = await getStarredThreadsFromDb(tenantId);
    return {
      threads: updatedStarred.length > 0 ? updatedStarred : [...newlyEnriched, ...unchangedThreads],
      nextPageToken,
      stale: false,
    };
  } catch (err) {
    log.warn("Gmail getStarredThreads refresh failed, returning cached", { error: err });
    return {
      threads: cachedStarred,
      nextPageToken: undefined,
      stale: true,
    };
  }
}

/**
 * Remove STARRED label from a thread in Gmail and update the DB cache.
 */
export async function unstarThread(
  tenantId: string,
  threadId: string
): Promise<{ success: boolean }> {
  const accountId = await getGmailAccountId(tenantId);
  const corsairClient = corsair.withTenant(tenantId);

  // 1. Remove STARRED label in Gmail via Corsair
  await corsairClient.gmail.api.threads.modify({
    id: threadId,
    removeLabelIds: ["STARRED"],
  });

  // 2. Update local DB cache so next read does not show this thread as starred
  if (accountId) {
    try {
      const rows = await db
        .select()
        .from(corsairEntities)
        .where(
          and(
            eq(corsairEntities.accountId, accountId),
            eq(corsairEntities.entityType, "threads"),
            eq(corsairEntities.entityId, threadId)
          )
        )
        .limit(1);

      if (rows[0]) {
        const existingData = (rows[0].data || {}) as CachedThreadData;
        const currentLabels = Array.isArray(existingData.labelIds) ? existingData.labelIds : [];
        const updatedLabelIds = currentLabels.filter((l) => l !== "STARRED");
        const updatedData = {
          ...existingData,
          starred: false,
          labelIds: updatedLabelIds,
        };

        await db
          .update(corsairEntities)
          .set({
            data: updatedData,
            updatedAt: new Date(),
          })
          .where(eq(corsairEntities.id, rows[0].id));
      }
    } catch (err) {
      log.warn("Failed to update cache after unstarring", { error: err });
    }
  }

  return { success: true };
}

/**
 * Add STARRED label to a thread in Gmail and update the DB cache.
 */
export async function starThread(
  tenantId: string,
  threadId: string
): Promise<{ success: boolean }> {
  const accountId = await getGmailAccountId(tenantId);
  const corsairClient = corsair.withTenant(tenantId);

  await corsairClient.gmail.api.threads.modify({
    id: threadId,
    addLabelIds: ["STARRED"],
  });

  if (accountId) {
    try {
      const rows = await db
        .select()
        .from(corsairEntities)
        .where(
          and(
            eq(corsairEntities.accountId, accountId),
            eq(corsairEntities.entityType, "threads"),
            eq(corsairEntities.entityId, threadId)
          )
        )
        .limit(1);

      if (rows[0]) {
        const existingData = (rows[0].data || {}) as CachedThreadData;
        const currentLabels = Array.isArray(existingData.labelIds) ? existingData.labelIds : [];
        const updatedLabelIds = currentLabels.includes("STARRED")
          ? currentLabels
          : [...currentLabels, "STARRED"];
        const updatedData = {
          ...existingData,
          starred: true,
          labelIds: updatedLabelIds,
        };

        await db
          .update(corsairEntities)
          .set({
            data: updatedData,
            updatedAt: new Date(),
          })
          .where(eq(corsairEntities.id, rows[0].id));
      }
    } catch (err) {
      log.warn("Failed to update cache after starring", { error: err });
    }
  }

  return { success: true };
}

/**
 * Toggle the STARRED status of a thread.
 */
export async function toggleStarThread(
  tenantId: string,
  threadId: string,
  starred: boolean
): Promise<{ success: boolean }> {
  return starred ? starThread(tenantId, threadId) : unstarThread(tenantId, threadId);
}

export interface SendGmailMessageInput {
  threadId?: string | null;
  to?: string;
  subject?: string;
  body: string;
  inReplyTo?: string | null;
  references?: string | null;
  inReplyToMessageId?: string | null;
  tenantCorsair?: TenantCorsair;
}

export interface SentGmailMessageResult {
  success: boolean;
  sent?: boolean;
  id: string;
  threadId?: string;
}

export function buildRfc2822Raw({
  to,
  from,
  subject,
  inReplyTo,
  references,
  body,
}: {
  to: string;
  from?: string;
  subject?: string;
  inReplyTo?: string;
  references?: string;
  body: string;
}): string {
  const lines: string[] = [];
  lines.push(`To: ${to}`);
  if (from) lines.push(`From: ${from}`);
  if (subject) lines.push(`Subject: ${subject}`);
  if (inReplyTo) lines.push(`In-Reply-To: ${inReplyTo}`);
  if (references) lines.push(`References: ${references}`);
  lines.push("MIME-Version: 1.0");
  lines.push("Content-Type: text/plain; charset=UTF-8");
  lines.push("Content-Transfer-Encoding: 7bit");

  const message = `${lines.join("\r\n")}\r\n\r\n${body}`;
  return Buffer.from(message, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendGmailMessage(
  input: SendGmailMessageInput
): Promise<SentGmailMessageResult> {
  const corsair = input.tenantCorsair ?? (await getCorsairTenant());
  let to = input.to?.trim();
  let subject = input.subject?.trim();
  let inReplyTo = input.inReplyTo?.trim() ?? input.inReplyToMessageId?.trim();
  let references = input.references?.trim();
  const threadId = input.threadId?.trim();

  // If threadId is provided and missing 'to' or 'subject', resolve from thread
  if (threadId && (!to || !subject || !inReplyTo)) {
    try {
      if (input.tenantCorsair) {
        const thread = await input.tenantCorsair.gmail.api.threads.get({
          id: threadId,
          format: "full",
        });
        const msgs = thread?.messages ?? [];
        if (msgs.length > 0) {
          const lastMsg = msgs[msgs.length - 1];
          if (!to) {
            const fromHdr = (lastMsg.payload?.headers ?? []).find(
              (h: GmailHeader) => h.name?.toLowerCase() === "from"
            );
            if (fromHdr?.value) to = fromHdr.value;
          }
          if (!subject) {
            const subjHdr = (lastMsg.payload?.headers ?? []).find(
              (h: GmailHeader) => h.name?.toLowerCase() === "subject"
            );
            if (subjHdr?.value) {
              subject = subjHdr.value.toLowerCase().startsWith("re:")
                ? subjHdr.value
                : `Re: ${subjHdr.value}`;
            }
          }
          if (!inReplyTo) {
            const msgIdHdr = (lastMsg.payload?.headers ?? []).find(
              (h: GmailHeader) => h.name?.toLowerCase() === "message-id"
            );
            if (msgIdHdr?.value) {
              inReplyTo = msgIdHdr.value;
              references = inReplyTo;
            } else if (lastMsg.id) {
              inReplyTo = `<${lastMsg.id}@mail.gmail.com>`;
              references = inReplyTo;
            }
          }
        }
      } else {
        const thread = await getThreadById(threadId);
        if (thread) {
          if (!to && thread.from && thread.from !== "Unknown Sender") {
            to = thread.from;
          }
          if (!subject && thread.subject) {
            subject = thread.subject.toLowerCase().startsWith("re:")
              ? thread.subject
              : `Re: ${thread.subject}`;
          }
          if (!inReplyTo && thread.messages && thread.messages.length > 0) {
            const lastMsg = thread.messages[thread.messages.length - 1];
            if (lastMsg.id) {
              inReplyTo = `<${lastMsg.id}@mail.gmail.com>`;
              references = inReplyTo;
            }
          }
        }
      }
    } catch (err) {
      log.warn("Failed to fetch thread info for reply", { error: err });
    }
  }

  if (!to) {
    throw new Error("Recipient ('to') is required to send an email");
  }
  if (!input.body || !input.body.trim()) {
    throw new Error("Email body cannot be empty");
  }

  const raw = buildRfc2822Raw({
    to,
    subject,
    inReplyTo,
    references,
    body: input.body.trim(),
  });

  const res = await corsair.gmail.api.messages.send({
    raw,
    threadId: threadId || undefined,
  });

  return {
    success: true,
    sent: true,
    id: res.id || "",
    threadId: res.threadId || threadId,
  };
}

// ── Service Functions for AI Tools ──────────────────────────────────────────

export function trimSnippet(s: string, max = 150): string {
  if (!s) return "";
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + "…";
}

export async function getRecentEmailsFromCache(
  tenantId: string,
  limit: number
): Promise<EmailResult[]> {
  const threads = await getInboxThreadsFromDb(tenantId);
  if (!threads.length) return [];
  return threads.slice(0, limit).map((t) => ({
    threadId: t.id || t.entity_id,
    from: t.from || "Unknown Sender",
    subject: t.subject || "No Subject",
    date: t.createdAt || new Date().toISOString(),
    snippet: trimSnippet(t.snippet || t.body || ""),
    unread: t.unread,
  }));
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage = "Operation timed out"
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), ms);
  });
  return Promise.race([
    promise.finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    }),
    timeoutPromise,
  ]);
}

export async function getRecentEmails(
  tenantId: string,
  limit: number
): Promise<{ emails: EmailResult[]; stale: boolean }> {
  const accountId = await getGmailAccountId(tenantId);
  if (!accountId) {
    throw new Error("Gmail is not connected for this user");
  }

  let stale = false;

  try {
    await withTimeout(
      syncInboxThreadsFromApi(tenantId, { force: true, limit }),
      4000,
      "Gmail sync timed out"
    );
  } catch (err) {
    log.warn("[getRecentEmails] Sync failed or timed out, serving cached emails", { error: err });
    stale = true;
  }

  const emails = await getRecentEmailsFromCache(tenantId, limit);
  return { emails, stale };
}

export async function searchEmailThreads({
  tenantCorsair,
  query,
  limit,
}: {
  tenantCorsair: TenantCorsair;
  query: string;
  limit: number;
}): Promise<EmailResult[]> {
  const res = await tenantCorsair.gmail.api.threads.list({
    q: query,
    maxResults: limit,
  });
  const rawThreads = res?.threads ?? [];
  if (!rawThreads.length) return [];

  const emails: EmailResult[] = [];
  for (const t of rawThreads) {
    if (!t.id) continue;
    try {
      const full = await tenantCorsair.gmail.api.threads.get({ id: t.id, format: "full" });
      const messages: GmailMessage[] = full?.messages ?? [];

      const getHeader = (name: string): string | undefined => {
        for (const msg of [...messages].reverse()) {
          const h = (msg.payload?.headers ?? []).find(
            (h: GmailHeader) => h.name?.toLowerCase() === name.toLowerCase()
          );
          if (h?.value) return h.value;
        }
        return undefined;
      };

      const from = getHeader("from") || "Unknown Sender";
      const to = getHeader("to");
      const subject = getHeader("subject") || t.snippet?.slice(0, 60) || "No Subject";
      const dateRaw = getHeader("date");
      const lastMsg = messages[messages.length - 1];
      const date = lastMsg?.internalDate
        ? new Date(Number(lastMsg.internalDate)).toISOString()
        : dateRaw
        ? new Date(dateRaw).toISOString()
        : new Date().toISOString();

      let rawSnippet = full?.snippet || t.snippet || "";
      if (!rawSnippet) {
        for (const msg of [...messages].reverse()) {
          const { text } = parseMessagePart(msg.payload);
          if (text) {
            rawSnippet = text;
            break;
          }
        }
      }

      const unread = messages.some((m: GmailMessage) => m.labelIds?.includes("UNREAD"));
      emails.push({
        threadId: t.id,
        from,
        to,
        subject,
        date,
        snippet: trimSnippet(rawSnippet),
        unread,
      });
    } catch {
      // skip threads we can't enrich
    }
  }

  emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return emails;
}


