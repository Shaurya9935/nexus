import {
  pgTable,
  text,
  timestamp,
  uuid,
  index,
  uniqueIndex,
  pgEnum,
  integer,
} from "drizzle-orm/pg-core";

export const waitlistStatusEnum = pgEnum("waitlist_status", [
  "pending",
  "approved",
  "rejected",
]);

export const waitlistEntries = pgTable(
  "waitlist_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    status: waitlistStatusEnum("status").default("pending").notNull(),
    source: text("source").default("landing").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("waitlist_entries_email_uidx").on(table.email),
    index("waitlist_entries_status_idx").on(table.status),
    index("waitlist_entries_created_at_idx").on(table.createdAt),
  ]
);

export const waitlistRateLimits = pgTable(
  "waitlist_rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").default(1).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("waitlist_rate_limits_expires_at_idx").on(table.expiresAt),
  ]
);

export type WaitlistEntry = typeof waitlistEntries.$inferSelect;
export type NewWaitlistEntry = typeof waitlistEntries.$inferInsert;
export type WaitlistStatus = "pending" | "approved" | "rejected";
