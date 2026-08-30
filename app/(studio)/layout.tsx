import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { StudioProvider } from '@/components/studio-provider';

export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <StudioProvider>
      <AppShell>{children}</AppShell>
    </StudioProvider>
  );
}
