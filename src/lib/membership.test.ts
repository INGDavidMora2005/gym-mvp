import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import {
  calculateMembershipStatus,
  computeNextPeriod,
  getMembershipExpiration,
} from './utils';

const NOW = new Date(Date.UTC(2026, 10, 22, 12, 0, 0)); // 2026-11-22 12:00 UTC

describe('getMembershipExpiration', () => {
  it('sin pagos devuelve null', () => {
    expect(getMembershipExpiration([])).toBeNull();
  });

  it('pago legacy sin period_end: paid_at + 30 días', () => {
    const paidAt = new Date(Date.UTC(2026, 10, 20, 10, 0, 0)).toISOString();
    const exp = getMembershipExpiration([{ paid_at: paidAt, period_end: null }]);
    expect(exp).not.toBeNull();
    expect(exp!.getTime()).toBe(addDays(new Date(paidAt), 30).getTime());
  });

  it('usa period_end si existe', () => {
    const periodEnd = new Date(Date.UTC(2026, 11, 5, 10, 0, 0)).toISOString();
    const exp = getMembershipExpiration([
      { paid_at: new Date(Date.UTC(2026, 10, 20)).toISOString(), period_end: periodEnd },
    ]);
    expect(exp!.getTime()).toBe(new Date(periodEnd).getTime());
  });

  it('varios pagos: toma el máximo', () => {
    const exp = getMembershipExpiration([
      { paid_at: new Date(Date.UTC(2026, 10, 20)).toISOString(), period_end: null },
      { paid_at: new Date(Date.UTC(2026, 10, 21)).toISOString(), period_end: null },
    ]);
    expect(exp!.getTime()).toBe(
      addDays(new Date(Date.UTC(2026, 10, 21)), 30).getTime(),
    );
  });

  it('period_end vence antes que paid_at+30 de otro pago: toma el máximo global', () => {
    const exp = getMembershipExpiration([
      {
        paid_at: new Date(Date.UTC(2026, 10, 1)).toISOString(),
        period_end: new Date(Date.UTC(2026, 10, 5)).toISOString(),
      },
      {
        paid_at: new Date(Date.UTC(2026, 10, 20)).toISOString(),
        period_end: null,
      },
    ]);
    expect(exp!.getTime()).toBe(addDays(new Date(Date.UTC(2026, 10, 20)), 30).getTime());
  });
});

describe('calculateMembershipStatus', () => {
  it('sin vencimiento -> SIN_PAGO', () => {
    const r = calculateMembershipStatus(null, NOW);
    expect(r.status).toBe('SIN_PAGO');
    expect(r.next_expiration).toBeNull();
    expect(r.days_left).toBeNull();
  });

  it('days_left 0 -> POR_VENCER (vence hoy)', () => {
    const r = calculateMembershipStatus(addDays(NOW, 0), NOW);
    expect(r.status).toBe('POR_VENCER');
    expect(r.days_left).toBe(0);
  });

  it('days_left 5 -> POR_VENCER', () => {
    const r = calculateMembershipStatus(addDays(NOW, 5), NOW);
    expect(r.status).toBe('POR_VENCER');
    expect(r.days_left).toBe(5);
  });

  it('days_left 6 -> ACTIVO (fuera de umbral)', () => {
    const r = calculateMembershipStatus(addDays(NOW, 6), NOW);
    expect(r.status).toBe('ACTIVO');
    expect(r.days_left).toBe(6);
  });

  it('days_left -1 -> VENCIDO', () => {
    const r = calculateMembershipStatus(addDays(NOW, -1), NOW);
    expect(r.status).toBe('VENCIDO');
    expect(r.days_left).toBe(-1);
  });

  it('acepta string ISO como expiración', () => {
    const r = calculateMembershipStatus(addDays(NOW, 3).toISOString(), NOW);
    expect(r.status).toBe('POR_VENCER');
    expect(r.days_left).toBe(3);
  });
});

describe('computeNextPeriod', () => {
  it('renovación anticipada: empieza desde el vencimiento actual', () => {
    const currentExpiration = addDays(NOW, 10); // vence en 10 días
    const { period_start, period_end } = computeNextPeriod(currentExpiration, NOW);
    expect(period_start.getTime()).toBe(currentExpiration.getTime());
    expect(period_end.getTime()).toBe(addDays(currentExpiration, 30).getTime());
  });

  it('renovación vencida: empieza desde hoy', () => {
    const currentExpiration = addDays(NOW, -5); // vencido hace 5 días
    const { period_start } = computeNextPeriod(currentExpiration, NOW);
    expect(period_start.getTime()).toBe(NOW.getTime());
  });

  it('sin pagos (currentExpiration null): empieza desde hoy', () => {
    const { period_start } = computeNextPeriod(null, NOW);
    expect(period_start.getTime()).toBe(NOW.getTime());
  });

  it('period_end = period_start + 30 días', () => {
    const { period_start, period_end } = computeNextPeriod(addDays(NOW, 7), NOW);
    expect(period_end.getTime()).toBe(addDays(period_start, 30).getTime());
  });
});
