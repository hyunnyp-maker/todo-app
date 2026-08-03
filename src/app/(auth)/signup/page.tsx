import { AuthForm } from "@/components/auth/AuthForm";
import { Providers } from "@/app/providers";

export default function SignupPage() {
  return (
    <Providers>
      <AuthForm mode="signup" />
    </Providers>
  );
}
