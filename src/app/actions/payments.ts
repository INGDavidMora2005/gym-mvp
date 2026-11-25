'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { FIXED_FEE_COP, formatCOP, getMembershipExpiration, computeNextPeriod } from '@/lib/utils';
import {
  type ActionState,
  uuidSchema,
  voidPaymentFormSchema,
  paymentMethodSchema,
} from '@/lib/validation';
import { logAudit } from '@/lib/audit';

export async function voidPaymentAction(
  clientId: string,
  paymentId: string,
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const owner = await requireOwner();

  // Validar UUIDs
  if (!uuidSchema.safeParse(clientId).success || !uuidSchema.safeParse(paymentId).success) {
    console.error('[voidPaymentAction] IDs inválidos');
    return { ok: false, error: 'Parámetros inválidos.' };
  }

  // Validar formulario
  const parsed = voidPaymentFormSchema.safeParse({
    reason: formData.get('reason'),
  });

  if (!parsed.success) {
    const firstMessage = parsed.error.issues[0]?.message;
    return {
      ok: false,
      fieldErrors: {
        reason: [firstMessage ?? 'Motivo de la anulación inválido'],
      },
    };
  }

  const supabase = createSupabaseAdminClient();

  // Anular el pago
  const { data: payment, error } = await supabase
    .from('membership_payments')
    .update({
      voided_at: new Date().toISOString(),
      voided_by: owner.name,
      void_reason: parsed.data.reason,
    })
    .eq('id', paymentId)
    .eq('client_id', clientId)
    .is('voided_at', null)
    .select('id, amount_cop, paid_at')
    .maybeSingle();

  if (error) {
    console.error('[voidPaymentAction]', error.message);
    return { ok: false, error: 'No se pudo anular el pago. Intenta de nuevo.' };
  }

  if (!payment) {
    return { ok: false, error: 'El pago no existe o ya fue anulado.' };
  }

  // Registrar auditoría
  await logAudit({
    owner,
    action: 'PAYMENT_VOIDED',
    entity: 'membership_payments',
    entityId: paymentId,
    details: {
      client_id: clientId,
      payment_id: paymentId,
      amount_cop: payment.amount_cop,
      paid_at: payment.paid_at,
      reason: parsed.data.reason,
    },
  });

  revalidatePath('/dashboard');
  revalidatePath('/expirations');
  revalidatePath('/reports');
  revalidatePath(`/clients/${clientId}`);

  return { ok: true };
}

export async function renewClientAction(clientId: string, paymentMethod: string) {
  const owner = await requireOwner();

  if (!uuidSchema.safeParse(clientId).success) {
    throw new Error('No se pudo renovar la suscripción. Intenta de nuevo.');
  }

  // Validar método de pago
  const methodResult = paymentMethodSchema.safeParse(paymentMethod);
  if (!methodResult.success) {
    throw new Error('No se pudo renovar la suscripción. Intenta de nuevo.');
  }

  const supabase = createSupabaseAdminClient();

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, payment_method')
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
  // Solo consideramos pagos no anulados
  const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
  const { data: recentPays } = await supabase
    .from('membership_payments')
    .select('created_at')
    .eq('client_id', clientId)
    .is('voided_at', null)
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
    .is('voided_at', null)
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
    payment_method: methodResult.data,
    note: `Renovación de tarifa fija ${formatCOP(FIXED_FEE_COP)}`,
  });

  if (error) {
    console.error('[renewClientAction]', error.message);
    throw new Error('No se pudo renovar la suscripción. Intenta de nuevo.');
  }

  revalidatePath('/dashboard');
  revalidatePath('/expirations');
  revalidatePath(`/clients/${clientId}`);
  revalidatePath('/caja');
}
