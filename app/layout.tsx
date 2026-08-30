import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cerca · Gestión médica familiar',
  description: 'Turnos, medicamentos y pendientes importantes en un solo lugar.',
  openGraph: {
    title: 'Cerca · Gestión médica familiar',
    description: 'Turnos, medicamentos y pendientes importantes en un solo lugar.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Cerca · Gestión médica familiar' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cerca · Gestión médica familiar',
    description: 'Turnos, medicamentos y pendientes importantes en un solo lugar.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
