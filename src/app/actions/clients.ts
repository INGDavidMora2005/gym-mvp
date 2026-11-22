'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { FIXED_FEE_COP } from '@/lib/utils';
import {
  type ActionState,
  clientSchema,
  createClientSchema,
  parseFormData,
  uuidSchema,
} from '@/lib/validation';

export async function createClientAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const owner = await requireOwner();

  const parsed = parseFormData(createClientSchema, formData);
  if (!parsed.ok) {
    return { ok: false, fieldErrors: parsed.fieldErrors };
  }

  const { first_payment, ...clientData } = parsed.data;
  const supabase = createSupabaseAdminClient();

  const { data: client, error } = await supabase
    .from('clients')
    .insert({
      ...clientData,
      consent_at: new Date().toISOString(),
      active: true,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[createClientAction]', error.message);

    if (error.code === '23505') {
      return {
        ok: false,
        fieldErrors: { phone: ['Ya existe un cliente con ese teléfono'] },
      };
    }

    return { ok: false, error: 'No se pudo guardar. Intenta de nuevo.' };
  }

  if (!client) {
    console.error('[createClientAction]', 'La inserción no devolvió el cliente creado');
    return { ok: false, error: 'No se pudo guardar. Intenta de nuevo.' };
  }

  if (first_payment) {
    const { error: paymentError } = await supabase
      .from('membership_payments')
      .insert({
        client_id: client.id,
        amount_cop: FIXED_FEE_COP,
        paid_at: new Date().toISOString(),
        recorded_by: owner.name,
        note: 'Pago inicial al registrar',
      });

    if (paymentError) {
      console.error('[createClientAction:initial-payment]', paymentError.message);
      return {
        ok: false,
        error: 'Cliente creado, pero falló el pago inicial',
      };
    }
  }

  revalidatePath('/dashboard');
  redirect('/dashboard');
}

export async function updateClientAction(
  clientId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireOwner();

  if (!uuidSchema.safeParse(clientId).success) {
    return { ok: false, error: 'ID de cliente inválido' };
  }

  const parsed = parseFormData(clientSchema, formData);
  if (!parsed.ok) {
    return { ok: false, fieldErrors: parsed.fieldErrors };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('clients')
    .update({
      name: parsed.data.name,
      age: parsed.data.age,
      phone: parsed.data.phone,
      address: parsed.data.address,
      payment_method: parsed.data.payment_method,
    })
    .eq('id', clientId);

  if (error) {
    console.error('[updateClientAction]', error.message);

    if (error.code === '23505') {
      return {
        ok: false,
        fieldErrors: { phone: ['Ya existe un cliente con ese teléfono'] },
      };
    }

    return { ok: false, error: 'No se pudo guardar. Intenta de nuevo.' };
  }

  revalidatePath(`/clients/${clientId}`);
  revalidatePath('/dashboard');

  return { ok: true };
}

export async function softDeleteClientAction(clientId: string) {
  await requireOwner();

  if (!uuidSchema.safeParse(clientId).success) {
    throw new Error('No se pudo eliminar el cliente. Intenta de nuevo.');
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('clients')
    .update({ active: false })
    .eq('id', clientId);

  if (error) {
    console.error('[softDeleteClientAction]', error.message);
    throw new Error('No se pudo eliminar el cliente. Intenta de nuevo.');
  }

  revalidatePath('/dashboard');
  redirect('/dashboard');
}
