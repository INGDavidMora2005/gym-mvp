'use client';

import { useActionState } from 'react';
import { loginAction } from '../actions';

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-ink-900 mb-2">
            Bienvenido Admin
          </h1>
          <p className="text-ink-500">Ingresa con tu cuenta de dueño</p>
        </div>

        <div className="bg-white rounded-2xl border border-ink-200 shadow-xs p-6">
          <form action={formAction} className="space-y-4">
            {state?.error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
                {state.error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">Correo</label>
              <input
                type="email"
                name="email"
                required
                placeholder="admin@example.com"
                className="w-full px-4 py-2.5 rounded-xl border border-ink-200 text-sm focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">Contraseña</label>
              <input
                type="password"
                name="password"
                required
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl border border-ink-200 text-sm focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
            >
              {pending ? 'Ingresando...' : 'Acceder'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
