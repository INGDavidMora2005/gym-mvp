import { redirect, notFound } from 'next/navigation';
import { getCurrentOwner } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { calculateMembershipStatus, formatDate, formatCOP, buildWhatsAppUrl, generateExpirationMessage } from '@/lib/utils';
import { Navigation } from '@/components/Navigation';
import { Card, Button, StatusBadge } from '@/components/UIComponents';
import { ArrowLeft, RefreshCw, MessageCircle, Phone, MapPin, Calendar, Trash2, CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const owner = await getCurrentOwner();
  if (!owner) redirect('/auth/login');

  const resolvedParams = await params;
  const id = resolvedParams.id;
  
  const supabase = createSupabaseAdminClient();

  // Cliente
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single();

  if (!client) notFound();

  // Pagos
  const { data: payments } = await supabase
    .from('membership_payments')
    .select('*')
    .eq('client_id', id)
    .order('paid_at', { ascending: false });

  // Asistencias
  const { data: attendances } = await supabase
    .from('attendance')
    .select('*')
    .eq('client_id', id)
    .order('check_in', { ascending: false });

  const lastPay = payments && payments.length > 0 ? payments[0].paid_at : null;
  const { status, next_expiration, days_left } = calculateMembershipStatus(lastPay);

  // Actions
  async function updateClientAction(formData: FormData) {
    'use server';
    const name = formData.get('name') as string;
    const age = formData.get('age') ? parseInt(formData.get('age') as string) : null;
    const address = formData.get('address') as string || null;
    const phone = formData.get('phone') as string;
    const paymentMethod = formData.get('payment_method') as any;

    const sb = createSupabaseAdminClient();
    await sb
      .from('clients')
      .update({ name, age, address, phone, payment_method: paymentMethod })
      .eq('id', id);

    revalidatePath(`/clients/${id}`);
    revalidatePath('/dashboard');
  }

  async function renewAction() {
    'use server';
    const sb = createSupabaseAdminClient();
    await sb.from('membership_payments').insert({
      client_id: id,
      amount_cop: 65000,
      paid_at: new Date().toISOString(),
      recorded_by: owner?.name || 'Dueño',
      note: 'Renovación de tarifa fija $65.000',
    });
    revalidatePath(`/clients/${id}`);
    revalidatePath('/dashboard');
  }

  async function softDeleteAction() {
    'use server';
    const sb = createSupabaseAdminClient();
    await sb.from('clients').update({ active: false }).eq('id', id);
    redirect('/dashboard');
  }

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
              <form action={renewAction} className="flex-1 sm:flex-initial">
                <Button variant="primary" type="submit" className="w-full">
                  <RefreshCw className="w-4 h-4" />
                  <span>Renovar $65.000</span>
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

            <form action={updateClientAction} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={client.name}
                  required
                  className="w-full px-3.5 py-2 rounded-xl border border-ink-200 text-sm focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1">Edad</label>
                  <input
                    type="number"
                    name="age"
                    defaultValue={client.age || ''}
                    className="w-full px-3.5 py-2 rounded-xl border border-ink-200 text-sm focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    name="phone"
                    defaultValue={client.phone}
                    required
                    className="w-full px-3.5 py-2 rounded-xl border border-ink-200 text-sm focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1">Dirección</label>
                <input
                  type="text"
                  name="address"
                  defaultValue={client.address || ''}
                  className="w-full px-3.5 py-2 rounded-xl border border-ink-200 text-sm focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1">Método de Pago Habitual</label>
                <select
                  name="payment_method"
                  defaultValue={client.payment_method}
                  className="w-full px-3.5 py-2 rounded-xl border border-ink-200 text-sm focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="NEQUI">Nequi</option>
                  <option value="DAVPLATA">Daviplata</option>
                  <option value="PSE">PSE / Transferencia</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button variant="primary" size="sm" type="submit">
                  Guardar Cambios
                </Button>
              </div>
            </form>

            <div className="pt-4 border-t border-ink-100 flex justify-end">
              <form action={softDeleteAction}>
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
              <div className="text-2xl font-bold text-brand-900">$65.000 COP</div>
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