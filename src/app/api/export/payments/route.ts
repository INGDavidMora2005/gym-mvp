import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentOwner } from '@/lib/auth';
import { exportRangeSchema } from '@/lib/validation';
import { parseBogotaDateKey, addDays } from '@/lib/dates';
import { toCsv, toBogotaDateString, toBogotaTimeString } from '@/lib/csv';
import { logAudit } from '@/lib/audit';
import { clientNameFrom } from '@/lib/cash';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BATCH_SIZE = 1000;
const MAX_ROWS = 50000;

interface PaymentExportRow {
  fecha: string;
  hora: string;
  cliente: string;
  monto_cop: number;
  metodo: string;
  registrado_por: string;
  periodo_inicio: string;
  periodo_fin: string;
  estado: 'VIGENTE' | 'ANULADO';
  anulado_por: string;
  motivo_anulacion: string;
}

export async function GET(request: Request) {
  try {
    // Autenticación
    const owner = await getCurrentOwner();
    if (!owner) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Validar parámetros
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const validation = exportRangeSchema.safeParse({ from, to });
    if (!validation.success) {
      const message = validation.error.issues[0]?.message ?? 'Parámetros inválidos';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { from: fromDate, to: toDate } = validation.data;

    // Rango de Bogotá: [from 00:00, to 24:00) -> en UTC
    const dayStart = parseBogotaDateKey(fromDate);
    const dayEnd = addDays(parseBogotaDateKey(toDate), 1); // exclusivo

    const supabase = createSupabaseAdminClient();

    // Leer por lotes con paginación
    let allPayments: PaymentExportRow[] = [];
    let fromIndex = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error } = await supabase
        .from('membership_payments')
        .select(`
          id,
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
        .gte('paid_at', dayStart.toISOString())
        .lt('paid_at', dayEnd.toISOString())
        .order('paid_at', { ascending: true })
        .order('id', { ascending: true })
        .range(fromIndex, fromIndex + BATCH_SIZE - 1);

      if (error) {
        console.error('[export:payments]', error.message);
        return NextResponse.json({ error: 'Error al leer pagos' }, { status: 500 });
      }

      if (!batch || batch.length === 0) {
        hasMore = false;
        break;
      }

      // Transformar lote
      const rows: PaymentExportRow[] = batch.map((p) => ({
        fecha: toBogotaDateString(p.paid_at),
        hora: toBogotaTimeString(p.paid_at),
        cliente: clientNameFrom(p.clients),
        monto_cop: p.amount_cop,
        metodo: p.payment_method ?? 'Sin método',
        registrado_por: p.recorded_by ?? '—',
        periodo_inicio: p.period_start ? toBogotaDateString(p.period_start) : '',
        periodo_fin: p.period_end ? toBogotaDateString(p.period_end) : '',
        estado: p.voided_at ? 'ANULADO' : 'VIGENTE',
        anulado_por: p.voided_by ?? '',
        motivo_anulacion: p.void_reason ?? '',
      }));

      allPayments = allPayments.concat(rows);
      fromIndex += batch.length;

      // Verificar límite de filas
      if (allPayments.length > MAX_ROWS) {
        return NextResponse.json(
          { error: `Se superó el límite de ${MAX_ROWS} filas. Acorta el rango de fechas.` },
          { status: 413 }
        );
      }

      // Si el lote tiene menos de BATCH_SIZE, no hay más
      if (batch.length < BATCH_SIZE) {
        hasMore = false;
      }
    }

    // Definir columnas para CSV
    const columns = [
      { header: 'fecha', getValue: (r: PaymentExportRow) => r.fecha, isFormulaSafe: true },
      { header: 'hora', getValue: (r: PaymentExportRow) => r.hora, isFormulaSafe: true },
      { header: 'cliente', getValue: (r: PaymentExportRow) => r.cliente },
      { header: 'monto_cop', getValue: (r: PaymentExportRow) => r.monto_cop, isFormulaSafe: true },
      { header: 'metodo', getValue: (r: PaymentExportRow) => r.metodo },
      { header: 'registrado_por', getValue: (r: PaymentExportRow) => r.registrado_por },
      { header: 'periodo_inicio', getValue: (r: PaymentExportRow) => r.periodo_inicio, isFormulaSafe: true },
      { header: 'periodo_fin', getValue: (r: PaymentExportRow) => r.periodo_fin, isFormulaSafe: true },
      { header: 'estado', getValue: (r: PaymentExportRow) => r.estado, isFormulaSafe: true },
      { header: 'anulado_por', getValue: (r: PaymentExportRow) => r.anulado_por },
      { header: 'motivo_anulacion', getValue: (r: PaymentExportRow) => r.motivo_anulacion },
    ] as const;

    // Generar CSV
    const csv = toCsv(allPayments, columns);

    // Registrar auditoría (no bloquear si falla)
    try {
      await logAudit({
        owner,
        action: 'DATA_EXPORTED',
        entity: 'membership_payments',
        entityId: null,
        details: {
          type: 'payments',
          from: fromDate,
          to: toDate,
          rows: allPayments.length,
        },
      });
    } catch (auditError) {
      console.error('[export:payments:audit]', auditError);
      // No romper la descarga
    }

    // Responder con CSV
    const filename = `pagos_${fromDate}_a_${toDate}.csv`;
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[export:payments]', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}