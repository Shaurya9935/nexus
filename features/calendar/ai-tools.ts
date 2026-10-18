import { z } from "zod";
import type { Tool } from "@openai/agents";
import type { ToolContext } from "@/lib/ai/types";
import { strictTool } from "@/lib/ai/strict-tool";
import { extractAndValidateEmail } from "@/lib/validation/email";
import {
  getEventsInRange,
  createCalendarEventWithMeet,
} from "./server";
import type { CalendarEventResult } from "./types";

export function calendarTools(ctx: ToolContext): Tool<unknown>[] {
  const { tenantId, tenantCorsair } = ctx;

  // ── get_calendar_events ────────────────────────────────────────────────────
  const getCalendarEvents = strictTool({
    name: "get_calendar_events",
    description:
      "Return Google Calendar events in a date/time range. Dates must be ISO 8601 in Asia/Kolkata (+05:30). Each event includes its eventId. Use for any request about meetings, schedule, or events today/this week.",
    parameters: z.object({
      startISO: z
        .string()
        .describe("Range start as ISO 8601 e.g. '2025-10-14T00:00:00+05:30'"),
      endISO: z
        .string()
        .describe("Range end as ISO 8601 e.g. '2025-10-14T23:59:59+05:30'"),
    }),
    execute: async ({ startISO, endISO }): Promise<string> => {
      try {
        const events: CalendarEventResult[] = await getEventsInRange({
          tenantId,
          tenantCorsair,
          startISO,
          endISO,
        });

        if (!events.length) {
          return JSON.stringify({ events: [], note: "no events in this range" });
        }
        return JSON.stringify({ events });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.toLowerCase().includes("not connected") ||
          msg.toLowerCase().includes("not_connected") ||
          msg.toLowerCase().includes("no account found")
        ) {
          return JSON.stringify({
            error: "not_connected",
            service: "Google Calendar",
            message: "Google Calendar is not connected for this user.",
          });
        }
        return JSON.stringify({ error: `Calendar API failed: ${msg}` });
      }
    },
  });

  // ── create_calendar_event ──────────────────────────────────────────────────
  const createCalendarEvent = strictTool({
    name: "create_calendar_event",
    description:
      "ONLY for creating a NEW event. NEVER use this to delete, cancel, move, reschedule or edit an existing event. Validates attendees and timing, then initiates event creation. If approval is required, notifies you that the action is waiting for approval.",
    parameters: z.object({
      title: z.string().describe("Title or summary of the calendar event"),
      startISO: z
        .string()
        .describe("Start time in ISO 8601 format in Asia/Kolkata timezone (+05:30) e.g. '2026-10-15T16:00:00+05:30'"),
      endISO: z
        .string()
        .describe("End time in ISO 8601 format in Asia/Kolkata timezone (+05:30) e.g. '2026-10-15T17:00:00+05:30'"),
      description: z.string().nullable().describe("Event description/notes or null"),
      location: z.string().nullable().describe("Event physical or virtual location or null"),
      attendeeEmails: z
        .array(z.string())
        .nullable()
        .describe("List of attendee real email addresses or null. All addresses must be valid, real addresses."),
      addMeetLink: z
        .boolean()
        .nullable()
        .describe("Whether to generate a Google Meet video conference link"),
    }),
    execute: async ({
      title,
      startISO,
      endISO,
      description,
      location,
      attendeeEmails,
      addMeetLink,
    }): Promise<string> => {
      // 1. Validate dates
      if (isNaN(new Date(startISO).getTime()) || isNaN(new Date(endISO).getTime())) {
        return JSON.stringify({
          error: "Invalid startISO or endISO date. Must be valid ISO 8601 strings.",
        });
      }

      // 2. Validate attendees (max 10)
      if (attendeeEmails && attendeeEmails.length > 10) {
        return JSON.stringify({
          error: "Attendee limit exceeded. A maximum of 10 attendees is allowed per calendar event.",
        });
      }

      const validAttendees: string[] = [];
      if (attendeeEmails && attendeeEmails.length > 0) {
        for (const email of attendeeEmails) {
          const check = extractAndValidateEmail(email);
          if (!check.valid || !check.email) {
            return JSON.stringify({ error: check.error });
          }
          validAttendees.push(check.email);
        }
      }

      try {
        const res = await createCalendarEventWithMeet({
          tenantCorsair,
          title,
          startISO,
          endISO,
          description,
          location,
          attendeeEmails: validAttendees,
          addMeetLink,
        });

        return JSON.stringify({
          created: true,
          title: res.title,
          start: res.start,
          end: res.end,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          (err instanceof Error && err.name === "PermissionRequiredError") ||
          msg.includes("waiting for the user's approval") ||
          msg.includes("approval")
        ) {
          // Return approval message as a normal tool result so model does not retry
          return JSON.stringify({
            status: "waiting_approval",
            message: msg,
          });
        }
        if (
          msg.toLowerCase().includes("not connected") ||
          msg.toLowerCase().includes("not_connected") ||
          msg.toLowerCase().includes("no account found")
        ) {
          return JSON.stringify({
            error: "not_connected",
            service: "Google Calendar",
            message: "Google Calendar is not connected for this user.",
          });
        }
        return JSON.stringify({ error: `Calendar event creation failed: ${msg}` });
      }
    },
  });

  return [getCalendarEvents, createCalendarEvent];
}
