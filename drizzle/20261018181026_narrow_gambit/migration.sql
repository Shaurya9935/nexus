CREATE TYPE "waitlist_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "waitlist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" text NOT NULL,
	"status" "waitlist_status" DEFAULT 'pending'::"waitlist_status" NOT NULL,
	"source" text DEFAULT 'landing' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"invited_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "waitlist_rate_limits" (
	"key" text PRIMARY KEY,
	"count" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_entries_email_uidx" ON "waitlist_entries" ("email");--> statement-breakpoint
CREATE INDEX "waitlist_entries_status_idx" ON "waitlist_entries" ("status");--> statement-breakpoint
CREATE INDEX "waitlist_entries_created_at_idx" ON "waitlist_entries" ("created_at");--> statement-breakpoint
CREATE INDEX "waitlist_rate_limits_expires_at_idx" ON "waitlist_rate_limits" ("expires_at");