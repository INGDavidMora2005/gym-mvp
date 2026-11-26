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
 * Extrae el nombre del cliente de un embed de PostgREST.
 * PostgREST puede devolver la relación muchos-a-uno como objeto ({ name })
 * o como array ([{ name }]). También tolera null/undefined.
 * Si no hay un nombre válido devuelve 'Cliente desconocido'.
 */
export function clientNameFrom(embed: unknown): string {
  if (embed === null || embed === undefined) return 'Cliente desconocido';

  const pickName = (value: unknown): string | null => {
    if (typeof value !== 'object' || value === null) return null;
    const name = (value as { name?: unknown }).name;
    return typeof name === 'string' && name.trim() !== '' ? name : null;
  };

  if (Array.isArray(embed)) {
    return pickName(embed[0]) ?? 'Cliente desconocido';
  }

  return pickName(embed) ?? 'Cliente desconocido';
}

/**
 * Resume un array de pagos de membresía agrupando por método de pago.
 * payment_method null se cuenta como 'SIN_METODO'.
 * Incluye todas las claves aunque estén en 0.
 *
 * Acepta cualquier objeto con `amount_cop` y `payment_method` para poder
 * reutilizarse con filas de reportes que no traen el resto de columnas.
 */
export function summarizeCash(
  payments: ReadonlyArray<Pick<MembershipPayment, 'amount_cop' | 'payment_method'>>,
): CashSummary {
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