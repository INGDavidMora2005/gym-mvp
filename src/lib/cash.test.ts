import { describe, expect, it } from 'vitest';
import { summarizeCash, clientNameFrom } from './cash';
import { PaymentMethod, MembershipPayment } from '@/types';

const basePayment: MembershipPayment = {
  id: '1',
  client_id: 'c1',
  amount_cop: 65000,
  paid_at: '2026-11-24T10:00:00Z',
  period_start: '2026-11-24T10:00:00Z',
  period_end: '2026-12-24T10:00:00Z',
  recorded_by: 'Admin',
  note: null,
  created_at: '2026-11-24T10:00:00Z',
  voided_at: null,
  voided_by: null,
  void_reason: null,
  payment_method: 'EFECTIVO',
};

function makePayment(overrides: Partial<MembershipPayment> = {}): MembershipPayment {
  return { ...basePayment, ...overrides };
}

describe('summarizeCash', () => {
  it('array vacío devuelve totales en 0 y todas las claves presentes', () => {
    const result = summarizeCash([]);
    expect(result.total).toBe(0);
    expect(result.count).toBe(0);
    expect(result.byMethod.EFECTIVO).toEqual({ total: 0, count: 0 });
    expect(result.byMethod.NEQUI).toEqual({ total: 0, count: 0 });
    expect(result.byMethod.DAVPLATA).toEqual({ total: 0, count: 0 });
    expect(result.byMethod.PSE).toEqual({ total: 0, count: 0 });
    expect(result.byMethod.OTRO).toEqual({ total: 0, count: 0 });
    expect(result.byMethod.SIN_METODO).toEqual({ total: 0, count: 0 });
  });

  it('un solo método (EFECTIVO)', () => {
    const payments = [makePayment({ payment_method: 'EFECTIVO' })];
    const result = summarizeCash(payments);
    expect(result.total).toBe(65000);
    expect(result.count).toBe(1);
    expect(result.byMethod.EFECTIVO).toEqual({ total: 65000, count: 1 });
    expect(result.byMethod.NEQUI).toEqual({ total: 0, count: 0 });
  });

  it('mezcla de métodos con nulls', () => {
    const payments = [
      makePayment({ id: '1', payment_method: 'EFECTIVO', amount_cop: 65000 }),
      makePayment({ id: '2', payment_method: 'NEQUI', amount_cop: 65000 }),
      makePayment({ id: '3', payment_method: 'DAVPLATA', amount_cop: 65000 }),
      makePayment({ id: '4', payment_method: 'PSE', amount_cop: 65000 }),
      makePayment({ id: '5', payment_method: 'OTRO', amount_cop: 65000 }),
      makePayment({ id: '6', payment_method: null, amount_cop: 65000 }),
    ];
    const result = summarizeCash(payments);
    expect(result.total).toBe(390000);
    expect(result.count).toBe(6);
    expect(result.byMethod.EFECTIVO).toEqual({ total: 65000, count: 1 });
    expect(result.byMethod.NEQUI).toEqual({ total: 65000, count: 1 });
    expect(result.byMethod.DAVPLATA).toEqual({ total: 65000, count: 1 });
    expect(result.byMethod.PSE).toEqual({ total: 65000, count: 1 });
    expect(result.byMethod.OTRO).toEqual({ total: 65000, count: 1 });
    expect(result.byMethod.SIN_METODO).toEqual({ total: 65000, count: 1 });
  });

  it('múltiples pagos del mismo método suman correctamente', () => {
    const payments = [
      makePayment({ id: '1', payment_method: 'EFECTIVO', amount_cop: 65000 }),
      makePayment({ id: '2', payment_method: 'EFECTIVO', amount_cop: 65000 }),
      makePayment({ id: '3', payment_method: 'EFECTIVO', amount_cop: 65000 }),
    ];
    const result = summarizeCash(payments);
    expect(result.total).toBe(195000);
    expect(result.count).toBe(3);
    expect(result.byMethod.EFECTIVO).toEqual({ total: 195000, count: 3 });
  });

  it('montos grandes (múltiples de 65000)', () => {
    const payments = [
      makePayment({ id: '1', payment_method: 'EFECTIVO', amount_cop: 650000 }),
      makePayment({ id: '2', payment_method: 'NEQUI', amount_cop: 1300000 }),
    ];
    const result = summarizeCash(payments);
    expect(result.total).toBe(1950000);
    expect(result.byMethod.EFECTIVO).toEqual({ total: 650000, count: 1 });
    expect(result.byMethod.NEQUI).toEqual({ total: 1300000, count: 1 });
  });

  it('payment_method null se cuenta como SIN_METODO', () => {
    const payments = [
      makePayment({ id: '1', payment_method: null, amount_cop: 65000 }),
      makePayment({ id: '2', payment_method: null, amount_cop: 65000 }),
    ];
    const result = summarizeCash(payments);
    expect(result.byMethod.SIN_METODO).toEqual({ total: 130000, count: 2 });
    expect(result.byMethod.EFECTIVO).toEqual({ total: 0, count: 0 });
  });
});

describe('clientNameFrom', () => {
  it('acepta un objeto con name (relación muchos-a-uno)', () => {
    expect(clientNameFrom({ name: 'Ana Gómez' })).toBe('Ana Gómez');
  });

  it('acepta un array con name (relación uno-a-muchos)', () => {
    expect(clientNameFrom([{ name: 'Ana Gómez' }])).toBe('Ana Gómez');
  });

  it('devuelve Cliente desconocido para null', () => {
    expect(clientNameFrom(null)).toBe('Cliente desconocido');
  });

  it('devuelve Cliente desconocido para undefined', () => {
    expect(clientNameFrom(undefined)).toBe('Cliente desconocido');
  });

  it('devuelve Cliente desconocido para array vacío', () => {
    expect(clientNameFrom([])).toBe('Cliente desconocido');
  });

  it('devuelve Cliente desconocido si name no es string', () => {
    expect(clientNameFrom({ name: 123 })).toBe('Cliente desconocido');
    expect(clientNameFrom([{ name: null }])).toBe('Cliente desconocido');
  });

  it('devuelve Cliente desconocido si name es string vacío o solo espacios', () => {
    expect(clientNameFrom({ name: '' })).toBe('Cliente desconocido');
    expect(clientNameFrom({ name: '   ' })).toBe('Cliente desconocido');
  });

  it('devuelve Cliente desconocido para valores primitivos', () => {
    expect(clientNameFrom('texto')).toBe('Cliente desconocido');
    expect(clientNameFrom(42)).toBe('Cliente desconocido');
  });
});