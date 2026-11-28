import Link from 'next/link';

interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  q?: string;
  status?: string;
}

export function Pagination({ page, pageCount, total, q, status }: PaginationProps) {
  const buildUrl = (targetPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status && status !== 'TODOS') params.set('status', status);
    if (targetPage > 1) params.set('page', targetPage.toString());
    const query = params.toString();
    return query ? `?${query}` : '?';
  };

  const hasPrev = page > 1;
  const hasNext = page < pageCount;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2 border-t border-ink-200">
      <div className="text-sm text-ink-700">
        Mostrando <span className="font-semibold text-ink-900">{total}</span> {total === 1 ? 'cliente' : 'clientes'}
      </div>
      <div className="flex items-center gap-2">
        {hasPrev ? (
          <Link
            href={buildUrl(page - 1)}
            className="px-3 py-1.5 text-sm font-medium text-ink-700 bg-surface border border-ink-200 rounded-md hover:bg-ink-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            Anterior
          </Link>
        ) : (
          <span className="px-3 py-1.5 text-sm font-medium text-ink-400 bg-ink-100 border border-ink-200 rounded-md cursor-not-allowed">
            Anterior
          </span>
        )}

        <span className="text-sm text-ink-600 px-2">
          Página <span className="font-medium text-ink-900">{page}</span> de{' '}
          <span className="font-medium text-ink-900">{pageCount}</span>
        </span>

        {hasNext ? (
          <Link
            href={buildUrl(page + 1)}
            className="px-3 py-1.5 text-sm font-medium text-ink-700 bg-surface border border-ink-200 rounded-md hover:bg-ink-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            Siguiente
          </Link>
        ) : (
          <span className="px-3 py-1.5 text-sm font-medium text-ink-400 bg-ink-100 border border-ink-200 rounded-md cursor-not-allowed">
            Siguiente
          </span>
        )}
      </div>
    </div>
  );
}
