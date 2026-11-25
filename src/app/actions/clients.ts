'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { FIXED_FEE_COP } from '@/lib/utils';
import { addDays } from '@/lib/dates';
import {
  type ActionState,
  clientSchema,
  createClientSchema,
  parseFormData,
  uuidSchema,
} from '@/lib/validation';
import { logAudit } from '@/lib/audit';

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
    const now = new Date();
    const period_end = addDays(now, 30);
    const { error: paymentError } = await supabase
      .from('membership_payments')
      .insert({
        client_id: client.id,
        amount_cop: FIXED_FEE_COP,
        paid_at: now.toISOString(),
        period_start: now.toISOString(),
        period_end: period_end.toISOString(),
        recorded_by: owner.name,
        payment_method: clientData.payment_method,
        note: 'Pago inicial al registrar',
      });

    if (paymentError) {
      console.error('[createClientAction:initial-payment]', paymentError.message);

      // Rollback manual: si no se puede registrar el pago, el cliente no debe quedar creado.
      const { error: rollbackError } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id);

      if (rollbackError) {
        console.error('[createClientAction:rollback]', rollbackError.message);
      }

      return {
        ok: false,
        error:
          'No se pudo registrar el pago inicial. El cliente no fue creado, intenta de nuevo.',
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
  const { data: updated, error } = await supabase
    .from('clients')
    .update({
      name: parsed.data.name,
      age: parsed.data.age,
      phone: parsed.data.phone,
      address: parsed.data.address,
      payment_method: parsed.data.payment_method,
    })
    .eq('id', clientId)
    .eq('active', true)
    .select('id');

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

  if (!updated || updated.length === 0) {
    return { ok: false, error: 'El cliente no existe o fue eliminado.' };
  }

  revalidatePath(`/clients/${clientId}`);
  revalidatePath('/dashboard');

  return { ok: true };
}

export async function softDeleteClientAction(clientId: string) {
  const owner = await requireOwner();

  if (!uuidSchema.safeParse(clientId).success) {
    console.error('[softDeleteClientAction] ID inválido');
    throw new Error('No se pudo eliminar el cliente. Intenta de nuevo.');
  }

  const supabase = createSupabaseAdminClient();
  const { data: deleted, error } = await supabase
    .from('clients')
    .update({ active: false })
    .eq('id', clientId)
    .eq('active', true)
    .select('id, name')
    .maybeSingle();

  if (error) {
    console.error('[softDeleteClientAction]', error.message);
    throw new Error('No se pudo eliminar el cliente. Intenta de nuevo.');
  }

  if (!deleted) {
    throw new Error('El cliente no existe o fue eliminado.');
  }

  // Registrar auditoría
  await logAudit({
    owner,
    action: 'CLIENT_DELETED',
    entity: 'clients',
    entityId: clientId,
    details: {
      name: deleted.name,
    },
  });

  revalidatePath('/dashboard');
  redirect('/dashboard');
}
