import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pendelkunst — pendelmaleri med ekte fysikk',
    short_name: 'Pendelkunst',
    description: 'Lag vakre malerier med ekte pendelfysikk og eksporter i høy oppløsning.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    lang: 'no',
    orientation: 'any',
    categories: ['art', 'entertainment', 'graphics'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
