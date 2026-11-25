import { describe, it, expect } from 'vitest';
import { filterAndPaginateClients, searchParamsSchema, normalizeText } from './clients-query';
import { ClientWithStatus } from '@/types';

describe('clients-query', () => {
  describe('normalizeText', () => {
    it('debe quitar tildes, pasar a minúsculas y colapsar espacios', () => {
      expect(normalizeText('  José   María  ')).toBe('jose maria');
      expect(normalizeText('ÁÉÍÓÚ ñ Ñ')).toBe('aeiou n n');
    });
  });

  describe('filterAndPaginateClients', () => {
    const mockClients: ClientWithStatus[] = [
      { id: '1', name: 'José Pérez', status: 'ACTIVO', phone: '3001234567', days_left: 10, created_at: '2023-01-01', age: 25, address: null, payment_method: 'EFECTIVO', consent_at: null, active: true, last_payment_at: null, next_expiration: null, last_attendance: null, attendance_this_month: 0 },
      { id: '2', name: 'Maria Lopez', status: 'POR_VENCER', phone: '310 123-4567', days_left: 2, created_at: '2023-01-01', age: 30, address: null, payment_method: 'EFECTIVO', consent_at: null, active: true, last_payment_at: null, next_expiration: null, last_attendance: null, attendance_this_month: 0 },
      { id: '3', name: 'Jose Martinez', status: 'VENCIDO', phone: '3201234567', days_left: -1, created_at: '2023-01-01', age: 35, address: null, payment_method: 'EFECTIVO', consent_at: null, active: true, last_payment_at: null, next_expiration: null, last_attendance: null, attendance_this_month: 0 },
    ];

    it('búsqueda con y sin tildes ("jose" encuentra "José")', () => {
      const result = filterAndPaginateClients(mockClients, { q: 'jose' });
      expect(result.items).toHaveLength(2);
      expect(result.items.map(c => c.name)).toContain('José Pérez');
      expect(result.items.map(c => c.name)).toContain('Jose Martinez');
    });

    it('búsqueda por teléfono parcial (>= 3 dígitos) y con espacios/guiones', () => {
      // "310 123" contiene los dígitos 310123
      const result = filterAndPaginateClients(mockClients, { q: '310 123' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('2');

      // Menos de 3 dígitos ignora la búsqueda por teléfono
      const resultShort = filterAndPaginateClients(mockClients, { q: '31' });
      expect(resultShort.items).toHaveLength(0); // No hay nombre que tenga "31"
    });

    it('filtro por estado', () => {
      const result = filterAndPaginateClients(mockClients, { status: 'VENCIDO' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('3');
    });

    it('orden por days_left para POR_VENCER y VENCIDO', () => {
      const clients: ClientWithStatus[] = [
        { ...mockClients[1], id: 'A', name: 'A', days_left: 5, status: 'POR_VENCER' },
        { ...mockClients[1], id: 'B', name: 'B', days_left: 1, status: 'POR_VENCER' },
      ] as any;
      const result = filterAndPaginateClients(clients, { status: 'POR_VENCER' });
      expect(result.items[0].days_left).toBe(1);
      expect(result.items[1].days_left).toBe(5);
    });

    it('página fuera de rango', () => {
      const result = filterAndPaginateClients(mockClients, { page: 99 });
      expect(result.page).toBe(1); // Acotado a pageCount
    });

    it('0 resultados devuelve page=1 y pageCount=1', () => {
      const result = filterAndPaginateClients([], { page: 5 });
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.pageCount).toBe(1);
    });

    it('45 clientes con pageSize 20 -> 3 páginas', () => {
      const clients = Array.from({ length: 45 }, (_, i) => ({ id: `${i}`, name: `Cliente ${i}`, status: 'ACTIVO', phone: '3000000000' })) as any;
      const resultPage1 = filterAndPaginateClients(clients, { page: 1 });
      expect(resultPage1.pageCount).toBe(3);
      expect(resultPage1.items).toHaveLength(20);

      const resultPage3 = filterAndPaginateClients(clients, { page: 3 });
      expect(resultPage3.items).toHaveLength(5);
    });
  });

  describe('searchParamsSchema', () => {
    it('parámetros válidos', () => {
      const parsed = searchParamsSchema.safeParse({ q: '  Jose  ', status: 'ACTIVO', page: '2' });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data).toEqual({ q: 'Jose', status: 'ACTIVO', page: 2 });
      }
    });

    it('parámetros inválidos ("page=abc", "page=-3", "status=XYZ", q de 500 caracteres)', () => {
      expect(searchParamsSchema.parse({ page: 'abc' })).toEqual({ q: undefined, status: 'TODOS', page: 1 });
      expect(searchParamsSchema.parse({ page: '-3' })).toEqual({ q: undefined, status: 'TODOS', page: 1 });
      expect(searchParamsSchema.parse({ status: 'XYZ' })).toEqual({ q: undefined, status: 'TODOS', page: 1 });
      expect(searchParamsSchema.parse({ q: 'a'.repeat(500) })).toEqual({ q: undefined, status: 'TODOS', page: 1 });
    });

  });
});
