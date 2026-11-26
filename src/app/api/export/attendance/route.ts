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

interface AttendanceExportRow {
  fecha: string;
  hora: string;
  cliente: string;
  registrado_por: string;
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
    let allAttendances: AttendanceExportRow[] = [];
    let fromIndex = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error } = await supabase
        .from('attendance')
        .select(`
          id,
          check_in,
          recorded_by,
          clients!inner(name)
        `)
        .gte('check_in', dayStart.toISOString())
        .lt('check_in', dayEnd.toISOString())
        .order('check_in', { ascending: true })
        .order('id', { ascending: true })
        .range(fromIndex, fromIndex + BATCH_SIZE - 1);

      if (error) {
        console.error('[export:attendance]', error.message);
        return NextResponse.json({ error: 'Error al leer asistencias' }, { status: 500 });
      }

      if (!batch || batch.length === 0) {
        hasMore = false;
        break;
      }

      // Transformar lote
      const rows: AttendanceExportRow[] = batch.map((a) => ({
        fecha: toBogotaDateString(a.check_in),
        hora: toBogotaTimeString(a.check_in),
        cliente: clientNameFrom(a.clients),
        registrado_por: a.recorded_by ?? '—',
      }));

      allAttendances = allAttendances.concat(rows);
      fromIndex += batch.length;

      // Verificar límite de filas
      if (allAttendances.length > MAX_ROWS) {
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
      { header: 'fecha', getValue: (r: AttendanceExportRow) => r.fecha, isFormulaSafe: true },
      { header: 'hora', getValue: (r: AttendanceExportRow) => r.hora, isFormulaSafe: true },
      { header: 'cliente', getValue: (r: AttendanceExportRow) => r.cliente },
      { header: 'registrado_por', getValue: (r: AttendanceExportRow) => r.registrado_por },
    ] as const;

    // Generar CSV
    const csv = toCsv(allAttendances, columns);

    // Registrar auditoría (no bloquear si falla)
    try {
      await logAudit({
        owner,
        action: 'DATA_EXPORTED',
        entity: 'attendance',
        entityId: null,
        details: {
          type: 'attendance',
          from: fromDate,
          to: toDate,
          rows: allAttendances.length,
        },
      });
    } catch (auditError) {
      console.error('[export:attendance:audit]', auditError);
      // No romper la descarga
    }

    // Responder con CSV
    const filename = `asistencias_${fromDate}_a_${toDate}.csv`;
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[export:attendance]', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}