'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/UIComponents';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-100 p-4">
      <div className="w-full max-w-md bg-surface rounded-2xl border border-ink-200 shadow-sm p-8 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h1 className="font-display text-xl font-bold text-ink-900">Algo salió mal</h1>
        <p className="text-sm text-ink-600">
          No pudimos completar la operación. Intenta de nuevo.
        </p>
        <Button variant="primary" className="w-full" onClick={() => reset()}>
          Reintentar
        </Button>
      </div>
    </div>
  );
}
