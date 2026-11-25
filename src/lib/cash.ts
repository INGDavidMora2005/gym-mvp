import { MembershipPayment, PaymentMethod } from '@/types';

type MethodKey = 'EFECTIVO' | 'NEQUI' | 'DAVPLATA' | 'PSE' | 'OTRO' | 'SIN_METODO';

export interface MethodSummary {
  total: number;
  count: number;
}

export interface CashSummary {
  total: number;
  count: number;
  byMethod: Record<MethodKey, MethodSummary>;
}

const ALL_METHODS: MethodKey[] = ['EFECTIVO', 'NEQUI', 'DAVPLATA', 'PSE', 'OTRO', 'SIN_METODO'];

function emptyMethodSummary(): MethodSummary {
  return { total: 0, count: 0 };
}

function emptyCashSummary(): CashSummary {
  const byMethod: Record<MethodKey, MethodSummary> = {} as Record<MethodKey, MethodSummary>;
  for (const method of ALL_METHODS) {
    byMethod[method] = emptyMethodSummary();
  }
  return { total: 0, count: 0, byMethod };
}

function methodKey(paymentMethod: PaymentMethod | null): MethodKey {
  if (paymentMethod === null) return 'SIN_METODO';
  return paymentMethod;
}

/**
 * Resume un array de pagos de membresía agrupando por método de pago.
 * payment_method null se cuenta como 'SIN_METODO'.
 * Incluye todas las claves aunque estén en 0.
 */
export function summarizeCash(payments: MembershipPayment[]): CashSummary {
  const summary = emptyCashSummary();

  for (const payment of payments) {
    const key = methodKey(payment.payment_method);
    summary.byMethod[key].total += payment.amount_cop;
    summary.byMethod[key].count += 1;
    summary.total += payment.amount_cop;
    summary.count += 1;
  }

  return summary;
}