import { requireOwner } from '@/lib/auth';
import { fetchClientsWithStatus, fetchDashboardStats } from '@/lib/db';
import { Navigation } from '@/components/Navigation';
import { ClientList } from '@/components/ClientList';
import { Card } from '@/components/UIComponents';
import { renewClientAction } from '@/app/actions/payments';
import { recordAttendanceAction } from '@/app/actions/attendance';
import { Users, AlertTriangle, CheckCircle, DollarSign, MessageCircle, UserX } from 'lucide-react';
import { FIXED_FEE_COP, formatCOP, buildWhatsAppUrl, generateInactivityMessage } from '@/lib/utils';
import { diffBogotaDays } from '@/lib/dates';
import { filterAndPaginateClients, searchParamsSchema } from '@/lib/clients-query';

export const revalidate = 0;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const owner = await requireOwner();
  const rawParams = await searchParams;
  const { q, status, page } = searchParamsSchema.parse(rawParams);

  const [allClients, stats] = await Promise.all([
    fetchClientsWithStatus(),
    fetchDashboardStats(),
  ]);

  const { items, total, page: currentPage, pageCount } = filterAndPaginateClients(allClients, {
    q,
    status,
    page,
  });

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-8">
      <Navigation ownerName={owner.name} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-ink-200 shadow-xs">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight">
              Bienvenido, {owner.name} 👋
            </h1>
            <p className="text-sm text-ink-600 mt-1">Resumen en tiempo real del estado de tu gimnasio</p>
          </div>
          <div className="bg-brand-50 border border-brand-200 rounded-xl px-4 py-2 text-right">
            <span className="text-xs font-medium text-brand-700 block">Tarifa Única</span>
            <span className="text-lg font-bold text-brand-900">{formatCOP(FIXED_FEE_COP)} COP / mes</span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="flex items-center gap-4">
            <div className="p-3 bg-brand-50 text-brand-600 rounded-xl"><Users className="w-6 h-6" /></div>
            <div>
              <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Total Clientes</p>
              <p className="text-2xl font-bold text-ink-900">{stats.total_clients}</p>
            </div>
          </Card>
          <Card className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><CheckCircle className="w-6 h-6" /></div>
            <div>
              <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Activos</p>
              <p className="text-2xl font-bold text-emerald-700">{stats.active_clients}</p>
            </div>
          </Card>
          <Card className="flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><AlertTriangle className="w-6 h-6" /></div>
            <div>
              <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Por Vencer</p>
              <p className="text-2xl font-bold text-amber-700">{stats.expiring_this_week}</p>
            </div>
          </Card>
          <Card className="flex items-center gap-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl"><DollarSign className="w-6 h-6" /></div>
            <div>
              <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Ingresos Este Mes</p>
              <p className="text-xl font-bold text-ink-900">{formatCOP(stats.revenue_this_month)}</p>
              <p className="text-[11px] text-ink-500">
                {stats.payments_this_month === 1
                  ? '1 pago'
                  : `${stats.payments_this_month} pagos`}
              </p>
            </div>
          </Card>
        </div>

        {stats.not_returned.length > 0 && (
          <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-900 font-semibold text-base">
              <UserX className="w-5 h-5 text-amber-600" />
              <span>
                Clientes que pagaron pero llevan 14 días o más sin asistir ({stats.not_returned.length})
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {stats.not_returned.slice(0, 4).map((c) => {
                const now = new Date();
                const daysAbsent = c.last_attendance
                  ? diffBogotaDays(new Date(c.last_attendance), now)
                  : null;
                const waUrl = buildWhatsAppUrl(
                  c.phone,
                  generateInactivityMessage(c.name, daysAbsent),
                );
                return (
                  <div key={c.id} className="bg-white p-3.5 rounded-xl border border-amber-200 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-ink-900 text-sm">{c.name}</p>
                      <p className="text-xs text-ink-500">
                        Última visita:{' '}
                        {daysAbsent !== null
                          ? `hace ${daysAbsent} días`
                          : 'Aún no ha asistido'}
                      </p>
                    </div>
                    <a href={waUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-all shadow-xs">
                      <MessageCircle className="w-3.5 h-3.5" /> <span>Motivar</span>
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h2 className="font-display text-xl font-bold text-ink-900">Directorio de Clientes</h2>
          <ClientList
            clients={items}
            total={total}
            page={currentPage}
            pageCount={pageCount}
            currentQ={q}
            currentStatus={status}
            onRenew={renewClientAction}
            onRecordAttendance={recordAttendanceAction}
          />
        </div>
      </main>
    </div>
  );
}
