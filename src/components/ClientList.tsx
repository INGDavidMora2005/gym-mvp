'use client';

import { useState } from 'react';
import { Search, RefreshCw, MessageCircle, Phone, UserCheck, Calendar } from 'lucide-react';
import { ClientWithStatus } from '@/types';
import { StatusBadge, Button } from './UIComponents';
import { formatDate, buildWhatsAppUrl, generateExpirationMessage, FIXED_FEE_COP, formatCOP } from '@/lib/utils';
import Link from 'next/link';

export function ClientList({
  initialClients,
  onRenew,
  onRecordAttendance,
}: {
  initialClients: ClientWithStatus[];
  onRenew: (clientId: string) => Promise<void>;
  onRecordAttendance: (clientId: string) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'TODOS' | 'ACTIVO' | 'POR_VENCER' | 'VENCIDO'>('TODOS');
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const filtered = initialClients.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search);
    const matchesStatus =
      filterStatus === 'TODOS' ? true : c.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleRenewClick = async (clientId: string) => {
    if (!confirm(`¿Confirmar renovación por ${formatCOP(FIXED_FEE_COP)} para este cliente?`)) return;
    setLoadingId(clientId);
    try {
      await onRenew(clientId);
    } finally {
      setLoadingId(null);
    }
  };

  const handleAttendanceClick = async (clientId: string) => {
    setLoadingId(clientId);
    try {
      await onRecordAttendance(clientId);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-ink-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          />
        </div>

        <div className="flex gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(['TODOS', 'ACTIVO', 'POR_VENCER', 'VENCIDO'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                filterStatus === st
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
              }`}
            >
              {st === 'TODOS' ? 'Todos' : st === 'ACTIVO' ? 'Activos' : st === 'POR_VENCER' ? 'Por Vencer' : 'Vencidos'}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Tarjetas de Clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((c) => {
          const waUrl = buildWhatsAppUrl(
            c.phone,
            generateExpirationMessage(c.name, c.days_left, c.next_expiration)
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
                      Vence: <strong className="text-ink-800">{formatDate(c.next_expiration)}</strong>
                    </span>
                  </div>
                  {c.days_left !== null && (
                    <p className="text-[11px] text-ink-500 pl-5">
                      {c.days_left < 0
                        ? `Vencido hace ${Math.abs(c.days_left)} días`
                        : c.days_left === 0
                        ? '¡Vence HOY!'
                        : `Quedan ${c.days_left} días de suscripción`}
                    </p>
                  )}
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="pt-3 border-t border-ink-100 grid grid-cols-3 gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={loadingId === c.id}
                  onClick={() => handleRenewClick(c.id)}
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
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-ink-200">
            <p className="text-sm text-ink-500 font-medium">No se encontraron clientes con esos filtros.</p>
          </div>
        )}
      </div>
    </div>
  );
}