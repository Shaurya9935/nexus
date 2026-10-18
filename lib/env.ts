import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_URL: z
    .string()
    .default("http://localhost:3000")
    .transform((url) => {
      const normalized = /^https?:\/\//i.test(url) ? url : `http://${url}`;
      return normalized.replace(/\/+$/, "");
    }),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
  BETTER_AUTH_URL: z.string().optional().transform((url) => url ? url.replace(/\/+$/, "") : undefined),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  CORSAIR_KEK: z.string().min(1, "CORSAIR_KEK is required"),
  CORSAIR_DEV_API_KEY: z.string().min(1, "CORSAIR_DEV_API_KEY is required"),
  CORSAIR_DEV_SIGNING_SECRET: z.string().optional(),
  WEBHOOK_SECRET: z.string().optional(),
  MCP_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
  AI_DAILY_MESSAGE_LIMIT: z.coerce.number().int().positive().default(50),
  AI_BURST_MESSAGE_LIMIT: z.coerce.number().int().positive().default(8),
  AI_DAILY_TOKEN_BUDGET_TOTAL: z.coerce.number().int().positive().default(2_000_000),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITLAB_CLIENT_ID: z.string().optional(),
  GITLAB_CLIENT_SECRET: z.string().optional(),
  ADMIN_EMAILS: z
    .string()
    .optional()
    .default("")
    .transform((s) =>
      s
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    ),
  ALLOWED_EMAILS: z
    .string()
    .optional()
    .default("")
    .transform((s) =>
      s
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    ),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  SIGNUP_MODE: z.enum(["open", "invite"]).default("open"),
  NEXT_PUBLIC_FEEDBACK_URL: z.string().optional(),
  NEXT_PUBLIC_FEEDBACK_EMAIL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const missingKeys = Array.from(new Set(parsed.error.issues.map((i) => i.path.join("."))));
    const errorMessage = `Missing or invalid required environment variables: ${missingKeys.join(", ")}`;
    if (process.env.NODE_ENV === "production") {
      throw new Error(`[FATAL] ${errorMessage}`);
    } else {
      // In development or build/test, warn and use fallback defaults
      return envSchema.parse({
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/command-inbox",
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || "dev-better-auth-secret-key-32-chars",
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || "dummy-openai-key",
        CORSAIR_KEK: process.env.CORSAIR_KEK || "dummy-corsair-kek",
        CORSAIR_DEV_API_KEY: process.env.CORSAIR_DEV_API_KEY || "ck_dev_dummy",
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "dummy-google-client-id",
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "dummy-google-client-secret",
        SIGNUP_MODE: (process.env.SIGNUP_MODE as "open" | "invite") || "open",
      });
    }
  }
  return parsed.data;
}

export const env = validateEnv();

export function isAdminEmail(email?: string | null): boolean {
  if (!email || typeof email !== "string") return false;
  const clean = email.trim().toLowerCase();
  return env.ADMIN_EMAILS.includes(clean);
}

export function isAllowedEmail(email?: string | null): boolean {
  if (!email || typeof email !== "string") return false;
  const clean = email.trim().toLowerCase();
  return env.ALLOWED_EMAILS.includes(clean);
}

export function isSignupOpen(): boolean {
  return env.SIGNUP_MODE === "open";
}
