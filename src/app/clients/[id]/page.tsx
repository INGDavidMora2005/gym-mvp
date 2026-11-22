import { redirect, notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { calculateMembershipStatus, formatDate, formatCOP, buildWhatsAppUrl, generateExpirationMessage } from '@/lib/utils';
import { Navigation } from '@/components/Navigation';
import { Card, Button, StatusBadge } from '@/components/UIComponents';
import { ArrowLeft, RefreshCw, MessageCircle, Clock, CheckCircle, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner();
  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single();

  if (!client) notFound();

  const { data: payments } = await supabase
    .from('membership_payments')
    .select('*')
    .eq('client_id', id)
    .order('paid_at', { ascending: false });

  const { data: attendances } = await supabase
    .from('attendance')
    .select('*')
    .eq('client_id', id)
    .order('check_in', { ascending: false });

  const lastPay = payments && payments.length > 0 ? payments[0].paid_at : null;
  const { status, next_expiration, days_left } = calculateMembershipStatus(lastPay);

  async function updateClientAction(formData: FormData) {
    'use server';
    await requireOwner();
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
    const owner = await requireOwner();
    const sb = createSupabaseAdminClient();
    await sb.from('membership_payments').insert({
      client_id: id,
      amount_cop: 65000,
      paid_at: new Date().toISOString(),
      recorded_by: owner.name,
      note: 'Renovación de tarifa fija $65.000',
    });
    revalidatePath(`/clients/${id}`);
    revalidatePath('/dashboard');
  }

  async function softDeleteAction() {
    'use server';
    await requireOwner();
    const sb = createSupabaseAdminClient();
    await sb.from('clients').update({ active: false }).eq('id', id);
    redirect('/dashboard');
  }

  const waUrl = buildWhatsAppUrl(client.phone, generateExpirationMessage(client.name, days_left, next_expiration));

  return (
    <div className="min-h-screen flex flex-col pb-12">
      <Navigation ownerName={owner.name} />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-6">
        <div>
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-ink-600 hover:text-ink-900 transition-colors mb-2">
            <ArrowLeft className="w-4 h-4" /> <span>Volver al Dashboard</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl font-bold text-ink-900">{client.name}</h1>
            <StatusBadge status={status} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 space-y-4">
            <form action={updateClientAction} className="space-y-4">
              <input type="text" name="name" defaultValue={client.name} required className="w-full px-3 py-2 rounded-xl border border-ink-200" />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" name="age" defaultValue={client.age || ''} className="w-full px-3 py-2 rounded-xl border border-ink-200" />
                <input type="tel" name="phone" defaultValue={client.phone} required className="w-full px-3 py-2 rounded-xl border border-ink-200" />
              </div>
              <Button variant="primary" size="sm" type="submit">Guardar Cambios</Button>
            </form>
            <form action={softDeleteAction} className="pt-4 border-t border-ink-100">
              <Button variant="danger" size="sm" type="submit"><Trash2 className="w-3.5 h-3.5" /> <span>Eliminar Cliente</span></Button>
            </form>
          </Card>
          <div className="space-y-4">
            <Card className="bg-brand-50/50">
              <p>Vence el: <strong>{formatDate(next_expiration)}</strong></p>
              <form action={renewAction} className="mt-4"><Button variant="primary" type="submit" className="w-full">Renovar $65.000</Button></form>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}