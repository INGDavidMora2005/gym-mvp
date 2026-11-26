import { NextResponse } from 'next/server';
import { getCurrentOwner } from '@/lib/auth';
import { exportRangeSchema } from '@/lib/validation';
import { fetchDashboardStats, fetchMonthlyRevenue } from '@/lib/db';
import {
  ExportTooLargeError,
  fetchAttendanceInRange,
  fetchPaymentsInRange,
} from '@/lib/export-data';
import { buildReportSummary } from '@/lib/report';
import { buildReportWorkbook } from '@/lib/excel-report';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Autenticación: JSON 401 (no redirect) porque es un route handler.
    const owner = await getCurrentOwner();
    if (!owner) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const validation = exportRangeSchema.safeParse({
      from: searchParams.get('from'),
      to: searchParams.get('to'),
    });

    if (!validation.success) {
      const message = validation.error.issues[0]?.message ?? 'Parámetros inválidos';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { from, to } = validation.data;

    const [payments, attendance, stats, monthly] = await Promise.all([
      fetchPaymentsInRange(from, to),
      fetchAttendanceInRange(from, to),
      fetchDashboardStats(),
      fetchMonthlyRevenue(6),
    ]);

    const summary = buildReportSummary({ payments, attendance, from, to });

    const buffer = await buildReportWorkbook({
      owner_name: owner.name,
      generated_at: new Date(),
      from,
      to,
      summary,
      payments,
      attendance,
      stats,
      monthly,
    });

    // Auditoría: si falla, la descarga sigue funcionando.
    try {
      await logAudit({
        owner,
        action: 'DATA_EXPORTED',
        entity: 'report',
        entityId: null,
        details: {
          type: 'report_xlsx',
          from,
          to,
          payments_rows: payments.length,
          attendance_rows: attendance.length,
        },
      });
    } catch (auditError) {
      console.error('[export:report:audit]', auditError);
    }

    const filename = `reporte_${from}_a_${to}.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof ExportTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error('[export:report]', message);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
