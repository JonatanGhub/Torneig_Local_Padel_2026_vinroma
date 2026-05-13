import './globals.css';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: {
    default: 'V Torneig de Pàdel les Coves de Vinromà — 2026',
    template: '%s · V Torneig Pàdel les Coves',
  },
  description: 'Web oficial del V Torneig de Pàdel les Coves de Vinromà (2026).',
  authors: [{ name: 'Club Pàdel les Coves' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
