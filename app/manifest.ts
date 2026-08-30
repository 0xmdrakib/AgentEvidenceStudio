import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Agent Evidence Studio',
    short_name: 'Agent Evidence',
    description: 'Replayable agent evidence, conflict-safe memory, and source-bound research.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fffaf0',
    theme_color: '#10231e',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
