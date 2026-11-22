import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { calculateMembershipStatus, formatDate, formatCOP, buildWhatsAppUrl, generateExpirationMessage, FIXED_FEE_COP } from '@/lib/utils';
import { Navigation } from '@/components/Navigation';
import { Card, Button, StatusBadge } from '@/components/UIComponents';
import { ClientForm } from '@/components/ClientForm';
import { renewClientAction } from '@/app/actions/payments';
import { softDeleteClientAction, updateClientAction } from '@/app/actions/clients';
import { ArrowLeft, RefreshCw, MessageCircle, Trash2, CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner();

  const resolvedParams = await params;
  const id = resolvedParams.id;

  const supabase = createSupabaseAdminClient();

  // Cliente
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single();

  if (clientError && clientError.code !== 'PGRST116') {
    console.error('[ClientDetailPage:client]', clientError.message);
    throw new Error('No se pudo cargar el cliente.');
  }

  if (!client) notFound();

  // Pagos
  const { data: payments, error: paymentsError } = await supabase
    .from('membership_payments')
    .select('*')
    .eq('client_id', id)
    .order('paid_at', { ascending: false });

  if (paymentsError) {
    console.error('[ClientDetailPage:payments]', paymentsError.message);
    throw new Error('No se pudieron cargar los pagos.');
  }

  // Asistencias
  const { data: attendances, error: attendancesError } = await supabase
    .from('attendance')
    .select('*')
    .eq('client_id', id)
    .order('check_in', { ascending: false });

  if (attendancesError) {
    console.error('[ClientDetailPage:attendance]', attendancesError.message);
    throw new Error('No se pudieron cargar las asistencias.');
  }

  const lastPay = payments && payments.length > 0 ? payments[0].paid_at : null;
  const { status, next_expiration, days_left } = calculateMembershipStatus(lastPay);

  const waUrl = buildWhatsAppUrl(
    client.phone,
    generateExpirationMessage(client.name, days_left, next_expiration)
  );

  return (
    <div className="min-h-screen flex flex-col pb-12">
      <Navigation ownerName={owner.name} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-6">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-ink-600 hover:text-ink-900 transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al Dashboard</span>
          </Link>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-900">{client.name}</h1>
                <StatusBadge status={status} />
              </div>
              <p className="text-sm text-ink-500 mt-1">Registrado el {formatDate(client.created_at)}</p>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <form action={renewClientAction.bind(null, id)} className="flex-1 sm:flex-initial">
                <Button variant="primary" type="submit" className="w-full">
                  <RefreshCw className="w-4 h-4" />
                  <span>Renovar {formatCOP(FIXED_FEE_COP)}</span>
                </Button>
              </form>

              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-all shadow-sm"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Columna Izquierda: Editar Información */}
          <Card className="md:col-span-2 space-y-4">
            <h2 className="font-display text-lg font-semibold text-ink-900 border-b border-ink-100 pb-3">
              Información del Cliente
            </h2>

            <ClientForm
              action={updateClientAction.bind(null, id)}
              mode="edit"
              submitLabel="Guardar Cambios"
              defaultValues={{
                name: client.name,
                age: client.age,
                phone: client.phone,
                address: client.address,
                payment_method: client.payment_method,
              }}
            />

            <div className="pt-4 border-t border-ink-100 flex justify-end">
              <form action={softDeleteClientAction.bind(null, id)}>
                <Button variant="danger" size="sm" type="submit">
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar Cliente</span>
                </Button>
              </form>
            </div>
          </Card>

          {/* Columna Derecha: Estado de Suscripción */}
          <div className="space-y-4">
            <Card className="space-y-3 bg-brand-50/50 border-brand-200">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-800">Suscripción Actual</h3>
              <div className="text-2xl font-bold text-brand-900">{formatCOP(FIXED_FEE_COP)} COP</div>
              <div className="space-y-1 text-xs text-ink-700">
                <p>Último pago: <strong>{formatDate(lastPay)}</strong></p>
                <p>Vence el: <strong>{formatDate(next_expiration)}</strong></p>
                {days_left !== null && (
                  <p className="font-semibold text-brand-700 mt-2">
                    {days_left < 0
                      ? `Vencido hace ${Math.abs(days_left)} días`
                      : `Faltan ${days_left} días`}
                  </p>
                )}
              </div>
            </Card>

            {/* Historial de Pagos */}
            <Card className="space-y-3">
              <h3 className="font-display text-sm font-semibold text-ink-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-ink-400" />
                <span>Historial de Pagos</span>
              </h3>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {payments?.map((p) => (
                  <div key={p.id} className="p-2.5 rounded-lg bg-ink-100 text-xs flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-ink-800">{formatCOP(p.amount_cop)}</p>
                      <p className="text-[11px] text-ink-500">{formatDate(p.paid_at)}</p>
                    </div>
                    <span className="text-[10px] text-ink-500 bg-white px-2 py-0.5 rounded border border-ink-200">
                      {p.recorded_by || 'Dueño'}
                    </span>
                  </div>
                ))}

                {(!payments || payments.length === 0) && (
                  <p className="text-xs text-ink-500 py-2 text-center">Sin pagos registrados</p>
                )}
              </div>
            </Card>

            {/* Asistencias Recientes */}
            <Card className="space-y-3">
              <h3 className="font-display text-sm font-semibold text-ink-900 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Últimas Asistencias</span>
              </h3>

              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {attendances?.slice(0, 5).map((a) => (
                  <div key={a.id} className="text-xs text-ink-700 flex justify-between py-1 border-b border-ink-100 last:border-0">
                    <span>{formatDate(a.check_in)}</span>
                    <span className="text-ink-500 font-mono text-[11px]">
                      {new Date(a.check_in).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}

                {(!attendances || attendances.length === 0) && (
                  <p className="text-xs text-ink-500 py-2 text-center">No hay registro de entradas</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
