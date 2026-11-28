import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { calculateMembershipStatus, getMembershipExpiration, formatDate, formatTime, formatCOP, buildWhatsAppUrl, generateExpirationMessage, FIXED_FEE_COP } from '@/lib/utils';
import { Navigation } from '@/components/Navigation';
import { Card, Button, StatusBadge } from '@/components/UIComponents';
import { ClientForm } from '@/components/ClientForm';
import { VoidPaymentForm } from '@/components/VoidPaymentForm';
import { RenewButton } from '@/components/RenewButton';
import { deleteAttendanceAction } from '@/app/actions/attendance';
import { softDeleteClientAction, updateClientAction } from '@/app/actions/clients';
import { ArrowLeft, MessageCircle, Trash2, CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import { PaymentMethod } from '@/types';

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

  // Pagos históricos (TODOS para historial)
  const { data: payments, error: paymentsError } = await supabase
    .from('membership_payments')
    .select('*')
    .eq('client_id', id)
    .order('paid_at', { ascending: false });

  if (paymentsError) {
    console.error('[ClientDetailPage:payments]', paymentsError.message);
    throw new Error('No se pudieron cargar los pagos.');
  }

  // Pagos activos (solo no anulados) para cálculo de vencimiento
  const { data: activePayments, error: activePaymentsError } = await supabase
    .from('membership_payments')
    .select('paid_at, period_end')
    .eq('client_id', id)
    .is('voided_at', null)
    .order('paid_at', { ascending: false });

  if (activePaymentsError) {
    console.error('[ClientDetailPage:activePayments]', activePaymentsError.message);
    throw new Error('No se pudieron cargar los pagos activos.');
  }

  // Asistencias - buscar id también para poder eliminar
  const { data: attendances, error: attendancesError } = await supabase
    .from('attendance')
    .select('id, client_id, check_in, note, recorded_by')
    .eq('client_id', id)
    .order('check_in', { ascending: false })
    .limit(10);

  if (attendancesError) {
    console.error('[ClientDetailPage:attendance]', attendancesError.message);
    throw new Error('No se pudieron cargar las asistencias.');
  }

  // Calcular expiración solo con pagos no anulados
  const expiration = getMembershipExpiration(activePayments || []);
  const { status, next_expiration, days_left } = calculateMembershipStatus(expiration);
  const lastPay = activePayments?.[0]?.paid_at || null;

  const waUrl = buildWhatsAppUrl(
    client.phone,
    generateExpirationMessage(client.name, days_left, next_expiration)
  );

  const habitualMethod = client.payment_method as PaymentMethod;

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
              <RenewButton 
                clientId={id} 
                habitualMethod={habitualMethod}
                fee={FIXED_FEE_COP}
              />

              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 dark:hover:bg-emerald-500 transition-colors-200 shadow-sm dark:shadow-emerald-900/30"
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
            <h2 className="font-display text-lg font-semibold text-ink-900 border-b border-ink-200 pb-3">
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

            <div className="pt-4 border-t border-ink-200 flex justify-end">
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
                {payments?.map((p) => {
                  const isVoided = p.voided_at != null;
                  return (
                    <div
                      key={p.id}
                      className={`p-2.5 rounded-lg text-xs flex justify-between items-center transition-colors-200 ${
                        isVoided ? 'bg-rose-50' : 'bg-ink-50'
                      }`}
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-ink-800">
                          {isVoided ? (
                            <>
                              <span className="text-red-600 line-through">
                                {formatCOP(p.amount_cop)}
                              </span>{' '}
                              <span className="text-red-600">(Anulado)</span>
                            </>
                          ) : (
                            formatCOP(p.amount_cop)
                          )}
                        </p>
                        <p className="text-[11px] text-ink-500">{formatDate(p.paid_at)}</p>
                        {isVoided && (
                          <p className="text-[10px] text-red-600 mt-1">
                            <strong>Motivo:</strong> {p.void_reason}
                            <br />
                            <strong>Anulado por:</strong> {p.voided_by}
                          </p>
                        )}
                      </div>
                      {!isVoided && (
                        <VoidPaymentForm clientId={id} paymentId={p.id} />
                      )}
                    </div>
                  );
                })}

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
                {attendances?.map((a) => (
                  <div key={a.id} className="text-xs text-ink-700 flex justify-between items-center py-1 border-b border-ink-200 last:border-0">
                    <span>{formatDate(a.check_in)}</span>
                    <span className="text-ink-500 font-mono text-[11px]">
                      {formatTime(a.check_in)}
                    </span>
                    <details className="border border-ink-200 rounded px-2 py-1">
                      <summary className="cursor-pointer text-xs text-ink-600 hover:text-ink-900">
                        Eliminar
                      </summary>
                      <form action={deleteAttendanceAction.bind(null, id, a.id)}>
                        <Button variant="danger" size="sm" type="submit" className="mt-1">
                          Confirmar eliminación
                        </Button>
                      </form>
                    </details>
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
