import { AuthLayout } from "@/components/auth/auth-layout";
import { RegistrationForm } from "@/components/auth/registration-form";
import { env } from "@/lib/env";

export default function RegisterPage() {
  return (
    <AuthLayout>
      <RegistrationForm signupMode={env.SIGNUP_MODE} />
    </AuthLayout>
  );
}
