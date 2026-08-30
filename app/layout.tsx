import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Agent Evidence Studio', template: '%s · Agent Evidence Studio' },
  description: 'Evidence-first local agent orchestration with replayable runs, conflict-safe memory, and source-bound research.',
  applicationName: 'Agent Evidence Studio',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  openGraph: {
    type: 'website', title: 'Agent Evidence Studio',
    description: 'See what your agents did. Merge what they remember. Verify what they claim.',
    images: ['/og.png'],
  },
  twitter: { card: 'summary_large_image', images: ['/og.png'] },
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
