'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { FIXED_FEE_COP, formatCOP } from '@/lib/utils';
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

  const { error } = await supabase.from('membership_payments').insert({
    client_id: clientId,
    amount_cop: FIXED_FEE_COP,
    paid_at: new Date().toISOString(),
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
