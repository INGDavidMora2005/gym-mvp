'use client';

import { useActionState } from 'react';
import { closeCashAction } from '@/app/actions/cash';
import { CashClosing } from '@/types';
import { Card, Button } from './UIComponents';
import { formatCOP } from '@/lib/utils';

interface CashClosingFormProps {
  businessDate: string;
  expectedCashCop: number;
  latestClosing: CashClosing | null;
  currentExpected: number;
}

export function CashClosingForm({ businessDate, expectedCashCop, latestClosing, currentExpected }: CashClosingFormProps) {
  const [formState, formAction, isPending] = useActionState(closeCashAction, {
    ok: false,
    expected_cash_cop: expectedCashCop,
  });

  const lastDifference =
  formState.ok && formState.difference_cop !== undefined
    ? formState.difference_cop
    : null;

  const differenceColor = lastDifference === null ? '' :
    lastDifference === 0 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
    lastDifference > 0 ? 'text-amber-700 bg-amber-50 border-amber-200' :
    'text-rose-700 bg-rose-50 border-rose-200';

  const differenceLabel = lastDifference === null ? '' :
    lastDifference === 0 ? 'Cuadrado ✓' :
    lastDifference > 0 ? `Sobrante ${formatCOP(lastDifference)}` :
    `Faltante ${formatCOP(Math.abs(lastDifference))}`;

  const isCurrentClosingStale = !!latestClosing && latestClosing.expected_cash_cop !== currentExpected;

  return (
    <Card>
      <h3 className="font-display text-lg font-semibold text-ink-900 mb-4 flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-ink-100 flex items-center justify-center">
          <svg className="w-4 h-4 text-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
        Cierre de Caja
      </h3>

      {isCurrentClosingStale && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">El esperado cambió desde el cierre del día</p>
            <p className="text-xs text-amber-700 mt-1">
              El cierre vigente esperaba {formatCOP(latestClosing.expected_cash_cop)} pero el esperado actual es {formatCOP(currentExpected)}.
              Esto puede pasar si se anuló un pago en efectivo después del cierre.
            </p>
          </div>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Efectivo esperado (calculado en servidor, solo lectura) */}
          <div>
            <label htmlFor="expected_cash_cop" className="block text-xs font-medium text-ink-600 mb-1">
              Efectivo esperado (calculado en servidor)
            </label>
            <div className="w-full px-4 py-3 rounded-xl bg-ink-50 border border-ink-200 font-mono text-lg font-semibold text-ink-900">
              {formatCOP(expectedCashCop)}
            </div>
            <p className="text-xs text-ink-500 mt-1">Suma de pagos en EFECTIVO no anulados de {businessDate}</p>
          </div>

          {/* Efectivo contado */}
          <div>
            <label htmlFor="counted_cash_cop" className="block text-xs font-medium text-ink-600 mb-1">
              Efectivo contado <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              id="counted_cash_cop"
              name="counted_cash_cop"
              inputMode="numeric"
              placeholder="Ej: 150000 o 150.000"
              className="w-full px-4 py-3 rounded-xl border border-ink-200 bg-white text-lg font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
              required
              autoComplete="off"
            />
            {formState.fieldErrors?.counted_cash_cop && (
              <p className="text-xs text-rose-600 mt-1">{formState.fieldErrors.counted_cash_cop[0]}</p>
            )}
          </div>
        </div>

        {/* Nota opcional */}
        <div>
          <label htmlFor="note" className="block text-xs font-medium text-ink-600 mb-1">
            Nota (opcional)
          </label>
          <textarea
            id="note"
            name="note"
            rows={2}
            placeholder="Observaciones sobre el cierre..."
            className="w-full px-4 py-3 rounded-xl border border-ink-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            maxLength={200}
          />
          {formState.fieldErrors?.note && (
            <p className="text-xs text-rose-600 mt-1">{formState.fieldErrors.note[0]}</p>
          )}
        </div>

        {/* Fecha oculta */}
        <input type="hidden" name="business_date" value={businessDate} />

        {/* Botón y diferencia */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t border-ink-100">
          <Button variant="primary" size="lg" type="submit" disabled={isPending} className="w-full sm:w-auto">
            {isPending ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Registrando...
              </>
            ) : (
              'Registrar cierre'
            )}
          </Button>

          {lastDifference !== null && (
            <div className={`px-4 py-2 rounded-xl border font-mono text-sm font-semibold ${differenceColor} animate-fade-in`}>
              {differenceLabel}
            </div>
          )}

          {formState.error && !formState.ok && (
            <p className="text-sm text-rose-600">{formState.error}</p>
          )}
        </div>
      </form>
    </Card>
  );
}