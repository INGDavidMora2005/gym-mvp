import { cache } from 'react';
import { createSupabaseAdminClient } from './supabase/admin';
import { calculateMembershipStatus } from './utils';
import {
  startOfBogotaMonth,
  bogotaMonthKey,
  diffBogotaDays,
} from './dates';
import {
  ClientWithStatus,
  DashboardStats,
  RevenuePoint,
} from '@/types';

export const fetchClientsWithStatus = cache(async (): Promise<ClientWithStatus[]> => {
  const supabase = createSupabaseAdminClient();
  const now = new Date();

  // 1. Obtener clientes activos
  const { data: clients, error: errClients } = await supabase
    .from('clients')
    .select('*')
    .eq('active', true)
    .order('name', { ascending: true }); // Ordenado por nombre

  if (errClients) {
    console.error('[fetchClientsWithStatus:clients]', errClients.message);
    throw new Error('No se pudieron cargar los clientes.');
  }

  // 2. Obtener resumen de la vista (pagos y asistencias procesados)
  const { data: overview, error: errOverview } = await supabase
    .from('client_overview')
    .select('*');

  if (errOverview) {
    console.error('[fetchClientsWithStatus:overview]', errOverview.message);
    throw new Error('No se pudieron cargar los datos de resumen.');
  }

  const overviewMap = new Map((overview || []).map((o) => [o.client_id, o]));

  return (clients || []).map((c) => {
    const o = overviewMap.get(c.id);
    const { status, next_expiration, days_left } = calculateMembershipStatus(
      o?.expiration ? new Date(o.expiration) : null,
      now,
    );

    return {
      ...c,
      status,
      last_payment_at: o?.last_payment_at || null,
      next_expiration,
      days_left,
      last_attendance: o?.last_attendance || null,
      attendance_this_month: o?.attendance_this_month || 0,
    };
  });
});

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const clients = await fetchClientsWithStatus();
  const now = new Date();

  let activeCount = 0;
  let expiringCount = 0;
  let expiredCount = 0;
  let noPaymentCount = 0;

  const notReturned: ClientWithStatus[] = [];

  for (const c of clients) {
    if (c.status === 'ACTIVO') activeCount++;
    else if (c.status === 'POR_VENCER') expiringCount++;
    else if (c.status === 'VENCIDO') expiredCount++;
    else if (c.status === 'SIN_PAGO') noPaymentCount++;

    // Clientes ACTIVO o POR_VENCER sin asistir >= 14 días (Bogotá).
    if (c.status === 'ACTIVO' || c.status === 'POR_VENCER') {
      const hasRecentAttendance =
        c.last_attendance &&
        diffBogotaDays(new Date(c.last_attendance), now) < 14;
      const registeredLongAgo =
        diffBogotaDays(new Date(c.created_at), now) >= 14;

      const shouldNotify =
        (!hasRecentAttendance && c.last_attendance) ||
        (!c.last_attendance && registeredLongAgo);

      if (shouldNotify) {
        notReturned.push(c);
      }
    }
  }

  const supabase = createSupabaseAdminClient();

  // Ingresos del mes actual y mes anterior en zona horaria de Bogotá.
  const thisMonthStart = startOfBogotaMonth(now, 0);
  const thisMonthEnd = startOfBogotaMonth(now, 1);
  const lastMonthStart = startOfBogotaMonth(now, -1);
  const lastMonthEnd = startOfBogotaMonth(now, 0);

  const { data: thisMonthPays, error: errThisMonthPays } = await supabase
    .from('membership_payments')
    .select('amount_cop')
    .is('voided_at', null)
    .gte('paid_at', thisMonthStart.toISOString())
    .lt('paid_at', thisMonthEnd.toISOString());

  if (errThisMonthPays) {
    console.error('[fetchDashboardStats:this-month-payments]', errThisMonthPays.message);
    throw new Error('No se pudieron cargar las métricas.');
  }

  const { data: lastMonthPays, error: errLastMonthPays } = await supabase
    .from('membership_payments')
    .select('amount_cop')
    .is('voided_at', null)
    .gte('paid_at', lastMonthStart.toISOString())
    .lt('paid_at', lastMonthEnd.toISOString());

  if (errLastMonthPays) {
    console.error('[fetchDashboardStats:last-month-payments]', errLastMonthPays.message);
    throw new Error('No se pudieron cargar las métricas.');
  }

  const revenueThisMonth = (thisMonthPays || []).reduce((acc, p) => acc + p.amount_cop, 0);
  const revenueLastMonth = (lastMonthPays || []).reduce((acc, p) => acc + p.amount_cop, 0);
  const paymentsThisMonth = (thisMonthPays || []).length;

  // Asistencia del mes actual (Bogotá) para tasa de asistencia.
  const { count: attendanceThisMonth, error: errAttendanceCount } = await supabase
    .from('attendance')
    .select('id', { count: 'exact', head: true })
    .gte('check_in', thisMonthStart.toISOString())
    .lt('check_in', thisMonthEnd.toISOString());

  if (errAttendanceCount) {
    console.error('[fetchDashboardStats:attendance]', errAttendanceCount.message);
    throw new Error('No se pudieron cargar las métricas.');
  }

  const totalEligible = activeCount + expiringCount;
  const attendedEligible = clients.filter(
    (c) =>
      (c.status === 'ACTIVO' || c.status === 'POR_VENCER') &&
      (c.attendance_this_month || 0) > 0,
  ).length;

  return {
    total_clients: clients.length,
    active_clients: activeCount,
    expiring_this_week: expiringCount,
    expired_clients: expiredCount,
    no_payment_clients: noPaymentCount,
    revenue_this_month: revenueThisMonth,
    revenue_last_month: revenueLastMonth,
    payments_this_month: paymentsThisMonth,
    attendance_this_month: attendanceThisMonth || 0,
    attendance_rate: { attended: attendedEligible, total: totalEligible },
    not_returned: notReturned,
  };
}

export async function fetchMonthlyRevenue(monthsCount: number = 6): Promise<RevenuePoint[]> {
  const supabase = createSupabaseAdminClient();
  const now = new Date();

  const { data: payments, error } = await supabase
    .from('membership_payments')
    .select('paid_at, amount_cop')
    .is('voided_at', null)
    .order('paid_at', { ascending: true });

  if (error) {
    console.error('[fetchMonthlyRevenue]', error.message);
    throw new Error('No se pudieron cargar los ingresos.');
  }

  // Etiquetas de los últimos N meses en Bogotá.
  const monthMap: Record<string, { revenue: number; count: number; label: string }> = {};

  for (let i = monthsCount - 1; i >= 0; i--) {
    const monthStart = startOfBogotaMonth(now, -i);
    const key = bogotaMonthKey(monthStart);
    const d = new Date(monthStart);
    const label = d.toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      month: 'short',
      year: '2-digit',
    });
    monthMap[key] = { revenue: 0, count: 0, label };
  }

  if (payments) {
    for (const p of payments) {
      const key = bogotaMonthKey(new Date(p.paid_at));
      if (monthMap[key]) {
        monthMap[key].revenue += p.amount_cop;
        monthMap[key].count += 1;
      }
    }
  }

  return Object.keys(monthMap).map((k) => ({
    month: k,
    label: monthMap[k].label,
    revenue: monthMap[k].revenue,
    count: monthMap[k].count,
  }));
}
