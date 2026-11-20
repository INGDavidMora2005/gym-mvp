import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gimnasio MVP - Panel de Gestión',
  description: 'Sistema administrativo privado para gimnasios',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen flex flex-col bg-ink-100 text-ink-900 antialiased selection:bg-brand-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}