import { requireOwner } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { Navigation } from '@/components/Navigation';
import { CashSummary } from '@/components/CashSummary';
import { CashClosingForm } from '@/components/CashClosingForm';
import { CashHistory } from '@/components/CashHistory';
import { parseBogotaDateKey, toBogotaDayKey } from '@/lib/dates';
import { formatDate, formatTime } from '@/lib/utils';
import { cashDateSchema } from '@/lib/validation';
import { Wallet } from 'lucide-react';
import Link from 'next/link';
import { MembershipPayment } from '@/types';

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

  // Transformar para que coincida con MembershipPayment (el cliente viene como array)
  const typedPayments = (payments || []).map((p) => ({
    ...p,
    clients: p.clients[0]?.name || 'Cliente desconocido',
  })) as (MembershipPayment & { clients: string })[];

  // Últimos 10 cierres de ese día o los 10 más recientes globales
  const { data: closings, error: closingsError } = await supabase
    .from('cash_closings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (closingsError) {
    console.error('[CashPage:closings]', closingsError.message);
    throw new Error('No se pudo cargar el historial de cierres.');
  }

  // Filtrar cierres del día seleccionado y el vigente (el último por created_at)
  const dayClosings = (closings || []).filter((c) => c.business_date === businessDate);
  const latestClosing = (closings || [])[0] || null;
  const isLatestForDay = latestClosing && latestClosing.business_date === businessDate;

  // Calcular expected actual para comparar con el cierre vigente
  const cashPayments = (typedPayments || []).filter((p) => p.payment_method === 'EFECTIVO');
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
          isLatestForDay={isLatestForDay}
        />

        {/* Historial de cierres */}
        <CashHistory
          closings={closings || []}
          dayClosings={dayClosings}
          businessDate={businessDate}
          currentExpected={currentExpected}
        />
      </main>
    </div>
  );
}