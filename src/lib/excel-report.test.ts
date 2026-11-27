import { describe, expect, it } from 'vitest';
import ExcelJS, { ValueType } from 'exceljs';
import { buildReportWorkbook, ReportWorkbookInput } from './excel-report';
import {
  buildReportSummary,
  ReportAttendanceRow,
  ReportPaymentRow,
} from './report';

const payments: ReportPaymentRow[] = [
  {
    id: 'p1',
    client_id: 'c1',
    client_name: '=1+1',
    amount_cop: 65000,
    paid_at: '2026-11-24T15:00:00Z',
    payment_method: 'EFECTIVO',
    recorded_by: 'Admin',
    period_start: '2026-11-24T15:00:00Z',
    period_end: '2026-12-24T15:00:00Z',
    voided_at: null,
    voided_by: null,
    void_reason: null,
  },
  {
    id: 'p2',
    client_id: 'c2',
    client_name: 'Ana Gómez',
    amount_cop: 78000,
    paid_at: '2026-11-24T20:00:00Z',
    payment_method: 'NEQUI',
    recorded_by: 'Admin',
    period_start: '2026-11-24T20:00:00Z',
    period_end: '2026-12-24T20:00:00Z',
    voided_at: '2026-11-25T10:00:00Z',
    voided_by: 'Admin',
    void_reason: 'Pago duplicado',
  },
  {
    id: 'p3',
    client_id: 'c3',
    client_name: 'Luis Pérez',
    amount_cop: 50000,
    // 2026-11-25T04:30:00Z = 24/11/2026 23:30 en Bogotá.
    paid_at: '2026-11-25T04:30:00Z',
    payment_method: null,
    recorded_by: 'Admin',
    period_start: '2026-11-25T04:30:00Z',
    period_end: '2026-12-25T04:30:00Z',
    voided_at: null,
    voided_by: null,
    void_reason: null,
  },
];

const attendance: ReportAttendanceRow[] = [
  {
    id: 'a1',
    client_id: 'c1',
    client_name: '=1+1',
    check_in: '2026-11-24T15:00:00Z',
    recorded_by: 'Admin',
  },
  {
    id: 'a2',
    client_id: 'c2',
    client_name: 'Ana Gómez',
    check_in: '2026-11-25T16:00:00Z',
    recorded_by: 'Admin',
  },
];

const from = '2026-11-24';
const to = '2026-11-25';

function buildInput(overrides: Partial<ReportWorkbookInput> = {}): ReportWorkbookInput {
  const summary = buildReportSummary({ payments, attendance, from, to });

  return {
    owner_name: 'David',
    generated_at: new Date('2026-11-26T15:05:00Z'),
    from,
    to,
    summary,
    payments,
    attendance,
    stats: {
      total_clients: 10,
      active_clients: 6,
      expiring_this_week: 2,
      expired_clients: 1,
      no_payment_clients: 1,
      revenue_this_month: 200000,
      revenue_last_month: 150000,
      payments_this_month: 3,
      attendance_this_month: 20,
      attendance_rate: { attended: 8, total: 10 },
      not_returned: [],
    },
    monthly: [
      { month: '2026-10', label: 'oct 26', revenue: 150000, count: 2 },
      { month: '2026-11', label: 'nov 26', revenue: 200000, count: 3 },
    ],
    ...overrides,
  };
}

async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(new Uint8Array(buffer) as unknown as ArrayBuffer);
  return wb;
}

describe('buildReportWorkbook', () => {
  it('genera las hojas en el orden Resumen, Pagos, Asistencias', async () => {
    const buffer = await buildReportWorkbook(buildInput());
    expect(buffer.length).toBeGreaterThan(0);

    const wb = await loadWorkbook(buffer);
    expect(wb.worksheets.map((ws) => ws.name)).toEqual([
      'Resumen',
      'Pagos',
      'Asistencias',
    ]);
    expect(wb.views[0]?.activeTab).toBe(0);
  });

  it('el título del Resumen es "Gimnasio MVP — Reporte"', async () => {
    const wb = await loadWorkbook(await buildReportWorkbook(buildInput()));
    const resumen = wb.getWorksheet('Resumen')!;
    expect(resumen.getCell('A1').value).toBe('Gimnasio MVP — Reporte');
    expect(resumen.properties.tabColor?.argb).toBe('FF1A3DA0');
  });

  it('incluye la cabecera de columnas de la tabla Pagos', async () => {
    const wb = await loadWorkbook(await buildReportWorkbook(buildInput()));
    const pagos = wb.getWorksheet('Pagos');
    expect(pagos).toBeDefined();

    const headers = (pagos!.getRow(1).values as unknown[]).slice(1);
    expect(headers).toEqual([
      'Fecha',
      'Hora',
      'Cliente',
      'Monto',
      'Método',
      'Registrado por',
      'Inicio periodo',
      'Fin periodo',
      'Estado',
      'Anulado por',
      'Motivo de anulación',
    ]);
    expect(pagos!.getTables()).toHaveLength(1);
  });

  it('centra columnas Fecha, Hora, Método, Estado', async () => {
    const wb = await loadWorkbook(await buildReportWorkbook(buildInput()));
    const pagos = wb.getWorksheet('Pagos')!;

    expect(pagos.getColumn(1).alignment?.horizontal).toBe('center');
    expect(pagos.getColumn(2).alignment?.horizontal).toBe('center');
    expect(pagos.getColumn(5).alignment?.horizontal).toBe('center');
    expect(pagos.getColumn(9).alignment?.horizontal).toBe('center');
  });

  it('alineación a derecha con indent 1 en Monto', async () => {
    const wb = await loadWorkbook(await buildReportWorkbook(buildInput()));
    const pagos = wb.getWorksheet('Pagos')!;

    expect(pagos.getColumn(4).alignment?.horizontal).toBe('right');
    expect(pagos.getColumn(4).alignment?.indent).toBe(1);
  });

  it('escribe fechas como Date y montos como número con formato de pesos', async () => {
    const wb = await loadWorkbook(await buildReportWorkbook(buildInput()));
    const pagos = wb.getWorksheet('Pagos')!;

    const fecha = pagos.getCell('A2');
    expect(fecha.value).toBeInstanceOf(Date);

    const monto = pagos.getCell('D2');
    expect(typeof monto.value).toBe('number');
    expect(monto.numFmt).toContain('$');
    expect(monto.numFmt).toContain('#,##0');

    const hora = pagos.getCell('B2');
    expect(hora.value).toBeInstanceOf(Date);
    expect(hora.numFmt).toBe('hh:mm');
  });

  it('un pago a las 23:30 de Bogotá se escribe en su día local', async () => {
    const wb = await loadWorkbook(await buildReportWorkbook(buildInput()));
    const pagos = wb.getWorksheet('Pagos')!;

    // Fila 4 = p3 (24/11/2026 23:30 Bogotá).
    const fecha = pagos.getCell('A4').value as Date;
    expect(fecha).toBeInstanceOf(Date);
    expect(fecha.getUTCFullYear()).toBe(2026);
    expect(fecha.getUTCMonth()).toBe(10); // noviembre
    expect(fecha.getUTCDate()).toBe(24);
    expect(fecha.getUTCHours()).toBe(23);
    expect(fecha.getUTCMinutes()).toBe(30);
  });

  it('marca la fila anulada con fuente roja y tachado', async () => {
    const wb = await loadWorkbook(await buildReportWorkbook(buildInput()));
    const pagos = wb.getWorksheet('Pagos')!;

    const estado = pagos.getCell('I3');
    expect(estado.value).toBe('ANULADO');
    expect(estado.font.strike).toBe(true);
    expect(estado.font.color?.argb).toBe('FFB91C1C');

    // La fila vigente no está tachada.
    expect(pagos.getCell('I2').font?.strike).not.toBe(true);
  });

  it('mantiene "=1+1" como texto y no como fórmula', async () => {
    const wb = await loadWorkbook(await buildReportWorkbook(buildInput()));
    const pagos = wb.getWorksheet('Pagos')!;

    const cliente = pagos.getCell('C2');
    expect(cliente.value).toBe('=1+1');
    expect(cliente.type).toBe(ValueType.String);
  });

  it('el Resumen contiene el total de ingresos vigentes', async () => {
    const wb = await loadWorkbook(await buildReportWorkbook(buildInput()));
    const resumen = wb.getWorksheet('Resumen')!;

    let foundRow: number | null = null;
    resumen.eachRow((row, rowNumber) => {
      if (row.getCell(1).value === 'Total de ingresos') foundRow = rowNumber;
    });

    expect(foundRow).not.toBeNull();
    const totalCell = resumen.getCell(foundRow!, 2);
    expect(totalCell.value).toBe(115000); // 65.000 + 50.000 (anulado excluido)
    expect(totalCell.numFmt).toContain('$');
  });

  it('genera el libro aunque no haya pagos ni asistencias', async () => {
    const emptySummary = buildReportSummary({
      payments: [],
      attendance: [],
      from: '2026-11-24',
      to: '2026-11-24',
    });

    const buffer = await buildReportWorkbook(
      buildInput({
        payments: [],
        attendance: [],
        summary: emptySummary,
        monthly: [],
      }),
    );

    const wb = await loadWorkbook(buffer);
    expect(wb.worksheets.map((ws) => ws.name)).toEqual([
      'Resumen',
      'Pagos',
      'Asistencias',
    ]);
    const pagos = wb.getWorksheet('Pagos')!;
    expect(pagos.getCell('A1').value).toBe('Fecha');
    // Sin filas de datos, la fila de totales queda justo bajo la cabecera.
    expect(pagos.getCell('A2').value).toBe('TOTAL (vigentes)');
    expect(pagos.getCell('D2').value).toBe(0);
  });

  it('las barras de datos tienen valor mínimo en 0 (cfvo tipo num)', async () => {
    const wb = await loadWorkbook(await buildReportWorkbook(buildInput()));
    const resumen = wb.getWorksheet('Resumen')!;

    // En Resumen, hoja de Ingresos por método (columna C) - buscar por index 0
    // ya que es el primer conditional formatting agregado
    const cfMethods = (resumen as any).conditionalFormattings?.[0]?.rules?.[0]?.cfvo;
    expect(cfMethods).toBeDefined();
    expect(cfMethods).toHaveLength(2);
    expect(cfMethods[0].type).toBe('num');
    expect(cfMethods[0].value).toBe(0);
    expect(cfMethods[1].type).toBe('max');

    // En Resumen, hoja de Asistencia por día (columna B) - buscar el que usa columna B
    const cfAttendance = (resumen as any).conditionalFormattings?.find((r: any) =>
      r.ref?.startsWith('B') || r.ref?.includes('B'),
    )?.rules?.[0]?.cfvo;
    expect(cfAttendance).toBeDefined();
    expect(cfAttendance[0].type).toBe('num');
    expect(cfAttendance[0].value).toBe(0);

    // En Resumen, hoja de Ingresos de los últimos 6 meses (columna C)
    const cfMonthly = (resumen as any).conditionalFormattings?.find((r: any) =>
      r.ref?.startsWith('C') || r.ref?.includes('C'),
    )?.rules?.[0]?.cfvo;
    expect(cfMonthly).toBeDefined();
    expect(cfMonthly[0].type).toBe('num');
    expect(cfMonthly[0].value).toBe(0);
  });
});
