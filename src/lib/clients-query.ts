import { z } from 'zod';
import { ClientWithStatus } from '@/types';

export const CLIENTS_PAGE_SIZE = 20;

export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function filterAndPaginateClients(
  clients: ClientWithStatus[],
  {
    q,
    status,
    page = 1,
  }: { q?: string; status?: string; page?: number }
) {
  let filtered = [...clients];

  // 1. Filtrar por estado
  if (status && status !== 'TODOS') {
    filtered = filtered.filter((c) => c.status === status);
  }

  // 2. Filtrar por búsqueda (q)
  if (q && q.trim().length > 0) {
    const normalizedQ = normalizeText(q);
    const qDigits = q.replace(/\D/g, '');

    filtered = filtered.filter((c) => {
      const nameMatch = normalizeText(c.name).includes(normalizedQ);
      let phoneMatch = false;
      if (qDigits.length >= 3) {
        phoneMatch = c.phone.replace(/\D/g, '').includes(qDigits);
      }
      return nameMatch || phoneMatch;
    });
  }

  // 3. Ordenar
  filtered.sort((a, b) => {
    if (status === 'POR_VENCER' || status === 'VENCIDO') {
      const diff = (a.days_left ?? 9999) - (b.days_left ?? 9999);
      if (diff !== 0) return diff;
    }
    return a.name.localeCompare(b.name);
  });

  // 4. Paginar
  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / CLIENTS_PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), pageCount);

  const start = (currentPage - 1) * CLIENTS_PAGE_SIZE;
  const items = filtered.slice(start, start + CLIENTS_PAGE_SIZE);

  return {
    items,
    total,
    page: currentPage,
    pageCount,
  };
}

export const searchParamsSchema = z.object({
  q: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((v) => (v === '' || !v ? undefined : v))
    .catch(undefined),
  status: z
    .string()
    .catch('TODOS')
    .transform((v) =>
      ['TODOS', 'ACTIVO', 'POR_VENCER', 'VENCIDO', 'SIN_PAGO'].includes(v) ? v : 'TODOS'
    ),
  page: z.coerce
    .number()
    .int()
    .catch(1)
    .transform((v) => (v < 1 ? 1 : v)),
});
