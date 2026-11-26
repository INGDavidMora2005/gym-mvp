import { PaymentMethod } from '@/types';
import { toBogotaDayKey } from './dates';
import { summarizeCash } from './cash';

/**
 * Módulo puro (sin Supabase, sin ExcelJS) que calcula las estadísticas del
 * reporte. Se reutiliza en el route handler y en las pruebas unitarias.
 */

export type ReportMethodKey =
  | 'EFECTIVO'
  | 'NEQUI'
  | 'DAVPLATA'
  | 'PSE'
  | 'OTRO'
  | 'SIN_METODO';

const METHOD_ORDER: ReportMethodKey[] = [
  'EFECTIVO',
  'NEQUI',
  'DAVPLATA',
  'PSE',
  'OTRO',
  'SIN_METODO',
];

const METHOD_LABELS: Record<ReportMethodKey, string> = {
  EFECTIVO: 'Efectivo',
  NEQUI: 'Nequi',
  DAVPLATA: 'Daviplata',
  PSE: 'PSE',
  OTRO: 'Otro',
  SIN_METODO: 'Sin método',
};

/** Datos mínimos de un pago para calcular el resumen. */
export interface ReportPayment {
  paid_at: string;
  amount_cop: number;
  payment_method: PaymentMethod | null;
  voided_at: string | null;
}

/** Fila completa de pago tal como la devuelve export-data.ts. */
export interface ReportPaymentRow extends ReportPayment {
  id: string;
  client_id: string;
  client_name: string;
  recorded_by: string | null;
  period_start: string | null;
  period_end: string | null;
  voided_by: string | null;
  void_reason: string | null;
}

/** Datos mínimos de una asistencia para calcular el resumen. */
export interface ReportAttendance {
  client_id: string;
  check_in: string;
}

/** Fila completa de asistencia tal como la devuelve export-data.ts. */
export interface ReportAttendanceRow extends ReportAttendance {
  id: string;
  client_name: string;
  recorded_by: string | null;
}

export interface ReportMethodBreakdown {
  method: ReportMethodKey;
  /** Etiqueta legible ('Sin método' cuando payment_method es null). */
  label: string;
  count: number;
  total: number;
  /** Fracción 0..1 del total de ingresos (para formato '0.0%'). */
  share: number;
}

export interface ReportAttendanceDay {
  /** 'YYYY-MM-DD' en calendario de Bogotá. */
  date: string;
  count: number;
}

export interface ReportSummary {
  /** Ingresos de pagos NO anulados. */
  revenue_total: number;
  /** Número de pagos NO anulados. */
  payments_count: number;
  /** revenue_total / payments_count (0 si no hay pagos). */
  ticket_average: number;
  voided_count: number;
  voided_total: number;
  /** Solo métodos con al menos un pago, en orden fijo. */
  by_method: ReportMethodBreakdown[];
  attendance_total: number;
  distinct_attendees: number;
  /** Promedio de asistencias por día del rango (incluye días en 0). */
  avg_attendance_per_day: number;
  /** Día con más asistencias (empate: el más antiguo). null si no hubo. */
  busiest_day: ReportAttendanceDay | null;
  /** Todos los días del rango, incluidos los de 0 asistencias. */
  attendance_by_day: ReportAttendanceDay[];
}

/** Lista todos los días 'YYYY-MM-DD' entre from y to, ambos incluidos. */
function eachDayKey(from: string, to: string): string[] {
  const keys: string[] = [];
  const start = new Date(from + 'T00:00:00Z').getTime();
  const end = new Date(to + 'T00:00:00Z').getTime();

  for (let cursor = start; cursor <= end; cursor += 24 * 60 * 60 * 1000) {
    keys.push(new Date(cursor).toISOString().slice(0, 10));
  }

  return keys;
}

/**
 * Construye el resumen estadístico del periodo.
 *
 * - Los ingresos, el ticket promedio y el desglose por método excluyen los
 *   pagos anulados; los anulados se informan aparte.
 * - `payment_method` null se agrupa como 'Sin método'.
 * - `attendance_by_day` incluye todos los días del rango, incluso con 0.
 */
export function buildReportSummary({
  payments,
  attendance,
  from,
  to,
}: {
  payments: ReadonlyArray<ReportPayment>;
  attendance: ReadonlyArray<ReportAttendance>;
  from: string;
  to: string;
}): ReportSummary {
  const activePayments = payments.filter((p) => p.voided_at === null);
  const voidedPayments = payments.filter((p) => p.voided_at !== null);

  const revenueTotal = activePayments.reduce((acc, p) => acc + p.amount_cop, 0);
  const paymentsCount = activePayments.length;
  const voidedTotal = voidedPayments.reduce((acc, p) => acc + p.amount_cop, 0);

  const cashSummary = summarizeCash(activePayments);

  const byMethod: ReportMethodBreakdown[] = METHOD_ORDER
    .map((method) => {
      const entry = cashSummary.byMethod[method];
      return {
        method,
        label: METHOD_LABELS[method],
        count: entry.count,
        total: entry.total,
        share: revenueTotal > 0 ? entry.total / revenueTotal : 0,
      };
    })
    .filter((entry) => entry.count > 0);

  const days = eachDayKey(from, to);
  const dayCounts = new Map<string, number>(days.map((date) => [date, 0]));

  const attendees = new Set<string>();

  for (const row of attendance) {
    const dateKey = toBogotaDayKey(new Date(row.check_in));
    // Ignorar filas fuera del rango (defensa ante datos inesperados).
    if (!dayCounts.has(dateKey)) continue;
    dayCounts.set(dateKey, (dayCounts.get(dateKey) ?? 0) + 1);
    attendees.add(row.client_id);
  }

  const attendanceByDay: ReportAttendanceDay[] = days.map((date) => ({
    date,
    count: dayCounts.get(date) ?? 0,
  }));

  let busiestDay: ReportAttendanceDay | null = null;
  for (const day of attendanceByDay) {
    if (day.count > 0 && (!busiestDay || day.count > busiestDay.count)) {
      busiestDay = day;
    }
  }

  const attendanceTotal = attendanceByDay.reduce((acc, day) => acc + day.count, 0);
  const dayCount = days.length;
  const avgPerDay = dayCount > 0 ? attendanceTotal / dayCount : 0;

  return {
    revenue_total: revenueTotal,
    payments_count: paymentsCount,
    ticket_average: paymentsCount > 0 ? revenueTotal / paymentsCount : 0,
    voided_count: voidedPayments.length,
    voided_total: voidedTotal,
    by_method: byMethod,
    attendance_total: attendanceTotal,
    distinct_attendees: attendees.size,
    avg_attendance_per_day: avgPerDay,
    busiest_day: busiestDay,
    attendance_by_day: attendanceByDay,
  };
}
