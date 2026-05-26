import './globals.css';

import type { Metadata, Viewport } from 'next';
import { Inter, Bricolage_Grotesque } from 'next/font/google';
import type { ReactNode } from 'react';
import { defaultLocale } from '@/i18n';
import { ThemeProvider } from '@/components/theme-provider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'V Torneig de Pàdel les Coves de Vinromà — 2026',
    template: '%s · V Torneig Pàdel les Coves',
  },
  description: 'Web oficial del V Torneig de Pàdel les Coves de Vinromà (2026).',
  authors: [{ name: 'Club Pàdel les Coves' }],
  openGraph: {
    title: 'V Torneig de Pàdel les Coves de Vinromà — 2026',
    description: "Del 6 de juliol al 9 d'agost. 4 categories. 3 pistes.",
    locale: 'ca_ES',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a1f12' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang={defaultLocale}
      suppressHydrationWarning
      className={`${inter.variable} ${bricolage.variable}`}
    >
      <body className="min-h-screen antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
