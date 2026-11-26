import { describe, expect, it } from 'vitest';
import { buildReportSummary, ReportAttendance, ReportPayment } from './report';

function payment(overrides: Partial<ReportPayment> = {}): ReportPayment {
  return {
    paid_at: '2026-11-24T15:00:00Z',
    amount_cop: 65000,
    payment_method: 'EFECTIVO',
    voided_at: null,
    ...overrides,
  };
}

function attendance(overrides: Partial<ReportAttendance> = {}): ReportAttendance {
  return {
    client_id: 'c1',
    check_in: '2026-11-24T15:00:00Z',
    ...overrides,
  };
}

describe('buildReportSummary', () => {
  it('devuelve ceros y días en 0 para un rango sin datos', () => {
    const summary = buildReportSummary({
      payments: [],
      attendance: [],
      from: '2026-11-23',
      to: '2026-11-24',
    });

    expect(summary.revenue_total).toBe(0);
    expect(summary.payments_count).toBe(0);
    expect(summary.ticket_average).toBe(0);
    expect(summary.voided_count).toBe(0);
    expect(summary.voided_total).toBe(0);
    expect(summary.by_method).toEqual([]);
    expect(summary.attendance_total).toBe(0);
    expect(summary.distinct_attendees).toBe(0);
    expect(summary.avg_attendance_per_day).toBe(0);
    expect(summary.busiest_day).toBeNull();
    expect(summary.attendance_by_day).toEqual([
      { date: '2026-11-23', count: 0 },
      { date: '2026-11-24', count: 0 },
    ]);
  });

  it('excluye pagos anulados de los ingresos y los informa aparte', () => {
    const summary = buildReportSummary({
      payments: [
        payment({ amount_cop: 65000 }),
        payment({ amount_cop: 65000, payment_method: 'NEQUI' }),
        payment({ amount_cop: 130000, voided_at: '2026-11-25T10:00:00Z' }),
      ],
      attendance: [],
      from: '2026-11-24',
      to: '2026-11-24',
    });

    expect(summary.revenue_total).toBe(130000);
    expect(summary.payments_count).toBe(2);
    expect(summary.ticket_average).toBe(65000);
    expect(summary.voided_count).toBe(1);
    expect(summary.voided_total).toBe(130000);
    expect(summary.by_method.find((m) => m.method === 'EFECTIVO')).toMatchObject({
      count: 1,
      total: 65000,
      share: 0.5,
    });
  });

  it('agrupa payment_method null como "Sin método"', () => {
    const summary = buildReportSummary({
      payments: [payment({ payment_method: null, amount_cop: 65000 })],
      attendance: [],
      from: '2026-11-24',
      to: '2026-11-24',
    });

    const sinMetodo = summary.by_method.find((m) => m.method === 'SIN_METODO');
    expect(sinMetodo).toBeDefined();
    expect(sinMetodo?.label).toBe('Sin método');
    expect(sinMetodo?.total).toBe(65000);
    expect(sinMetodo?.share).toBe(1);
  });

  it('omite métodos sin pagos en el desglose', () => {
    const summary = buildReportSummary({
      payments: [payment({ payment_method: 'PSE' })],
      attendance: [],
      from: '2026-11-24',
      to: '2026-11-24',
    });

    expect(summary.by_method).toHaveLength(1);
    expect(summary.by_method[0].method).toBe('PSE');
  });

  it('incluye todos los días del rango, incluso los de 0 asistencias', () => {
    const summary = buildReportSummary({
      payments: [],
      attendance: [
        attendance({ client_id: 'c1', check_in: '2026-11-23T15:00:00Z' }),
        attendance({ client_id: 'c1', check_in: '2026-11-25T15:00:00Z' }),
        attendance({ client_id: 'c2', check_in: '2026-11-25T16:00:00Z' }),
      ],
      from: '2026-11-23',
      to: '2026-11-26',
    });

    expect(summary.attendance_by_day).toEqual([
      { date: '2026-11-23', count: 1 },
      { date: '2026-11-24', count: 0 },
      { date: '2026-11-25', count: 2 },
      { date: '2026-11-26', count: 0 },
    ]);
    expect(summary.attendance_total).toBe(3);
    expect(summary.distinct_attendees).toBe(2);
    expect(summary.avg_attendance_per_day).toBe(0.75);
    expect(summary.busiest_day).toEqual({ date: '2026-11-25', count: 2 });
  });

  it('funciona con un rango de un solo día', () => {
    const summary = buildReportSummary({
      payments: [payment()],
      attendance: [attendance()],
      from: '2026-11-24',
      to: '2026-11-24',
    });

    expect(summary.attendance_by_day).toEqual([{ date: '2026-11-24', count: 1 }]);
    expect(summary.avg_attendance_per_day).toBe(1);
  });

  it('una asistencia a las 23:30 de Bogotá cae en su día local', () => {
    // 2026-11-25T04:30:00Z = 2026-11-24 23:30 en Bogotá (UTC-5).
    const summary = buildReportSummary({
      payments: [],
      attendance: [attendance({ check_in: '2026-11-25T04:30:00Z' })],
      from: '2026-11-24',
      to: '2026-11-24',
    });

    expect(summary.attendance_by_day).toEqual([{ date: '2026-11-24', count: 1 }]);
  });

  it('una asistencia a las 00:30 de Bogotá cae en el día siguiente', () => {
    // 2026-11-25T05:30:00Z = 2026-11-25 00:30 en Bogotá.
    const summary = buildReportSummary({
      payments: [],
      attendance: [attendance({ check_in: '2026-11-25T05:30:00Z' })],
      from: '2026-11-24',
      to: '2026-11-25',
    });

    expect(summary.attendance_by_day).toEqual([
      { date: '2026-11-24', count: 0 },
      { date: '2026-11-25', count: 1 },
    ]);
  });

  it('en empate de asistencias elige el día más antiguo', () => {
    const summary = buildReportSummary({
      payments: [],
      attendance: [
        attendance({ check_in: '2026-11-25T15:00:00Z' }),
        attendance({ check_in: '2026-11-24T15:00:00Z' }),
      ],
      from: '2026-11-24',
      to: '2026-11-25',
    });

    expect(summary.busiest_day).toEqual({ date: '2026-11-24', count: 1 });
  });
});
