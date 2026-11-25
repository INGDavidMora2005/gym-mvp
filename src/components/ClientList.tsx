'use client';

import { useState } from 'react';
import { Search, RefreshCw, MessageCircle, Phone, UserCheck, Calendar, X } from 'lucide-react';
import { ClientWithStatus, PaymentMethod } from '@/types';
import { StatusBadge, Button } from './UIComponents';
import {
  formatDate,
  buildWhatsAppUrl,
  generateExpirationMessage,
  generatePendingPaymentMessage,
  FIXED_FEE_COP,
  formatCOP,
} from '@/lib/utils';
import Link from 'next/link';
import { Pagination } from './Pagination';

const PAYMENT_METHODS: PaymentMethod[] = ['EFECTIVO', 'NEQUI', 'DAVPLATA', 'PSE', 'OTRO'];

export function ClientList({
  clients,
  total,
  page,
  pageCount,
  currentQ = '',
  currentStatus = 'TODOS',
  onRenew,
  onRecordAttendance,
}: {
  clients: ClientWithStatus[];
  total: number;
  page: number;
  pageCount: number;
  currentQ?: string;
  currentStatus?: string;
  onRenew: (clientId: string, paymentMethod: string) => Promise<void>;
  onRecordAttendance: (clientId: string) => Promise<void>;
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [renewPanel, setRenewPanel] = useState<{ clientId: string; habitualMethod: PaymentMethod } | null>(null);

  const handleRenewClick = (clientId: string, habitualMethod: PaymentMethod) => {
    setRenewPanel({ clientId, habitualMethod });
  };

  const [renewError, setRenewError] = useState<string | null>(null);

  const handleRenewConfirm = async (paymentMethod: string) => {
    if (!renewPanel) return;
    const { clientId } = renewPanel;
    setLoadingId(clientId);
    setRenewError(null);
    try {
      await onRenew(clientId, paymentMethod);
      setRenewPanel(null);
    } catch (e) {
      console.error('[handleRenewConfirm]', e);
      setRenewError('No se pudo renovar. Intenta de nuevo.');
    } finally {
      setLoadingId(null);
    }
  };

  const handleRenewCancel = () => {
    setRenewPanel(null);
  };

  const handleAttendanceClick = async (clientId: string) => {
    setLoadingId(clientId);
    try {
      await onRecordAttendance(clientId);
    } finally {
      setLoadingId(null);
    }
  };

  const buildStatusUrl = (status: string) => {
    const params = new URLSearchParams();
    if (currentQ) params.set('q', currentQ);
    if (status !== 'TODOS') params.set('status', status);
    const query = params.toString();
    return query ? `?${query}` : '?';
  };

  return (
    <div className="space-y-4">
      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <form method="get" className="relative w-full sm:w-80 flex gap-2">
          {currentStatus && currentStatus !== 'TODOS' && (
            <input type="hidden" name="status" value={currentStatus} />
          )}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              name="q"
              defaultValue={currentQ}
              placeholder="Buscar por nombre o teléfono..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-ink-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors"
          >
            Buscar
          </button>
        </form>

        <div className="flex gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(['TODOS', 'ACTIVO', 'POR_VENCER', 'VENCIDO', 'SIN_PAGO'] as const).map((st) => {
            const isSelected = currentStatus === st;
            return (
              <Link
                key={st}
                href={buildStatusUrl(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                }`}
              >
                {st === 'TODOS'
                  ? 'Todos'
                  : st === 'ACTIVO'
                  ? 'Activos'
                  : st === 'POR_VENCER'
                  ? 'Por Vencer'
                  : st === 'VENCIDO'
                  ? 'Vencidos'
                  : 'Sin pago'}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Lista de Tarjetas de Clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((c) => {
          const waUrl = buildWhatsAppUrl(
            c.phone,
            c.status === 'SIN_PAGO'
              ? generatePendingPaymentMessage(c.name)
              : generateExpirationMessage(c.name, c.days_left, c.next_expiration)
          );

          return (
            <div
              key={c.id}
              className="bg-white rounded-2xl border border-ink-200 p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Link
                    href={`/clients/${c.id}`}
                    className="font-display font-semibold text-ink-900 text-base hover:text-brand-600 transition-colors line-clamp-1"
                  >
                    {c.name}
                  </Link>
                  <StatusBadge status={c.status} />
                </div>

                <div className="space-y-1 text-xs text-ink-600 mb-4">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-ink-400" />
                    <span>{c.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-ink-400" />
                    <span>
                      Vence:{' '}
                      <strong className="text-ink-800">
                        {c.days_left !== null
                          ? formatDate(c.next_expiration)
                          : 'Sin pagos registrados'}
                      </strong>
                    </span>
                  </div>
                  {c.days_left !== null ? (
                    <p className="text-[11px] text-ink-500 pl-5">
                      {c.days_left < 0
                        ? `Vencido hace ${Math.abs(c.days_left)} días`
                        : c.days_left === 0
                        ? '¡Vence HOY!'
                        : `Quedan ${c.days_left} días de suscripción`}
                    </p>
                  ) : (
                    <p className="text-[11px] text-ink-500 pl-5">
                      Sin pagos registrados
                    </p>
                  )}
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="pt-3 border-t border-ink-100">
                {renewPanel && renewPanel.clientId === c.id ? (
                  <div className="space-y-2 p-3 bg-brand-50 rounded-xl border border-brand-200 animate-slide-down">
                    <div className="flex items-center gap-2">
                      <label htmlFor={`payment-method-${c.id}`} className="text-xs font-medium text-ink-700 w-24 shrink-0">
                        Método
                      </label>
                      <select
                        id={`payment-method-${c.id}`}
                        className="flex-1 px-3 py-2 text-sm border border-ink-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={loadingId === c.id}
                        defaultValue={renewPanel.habitualMethod}
                        onChange={(e) => handleRenewConfirm(e.target.value)}
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        disabled={loadingId === c.id}
                        onClick={() => handleRenewConfirm(renewPanel.habitualMethod)}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Confirmar {formatCOP(FIXED_FEE_COP)}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRenewCancel}
                        disabled={loadingId === c.id}
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Cancelar</span>
                      </Button>
                    </div>
                    {renewError && (
                      <p className="text-xs text-red-600 text-center">{renewError}</p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={loadingId === c.id}
                      onClick={() => handleRenewClick(c.id, c.payment_method)}
                      title={`Renovar suscripción de ${formatCOP(FIXED_FEE_COP)}`}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Renovar</span>
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={loadingId === c.id}
                      onClick={() => handleAttendanceClick(c.id)}
                      title="Marcar ingreso del día"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Entró</span>
                    </Button>

                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1 text-xs font-medium px-2 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-all"
                      title="Enviar aviso por WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Aviso</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {clients.length === 0 && (
          <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-ink-200 space-y-3">
            <p className="text-sm text-ink-500 font-medium">No se encontraron clientes</p>
            <div>
              <Link
                href="?"
                className="inline-flex items-center text-xs font-semibold text-brand-600 hover:text-brand-700 underline"
              >
                Limpiar búsqueda
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Paginación */}
      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        q={currentQ}
        status={currentStatus}
      />
    </div>
  );
}