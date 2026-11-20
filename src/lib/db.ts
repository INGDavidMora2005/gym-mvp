import { createSupabaseAdminClient } from './supabase';
import { calculateMembershipStatus } from './utils';
import { ClientWithStatus, DashboardStats, RevenuePoint } from '@/types';

export async function fetchClientsWithStatus(): Promise<ClientWithStatus[]> {
  const supabase = createSupabaseAdminClient();

  const { data: clients, error: errClients } = await supabase
    .from('clients')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (errClients || !clients) return [];

  // Obtener los pagos más recientes de cada cliente
  const { data: payments } = await supabase
    .from('membership_payments')
    .select('client_id, paid_at')
    .order('paid_at', { ascending: false });

  const paymentMap: Record<string, string> = {};
  if (payments) {
    for (const p of payments) {
      if (!paymentMap[p.client_id]) {
        paymentMap[p.client_id] = p.paid_at;
      }
    }
  }

  // Obtener la última asistencia y total de asistencias del mes
  const { data: attendances } = await supabase
    .from('attendance')
    .select('client_id, check_in')
    .order('check_in', { ascending: false });

  const lastAttendanceMap: Record<string, string> = {};
  const monthAttendanceMap: Record<string, number> = {};

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  if (attendances) {
    for (const a of attendances) {
      if (!lastAttendanceMap[a.client_id]) {
        lastAttendanceMap[a.client_id] = a.check_in;
      }
      const cDate = new Date(a.check_in);
      if (cDate.getMonth() === currentMonth && cDate.getFullYear() === currentYear) {
        monthAttendanceMap[a.client_id] = (monthAttendanceMap[a.client_id] || 0) + 1;
      }
    }
  }

  return clients.map((c) => {
    const lastPay = paymentMap[c.id] || null;
    const { status, next_expiration, days_left } = calculateMembershipStatus(lastPay);
    return {
      ...c,
      status,
      last_payment_at: lastPay,
      next_expiration,
      days_left,
      last_attendance: lastAttendanceMap[c.id] || null,
      attendance_this_month: monthAttendanceMap[c.id] || 0,
    };
  });
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const clients = await fetchClientsWithStatus();

  let activeCount = 0;
  let expiringCount = 0;
  let expiredCount = 0;

  const notReturned: ClientWithStatus[] = [];
  const now = new Date();

  for (const c of clients) {
    if (c.status === 'ACTIVO') activeCount++;
    else if (c.status === 'POR_VENCER') expiringCount++;
    else if (c.status === 'VENCIDO') expiredCount++;

    // Clientes activos que no han asistido en más de 14 días
    if (c.status !== 'VENCIDO' && c.last_attendance) {
      const last = new Date(c.last_attendance);
      const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 14) {
        notReturned.push(c);
      }
    }
  }

  const supabase = createSupabaseAdminClient();

  // Calcular ingresos del mes actual y mes anterior
  const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

  const { data: thisMonthPays } = await supabase
    .from('membership_payments')
    .select('amount_cop')
    .gte('paid_at', firstDayThisMonth);

  const { data: lastMonthPays } = await supabase
    .from('membership_payments')
    .select('amount_cop')
    .gte('paid_at', firstDayLastMonth)
    .lte('paid_at', lastDayLastMonth);

  const revenueThisMonth = (thisMonthPays || []).reduce((acc, p) => acc + p.amount_cop, 0);
  const revenueLastMonth = (lastMonthPays || []).reduce((acc, p) => acc + p.amount_cop, 0);

  // Total asistencias del mes
  const { count: attendanceThisMonth } = await supabase
    .from('attendance')
    .select('id', { count: 'exact', head: true })
    .gte('check_in', firstDayThisMonth);

  return {
    total_clients: clients.length,
    active_clients: activeCount,
    expiring_this_week: expiringCount,
    expired_clients: expiredCount,
    revenue_this_month: revenueThisMonth,
    revenue_last_month: revenueLastMonth,
    attendance_this_month: attendanceThisMonth || 0,
    not_returned: notReturned,
  };
}

export async function fetchMonthlyRevenue(monthsCount: number = 6): Promise<RevenuePoint[]> {
  const supabase = createSupabaseAdminClient();
  const { data: payments } = await supabase
    .from('membership_payments')
    .select('paid_at, amount_cop')
    .order('paid_at', { ascending: true });

  const monthMap: Record<string, { revenue: number; count: number; label: string }> = {};

  const now = new Date();
  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });
    monthMap[key] = { revenue: 0, count: 0, label };
  }

  if (payments) {
    for (const p of payments) {
      const d = new Date(p.paid_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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