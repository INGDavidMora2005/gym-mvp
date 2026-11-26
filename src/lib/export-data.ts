import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { parseBogotaDateKey, addDays } from '@/lib/dates';
import { clientNameFrom } from '@/lib/cash';
import {
  ReportAttendanceRow,
  ReportPaymentRow,
} from '@/lib/report';

/**
 * Lectura de datos para el reporte Excel.
 * Solo se importa desde el route handler (código de servidor).
 */

const BATCH_SIZE = 1000;
export const MAX_EXPORT_ROWS = 50000;

/** Se lanza cuando el rango supera el tope de filas permitido. */
export class ExportTooLargeError extends Error {
  constructor() {
    super(
      `El reporte supera el límite de ${MAX_EXPORT_ROWS.toLocaleString('es-CO')} filas. Acorta el rango de fechas.`,
    );
    this.name = 'ExportTooLargeError';
  }
}

/**
 * Rango [from 00:00 Bogotá, to+1 día 00:00 Bogotá) en instantes UTC.
 */
function bogotaRange(from: string, to: string): { start: Date; end: Date } {
  return {
    start: parseBogotaDateKey(from),
    end: addDays(parseBogotaDateKey(to), 1),
  };
}

/**
 * Pagos del rango, incluidos los anulados.
 * Orden estable: paid_at asc, id asc. Lanza ExportTooLargeError si se
 * superan MAX_EXPORT_ROWS filas (nunca trunca en silencio).
 */
export async function fetchPaymentsInRange(
  from: string,
  to: string,
): Promise<ReportPaymentRow[]> {
  const { start, end } = bogotaRange(from, to);
  const supabase = createSupabaseAdminClient();

  const rows: ReportPaymentRow[] = [];
  let fromIndex = 0;

  while (true) {
    const { data: batch, error } = await supabase
      .from('membership_payments')
      .select(`
        id,
        client_id,
        amount_cop,
        paid_at,
        payment_method,
        recorded_by,
        period_start,
        period_end,
        voided_at,
        voided_by,
        void_reason,
        clients!inner(name)
      `)
      .gte('paid_at', start.toISOString())
      .lt('paid_at', end.toISOString())
      .order('paid_at', { ascending: true })
      .order('id', { ascending: true })
      .range(fromIndex, fromIndex + BATCH_SIZE - 1);

    if (error) {
      console.error('[export-data:payments]', error.message);
      throw new Error('No se pudieron leer los pagos.');
    }

    if (!batch || batch.length === 0) break;

    for (const p of batch) {
      rows.push({
        id: p.id,
        client_id: p.client_id,
        amount_cop: p.amount_cop,
        paid_at: p.paid_at,
        payment_method: p.payment_method,
        recorded_by: p.recorded_by,
        period_start: p.period_start,
        period_end: p.period_end,
        voided_at: p.voided_at,
        voided_by: p.voided_by,
        void_reason: p.void_reason,
        client_name: clientNameFrom(p.clients),
      });

      if (rows.length > MAX_EXPORT_ROWS) {
        throw new ExportTooLargeError();
      }
    }

    fromIndex += batch.length;
    if (batch.length < BATCH_SIZE) break;
  }

  return rows;
}

/**
 * Asistencias del rango.
 * Orden estable: check_in asc, id asc. Lanza ExportTooLargeError si se
 * superan MAX_EXPORT_ROWS filas (nunca trunca en silencio).
 */
export async function fetchAttendanceInRange(
  from: string,
  to: string,
): Promise<ReportAttendanceRow[]> {
  const { start, end } = bogotaRange(from, to);
  const supabase = createSupabaseAdminClient();

  const rows: ReportAttendanceRow[] = [];
  let fromIndex = 0;

  while (true) {
    const { data: batch, error } = await supabase
      .from('attendance')
      .select(`
        id,
        client_id,
        check_in,
        recorded_by,
        clients!inner(name)
      `)
      .gte('check_in', start.toISOString())
      .lt('check_in', end.toISOString())
      .order('check_in', { ascending: true })
      .order('id', { ascending: true })
      .range(fromIndex, fromIndex + BATCH_SIZE - 1);

    if (error) {
      console.error('[export-data:attendance]', error.message);
      throw new Error('No se pudieron leer las asistencias.');
    }

    if (!batch || batch.length === 0) break;

    for (const a of batch) {
      rows.push({
        id: a.id,
        client_id: a.client_id,
        check_in: a.check_in,
        recorded_by: a.recorded_by,
        client_name: clientNameFrom(a.clients),
      });

      if (rows.length > MAX_EXPORT_ROWS) {
        throw new ExportTooLargeError();
      }
    }

    fromIndex += batch.length;
    if (batch.length < BATCH_SIZE) break;
  }

  return rows;
}
