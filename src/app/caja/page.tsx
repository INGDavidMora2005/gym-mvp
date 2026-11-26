import { requireOwner } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { Navigation } from '@/components/Navigation';
import { CashSummary } from '@/components/CashSummary';
import { CashClosingForm } from '@/components/CashClosingForm';
import { CashHistory } from '@/components/CashHistory';
import { parseBogotaDateKey, toBogotaDayKey } from '@/lib/dates';
import { cashDateSchema } from '@/lib/validation';
import { clientNameFrom } from '@/lib/cash';
import { Wallet, Download } from 'lucide-react';
import Link from 'next/link';
import { CashClosing, MembershipPayment } from '@/types';

export const revalidate = 0;

export default async function CashPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const owner = await requireOwner();
  const rawParams = await searchParams;
  const dateParam = Array.isArray(rawParams.date) ? rawParams.date[0] : rawParams.date;

  // Validar fecha; si inválida o ausente, usar hoy en Bogotá
  const dateResult = cashDateSchema.safeParse(dateParam);
  const businessDate = dateResult.success ? dateResult.data : toBogotaDayKey(new Date());

  const supabase = createSupabaseAdminClient();

  // Rango del día en Bogotá: [00:00, 24:00) -> en UTC
  const dayStart = parseBogotaDateKey(businessDate);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  // Pagos no anulados de ese día, con nombre del cliente
  const { data: payments, error: paymentsError } = await supabase
    .from('membership_payments')
    .select(`
      id,
      client_id,
      amount_cop,
      paid_at,
      payment_method,
      recorded_by,
      period_start,
      period_end,
      note,
      created_at,
      voided_at,
      voided_by,
      void_reason,
      clients!inner(name)
    `)
    .is('voided_at', null)
    .gte('paid_at', dayStart.toISOString())
    .lt('paid_at', dayEnd.toISOString())
    .order('paid_at', { ascending: true });

  if (paymentsError) {
    console.error('[CashPage:payments]', paymentsError.message);
    throw new Error('No se pudieron cargar los pagos del día.');
  }

  // Transformar de forma explícita: PostgREST puede devolver `clients` como objeto o array.
  // `clients` queda como string ya resuelto para la UI.
  const typedPayments: (MembershipPayment & { clients: string })[] = (payments ?? []).map((p) => ({
    id: p.id,
    client_id: p.client_id,
    amount_cop: p.amount_cop,
    paid_at: p.paid_at,
    period_start: p.period_start,
    period_end: p.period_end,
    recorded_by: p.recorded_by,
    note: p.note,
    created_at: p.created_at,
    voided_at: p.voided_at,
    voided_by: p.voided_by,
    void_reason: p.void_reason,
    payment_method: p.payment_method,
    clients: clientNameFrom(p.clients),
  }));

  // Cierres de la fecha mostrada (todos, el primero es el vigente del día)
  const { data: dayClosingsRaw, error: dayClosingsError } = await supabase
    .from('cash_closings')
    .select('*')
    .eq('business_date', businessDate)
    .order('created_at', { ascending: false });

  if (dayClosingsError) {
    console.error('[CashPage:dayClosings]', dayClosingsError.message);
    throw new Error('No se pudo cargar el historial de cierres del día.');
  }

  // Los 10 cierres más recientes globales (historial general)
  const { data: recentClosingsRaw, error: recentClosingsError } = await supabase
    .from('cash_closings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (recentClosingsError) {
    console.error('[CashPage:recentClosings]', recentClosingsError.message);
    throw new Error('No se pudo cargar el historial de cierres.');
  }

  const dayClosings: CashClosing[] = dayClosingsRaw ?? [];
  const recentClosings: CashClosing[] = recentClosingsRaw ?? [];

  // El cierre vigente del día es el primero de los cierres de esa fecha (o null).
  const latestClosing: CashClosing | null = dayClosings[0] ?? null;

  // Calcular expected actual para comparar con el cierre vigente del día
  const cashPayments = typedPayments.filter((p) => p.payment_method === 'EFECTIVO');
  const currentExpected = cashPayments.reduce((sum, p) => sum + p.amount_cop, 0);

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-8">
      <Navigation ownerName={owner.name} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header con selector de fecha */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-ink-200 shadow-xs">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight flex items-center gap-3">
              <Wallet className="w-7 h-7 text-brand-600" />
              <span>Caja</span>
            </h1>
            <p className="text-sm text-ink-600 mt-1">Resumen diario por método y cierre de efectivo</p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
            <form method="get" className="flex items-center gap-3 w-full sm:w-auto">
              <label htmlFor="date" className="sr-only">Fecha</label>
              <input
                type="date"
                id="date"
                name="date"
                defaultValue={businessDate}
                max={toBogotaDayKey(new Date())}
                className="px-4 py-2.5 rounded-xl border border-ink-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-48"
              />
              <button type="submit" className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors">
                Ver
              </button>
            </form>
            <a
              href={`/api/export/payments?from=${businessDate}&to=${businessDate}`}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              Exportar pagos de este día (CSV)
            </a>
          </div>
        </div>

        {/* Resumen del día */}
        <CashSummary
          payments={typedPayments}
          businessDate={businessDate}
          currentExpected={currentExpected}
        />

        {/* Formulario de cierre de caja */}
        <CashClosingForm
          businessDate={businessDate}
          expectedCashCop={currentExpected}
          latestClosing={latestClosing}
          currentExpected={currentExpected}
        />

        {/* Historial de cierres */}
        <CashHistory
          dayClosings={dayClosings}
          recentClosings={recentClosings}
          businessDate={businessDate}
          currentExpected={currentExpected}
        />
      </main>
    </div>
  );
}