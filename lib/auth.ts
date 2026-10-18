import { betterAuth, APIError } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import * as schema from "../db/auth";
import { db } from "./db";
import { env } from "./env";
import { isEmailPermittedToAccess, maskEmail } from "./waitlist";
import { log } from "./logger";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: env.APP_URL,
  trustedOrigins: [env.APP_URL],
  advanced: {
    useSecureCookies: env.NODE_ENV === "production",
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const permitted = await isEmailPermittedToAccess(user.email);
          if (!permitted) {
            log.warn("[auth/signup] Blocked unapproved registration", {
              email: maskEmail(user.email),
            });
            throw new APIError("FORBIDDEN", {
              message: "Nexus is in private beta. Request access on the home page.",
            });
          }
          return { data: user };
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          if (session?.userId) {
            const [existingUser] = await db
              .select({ email: schema.user.email })
              .from(schema.user)
              .where(eq(schema.user.id, session.userId))
              .limit(1);

            if (existingUser?.email) {
              const permitted = await isEmailPermittedToAccess(existingUser.email);
              if (!permitted) {
                log.warn("[auth/signin] Blocked unapproved sign-in", {
                  email: maskEmail(existingUser.email),
                });
                throw new APIError("FORBIDDEN", {
                  message: "Nexus is in private beta. Request access on the home page.",
                });
              }
            }
          }
          return { data: session };
        },
      },
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
  emailAndPassword: { enabled: true },
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET
      ? {
          apple: {
            clientId: process.env.APPLE_CLIENT_ID,
            clientSecret: process.env.APPLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.GITLAB_CLIENT_ID && process.env.GITLAB_CLIENT_SECRET
      ? {
          gitlab: {
            clientId: process.env.GITLAB_CLIENT_ID,
            clientSecret: process.env.GITLAB_CLIENT_SECRET,
          },
        }
      : {}),
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  }
});
