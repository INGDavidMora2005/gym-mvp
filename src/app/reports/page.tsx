import { requireOwner } from '@/lib/auth';
import { fetchDashboardStats, fetchMonthlyRevenue } from '@/lib/db';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/UIComponents';
import { RevenueChart } from '@/components/RevenueChart';
import { formatCOP } from '@/lib/utils';
import { toBogotaDayKey, startOfBogotaMonth } from '@/lib/dates';
import { DollarSign, Calendar, TrendingUp, Users, Download } from 'lucide-react';

export const revalidate = 0;

export default async function ReportsPage() {
  const owner = await requireOwner();

  const [stats, revenueData] = await Promise.all([
    fetchDashboardStats(),
    fetchMonthlyRevenue(6),
  ]);

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-8">
      <Navigation ownerName={owner.name} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-900">
            Reportes y Estadísticas
          </h1>
          <p className="text-sm text-ink-500 mt-1">
            Análisis de ingresos y rendimiento del gimnasio
          </p>
        </div>

        {/* Métricas clave */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="flex items-center gap-4">
            <div className="p-3 bg-ink-100 text-ink-700 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-ink-500 uppercase tracking-wider">
                Ingresos Mes Actual
              </p>
              <p className="text-xl font-bold text-ink-900">{formatCOP(stats.revenue_this_month)}</p>
              <p className="text-[11px] text-ink-500">
                {stats.payments_this_month === 1
                  ? '1 pago'
                  : `${stats.payments_this_month} pagos`}
              </p>
            </div>
          </Card>

          <Card className="flex items-center gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-ink-500 uppercase tracking-wider">
                Ingresos Mes Anterior
              </p>
              <p className="text-xl font-bold text-ink-900">{formatCOP(stats.revenue_last_month)}</p>
            </div>
          </Card>

          <Card className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 text-blue-700 rounded-xl">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-ink-500 uppercase tracking-wider">
                Clientes Activos
              </p>
              <p className="text-xl font-bold text-ink-900">{stats.active_clients}</p>
            </div>
          </Card>
        </div>

        {/* Gráfico de Ingresos */}
        <Card className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-ink-900">Ingresos - Últimos 6 Meses</h2>
          <div className="h-72">
            <RevenueChart data={revenueData} />
          </div>
        </Card>

        {/* Tabla Detallada */}
        <Card>
          <h2 className="font-display text-lg font-semibold text-ink-900 border-b border-ink-100 pb-3 mb-4">
            Detalle por Mes
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {revenueData.map((item) => (
              <div
                key={item.month}
                className="flex items-center justify-between p-3 rounded-xl bg-ink-50 border border-ink-100 text-xs"
              >
                <div>
                  <p className="font-semibold text-ink-900">{item.label}</p>
                  <p className="text-ink-500">
                    {item.count === 1 ? '1 pago' : `${item.count} pagos`}
                  </p>
                </div>
                <p className="font-bold text-ink-900">{formatCOP(item.revenue)}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Exportar reporte */}
        <Card>
          <h2 className="font-display text-lg font-semibold text-ink-900 mb-4 flex items-center gap-2">
            <Download className="w-5 h-5 text-brand-600" />
            <span>Exportar reporte</span>
          </h2>
          <p className="text-sm text-ink-500 mb-4">
            Incluye resumen, pagos y asistencias del periodo. Archivo Excel (.xlsx) con formato,
            filtros y tablas. Rango máximo: 366 días / 50.000 filas.
          </p>
          <form
            method="get"
            action="/api/export/report"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end"
          >
            <div>
              <label htmlFor="from" className="block text-xs font-medium text-ink-700 mb-1">
                Desde
              </label>
              <input
                type="date"
                id="from"
                name="from"
                defaultValue={toBogotaDayKey(startOfBogotaMonth(new Date()))}
                max={toBogotaDayKey(new Date())}
                className="w-full px-3 py-2 rounded-lg border border-ink-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label htmlFor="to" className="block text-xs font-medium text-ink-700 mb-1">
                Hasta
              </label>
              <input
                type="date"
                id="to"
                name="to"
                defaultValue={toBogotaDayKey(new Date())}
                max={toBogotaDayKey(new Date())}
                className="w-full px-3 py-2 rounded-lg border border-ink-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <button
              type="submit"
              className="sm:col-span-2 lg:col-span-2 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Descargar reporte (Excel)
            </button>
          </form>
        </Card>

        {/* KPIs adicionales */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <h2 className="font-display text-lg font-semibold text-ink-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-600" />
              <span>Resumen General</span>
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-ink-100 rounded-xl">
                <p className="text-2xl font-bold text-ink-900">{stats.total_clients}</p>
                <p className="text-xs text-ink-600">Total Clientes</p>
              </div>
              <div className="text-center p-4 bg-emerald-100 rounded-xl">
                <p className="text-2xl font-bold text-emerald-700">{stats.active_clients}</p>
                <p className="text-xs text-ink-600">Activos</p>
              </div>
              <div className="text-center p-4 bg-amber-100 rounded-xl">
                <p className="text-2xl font-bold text-amber-700">{stats.expiring_this_week}</p>
                <p className="text-xs text-ink-600">Próximos Vencer</p>
              </div>
              <div className="text-center p-4 bg-rose-100 rounded-xl">
                <p className="text-2xl font-bold text-rose-700">{stats.expired_clients}</p>
                <p className="text-xs text-ink-600">Vencidos</p>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="font-display text-lg font-semibold text-ink-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-sky-600" />
              <span>Actividad</span>
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-sky-100 rounded-xl">
                <p className="text-2xl font-bold text-sky-700">{stats.attendance_this_month}</p>
                <p className="text-xs text-ink-600">Entradas Este Mes</p>
              </div>
              <div className="text-center p-4 bg-indigo-100 rounded-xl">
                <p className="text-2xl font-bold text-indigo-700">
                  {stats.attendance_rate.total === 0
                    ? '—'
                    : `${Math.round((stats.attendance_rate.attended / stats.attendance_rate.total) * 100)}%`}
                </p>
                <p className="text-xs text-ink-600">
                  {stats.attendance_rate.attended} de{' '}
                  {stats.attendance_rate.total} asistieron este mes
                </p>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}