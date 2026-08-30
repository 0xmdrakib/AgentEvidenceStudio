import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Agent Evidence Studio', template: '%s · Agent Evidence Studio' },
  description: 'Replayable agent evidence, conflict-safe memory, and source-bound multi-agent research.',
  applicationName: 'Agent Evidence Studio',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://agentevidencestudio.rakibhq.xyz'),
  openGraph: {
    type: 'website', title: 'Agent Evidence Studio',
    description: 'See what your agents did. Merge what they remember. Verify what they claim.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Agent Evidence Studio — record, reconcile, and verify agent decisions' }],
  },
  twitter: { card: 'summary_large_image', title: 'Agent Evidence Studio', description: 'Record what agents did. Reconcile what they remember. Verify what they claim.', images: ['/og.png'] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
