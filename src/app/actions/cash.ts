'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { parseBogotaDateKey, startOfBogotaDay, addDays } from '@/lib/dates';
import {
  cashDateSchema,
  countedCashSchema,
  noteSchema,
} from '@/lib/validation';
import { logAudit } from '@/lib/audit';
import { Owner } from '@/types';

interface CloseCashFormState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  expected_cash_cop?: number;
  counted_cash_cop?: number;
  difference_cop?: number;
  business_date?: string;
}

export async function closeCashAction(
  _prevState: CloseCashFormState,
  formData: FormData
): Promise<CloseCashFormState> {
  const owner = await requireOwner();

  // Validar fecha
  const dateRaw = formData.get('business_date');
  const dateResult = cashDateSchema.safeParse(dateRaw);
  if (!dateResult.success) {
    return {
      ok: false,
      fieldErrors: {
        business_date: [dateResult.error.issues[0]?.message ?? 'Fecha inválida'],
      },
    };
  }

  // Validar efectivo contado
  const countedRaw = formData.get('counted_cash_cop');
  const countedResult = countedCashSchema.safeParse(countedRaw);
  if (!countedResult.success) {
    return {
      ok: false,
      fieldErrors: {
        counted_cash_cop: [countedResult.error.issues[0]?.message ?? 'Efectivo contado inválido'],
      },
    };
  }

  // Validar nota (opcional)
  const noteRaw = formData.get('note');
  const noteResult = noteSchema.safeParse(noteRaw);
  if (!noteResult.success) {
    return {
      ok: false,
      fieldErrors: {
        note: [noteResult.error.issues[0]?.message ?? 'Nota inválida'],
      },
    };
  }

  const businessDateStr = dateResult.data;
  const countedCashCop = countedResult.data;
  const note = noteResult.data;

  // Calcular expected en el servidor: suma de pagos en EFECTIVO no anulados del día de Bogotá
  const supabase = createSupabaseAdminClient();

  const dayStart = parseBogotaDateKey(businessDateStr); // 00:00 Bogotá en UTC
  const dayEnd = addDays(dayStart, 1); // 00:00 del día siguiente en UTC

  const { data: cashPayments, error: paymentsError } = await supabase
    .from('membership_payments')
    .select('amount_cop')
    .eq('payment_method', 'EFECTIVO')
    .is('voided_at', null)
    .gte('paid_at', dayStart.toISOString())
    .lt('paid_at', dayEnd.toISOString());

  if (paymentsError) {
    console.error('[closeCashAction:payments]', paymentsError.message);
    return { ok: false, error: 'No se pudo calcular el efectivo esperado. Intenta de nuevo.' };
  }

  const expectedCashCop = (cashPayments || []).reduce((sum, p) => sum + p.amount_cop, 0);
  const differenceCop = countedCashCop - expectedCashCop;

  // Insertar cierre de caja
  const { error: insertError } = await supabase.from('cash_closings').insert({
    business_date: businessDateStr,
    expected_cash_cop: expectedCashCop,
    counted_cash_cop: countedCashCop,
    difference_cop: differenceCop,
    note: note ?? null,
    closed_by: owner.name,
    closed_by_id: owner.id,
  });

  if (insertError) {
    console.error('[closeCashAction:insert]', insertError.message);
    return { ok: false, error: 'No se pudo registrar el cierre. Intenta de nuevo.' };
  }

  // Registrar auditoría
  await logAudit({
    owner,
    action: 'CASH_CLOSED',
    entity: 'cash_closings',
    entityId: null, // No tenemos el ID del insert, pero los detalles están abajo
    details: {
      business_date: businessDateStr,
      expected_cash_cop: expectedCashCop,
      counted_cash_cop: countedCashCop,
      difference_cop: differenceCop,
      note: note ?? null,
    },
  });

  revalidatePath('/caja');

  return {
    ok: true,
    expected_cash_cop: expectedCashCop,
    counted_cash_cop: countedCashCop,
    difference_cop: differenceCop,
    business_date: businessDateStr,
  };
}