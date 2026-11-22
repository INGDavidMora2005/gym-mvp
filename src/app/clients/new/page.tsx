import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { Navigation } from '@/components/Navigation';
import { Card, Button } from '@/components/UIComponents';
import { UserPlus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default async function NewClientPage() {
  const owner = await requireOwner();

  async function createClientAction(formData: FormData) {
    'use server';
    const owner = await requireOwner();
    const name = formData.get('name') as string;
    const age = formData.get('age') ? parseInt(formData.get('age') as string) : null;
    const address = formData.get('address') as string || null;
    const phone = formData.get('phone') as string;
    const paymentMethod = formData.get('payment_method') as any;
    const firstPayment = formData.get('first_payment') === 'on';

    const supabase = createSupabaseAdminClient();

    // Insertar cliente
    const { data: client, error } = await supabase
      .from('clients')
      .insert({
        name,
        age,
        address,
        phone,
        payment_method: paymentMethod,
        consent_at: new Date().toISOString(),
        active: true,
      })
      .select()
      .single();

    if (error || !client) {
      throw new Error('Error al guardar el cliente');
    }

    // Si se marcó pago inicial de $65.000
    if (firstPayment) {
      await supabase.from('membership_payments').insert({
        client_id: client.id,
        amount_cop: 65000,
        paid_at: new Date().toISOString(),
        recorded_by: owner.name,
        note: 'Pago inicial al registrar',
      });
    }

    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen flex flex-col pb-12">
      <Navigation ownerName={owner.name} />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-ink-600 hover:text-ink-900 transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al Dashboard</span>
          </Link>
          <h1 className="font-display text-2xl font-bold text-ink-900">Registrar Nuevo Cliente</h1>
          <p className="text-sm text-ink-500">Ingresa la información básica y el método de pago inicial</p>
        </div>

        <Card>
          <form action={createClientAction} className="space-y-5">
            {/* Nombre Completo */}
            <div>
              <label className="block text-sm font-medium text-ink-800 mb-1">
                Nombre Completo *
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="Ej. María Fernanda Gómez"
                className="w-full px-4 py-2.5 rounded-xl border border-ink-200 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            {/* Edad y Teléfono */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-800 mb-1">
                  Edad
                </label>
                <input
                  type="number"
                  name="age"
                  min="10"
                  max="100"
                  placeholder="Ej. 28"
                  className="w-full px-4 py-2.5 rounded-xl border border-ink-200 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-800 mb-1">
                  Número Telefónico (WhatsApp) *
                </label>
                <input
                  type="tel"
                  name="phone"
                  required
                  placeholder="Ej. 3001234567"
                  className="w-full px-4 py-2.5 rounded-xl border border-ink-200 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Dirección */}
            <div>
              <label className="block text-sm font-medium text-ink-800 mb-1">
                Dirección de Residencia
              </label>
              <input
                type="text"
                name="address"
                placeholder="Ej. Calle 45 # 12-34 Barrio Centro"
                className="w-full px-4 py-2.5 rounded-xl border border-ink-200 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            {/* Método de Pago */}
            <div>
              <label className="block text-sm font-medium text-ink-800 mb-1">
                Método de Pago Habitual *
              </label>
              <select
                name="payment_method"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-ink-200 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white"
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="NEQUI">Nequi</option>
                <option value="DAVPLATA">Daviplata</option>
                <option value="PSE">PSE / Transferencia</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>

            {/* Checkbox Pago Inicial */}
            <div className="p-4 rounded-xl bg-brand-50 border border-brand-200 flex items-start gap-3">
              <input
                type="checkbox"
                name="first_payment"
                id="first_payment"
                defaultChecked
                className="mt-1 w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-ink-300"
              />
              <label htmlFor="first_payment" className="text-xs text-brand-900 leading-relaxed cursor-pointer">
                <strong>Registrar pago de mensualidad inicial de $65.000 COP hoy mismo.</strong> Se activará por 30 días a partir de este momento.
              </label>
            </div>

            {/* Botones */}
            <div className="flex gap-3 pt-2">
              <Link href="/dashboard" className="flex-1">
                <Button variant="secondary" className="w-full" type="button">
                  Cancelar
                </Button>
              </Link>
              <Button variant="primary" className="flex-1" type="submit">
                <UserPlus className="w-4 h-4" />
                <span>Guardar Cliente</span>
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}
