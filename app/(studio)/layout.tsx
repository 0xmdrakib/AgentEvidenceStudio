import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { AuthGate } from '@/components/auth-gate';
import { StudioProvider } from '@/components/studio-provider';
export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <StudioProvider>
        <AppShell>{children}</AppShell>
      </StudioProvider>
    </AuthGate>
  );
}
