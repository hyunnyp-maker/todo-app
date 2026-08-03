import { AppShell } from "@/components/AppShell";
import { Providers } from "./providers";

export default function Home() {
  return (
    <Providers>
      <AppShell />
    </Providers>
  );
}
