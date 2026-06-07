import type { Metadata, Viewport } from 'next';
import './globals.css';

const description =
  'Lag vakre malerier med ekte pendelfysikk. Slipp eller kast pendelen, velg farger, pensler og symmetri, og eksporter kunsten i høy oppløsning.';

export const metadata: Metadata = {
  metadataBase: new URL('https://pendelkunst.vercel.app'),
  title: {
    default: 'Pendelkunst — pendelmaleri med ekte fysikk',
    template: '%s · Pendelkunst',
  },
  description,
  applicationName: 'Pendelkunst',
  keywords: [
    'pendelkunst', 'pendelmaleri', 'harmonograf', 'pendulum art', 'Lissajous',
    'rosett', 'generativ kunst', 'sandpendel', 'pendulum painting', 'spirograf',
  ],
  authors: [{ name: 'ThorsenH1' }],
  creator: 'ThorsenH1',
  manifest: '/manifest.webmanifest',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Pendelkunst — pendelmaleri med ekte fysikk',
    description,
    url: '/',
    siteName: 'Pendelkunst',
    locale: 'nb_NO',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pendelkunst — pendelmaleri med ekte fysikk',
    description,
  },
  robots: { index: true, follow: true },
  category: 'art',
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body className="antialiased">{children}</body>
    </html>
  );
}
