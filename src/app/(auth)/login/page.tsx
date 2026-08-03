import { AuthForm } from "@/components/auth/AuthForm";
import { Providers } from "@/app/providers";

export default function LoginPage() {
  return (
    <Providers>
      <AuthForm mode="login" />
    </Providers>
  );
}
