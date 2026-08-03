import { AuthForm } from "@/components/auth/AuthForm";
import { Providers } from "@/app/providers";

export default function ResetPage() {
  return (
    <Providers>
      <AuthForm mode="reset" />
    </Providers>
  );
}
