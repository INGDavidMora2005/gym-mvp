import ExcelJS from 'exceljs';
import type {
  Color,
  DataBarRuleType,
  TableColumnProperties,
  Worksheet,
} from 'exceljs';
import { DashboardStats, RevenuePoint } from '@/types';
import { bogotaDateTimeParts } from './dates';
import {
  ReportAttendanceRow,
  ReportPaymentRow,
  ReportSummary,
} from './report';

/**
 * Generación del reporte Excel (.xlsx) con ExcelJS.
 *
 * Este módulo importa ExcelJS y por tanto SOLO debe usarse desde código de
 * servidor (el route handler). No lleva 'server-only' para que las pruebas
 * unitarias puedan cargarlo en Node.
 *
 * Fechas y horas: Excel no maneja zonas horarias. Por eso cada Date se
 * construye con Date.UTC(año, mes, día, hora, minuto) a partir de los
 * componentes de Bogotá: el serial de ExcelJS se calcula sobre el epoch
 * absoluto, así que la hora de pared queda intacta sin importar el TZ del
 * servidor.
 */

export interface ReportWorkbookInput {
  owner_name: string;
  generated_at: Date;
  from: string;
  to: string;
  summary: ReportSummary;
  payments: ReportPaymentRow[];
  attendance: ReportAttendanceRow[];
  stats: DashboardStats;
  monthly: RevenuePoint[];
}

const BRAND_700 = 'FF1A3DA0';
const BRAND_500 = 'FF2F66E6';
const BRAND_50 = 'FFEEF4FF';
const EMERALD_600 = 'FF059669';
const INK_900 = 'FF14181F';
const INK_600 = 'FF5A6272';
const INK_200 = 'FFE9EBEF';
const DANGER = 'FFB91C1C';

const MONEY_FMT = '$ #,##0';
const INTEGER_FMT = '#,##0';
const DATE_FMT = 'dd/mm/yyyy';
const TIME_FMT = 'hh:mm';
const PERCENT_FMT = '0.0%';

/** Fecha "de pared" de Bogotá (UTC puro) a partir de un ISO. */
function bogotaWallDate(iso: string | null): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (isNaN(date.getTime())) return null;
  const parts = bogotaDateTimeParts(date);
  return new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute),
  );
}

/** Fecha "de pared" de Bogotá a medianoche (para tablas por día). */
function dayKeyToDate(dayKey: string): Date {
  const [year, month, day] = dayKey.split('-').map((n) => parseInt(n, 10));
  return new Date(Date.UTC(year, month - 1, day));
}

/** 'YYYY-MM-DD' -> 'dd/mm/yyyy' (sin pasar por zonas horarias). */
function formatDayKeyDMY(dayKey: string): string {
  const [year, month, day] = dayKey.split('-');
  return `${day}/${month}/${year}`;
}

/** dd/mm/yyyy de un Date construido con Date.UTC. */
function formatWallDMY(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${String(date.getUTCFullYear())}`;
}

/** dd/mm/yyyy hh:mm (hora de Bogotá). */
function formatBogotaDateTime(date: Date): string {
  const parts = bogotaDateTimeParts(date);
  const day = String(parts.day).padStart(2, '0');
  const month = String(parts.month).padStart(2, '0');
  const hour = String(parts.hour).padStart(2, '0');
  const minute = String(parts.minute).padStart(2, '0');
  return `${day}/${month}/${parts.year} ${hour}:${minute}`;
}

function solidFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function thinBorder(argb = INK_200): Partial<ExcelJS.Borders> {
  return {
    top: { style: 'thin', color: { argb } },
    left: { style: 'thin', color: { argb } },
    bottom: { style: 'thin', color: { argb } },
    right: { style: 'thin', color: { argb } },
  };
}

interface DataBarRule extends DataBarRuleType {
  color: Partial<Color>;
}

/** Barra de datos (formato condicional) sobre un rango de valores. */
function addDataBar(ws: Worksheet, ref: string, argb: string, priority = 1): void {
  ws.addConditionalFormatting({
    ref,
    rules: [
      {
        type: 'dataBar',
        priority,
        cfvo: [{ type: 'min' }, { type: 'max' }],
        minLength: 0,
        maxLength: 100,
        showValue: true,
        border: true,
        gradient: false,
        color: { argb },
      } as DataBarRule,
    ],
  });
}

function styleSectionHeader(ws: Worksheet, row: number, text: string): void {
  ws.mergeCells(row, 1, row, 7);
  const cell = ws.getCell(row, 1);
  cell.value = text;
  cell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  cell.fill = solidFill(BRAND_700);
  cell.alignment = { vertical: 'middle' };
  ws.getRow(row).height = 24;
}

function styleTableHeaderRow(
  ws: Worksheet,
  row: number,
  fromCol: number,
  toCol: number,
): void {
  for (let col = fromCol; col <= toCol; col++) {
    const cell = ws.getCell(row, col);
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = solidFill(BRAND_700);
    cell.border = thinBorder(BRAND_700);
    cell.alignment = { vertical: 'middle', wrapText: true };
  }
  ws.getRow(row).height = 22;
}

/** Fila etiqueta/valor en la hoja Resumen. Devuelve la fila siguiente. */
function writeKeyValue(
  ws: Worksheet,
  row: number,
  label: string,
  value: string | number,
  numFmt?: string,
): number {
  const labelCell = ws.getCell(row, 1);
  labelCell.value = label;
  labelCell.font = { color: { argb: INK_600 }, size: 10 };
  labelCell.border = { bottom: { style: 'hair', color: { argb: INK_200 } } };

  const valueCell = ws.getCell(row, 2);
  valueCell.value = value;
  valueCell.font = { bold: true, color: { argb: INK_900 }, size: 11 };
  valueCell.alignment = { horizontal: 'left' };
  if (numFmt) valueCell.numFmt = numFmt;

  ws.getRow(row).height = 18;
  return row + 1;
}

function styleTotalsRow(ws: Worksheet, row: number, fromCol: number, toCol: number): void {
  for (let col = fromCol; col <= toCol; col++) {
    const cell = ws.getCell(row, col);
    cell.font = { bold: true, color: { argb: INK_900 } };
    cell.fill = solidFill(BRAND_50);
    cell.border = {
      top: { style: 'thin', color: { argb: BRAND_500 } },
      bottom: { style: 'double', color: { argb: BRAND_500 } },
    };
  }
}

function styleTab(ws: Worksheet, argb: string): void {
  ws.properties.tabColor = { argb };
}

function setupPrint(ws: Worksheet, repeatHeaderRow: boolean): void {
  ws.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: repeatHeaderRow ? '1:1' : undefined,
    horizontalCentered: true,
    margins: {
      left: 0.4,
      right: 0.4,
      top: 0.6,
      bottom: 0.6,
      header: 0.3,
      footer: 0.3,
    },
  };
}

function buildSummarySheet(wb: ExcelJS.Workbook, input: ReportWorkbookInput): void {
  const { summary, stats, monthly, from, to } = input;

  const ws = wb.addWorksheet('Resumen', {
    views: [{ state: 'normal', showGridLines: false }],
  });
  styleTab(ws, BRAND_700);
  setupPrint(ws, false);

  ws.columns = [
    { width: 38 },
    { width: 18 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 16 },
  ];

  // Encabezado del reporte
  ws.mergeCells(1, 1, 1, 7);
  const title = ws.getCell(1, 1);
  title.value = 'Gimnasio MVP — Reporte del gimnasio';
  title.font = { bold: true, size: 20, color: { argb: BRAND_700 } };
  title.alignment = { vertical: 'middle' };
  ws.getRow(1).height = 32;

  ws.mergeCells(2, 1, 2, 7);
  const period = ws.getCell(2, 1);
  period.value = `Periodo: ${formatDayKeyDMY(from)} a ${formatDayKeyDMY(to)}`;
  period.font = { size: 11, color: { argb: INK_600 } };

  ws.mergeCells(3, 1, 3, 7);
  const generated = ws.getCell(3, 1);
  generated.value = `Generado el ${formatBogotaDateTime(input.generated_at)} (hora de Bogotá) por ${input.owner_name}`;
  generated.font = { size: 10, color: { argb: INK_600 } };

  let row = 5;

  // (1) Ingresos del periodo
  styleSectionHeader(ws, row++, 'Ingresos del periodo');
  row = writeKeyValue(ws, row, 'Total de ingresos', summary.revenue_total, MONEY_FMT);
  row = writeKeyValue(ws, row, 'Número de pagos', summary.payments_count, INTEGER_FMT);
  row = writeKeyValue(ws, row, 'Ticket promedio', summary.ticket_average, MONEY_FMT);
  row = writeKeyValue(ws, row, 'Pagos anulados', summary.voided_count, INTEGER_FMT);
  row = writeKeyValue(ws, row, 'Monto anulado', summary.voided_total, MONEY_FMT);

  row += 1;

  // (2) Ingresos por método
  styleSectionHeader(ws, row++, 'Ingresos por método');
  const methodHeaderRow = row;
  ['Método', 'Pagos', 'Total', '%'].forEach((label, index) => {
    ws.getCell(methodHeaderRow, index + 1).value = label;
  });
  styleTableHeaderRow(ws, methodHeaderRow, 1, 4);
  row += 1;

  const methodFirstRow = row;
  if (summary.by_method.length === 0) {
    ws.mergeCells(row, 1, row, 4);
    const emptyCell = ws.getCell(row, 1);
    emptyCell.value = 'Sin pagos registrados en el periodo';
    emptyCell.font = { italic: true, color: { argb: INK_600 } };
    row += 1;
  } else {
    for (const method of summary.by_method) {
      ws.getCell(row, 1).value = method.label;
      ws.getCell(row, 2).value = method.count;
      ws.getCell(row, 2).numFmt = INTEGER_FMT;
      ws.getCell(row, 3).value = method.total;
      ws.getCell(row, 3).numFmt = MONEY_FMT;
      ws.getCell(row, 4).value = method.share;
      ws.getCell(row, 4).numFmt = PERCENT_FMT;
      for (let col = 1; col <= 4; col++) {
        ws.getCell(row, col).border = thinBorder();
      }
      row += 1;
    }

    addDataBar(ws, `C${methodFirstRow}:C${row - 1}`, BRAND_500);

    // Fila de total
    ws.getCell(row, 1).value = 'Total';
    ws.getCell(row, 2).value = summary.payments_count;
    ws.getCell(row, 2).numFmt = INTEGER_FMT;
    ws.getCell(row, 3).value = summary.revenue_total;
    ws.getCell(row, 3).numFmt = MONEY_FMT;
    ws.getCell(row, 4).value = summary.revenue_total > 0 ? 1 : 0;
    ws.getCell(row, 4).numFmt = PERCENT_FMT;
    styleTotalsRow(ws, row, 1, 4);
    row += 1;
  }

  row += 1;

  // (3) Asistencia del periodo
  styleSectionHeader(ws, row++, 'Asistencia del periodo');
  row = writeKeyValue(ws, row, 'Total de asistencias', summary.attendance_total, INTEGER_FMT);
  row = writeKeyValue(ws, row, 'Clientes distintos', summary.distinct_attendees, INTEGER_FMT);
  row = writeKeyValue(ws, row, 'Promedio por día', summary.avg_attendance_per_day, '0.0');
  row = writeKeyValue(
    ws,
    row,
    'Día con más asistencia',
    summary.busiest_day
      ? `${formatDayKeyDMY(summary.busiest_day.date)} (${summary.busiest_day.count})`
      : '—',
  );

  row += 1;
  ws.getCell(row, 1).value = 'Asistencia por día';
  ws.getCell(row, 1).font = { bold: true, color: { argb: BRAND_700 } };
  row += 1;

  const attendanceHeaderRow = row;
  ws.getCell(attendanceHeaderRow, 1).value = 'Fecha';
  ws.getCell(attendanceHeaderRow, 2).value = 'Asistentes';
  styleTableHeaderRow(ws, attendanceHeaderRow, 1, 2);
  row += 1;

  const attendanceFirstRow = row;
  for (const day of summary.attendance_by_day) {
    ws.getCell(row, 1).value = dayKeyToDate(day.date);
    ws.getCell(row, 1).numFmt = DATE_FMT;
    ws.getCell(row, 1).border = thinBorder();
    ws.getCell(row, 2).value = day.count;
    ws.getCell(row, 2).numFmt = INTEGER_FMT;
    ws.getCell(row, 2).border = thinBorder();
    row += 1;
  }

  if (summary.attendance_by_day.length > 0) {
    addDataBar(ws, `B${attendanceFirstRow}:B${row - 1}`, EMERALD_600);
  }

  row += 1;

  // (4) Situación actual de clientes (a la fecha de descarga)
  styleSectionHeader(ws, row++, 'Situación actual de clientes');
  ws.mergeCells(row, 1, row, 5);
  const note = ws.getCell(row, 1);
  note.value = 'A la fecha de descarga, no del periodo seleccionado.';
  note.font = { italic: true, size: 10, color: { argb: INK_600 } };
  row += 1;

  row = writeKeyValue(ws, row, 'Total de clientes', stats.total_clients, INTEGER_FMT);
  row = writeKeyValue(ws, row, 'Activos', stats.active_clients, INTEGER_FMT);
  row = writeKeyValue(ws, row, 'Por vencer', stats.expiring_this_week, INTEGER_FMT);
  row = writeKeyValue(ws, row, 'Vencidos', stats.expired_clients, INTEGER_FMT);
  row = writeKeyValue(ws, row, 'Sin pago', stats.no_payment_clients, INTEGER_FMT);

  const { attended, total: eligible } = stats.attendance_rate;
  const attendanceRateText =
    eligible > 0
      ? `${attended} de ${eligible} (${Math.round((attended / eligible) * 100)}%)`
      : `${attended} de ${eligible} (—)`;
  row = writeKeyValue(ws, row, 'Asistieron este mes', attendanceRateText);
  row = writeKeyValue(ws, row, 'Ingresos del mes actual', stats.revenue_this_month, MONEY_FMT);
  row = writeKeyValue(ws, row, 'Ingresos del mes anterior', stats.revenue_last_month, MONEY_FMT);

  row += 1;

  // (5) Ingresos de los últimos 6 meses
  styleSectionHeader(ws, row++, 'Ingresos de los últimos 6 meses');
  const monthHeaderRow = row;
  ws.getCell(monthHeaderRow, 1).value = 'Mes';
  ws.getCell(monthHeaderRow, 2).value = 'Pagos';
  ws.getCell(monthHeaderRow, 3).value = 'Ingresos';
  styleTableHeaderRow(ws, monthHeaderRow, 1, 3);
  row += 1;

  const monthFirstRow = row;
  for (const point of monthly) {
    ws.getCell(row, 1).value = point.label;
    ws.getCell(row, 1).border = thinBorder();
    ws.getCell(row, 2).value = point.count;
    ws.getCell(row, 2).numFmt = INTEGER_FMT;
    ws.getCell(row, 2).border = thinBorder();
    ws.getCell(row, 3).value = point.revenue;
    ws.getCell(row, 3).numFmt = MONEY_FMT;
    ws.getCell(row, 3).border = thinBorder();
    row += 1;
  }

  if (monthly.length > 0) {
    addDataBar(ws, `C${monthFirstRow}:C${row - 1}`, BRAND_500);
  }
}

function buildPaymentsSheet(wb: ExcelJS.Workbook, input: ReportWorkbookInput): void {
  const { payments, summary } = input;

  const ws = wb.addWorksheet('Pagos', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  styleTab(ws, BRAND_500);
  setupPrint(ws, true);

  ws.columns = [
    { width: 12 }, // Fecha
    { width: 8 }, // Hora
    { width: 30 }, // Cliente
    { width: 14 }, // Monto
    { width: 14 }, // Método
    { width: 20 }, // Registrado por
    { width: 14 }, // Inicio periodo
    { width: 14 }, // Fin periodo
    { width: 11 }, // Estado
    { width: 18 }, // Anulado por
    { width: 30 }, // Motivo de anulación
  ];

  const columns: TableColumnProperties[] = [
    { name: 'Fecha' },
    { name: 'Hora' },
    { name: 'Cliente' },
    { name: 'Monto' },
    { name: 'Método' },
    { name: 'Registrado por' },
    { name: 'Inicio periodo' },
    { name: 'Fin periodo' },
    { name: 'Estado' },
    { name: 'Anulado por' },
    { name: 'Motivo de anulación' },
  ];

  const rows = payments.map((p) => [
    bogotaWallDate(p.paid_at),
    bogotaWallDate(p.paid_at),
    p.client_name,
    p.amount_cop,
    p.payment_method ?? 'Sin método',
    p.recorded_by ?? '—',
    bogotaWallDate(p.period_start),
    bogotaWallDate(p.period_end),
    p.voided_at ? 'ANULADO' : 'VIGENTE',
    p.voided_by ?? '',
    p.void_reason ?? '',
  ]);

  const table = ws.addTable({
    name: 'TablaPagos',
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns,
    rows,
  });
  table.commit();

  styleTableHeaderRow(ws, 1, 1, columns.length);

  const firstDataRow = 2;
  const lastDataRow = firstDataRow + payments.length - 1;

  for (let index = 0; index < payments.length; index++) {
    const rowNumber = firstDataRow + index;
    const payment = payments[index];

    ws.getCell(rowNumber, 1).numFmt = DATE_FMT;
    ws.getCell(rowNumber, 2).numFmt = TIME_FMT;
    ws.getCell(rowNumber, 4).numFmt = MONEY_FMT;
    ws.getCell(rowNumber, 7).numFmt = DATE_FMT;
    ws.getCell(rowNumber, 8).numFmt = DATE_FMT;

    if (payment.voided_at) {
      for (let col = 1; col <= columns.length; col++) {
        const cell = ws.getCell(rowNumber, col);
        cell.font = { color: { argb: DANGER }, strike: true };
      }
    }
  }

  // Fila de totales: solo pagos vigentes (SUMIFS sobre Estado).
  const totalsRowNumber = lastDataRow + 1;
  const labelCell = ws.getCell(totalsRowNumber, 1);
  labelCell.value = 'TOTAL (vigentes)';
  ws.mergeCells(totalsRowNumber, 1, totalsRowNumber, 3);

  const totalCell = ws.getCell(totalsRowNumber, 4);
  if (payments.length > 0) {
    totalCell.value = {
      formula: `SUMIFS(D${firstDataRow}:D${lastDataRow},I${firstDataRow}:I${lastDataRow},"VIGENTE")`,
      result: summary.revenue_total,
    };
  } else {
    totalCell.value = 0;
  }
  totalCell.numFmt = MONEY_FMT;
  styleTotalsRow(ws, totalsRowNumber, 1, columns.length);
}

function buildAttendanceSheet(wb: ExcelJS.Workbook, input: ReportWorkbookInput): void {
  const { attendance } = input;

  const ws = wb.addWorksheet('Asistencias', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  styleTab(ws, EMERALD_600);
  setupPrint(ws, true);

  ws.columns = [
    { width: 12 }, // Fecha
    { width: 8 }, // Hora
    { width: 30 }, // Cliente
    { width: 20 }, // Registrado por
  ];

  const columns: TableColumnProperties[] = [
    { name: 'Fecha' },
    { name: 'Hora' },
    { name: 'Cliente' },
    { name: 'Registrado por' },
  ];

  const rows = attendance.map((a) => [
    bogotaWallDate(a.check_in),
    bogotaWallDate(a.check_in),
    a.client_name,
    a.recorded_by ?? '—',
  ]);

  const table = ws.addTable({
    name: 'TablaAsistencias',
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns,
    rows,
  });
  table.commit();

  styleTableHeaderRow(ws, 1, 1, columns.length);

  for (let index = 0; index < attendance.length; index++) {
    const rowNumber = 2 + index;
    ws.getCell(rowNumber, 1).numFmt = DATE_FMT;
    ws.getCell(rowNumber, 2).numFmt = TIME_FMT;
  }
}

/**
 * Construye el libro Excel completo y lo devuelve como Buffer.
 * Orden de hojas: Resumen, Pagos, Asistencias.
 */
export async function buildReportWorkbook(
  input: ReportWorkbookInput,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Gym App';
  wb.lastModifiedBy = 'Gym App';
  wb.created = input.generated_at;
  wb.modified = input.generated_at;

  buildSummarySheet(wb, input);
  buildPaymentsSheet(wb, input);
  buildAttendanceSheet(wb, input);

  // Resumen activo al abrir el archivo.
  wb.views = [
    {
      x: 0,
      y: 0,
      width: 16000,
      height: 12000,
      firstSheet: 0,
      activeTab: 0,
      visibility: 'visible',
    },
  ];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
