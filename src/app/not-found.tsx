import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-100 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-ink-200 shadow-sm p-8 text-center space-y-4">
        <p className="font-display text-5xl font-bold text-brand-600">404</p>
        <h1 className="font-display text-xl font-bold text-ink-900">Página no encontrada</h1>
        <p className="text-sm text-ink-600">
          La página que buscas no existe o fue movida.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-all"
        >
          Volver al Dashboard
        </Link>
      </div>
    </div>
  );
}
