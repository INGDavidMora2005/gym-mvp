'use client';

import { MembershipPayment } from '@/types';
import { summarizeCash, CashSummary as CashSummaryType } from '@/lib/cash';
import { formatCOP } from '@/lib/utils';
import { Card } from './UIComponents';

interface CashSummaryProps {
  payments: (MembershipPayment & { clients: string })[];
  businessDate: string;
  currentExpected: number;
}

export function CashSummary({ payments, businessDate, currentExpected }: CashSummaryProps) {
  const summary: CashSummaryType = summarizeCash(payments);

  const methods = [
    { key: 'EFECTIVO' as const, label: 'Efectivo', icon: '💵' },
    { key: 'NEQUI' as const, label: 'Nequi', icon: '📱' },
    { key: 'DAVPLATA' as const, label: 'Daviplata', icon: '📲' },
    { key: 'PSE' as const, label: 'PSE', icon: '🏦' },
    { key: 'OTRO' as const, label: 'Otro', icon: '💳' },
    { key: 'SIN_METODO' as const, label: 'Sin método', icon: '❓' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Tarjetas principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400 rounded-xl">💰</div>
            <div>
              <p className="text-xs font-semibold text-ink-500 dark:text-ink-600 uppercase tracking-wider">Total del día</p>
              <p className="text-2xl font-bold text-ink-900 dark:text-ink-900">{formatCOP(summary.total)}</p>
            </div>
          </div>
          <p className="text-xs text-ink-500 dark:text-ink-600 mt-2">{summary.count} pago{summary.count !== 1 ? 's' : ''} registrados</p>
        </Card>

        <Card className="lg:col-span-1">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 rounded-xl">💵</div>
            <div>
              <p className="text-xs font-semibold text-ink-500 dark:text-ink-600 uppercase tracking-wider">Efectivo esperado</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{formatCOP(currentExpected)}</p>
            </div>
          </div>
          <p className="text-xs text-ink-500 dark:text-ink-600 mt-2">Sumado en servidor (pagos EFECTIVO no anulados)</p>
        </Card>

        <Card className="lg:col-span-1">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 rounded-xl">📊</div>
            <div>
              <p className="text-xs font-semibold text-ink-500 dark:text-ink-600 uppercase tracking-wider">Métodos usados</p>
              <p className="text-2xl font-bold text-ink-900 dark:text-ink-900">
                {methods.filter((m) => summary.byMethod[m.key].count > 0).length} / {methods.length}
              </p>
            </div>
          </div>
          <p className="text-xs text-ink-500 dark:text-ink-600 mt-2">Con al menos un pago</p>
        </Card>
      </div>

      {/* Desglose por método */}
      <Card>
        <h3 className="font-display text-lg font-semibold text-ink-900 dark:text-ink-900 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-ink-100 dark:bg-ink-200 flex items-center justify-center">
            <svg className="w-4 h-4 text-ink-500 dark:text-ink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </span>
          Desglose por método
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {methods.map(({ key, label, icon }) => {
            const data = summary.byMethod[key];
            const isZero = data.count === 0;
            return (
              <div
                key={key}
                className={`p-4 rounded-xl border transition-colors-200 ${
                  isZero
                    ? 'bg-ink-50 border-ink-100 dark:bg-ink-200 dark:border-ink-700 opacity-60'
                    : 'bg-surface border-ink-200 dark:border-ink-700 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-md'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{icon}</span>
                  <span className={`text-xs font-medium ${isZero ? 'text-ink-400 dark:text-ink-400' : 'text-ink-700 dark:text-ink-700'}`}>
                    {label}
                  </span>
                </div>
                <p className={`text-xl font-bold ${isZero ? 'text-ink-300 dark:text-ink-600' : 'text-ink-900 dark:text-ink-900'}`}>
                  {formatCOP(data.total)}
                </p>
                <p className={`text-xs ${isZero ? 'text-ink-400 dark:text-ink-400' : 'text-ink-500 dark:text-ink-600'}`}>
                  {data.count} pago{data.count !== 1 ? 's' : ''}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Lista de pagos */}
      {payments.length > 0 && (
        <Card>
          <h3 className="font-display text-lg font-semibold text-ink-900 dark:text-ink-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-ink-100 dark:bg-ink-200 flex items-center justify-center">
              <svg className="w-4 h-4 text-ink-500 dark:text-ink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599 1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            Pagos del día ({payments.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {payments.map((p) => {
              const clientName = p.clients;
              const methodLabel = p.payment_method || 'Sin método';
              const isCash = p.payment_method === 'EFECTIVO';
              return (
                <div
                  key={p.id}
                  className="p-3 rounded-lg bg-ink-50 border border-ink-100 dark:bg-ink-200 dark:border-ink-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium ${
                      isCash ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                      p.payment_method === 'NEQUI' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400' :
                      p.payment_method === 'DAVPLATA' ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400' :
                      p.payment_method === 'PSE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' :
                      p.payment_method === 'OTRO' ? 'bg-ink-100 text-ink-700 dark:bg-ink-200 dark:text-ink-700' :
                      'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                    }`}>
                      {isCash ? '💵' : p.payment_method === 'NEQUI' ? '📱' : p.payment_method === 'DAVPLATA' ? '📲' : p.payment_method === 'PSE' ? '🏦' : p.payment_method === 'OTRO' ? '💳' : '❓'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900 dark:text-ink-900 truncate">{clientName}</p>
                      <p className="text-xs text-ink-500 dark:text-ink-600">{methodLabel}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-mono font-semibold text-ink-900 dark:text-ink-900 whitespace-nowrap">{formatCOP(p.amount_cop)}</span>
                    <span className="text-xs text-ink-500 dark:text-ink-600 whitespace-nowrap">
                      {p.recorded_by || '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {payments.length === 0 && (
        <Card className="text-center py-8">
          <p className="text-ink-500 dark:text-ink-600">No hay pagos registrados para {businessDate}</p>
        </Card>
      )}
    </div>
  );
}