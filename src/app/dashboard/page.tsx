import { redirect } from 'next/navigation';
import { getCurrentOwner } from '@/lib/auth';
import { fetchClientsWithStatus, fetchDashboardStats } from '@/lib/db';
import { Navigation } from '@/components/Navigation';
import { ClientList } from '@/components/ClientList';
import { Card } from '@/components/UIComponents';
import { Users, AlertTriangle, CheckCircle, DollarSign, Dumbbell, MessageCircle, UserX } from 'lucide-react';
import { formatCOP, buildWhatsAppUrl, generateInactivityMessage } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import { createSupabaseAdminClient } from '@/lib/supabase';

export const revalidate = 0;

export default async function DashboardPage() {
  const owner = await getCurrentOwner();
  if (!owner) {
    redirect('/auth/login');
  }

  const [clients, stats] = await Promise.all([
    fetchClientsWithStatus(),
    fetchDashboardStats(),
  ]);

  // Server Action para renovar
  async function renewClientAction(clientId: string) {
    'use server';
    const supabase = createSupabaseAdminClient();
    const now = new Date().toISOString();
    await supabase.from('membership_payments').insert({
      client_id: clientId,
      amount_cop: 65000,
      paid_at: now,
      recorded_by: owner?.name || 'Dueño',
      note: 'Renovación de tarifa fija $65.000',
    });
    revalidatePath('/dashboard');
    revalidatePath('/expirations');
  }

  // Server Action para marcar asistencia
  async function recordAttendanceAction(clientId: string) {
    'use server';
    const supabase = createSupabaseAdminClient();
    await supabase.from('attendance').insert({
      client_id: clientId,
      check_in: new Date().toISOString(),
      recorded_by: owner?.name || 'Dueño',
    });
    revalidatePath('/dashboard');
    revalidatePath('/attendance');
  }

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-8">
      <Navigation ownerName={owner.name} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Encabezado Principal */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-ink-200 shadow-xs">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight">
              Bienvenido, {owner.name} 👋
            </h1>
            <p className="text-sm text-ink-600 mt-1">
              Resumen en tiempo real del estado de tu gimnasio
            </p>
          </div>
          <div className="bg-brand-50 border border-brand-200 rounded-xl px-4 py-2 text-right">
            <span className="text-xs font-medium text-brand-700 block">Tarifa Única</span>
            <span className="text-lg font-bold text-brand-900">$65.000 COP / mes</span>
          </div>
        </div>

        {/* Tarjetas de Métricas Rápidas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="flex items-center gap-4">
            <div className="p-3 bg-brand-50 text-brand-600 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Total Clientes</p>
              <p className="text-2xl font-bold text-ink-900">{stats.total_clients}</p>
            </div>
          </Card>

          <Card className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Activos</p>
              <p className="text-2xl font-bold text-emerald-700">{stats.active_clients}</p>
            </div>
          </Card>

          <Card className="flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Por Vencer</p>
              <p className="text-2xl font-bold text-amber-700">{stats.expiring_this_week}</p>
            </div>
          </Card>

          <Card className="flex items-center gap-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Ingresos Este Mes</p>
              <p className="text-xl font-bold text-ink-900">{formatCOP(stats.revenue_this_month)}</p>
            </div>
          </Card>
        </div>

        {/* Sección de Retención: Clientes sin Asistir */}
        {stats.not_returned.length > 0 && (
          <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-900 font-semibold text-base">
              <UserX className="w-5 h-5 text-amber-600" />
              <span>Clientes que pagaron pero llevan más de 14 días sin asistir ({stats.not_returned.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {stats.not_returned.slice(0, 4).map((c) => {
                const daysAbsent = c.last_attendance
                  ? Math.floor((new Date().getTime() - new Date(c.last_attendance).getTime()) / (1000 * 60 * 60 * 24))
                  : 14;
                const waUrl = buildWhatsAppUrl(c.phone, generateInactivityMessage(c.name, daysAbsent));

                return (
                  <div key={c.id} className="bg-white p-3.5 rounded-xl border border-amber-200 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-ink-900 text-sm">{c.name}</p>
                      <p className="text-xs text-ink-500">Última visita: hace {daysAbsent} días</p>
                    </div>
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-all shadow-xs"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Motivar</span>
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Directorio Principal de Clientes */}
        <div className="space-y-4">
          <h2 className="font-display text-xl font-bold text-ink-900">Directorio de Clientes</h2>
          <ClientList
            initialClients={clients}
            onRenew={renewClientAction}
            onRecordAttendance={recordAttendanceAction}
          />
        </div>
      </main>
    </div>
  );
}