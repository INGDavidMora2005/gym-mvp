'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { uuidSchema } from '@/lib/validation';

export async function recordAttendanceAction(clientId: string) {
  const owner = await requireOwner();

  if (!uuidSchema.safeParse(clientId).success) {
    throw new Error('No se pudo registrar la asistencia. Intenta de nuevo.');
  }

  const supabase = createSupabaseAdminClient();

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('active', true)
    .maybeSingle();

  if (clientError) {
    console.error('[recordAttendanceAction:client]', clientError.message);
    throw new Error('No se pudo registrar la asistencia. Intenta de nuevo.');
  }

  if (!client) {
    throw new Error('No se pudo registrar la asistencia. Intenta de nuevo.');
  }

  const { error } = await supabase.from('attendance').insert({
    client_id: clientId,
    check_in: new Date().toISOString(),
    recorded_by: owner.name,
  });

  if (error) {
    console.error('[recordAttendanceAction]', error.message);
    throw new Error('No se pudo registrar la asistencia. Intenta de nuevo.');
  }

  revalidatePath('/attendance');
  revalidatePath('/dashboard');
}
