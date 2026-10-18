CREATE TABLE "verification_rate_limits" (
	"key" text PRIMARY KEY,
	"count" integer DEFAULT 1 NOT NULL,
	"last_sent_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "verification_rate_limits_expires_at_idx" ON "verification_rate_limits" ("expires_at");