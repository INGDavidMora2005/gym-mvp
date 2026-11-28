import { requireOwner } from '@/lib/auth';
import { fetchClientsWithStatus } from '@/lib/db';
import { Navigation } from '@/components/Navigation';
import { Card, Button, StatusBadge } from '@/components/UIComponents';
import { recordAttendanceAction, deleteAttendanceAction } from '@/app/actions/attendance';
import { CalendarCheck, CheckCircle, Search } from 'lucide-react';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { startOfBogotaDay } from '@/lib/dates';
import { formatDate } from '@/lib/utils';
import { filterAndPaginateClients, searchParamsSchema } from '@/lib/clients-query';
import { Pagination } from '@/components/Pagination';
import Link from 'next/link';

export const revalidate = 0;

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const owner = await requireOwner();
  const rawParams = await searchParams;
  const { q, status, page } = searchParamsSchema.parse(rawParams);

  const allClients = await fetchClientsWithStatus();

  const { items: pageClients, total, page: currentPage, pageCount } = filterAndPaginateClients(
    allClients,
    { q, status, page }
  );

  const pageClientIds = pageClients.map((c) => c.id);

  // Obtener asistencias registradas HOY (filtrado por clientes de la página si hay)
  const supabase = createSupabaseAdminClient();
  const todayStart = startOfBogotaDay(new Date());

  let todayAttendances: { id: string; client_id: string; check_in: string }[] = [];

  if (pageClientIds.length > 0) {
    const { data, error: todayAttendancesError } = await supabase
      .from('attendance')
      .select('id, client_id, check_in')
      .gte('check_in', todayStart.toISOString())
      .in('client_id', pageClientIds)
      .order('check_in', { ascending: false });

    if (todayAttendancesError) {
      console.error('[AttendancePage:attendance]', todayAttendancesError.message);
      throw new Error('No se pudieron cargar las asistencias.');
    }
    todayAttendances = data || [];
  }

  // También podemos contar el total de asistencias de hoy en el gym para la métrica del encabezado
  const { count: totalTodayCount, error: countErr } = await supabase
    .from('attendance')
    .select('id', { count: 'exact', head: true })
    .gte('check_in', todayStart.toISOString());

  if (countErr) {
    console.error('[AttendancePage:attendance-count]', countErr.message);
  }

  // Mapa: client_id -> {id, check_in} para poder mostrar botón deshacer
  const attendedMap = new Map<string, { id: string; check_in: string }>();
  for (const a of todayAttendances) {
    attendedMap.set(a.client_id, a);
  }

  const buildStatusUrl = (st: string) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (st !== 'TODOS') params.set('status', st);
    const query = params.toString();
    return query ? `?${query}` : '?';
  };

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-8">
      <Navigation ownerName={owner.name} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-6 rounded-2xl border border-ink-200">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink-900 flex items-center gap-2">
              <CalendarCheck className="w-6 h-6 text-brand-600" />
              <span>Control de Asistencia Diaria</span>
            </h1>
            <p className="text-sm text-ink-500 mt-1">
              Marca el ingreso de los clientes al gimnasio el día de hoy
            </p>
          </div>
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-800 px-4 py-2 rounded-xl text-center">
            <span className="text-xs font-semibold block uppercase tracking-wider">Asistencias Hoy</span>
            <span className="text-2xl font-bold">{totalTodayCount ?? 0} personas</span>
          </div>
        </div>

        {/* Barra de Búsqueda y Filtros */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <form method="get" className="relative w-full sm:w-80 flex gap-2">
            {status && status !== 'TODOS' && (
              <input type="hidden" name="status" value={status} />
            )}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Buscar por nombre o teléfono..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-ink-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-surface"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-brand-solid text-white hover:bg-brand-solid-hover transition-colors-200"
            >
              Buscar
            </button>
          </form>

          <div className="flex gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {(['TODOS', 'ACTIVO', 'POR_VENCER', 'VENCIDO', 'SIN_PAGO'] as const).map((st) => {
              const isSelected = status === st;
              return (
                <Link
                  key={st}
                  href={buildStatusUrl(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors-200 ${
                    isSelected
                      ? 'bg-brand-solid text-white shadow-xs'
                      : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                  }`}
                >
                  {st === 'TODOS'
                    ? 'Todos'
                    : st === 'ACTIVO'
                    ? 'Activos'
                    : st === 'POR_VENCER'
                    ? 'Por Vencer'
                    : st === 'VENCIDO'
                    ? 'Vencidos'
                    : 'Sin pago'}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Lista de Marcado Rápido */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pageClients.map((c) => {
            const hasAttendedToday = attendedMap.has(c.id);

            return (
              <Card
                key={c.id}
                className={`flex items-center justify-between p-4 transition-colors-200 ${
                  hasAttendedToday ? 'bg-emerald-50/40 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-800' : ''
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-ink-900 text-sm">{c.name}</h3>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-xs text-ink-500">{c.phone}</p>
                  <p className="text-[11px] text-ink-400 mt-1">
                    Última entrada: {c.last_attendance ? formatDate(c.last_attendance) : 'Nunca'}
                  </p>
                </div>

                {hasAttendedToday ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300 text-xs font-semibold">
                      <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Ya entró hoy</span>
                    </span>
                    <form action={deleteAttendanceAction.bind(null, c.id, attendedMap.get(c.id)!.id)}>
                      <Button variant="secondary" size="sm" type="submit">
                        Deshacer
                      </Button>
                    </form>
                  </div>
                ) : (
                  <form action={recordAttendanceAction.bind(null, c.id)}>
                    <Button variant="primary" size="sm" type="submit">
                      Marcar Ingreso
                    </Button>
                  </form>
                )}
              </Card>
            );
          })}

          {pageClients.length === 0 && (
            <div className="col-span-full text-center py-12 bg-surface rounded-2xl border border-dashed border-ink-200 space-y-3">
              <p className="text-sm text-ink-500 font-medium">No se encontraron clientes</p>
              <div>
                <Link
                  href="?"
                  className="inline-flex items-center text-xs font-semibold text-brand-600 hover:text-brand-700 underline"
                >
                  Limpiar búsqueda
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Paginación */}
        <Pagination
          page={currentPage}
          pageCount={pageCount}
          total={total}
          q={q}
          status={status}
        />
      </main>
    </div>
  );
}
