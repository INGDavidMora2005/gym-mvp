import React from 'react';
import { ClientStatus } from '@/types';

export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border border-ink-200 shadow-sm hover:shadow-md transition-all duration-300 p-6 ${className}`}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'whatsapp';
  size?: 'sm' | 'md' | 'lg';
}) {
  const base =
    'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none';

  const variants = {
    primary:
      'bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-500 shadow-sm shadow-brand-200',
    secondary:
      'bg-ink-100 text-ink-800 hover:bg-ink-200 focus:ring-ink-400 border border-ink-200',
    danger:
      'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-sm shadow-red-200',
    ghost:
      'text-ink-600 hover:bg-ink-100 hover:text-ink-900 focus:ring-ink-300',
    whatsapp:
      'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500 shadow-sm shadow-emerald-200',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2.5 gap-2',
    lg: 'text-base px-5 py-3 gap-2.5',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function StatusBadge({ status }: { status: ClientStatus }) {
  const styles: Record<ClientStatus, string> = {
    ACTIVO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    POR_VENCER: 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse-soft',
    VENCIDO: 'bg-rose-50 text-rose-700 border-rose-200',
    SIN_PAGO: 'bg-ink-50 text-ink-700 border-ink-200',
  };

  const labels: Record<ClientStatus, string> = {
    ACTIVO: 'Activo',
    POR_VENCER: 'Por vencer',
    VENCIDO: 'Vencido',
    SIN_PAGO: 'Sin pago',
  };

  const dots: Record<ClientStatus, string> = {
    ACTIVO: 'bg-emerald-500',
    POR_VENCER: 'bg-amber-500',
    VENCIDO: 'bg-rose-500',
    SIN_PAGO: 'bg-ink-500',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status]}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dots[status]}`}
      />
      {labels[status]}
    </span>
  );
}