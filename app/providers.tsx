"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { usePathname } from "next/navigation";
import { VaultProvider } from "@/components/vault-provider";
import { VaultSetupModal } from "@/components/vault-setup-modal";
import { VaultUnlockModal } from "@/components/vault-unlock-modal";
import { Toaster } from "@/components/ui/sonner";

function VaultShell({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();
  if (status === "loading") return null;
  if (status === "unauthenticated" || pathname === "/login") return <>{children}</>;
  return (
    <VaultProvider>
      {children}
      <VaultSetupModal />
      <VaultUnlockModal />
    </VaultProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <VaultShell>{children}</VaultShell>
        <Toaster richColors position="bottom-right" />
      </ThemeProvider>
    </SessionProvider>
  );
}
