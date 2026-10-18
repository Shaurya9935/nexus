import { Suspense } from "react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

export const metadata = {
  title: "Verify your email - Nexus",
  description: "Enter your 6-digit verification code to access Nexus.",
};

export default function VerifyEmailPage() {
  return (
    <AuthLayout>
      <Suspense
        fallback={
          <div className="w-full max-w-[360px] py-12 flex items-center justify-center text-[var(--text-secondary)] text-[13px]">
            Loading…
          </div>
        }
      >
        <VerifyEmailForm />
      </Suspense>
    </AuthLayout>
  );
}
