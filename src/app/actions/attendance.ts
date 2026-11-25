'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { startOfBogotaDay, addDays } from '@/lib/dates';
import { uuidSchema } from '@/lib/validation';
import { logAudit } from '@/lib/audit';

export async function deleteAttendanceAction(
  clientId: string,
  attendanceId: string
): Promise<void> {
  const owner = await requireOwner();

  // Validar UUIDs
  if (!uuidSchema.safeParse(clientId).success || !uuidSchema.safeParse(attendanceId).success) {
    console.error('[deleteAttendanceAction] IDs inválidos');
    throw new Error('No se pudo eliminar la asistencia. Intenta de nuevo.');
  }

  const supabase = createSupabaseAdminClient();

  // Borrar la asistencia
  const { data: attendance, error } = await supabase
    .from('attendance')
    .delete()
    .eq('id', attendanceId)
    .eq('client_id', clientId)
    .select('id, check_in')
    .single();

  if (error) {
    console.error('[deleteAttendanceAction]', error.message);
    throw new Error('No se pudo eliminar la asistencia. Intenta de nuevo.');
  }

  if (!attendance) {
    throw new Error('No se pudo eliminar la asistencia. Intenta de nuevo.');
  }

  // Registrar auditoría
  await logAudit({
    owner,
    action: 'ATTENDANCE_DELETED',
    entity: 'attendance',
    entityId: attendanceId,
    details: {
      client_id: clientId,
      attendance_id: attendanceId,
      check_in: attendance.check_in,
    },
  });

  revalidatePath('/attendance');
  revalidatePath('/dashboard');
  revalidatePath(`/clients/${clientId}`);
}

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

  // Idempotencia por día de Bogotá: si ya hay una asistencia hoy, no insertar otra.
  const now = new Date();
  const dayStart = startOfBogotaDay(now);
  const dayEnd = addDays(dayStart, 1);

  const { data: existing } = await supabase
    .from('attendance')
    .select('id')
    .eq('client_id', clientId)
    .gte('check_in', dayStart.toISOString())
    .lt('check_in', dayEnd.toISOString())
    .maybeSingle();

  if (existing) {
    revalidatePath('/attendance');
    revalidatePath('/dashboard');
    return;
  }

  const { error } = await supabase.from('attendance').insert({
    client_id: clientId,
    check_in: now.toISOString(),
    recorded_by: owner.name,
  });

  if (error) {
    console.error('[recordAttendanceAction]', error.message);
    // El índice único attendance_client_day_idx hace que un doble clic simultáneo
    // falle con 23505: se trata como ya registrada hoy.
    if (error.code === '23505') {
      revalidatePath('/attendance');
      revalidatePath('/dashboard');
      return;
    }
    throw new Error('No se pudo registrar la asistencia. Intenta de nuevo.');
  }

  revalidatePath('/attendance');
  revalidatePath('/dashboard');
}
