import { createSupabaseAdminClient } from './supabase/admin';
import {
  getMembershipExpiration,
  calculateMembershipStatus,
} from './utils';
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

export async function fetchClientsWithStatus(): Promise<ClientWithStatus[]> {
  const supabase = createSupabaseAdminClient();
  const now = new Date();

  const { data: clients, error: errClients } = await supabase
    .from('clients')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (errClients) {
    console.error('[fetchClientsWithStatus:clients]', errClients.message);
    throw new Error('No se pudieron cargar los clientes.');
  }

  if (!clients) {
    throw new Error('No se pudieron cargar los clientes.');
  }

  // Pagos con paid_at y period_end para calcular el vencimiento real (excluyendo anulados).
  const { data: payments, error: errPayments } = await supabase
    .from('membership_payments')
    .select('client_id, paid_at, period_end')
    .is('voided_at', null)
    .order('paid_at', { ascending: false });

  if (errPayments) {
    console.error('[fetchClientsWithStatus:payments]', errPayments.message);
    throw new Error('No se pudieron cargar los pagos.');
  }

  const paymentsByClient: Record<string, { paid_at: string; period_end: string | null }[]> = {};
  if (payments) {
    for (const p of payments) {
      if (!paymentsByClient[p.client_id]) {
        paymentsByClient[p.client_id] = [];
      }
      paymentsByClient[p.client_id].push({
        paid_at: p.paid_at,
        period_end: p.period_end,
      });
    }
  }

  // Asistencias: última y conteo del mes de Bogotá.
  const { data: attendances, error: errAttendances } = await supabase
    .from('attendance')
    .select('client_id, check_in')
    .order('check_in', { ascending: false });

  if (errAttendances) {
    console.error('[fetchClientsWithStatus:attendance]', errAttendances.message);
    throw new Error('No se pudieron cargar las asistencias.');
  }

  const lastAttendanceMap: Record<string, string> = {};
  const monthAttendanceMap: Record<string, number> = {};
  const currentMonthKey = bogotaMonthKey(now);

  if (attendances) {
    for (const a of attendances) {
      if (!lastAttendanceMap[a.client_id]) {
        lastAttendanceMap[a.client_id] = a.check_in;
      }
      if (bogotaMonthKey(new Date(a.check_in)) === currentMonthKey) {
        monthAttendanceMap[a.client_id] = (monthAttendanceMap[a.client_id] || 0) + 1;
      }
    }
  }

  return clients.map((c) => {
    const clientPayments = paymentsByClient[c.id] || [];
    const expiration = getMembershipExpiration(clientPayments);
    const { status, next_expiration, days_left } = calculateMembershipStatus(
      expiration,
      now,
    );

    return {
      ...c,
      status,
      last_payment_at: clientPayments[0]?.paid_at || null,
      next_expiration,
      days_left,
      last_attendance: lastAttendanceMap[c.id] || null,
      attendance_this_month: monthAttendanceMap[c.id] || 0,
    };
  });
}

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
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
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
