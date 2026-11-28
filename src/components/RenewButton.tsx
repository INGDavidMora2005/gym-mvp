'use client';

import { useState } from 'react';
import { renewClientAction } from '@/app/actions/payments';
import { Button } from './UIComponents';
import { formatCOP, FIXED_FEE_COP } from '@/lib/utils';
import { RefreshCw, X } from 'lucide-react';
import { PaymentMethod } from '@/types';

interface RenewButtonProps {
  clientId: string;
  habitualMethod: PaymentMethod;
  fee?: number;
}

export function RenewButton({ clientId, habitualMethod, fee = FIXED_FEE_COP }: RenewButtonProps) {
  const [showPanel, setShowPanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(habitualMethod);
  const [renewError, setRenewError] = useState<string | null>(null);

  const PAYMENT_METHODS: PaymentMethod[] = ['EFECTIVO', 'NEQUI', 'DAVPLATA', 'PSE', 'OTRO'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setRenewError(null);
    try {
      await renewClientAction(clientId, selectedMethod);
      setShowPanel(false);
    } catch (e) {
      console.error('[handleSubmit]', e);
      setRenewError('No se pudo renovar. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setSelectedMethod(habitualMethod);
    setRenewError(null);
    setShowPanel(false);
  };

  if (showPanel) {
    return (
      <form onSubmit={handleSubmit} className="flex-1 sm:flex-initial">
        <div className="space-y-2 p-3 bg-brand-50 border border-brand-200 rounded-xl animate-slide-down w-full sm:w-[280px]">
          <div className="flex items-center gap-2">
            <label htmlFor={`payment-method-detail-${clientId}`} className="text-xs font-medium text-ink-700 w-24 shrink-0">
              Método
            </label>
            <select
              id={`payment-method-detail-${clientId}`}
              className="flex-1 px-3 py-2 text-sm border border-ink-200 rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value as PaymentMethod)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" className="flex-1" type="submit" disabled={loading}>
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Confirmar {formatCOP(fee)}</span>
            </Button>
            <Button variant="ghost" size="sm" type="button" onClick={handleCancel} disabled={loading}>
              <X className="w-3.5 h-3.5" />
              <span>Cancelar</span>
            </Button>
          </div>
          {renewError && (
            <p className="text-xs text-red-600 text-center">{renewError}</p>
          )}
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); setShowPanel(true); }} className="flex-1 sm:flex-initial">
      <Button variant="primary" type="submit" className="w-full">
        <RefreshCw className="w-4 h-4" />
        <span>Renovar {formatCOP(fee)}</span>
      </Button>
    </form>
  );
}