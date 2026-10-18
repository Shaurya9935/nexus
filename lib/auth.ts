import { betterAuth, APIError } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import * as schema from "../db/auth";
import { db } from "./db";
import { env } from "./env";
import { isEmailPermittedToAccess, maskEmail } from "./waitlist";
import { log } from "./logger";
import { sendEmail } from "./email";
import { renderVerificationEmail } from "./email-templates/verification";
import { renderResetPasswordEmail } from "./email-templates/reset-password";
import { checkAndIncrementVerificationRateLimit } from "./verification-rate-limit";

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
          if (env.SIGNUP_MODE === "open") {
            return { data: user };
          }
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
              .select({
                email: schema.user.email,
                emailVerified: schema.user.emailVerified,
              })
              .from(schema.user)
              .where(eq(schema.user.id, session.userId))
              .limit(1);

            // Server-side enforcement: unverified users cannot create a session when verification is required
            if (
              env.REQUIRE_EMAIL_VERIFICATION &&
              existingUser &&
              !existingUser.emailVerified
            ) {
              log.warn("[auth/session] Blocked session creation for unverified user", {
                email: maskEmail(existingUser.email),
              });
              throw new APIError("UNAUTHORIZED", {
                message: "Email verification required",
              });
            }

            if (env.SIGNUP_MODE !== "open" && existingUser?.email) {
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
      "/email-otp/send-verification-otp": { window: 60, max: 3 },
      "/email-otp/verify-email": { window: 60, max: 10 },
    },
  },
  emailVerification: {
    sendOnSignUp: env.REQUIRE_EMAIL_VERIFICATION,
    sendOnSignIn: env.REQUIRE_EMAIL_VERIFICATION,
    autoSignInAfterVerification: true,
    expiresIn: 600, // 10 minutes
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: env.REQUIRE_EMAIL_VERIFICATION,
    autoSignIn: false,
    sendResetPassword: async ({ user, url }) => {
      const { html, text } = renderResetPasswordEmail({ url });
      await sendEmail({
        to: user.email,
        subject: "Reset your Nexus password",
        html,
        text,
      });
    },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 600, // 10 minutes
      allowedAttempts: 5,
      sendVerificationOnSignUp: env.REQUIRE_EMAIL_VERIFICATION,
      overrideDefaultEmailVerification: env.REQUIRE_EMAIL_VERIFICATION,
      storeOTP: "hashed",
      sendVerificationOTP: async ({ email, otp }, ctx) => {
        // 1. In invite mode, verify permission before sending anything
        if (env.SIGNUP_MODE === "invite") {
          const permitted = await isEmailPermittedToAccess(email);
          if (!permitted) {
            log.warn("[auth/email-otp] Blocked OTP send for unapproved email in invite mode", {
              email: maskEmail(email),
            });
            return;
          }
        }

        // 2. Extract client IP from headers/context
        const clientIp =
          ctx?.request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          ctx?.request?.headers?.get("x-real-ip")?.trim() ||
          ctx?.headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() ||
          undefined;

        // 3. Check & record rate limits in DB
        const rateLimitRes = await checkAndIncrementVerificationRateLimit({
          email,
          ip: clientIp,
        });

        if (!rateLimitRes.allowed) {
          log.warn("[auth/email-otp] Verification OTP rate limited", {
            email: maskEmail(email),
            reason: rateLimitRes.reason,
          });
          if (rateLimitRes.reason === "global_daily") {
            throw new APIError("TOO_MANY_REQUESTS", {
              message: "We're sending a lot of emails right now. Please try again later.",
            });
          }
          if (rateLimitRes.reason === "cooldown") {
            throw new APIError("TOO_MANY_REQUESTS", {
              message: rateLimitRes.message || "Please wait before requesting another code.",
            });
          }
          throw new APIError("TOO_MANY_REQUESTS", {
            message: rateLimitRes.message || "Too many attempts. Please try again later.",
          });
        }

        // 4. Render and dispatch email
        const { html, text } = renderVerificationEmail({ code: otp });
        await sendEmail({
          to: email,
          subject: "Verify your email - Nexus",
          html,
          text,
          devCode: otp,
        });
      },
    }),
  ],
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
  },
});

