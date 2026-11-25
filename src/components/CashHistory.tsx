'use client';

import { CashClosing } from '@/types';
import { Card } from './UIComponents';
import { formatCOP, formatTime } from '@/lib/utils';

interface CashHistoryProps {
  closings: CashClosing[];
  dayClosings: CashClosing[];
  businessDate: string;
  currentExpected: number;
}

export function CashHistory({ closings, dayClosings, businessDate, currentExpected }: CashHistoryProps) {
  // El vigente es el primero de la lista (ordenado por created_at desc)
  const latestClosing = closings[0] || null;
  const isLatestForDay = latestClosing && latestClosing.business_date === businessDate;

  // Para el historial, mostramos los del día seleccionado si hay, sino los 10 más recientes
  const displayClosings = dayClosings.length > 0 ? dayClosings : closings;

  return (
    <Card>
      <h3 className="font-display text-lg font-semibold text-ink-900 mb-4 flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-ink-100 flex items-center justify-center">
          <svg className="w-4 h-4 text-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
        Historial de Cierres
        {dayClosings.length > 0 && (
          <span className="text-xs font-normal text-ink-500 ml-2">({dayClosings.length} de {businessDate})</span>
        )}
      </h3>

      {displayClosings.length === 0 ? (
        <div className="text-center py-8 text-ink-500">
          No hay cierres registrados aún
        </div>
      ) : (
        <div className="space-y-2">
          {displayClosings.map((closing, index) => {
            const isCurrent = isLatestForDay && index === 0;
            const isStale = isCurrent && closing.expected_cash_cop !== currentExpected;
            const differenceColor = closing.difference_cop === 0 ? 'text-emerald-700' :
              closing.difference_cop > 0 ? 'text-amber-700' : 'text-rose-700';
            const differenceLabel = closing.difference_cop === 0 ? 'Cuadrado' :
              closing.difference_cop > 0 ? `Sobrante ${formatCOP(closing.difference_cop)}` :
              `Faltante ${formatCOP(Math.abs(closing.difference_cop))}`;

            return (
              <div
                key={closing.id}
                className={`p-4 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-brand-50 border-brand-200 ring-2 ring-brand-200'
                    : 'bg-white border-ink-100 hover:border-ink-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {isCurrent && (
                      <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-100 text-brand-700">
                        Vigente
                      </span>
                    )}
                    <div>
                      <p className="font-medium text-ink-900 truncate">
                        {formatDate(closing.business_date)}
                      </p>
                      <p className="text-xs text-ink-500">
                        Cerrado por {closing.closed_by} · {formatTime(closing.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-500">Esperado:</span>
                      <span className="font-mono font-semibold text-ink-900">{formatCOP(closing.expected_cash_cop)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-500">Contado:</span>
                      <span className="font-mono font-semibold text-ink-900">{formatCOP(closing.counted_cash_cop)}</span>
                    </div>
                    <div className={`flex items-center gap-2 font-mono font-semibold ${differenceColor}`}>
                      {differenceLabel}
                    </div>
                  </div>
                </div>

                {isStale && (
                  <div className="mt-3 pt-3 border-t border-brand-200 flex items-start gap-2">
                    <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-xs text-amber-700">
                      <strong>El esperado cambió desde este cierre:</strong> era {formatCOP(closing.expected_cash_cop)}, ahora es {formatCOP(currentExpected)}.
                      {' '}
                      <span className="font-medium">Esto ocurre si se anuló un pago en efectivo después del cierre.</span>
                    </p>
                  </div>
                )}

                {closing.note && (
                  <div className="mt-2 pt-2 border-t border-ink-100">
                    <p className="text-xs text-ink-600">
                      <strong>Nota:</strong> {closing.note}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}