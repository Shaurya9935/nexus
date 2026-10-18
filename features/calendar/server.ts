import { getCorsairTenant } from "@/lib/corsair-client";
import { db } from "@/lib/db";
import { corsairAccounts, corsairEntities, corsairIntegrations } from "@/db/corsair";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import crypto from "crypto";
import type { TenantCorsair } from "@/lib/corsair";
import { log } from "@/lib/logger";
import type { CalendarEventResult } from "./types";

export interface EnrichedCalendarEvent {
  id: string;
  entity_id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  end: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  status?: "tentative" | "confirmed" | "cancelled";
  htmlLink?: string;
  hangoutLink?: string;
  creator?: { email?: string; displayName?: string };
  organizer?: { email?: string; displayName?: string };
  attendees?: Array<{ email?: string; displayName?: string; responseStatus?: string }>;
  created?: string;
  updated?: string;
  createdAt: string;
}

/**
 * Read calendar events from the local Corsair DB — fast, no rate limits.
 * Returns cached events stored in the database.
 */
export async function getCalendarEvents(): Promise<EnrichedCalendarEvent[]> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const accountId = await getCalendarAccountId(session.user.id);
  if (!accountId) {
    throw new Error("Google Calendar is not connected for this user");
  }

  const corsair = await getCorsairTenant();

  try {
    const entities = await corsair.googlecalendar.db.events.list({ limit: 50 });
    if (Array.isArray(entities) && entities.length > 0) {
      return entities.map((e) => {
        const d = e.data;
        const ts =
          d?.createdAt instanceof Date
            ? d.createdAt.toISOString()
            : typeof d?.createdAt === "string"
            ? d.createdAt
            : d?.created || new Date().toISOString();

        return {
          id: e.entity_id || d?.id || "",
          entity_id: e.entity_id || d?.id || "",
          summary: d?.summary || "No Title",
          description: d?.description,
          location: d?.location,
          start: {
            date: d?.start?.date,
            dateTime: d?.start?.dateTime,
            timeZone: d?.start?.timeZone,
          },
          end: {
            date: d?.end?.date,
            dateTime: d?.end?.dateTime,
            timeZone: d?.end?.timeZone,
          },
          status: d?.status,
          htmlLink: d?.htmlLink,
          hangoutLink: d?.hangoutLink,
          creator: d?.creator
            ? { email: d.creator.email, displayName: d.creator.displayName }
            : undefined,
          organizer: d?.organizer
            ? { email: d.organizer.email, displayName: d.organizer.displayName }
            : undefined,
          attendees: d?.attendees?.map((a) => ({
            email: a.email,
            displayName: a.displayName,
            responseStatus: a.responseStatus,
          })),
          created: d?.created,
          updated: d?.updated,
          createdAt: ts,
        };
      });
    }
  } catch (err) {
    log.warn("DB calendar events fetch failed", { error: err });
  }

  return [];
}

const CALENDAR_SYNC_STATE_ENTITY_TYPE = "calendar_sync_state";
const CALENDAR_SYNC_STATE_ENTITY_ID = "events_state";
const CALENDAR_SYNC_LOCK_ENTITY_TYPE = "calendar_sync_lock";
const CALENDAR_SYNC_LOCK_ENTITY_ID = "events_lock";
const CALENDAR_SYNC_INTERVAL_MS = 15 * 60 * 1000;

async function getLastCalendarSyncAt(accountId: string): Promise<Date | null> {
  const row = await db
    .select({ data: corsairEntities.data })
    .from(corsairEntities)
    .where(
      and(
        eq(corsairEntities.accountId, accountId),
        eq(corsairEntities.entityType, CALENDAR_SYNC_STATE_ENTITY_TYPE),
        eq(corsairEntities.entityId, CALENDAR_SYNC_STATE_ENTITY_ID)
      )
    )
    .limit(1);

  const value = (row[0]?.data as { lastSyncedAt?: unknown } | undefined)?.lastSyncedAt;
  if (typeof value !== "string") return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function markCalendarSyncComplete(accountId: string): Promise<void> {
  const existing = await db
    .select({ id: corsairEntities.id })
    .from(corsairEntities)
    .where(
      and(
        eq(corsairEntities.accountId, accountId),
        eq(corsairEntities.entityType, CALENDAR_SYNC_STATE_ENTITY_TYPE),
        eq(corsairEntities.entityId, CALENDAR_SYNC_STATE_ENTITY_ID)
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
    entityId: CALENDAR_SYNC_STATE_ENTITY_ID,
    entityType: CALENDAR_SYNC_STATE_ENTITY_TYPE,
    version: "1.0.0",
    data,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function acquireCalendarSyncLock(accountId: string, ttlMs = 120_000): Promise<boolean> {
  const now = new Date();
  try {
    const existing = await db
      .select({ id: corsairEntities.id, updatedAt: corsairEntities.updatedAt })
      .from(corsairEntities)
      .where(
        and(
          eq(corsairEntities.accountId, accountId),
          eq(corsairEntities.entityType, CALENDAR_SYNC_LOCK_ENTITY_TYPE),
          eq(corsairEntities.entityId, CALENDAR_SYNC_LOCK_ENTITY_ID)
        )
      )
      .limit(1);

    if (existing[0]) {
      const elapsed = now.getTime() - existing[0].updatedAt.getTime();
      if (elapsed < ttlMs) {
        return false;
      }
      await db
        .update(corsairEntities)
        .set({ updatedAt: now })
        .where(eq(corsairEntities.id, existing[0].id));
      return true;
    }

    await db.insert(corsairEntities).values({
      id: crypto.randomUUID(),
      accountId,
      entityId: CALENDAR_SYNC_LOCK_ENTITY_ID,
      entityType: CALENDAR_SYNC_LOCK_ENTITY_TYPE,
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

async function releaseCalendarSyncLock(accountId: string): Promise<void> {
  try {
    await db
      .delete(corsairEntities)
      .where(
        and(
          eq(corsairEntities.accountId, accountId),
          eq(corsairEntities.entityType, CALENDAR_SYNC_LOCK_ENTITY_TYPE),
          eq(corsairEntities.entityId, CALENDAR_SYNC_LOCK_ENTITY_ID)
        )
      );
  } catch (err) {
    log.warn("Failed to release Calendar sync lock", { error: err });
  }
}

/**
 * Pull fresh events from the Google Calendar API,
 * upsert into Corsair DB cache, and return the events list.
 */
export async function syncCalendarEventsFromApi(options: { force?: boolean } = {}): Promise<EnrichedCalendarEvent[]> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const accountId = await getCalendarAccountId(session.user.id);
  if (!accountId) {
    throw new Error("Google Calendar is not connected for this user");
  }

  const existingEvents = await getCalendarEvents();
  if (!options.force && existingEvents.length > 0) {
    const lastSyncedAt = await getLastCalendarSyncAt(accountId);
    if (lastSyncedAt && Date.now() - lastSyncedAt.getTime() < CALENDAR_SYNC_INTERVAL_MS) {
      return existingEvents;
    }
  }

  const lockAcquired = await acquireCalendarSyncLock(accountId);
  if (!lockAcquired) {
    return existingEvents;
  }

  try {
    const corsair = await getCorsairTenant();

    // Fetch events from 7 days ago to upcoming 30 days
    const timeMin = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const res = await corsair.googlecalendar.api.events.getMany({
      calendarId: "primary",
      maxResults: 50,
      singleEvents: true,
      orderBy: "startTime",
      timeMin,
      timeMax,
    });

    const rawEvents = res?.items ?? [];

    if (!rawEvents.length) {
      await markCalendarSyncComplete(accountId);
      return existingEvents;
    }

  const events: EnrichedCalendarEvent[] = [];

  await Promise.allSettled(
    rawEvents.map(async (ev) => {
      if (!ev.id) return;

      const nowIso = new Date().toISOString();
      const createdIso = ev.created || nowIso;

      // Upsert into local database cache
      try {
        await corsair.googlecalendar.db.events.upsertByEntityId(ev.id, {
          id: ev.id,
          summary: ev.summary || undefined,
          description: ev.description || undefined,
          location: ev.location || undefined,
          status: ev.status as "tentative" | "confirmed" | "cancelled" | undefined,
          htmlLink: ev.htmlLink || undefined,
          hangoutLink: ev.hangoutLink || undefined,
          start: ev.start
            ? {
                date: ev.start.date || undefined,
                dateTime: ev.start.dateTime || undefined,
                timeZone: ev.start.timeZone || undefined,
              }
            : undefined,
          end: ev.end
            ? {
                date: ev.end.date || undefined,
                dateTime: ev.end.dateTime || undefined,
                timeZone: ev.end.timeZone || undefined,
              }
            : undefined,
          creator: ev.creator
            ? {
                id: ev.creator.id || undefined,
                email: ev.creator.email || undefined,
                displayName: ev.creator.displayName || undefined,
                self: ev.creator.self || undefined,
              }
            : undefined,
          organizer: ev.organizer
            ? {
                id: ev.organizer.id || undefined,
                email: ev.organizer.email || undefined,
                displayName: ev.organizer.displayName || undefined,
                self: ev.organizer.self || undefined,
              }
            : undefined,
          attendees: ev.attendees
            ? ev.attendees.map((a) => ({
                id: a.id || undefined,
                email: a.email || undefined,
                displayName: a.displayName || undefined,
                organizer: a.organizer || undefined,
                self: a.self || undefined,
                resource: a.resource || undefined,
                optional: a.optional || undefined,
                responseStatus: a.responseStatus as
                  | "needsAction"
                  | "declined"
                  | "tentative"
                  | "accepted"
                  | undefined,
                comment: a.comment || undefined,
                additionalGuests: a.additionalGuests || undefined,
              }))
            : undefined,
          created: ev.created || undefined,
          updated: ev.updated || undefined,
          createdAt: new Date(createdIso),
        });
      } catch (e) {
        log.warn("Failed to upsert calendar event", { eventId: ev.id, error: e });
      }

      events.push({
        id: ev.id,
        entity_id: ev.id,
        summary: ev.summary || "No Title",
        description: ev.description || undefined,
        location: ev.location || undefined,
        start: {
          date: ev.start?.date || undefined,
          dateTime: ev.start?.dateTime || undefined,
          timeZone: ev.start?.timeZone || undefined,
        },
        end: {
          date: ev.end?.date || undefined,
          dateTime: ev.end?.dateTime || undefined,
          timeZone: ev.end?.timeZone || undefined,
        },
        status: ev.status as "tentative" | "confirmed" | "cancelled" | undefined,
        htmlLink: ev.htmlLink || undefined,
        hangoutLink: ev.hangoutLink || undefined,
        creator: ev.creator
          ? { email: ev.creator.email || undefined, displayName: ev.creator.displayName || undefined }
          : undefined,
        organizer: ev.organizer
          ? { email: ev.organizer.email || undefined, displayName: ev.organizer.displayName || undefined }
          : undefined,
        attendees: ev.attendees?.map((a) => ({
          email: a.email || undefined,
          displayName: a.displayName || undefined,
          responseStatus: a.responseStatus || undefined,
        })),
        created: ev.created || undefined,
        updated: ev.updated || undefined,
        createdAt: createdIso,
      });
    })
  );
  await markCalendarSyncComplete(accountId);

    // Sort events by start time
    return events.sort((a, b) => {
      const timeA = new Date(a.start.dateTime || a.start.date || 0).getTime();
      const timeB = new Date(b.start.dateTime || b.start.date || 0).getTime();
      return timeA - timeB;
    });
  } catch (error) {
    log.error("Calendar sync failed", { error });
    return existingEvents;
  } finally {
    await releaseCalendarSyncLock(accountId);
  }
}

export interface CreateCalendarEventInput {
  summary: string;
  description?: string;
  location?: string;
  start: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  end: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  attendees?: Array<{ email: string; displayName?: string }>;
}

export async function createCalendarEvent(
  input: CreateCalendarEventInput
): Promise<EnrichedCalendarEvent> {
  const corsair = await getCorsairTenant();
  const res = await corsair.googlecalendar.api.events.create({
    calendarId: "primary",
    event: {
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: input.start,
      end: input.end,
      attendees: input.attendees,
    },
  });

  const createdIso = res.created || new Date().toISOString();
  return {
    id: res.id || "",
    entity_id: res.id || "",
    summary: res.summary || input.summary || "No Title",
    description: res.description || input.description,
    location: res.location || input.location,
    start: {
      date: res.start?.date || input.start.date,
      dateTime: res.start?.dateTime || input.start.dateTime,
      timeZone: res.start?.timeZone || input.start.timeZone,
    },
    end: {
      date: res.end?.date || input.end.date,
      dateTime: res.end?.dateTime || input.end.dateTime,
      timeZone: res.end?.timeZone || input.end.timeZone,
    },
    status: (res.status as "tentative" | "confirmed" | "cancelled") || "confirmed",
    htmlLink: res.htmlLink,
    hangoutLink: res.hangoutLink,
    creator: res.creator
      ? { email: res.creator.email, displayName: res.creator.displayName }
      : undefined,
    organizer: res.organizer
      ? { email: res.organizer.email, displayName: res.organizer.displayName }
      : undefined,
    attendees: res.attendees?.map((a) => ({
      email: a.email,
      displayName: a.displayName,
      responseStatus: a.responseStatus,
    })),
    created: res.created,
    updated: res.updated,
    createdAt: createdIso,
  };
}

// ── Service Functions for AI Tools ──────────────────────────────────────────

interface CalEventData {
  summary?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  location?: string;
  hangoutLink?: string;
  status?: string;
}

export async function getCalendarAccountId(tenantId: string): Promise<string | null> {
  try {
    const accts = await db
      .select({ id: corsairAccounts.id })
      .from(corsairAccounts)
      .innerJoin(corsairIntegrations, eq(corsairAccounts.integrationId, corsairIntegrations.id))
      .where(
        and(
          eq(corsairAccounts.tenantId, tenantId),
          eq(corsairIntegrations.name, "googlecalendar")
        )
      )
      .limit(1);
    return accts[0]?.id ?? null;
  } catch (err) {
    log.warn("Failed to get calendar account ID", { error: err });
    return null;
  }
}

export async function getEventsInRange({
  tenantId,
  tenantCorsair,
  startISO,
  endISO,
}: {
  tenantId: string;
  tenantCorsair: TenantCorsair;
  startISO: string;
  endISO: string;
}): Promise<CalendarEventResult[]> {
  // Try DB cache first
  const calendarAccountId = await getCalendarAccountId(tenantId);
  if (!calendarAccountId) {
    throw new Error("Google Calendar is not connected for this user");
  }

  let events: CalendarEventResult[] = [];

  if (calendarAccountId) {
    const rows = await db
      .select()
      .from(corsairEntities)
      .where(
        and(
          eq(corsairEntities.accountId, calendarAccountId),
          eq(corsairEntities.entityType, "events")
        )
      )
      .orderBy(desc(corsairEntities.updatedAt));

    const startMs = new Date(startISO).getTime();
    const endMs = new Date(endISO).getTime();

    for (const row of rows) {
      const d = (row.data ?? {}) as CalEventData;
      if (d.status === "cancelled") continue;
      const evStart = d.start?.dateTime || d.start?.date;
      const evEnd = d.end?.dateTime || d.end?.date;
      if (!evStart) continue;
      const evStartMs = new Date(evStart).getTime();
      if (isNaN(evStartMs) || evStartMs < startMs || evStartMs > endMs) continue;
      const eventId = row.entityId || (d as { id?: string; eventId?: string }).eventId || (d as { id?: string }).id || "";
      events.push({
        eventId,
        id: eventId,
        title: d.summary || "No Title",
        start: evStart,
        end: evEnd || evStart,
        location: d.location ?? null,
        meetLink: d.hangoutLink ?? null,
      });
    }
  }

  // Fallback to API if DB cache was empty
  if (!events.length) {
    const res = await tenantCorsair.googlecalendar.api.events.getMany({
      calendarId: "primary",
      maxResults: 50,
      singleEvents: true,
      orderBy: "startTime",
      timeMin: startISO,
      timeMax: endISO,
    });
    const raw = res?.items ?? [];
    events = (raw as Array<{
      id?: string;
      status?: string;
      summary?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      location?: string;
      hangoutLink?: string;
    }>)
      .filter((ev) => ev.status !== "cancelled")
      .map((ev) => {
        const eventId = ev.id || "";
        return {
          eventId,
          id: eventId,
          title: ev.summary || "No Title",
          start: ev.start?.dateTime || ev.start?.date || startISO,
          end: ev.end?.dateTime || ev.end?.date || endISO,
          location: ev.location ?? null,
          meetLink: ev.hangoutLink ?? null,
        };
      });
  }

  events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return events;
}

export async function createCalendarEventWithMeet({
  tenantCorsair,
  title,
  startISO,
  endISO,
  description,
  location,
  attendeeEmails,
  addMeetLink,
}: {
  tenantCorsair: TenantCorsair;
  title: string;
  startISO: string;
  endISO: string;
  description?: string | null;
  location?: string | null;
  attendeeEmails?: string[] | null;
  addMeetLink?: boolean | null;
}): Promise<{ created: boolean; title: string; start: string; end: string }> {
  const formattedAttendees =
    attendeeEmails && attendeeEmails.length > 0
      ? attendeeEmails.map((email) => ({ email }))
      : undefined;

  const eventPayload: Record<string, unknown> = {
    summary: title,
    description: description || undefined,
    location: location || undefined,
    start: {
      dateTime: startISO,
      timeZone: "Asia/Kolkata",
    },
    end: {
      dateTime: endISO,
      timeZone: "Asia/Kolkata",
    },
    attendees: formattedAttendees,
  };

  if (addMeetLink) {
    eventPayload.conferenceData = {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const res = await tenantCorsair.googlecalendar.api.events.create({
    calendarId: "primary",
    conferenceDataVersion: addMeetLink ? 1 : undefined,
    event: eventPayload as Parameters<typeof tenantCorsair.googlecalendar.api.events.create>[0]["event"],
  });

  return {
    created: true,
    title: res?.summary || title,
    start: res?.start?.dateTime || res?.start?.date || startISO,
    end: res?.end?.dateTime || res?.end?.date || endISO,
  };
}

export async function deleteCalendarEvent({
  tenantCorsair,
  eventId,
  tenantId,
}: {
  tenantCorsair: TenantCorsair;
  eventId: string;
  tenantId?: string;
}): Promise<{ deleted: boolean; id: string }> {
  // 1. Delete on Google Calendar via Corsair SDK
  await tenantCorsair.googlecalendar.api.events.delete({
    calendarId: "primary",
    id: eventId,
  });

  // 2. Remove / invalidate from local DB cache
  if (tenantId) {
    try {
      const accountId = await getCalendarAccountId(tenantId);
      if (accountId) {
        await db
          .delete(corsairEntities)
          .where(
            and(
              eq(corsairEntities.accountId, accountId),
              eq(corsairEntities.entityType, "events"),
              eq(corsairEntities.entityId, eventId)
            )
          );
      }
    } catch (err) {
      log.warn("Failed to remove deleted event from cache", { eventId, error: err });
    }
  }

  return { deleted: true, id: eventId };
}

