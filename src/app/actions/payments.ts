'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { FIXED_FEE_COP, formatCOP, getMembershipExpiration, computeNextPeriod } from '@/lib/utils';
import { uuidSchema } from '@/lib/validation';

export async function renewClientAction(clientId: string) {
  const owner = await requireOwner();

  if (!uuidSchema.safeParse(clientId).success) {
    throw new Error('No se pudo renovar la suscripción. Intenta de nuevo.');
  }

  const supabase = createSupabaseAdminClient();

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('active', true)
    .maybeSingle();

  if (clientError) {
    console.error('[renewClientAction:client]', clientError.message);
    throw new Error('No se pudo renovar la suscripción. Intenta de nuevo.');
  }

  if (!client) {
    throw new Error('No se pudo renovar la suscripción. Intenta de nuevo.');
  }

  // Guardia anti doble clic: si ya hay un pago en los últimos 30 segundos, no insertar otro.
  const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
  const { data: recentPays } = await supabase
    .from('membership_payments')
    .select('created_at')
    .eq('client_id', clientId)
    .gte('created_at', thirtySecondsAgo.toISOString());

  if (recentPays && recentPays.length > 0) {
    revalidatePath('/dashboard');
    revalidatePath('/expirations');
    revalidatePath(`/clients/${clientId}`);
    return;
  }

  const { data: payments, error: paymentsError } = await supabase
    .from('membership_payments')
    .select('paid_at, period_end')
    .eq('client_id', clientId)
    .order('paid_at', { ascending: false });

  if (paymentsError) {
    console.error('[renewClientAction:payments]', paymentsError.message);
    throw new Error('No se pudo renovar la suscripción. Intenta de nuevo.');
  }

  const expiration = getMembershipExpiration(payments || []);
  const now = new Date();
  const { period_start, period_end } = computeNextPeriod(expiration, now);

  const { error } = await supabase.from('membership_payments').insert({
    client_id: clientId,
    amount_cop: FIXED_FEE_COP,
    paid_at: now.toISOString(),
    period_start: period_start.toISOString(),
    period_end: period_end.toISOString(),
    recorded_by: owner.name,
    note: `Renovación de tarifa fija ${formatCOP(FIXED_FEE_COP)}`,
  });

  if (error) {
    console.error('[renewClientAction]', error.message);
    throw new Error('No se pudo renovar la suscripción. Intenta de nuevo.');
  }

  revalidatePath('/dashboard');
  revalidatePath('/expirations');
  revalidatePath(`/clients/${clientId}`);
}
