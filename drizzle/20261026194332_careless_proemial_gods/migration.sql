CREATE TABLE "pending_registrations" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"otp_hash" text NOT NULL,
	"otp_expires_at" timestamp with time zone NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "pending_registrations_email_idx" ON "pending_registrations" ("email");--> statement-breakpoint
CREATE INDEX "pending_registrations_expires_at_idx" ON "pending_registrations" ("otp_expires_at");