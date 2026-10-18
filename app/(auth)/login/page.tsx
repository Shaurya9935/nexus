import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginForm } from "@/components/auth/login-form";
import { env } from "@/lib/env";

export default function LoginPage() {
  return (
    <AuthLayout>
      <LoginForm signupMode={env.SIGNUP_MODE} />
    </AuthLayout>
  );
}
