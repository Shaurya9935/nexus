import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
});

export async function registerPendingAccount(data: {
  name: string;
  email: string;
  password: string;
}) {
  return await authClient.$fetch<{ success: boolean; message: string }>(
    "/pending-registration/register",
    {
      method: "POST",
      body: data,
    }
  );
}

export async function verifyPendingAccount(data: {
  email: string;
  otp: string;
}) {
  return await authClient.$fetch<{
    status: boolean;
    token: string;
    user: {
      id: string;
      name: string;
      email: string;
      emailVerified: boolean;
    };
  }>("/pending-registration/verify", {
    method: "POST",
    body: data,
  });
}

export async function resendPendingAccountOtp(data: { email: string }) {
  return await authClient.$fetch<{ success: boolean; message: string }>(
    "/pending-registration/resend-otp",
    {
      method: "POST",
      body: data,
    }
  );
}
