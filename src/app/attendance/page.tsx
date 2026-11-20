import { redirect } from 'next/navigation';
import { getCurrentOwner } from '@/lib/auth';
import { fetchClientsWithStatus } from '@/lib/db';
import { Navigation } from '@/components/Navigation';
import { Card, Button } from '@/components/UIComponents';
import { CalendarCheck, Search, CheckCircle } from 'lucide-react';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export const revalidate = 0;

export default async function AttendancePage() {
  const owner = await getCurrentOwner();
  if (!owner) redirect('/auth/login');

  const clients = await fetchClientsWithStatus();

  // Obtener asistencias registradas HOY
  const supabase = createSupabaseAdminClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: todayAttendances } = await supabase
    .from('attendance')
    .select('client_id, check_in')
    .gte('check_in', todayStart.toISOString())
    .order('check_in', { ascending: false });

  const attendedMap = new Set((todayAttendances || []).map((a) => a.client_id));

  // Action para marcar ingreso de cliente
  async function recordAttendanceAction(formData: FormData) {
    'use server';
    const clientId = formData.get('client_id') as string;
    const sb = createSupabaseAdminClient();
    await sb.from('attendance').insert({
      client_id: clientId,
      check_in: new Date().toISOString(),
      recorded_by: owner?.name || 'Dueño',
    });
    revalidatePath('/attendance');
    revalidatePath('/dashboard');
  }

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-8">
      <Navigation ownerName={owner.name} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-ink-200">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink-900 flex items-center gap-2">
              <CalendarCheck className="w-6 h-6 text-brand-600" />
              <span>Control de Asistencia Diaria</span>
            </h1>
            <p className="text-sm text-ink-500 mt-1">
              Marca el ingreso de los clientes al gimnasio el día de hoy
            </p>
          </div>
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2 rounded-xl text-center">
            <span className="text-xs font-semibold block uppercase tracking-wider">Asistencias Hoy</span>
            <span className="text-2xl font-bold">{attendedMap.size} personas</span>
          </div>
        </div>

        {/* Lista de Marcado Rápido */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clients.map((c) => {
            const hasAttendedToday = attendedMap.has(c.id);

            return (
              <Card
                key={c.id}
                className={`flex items-center justify-between p-4 ${
                  hasAttendedToday ? 'bg-emerald-50/40 border-emerald-200' : ''
                }`}
              >
                <div>
                  <h3 className="font-semibold text-ink-900 text-sm">{c.name}</h3>
                  <p className="text-xs text-ink-500">{c.phone}</p>
                  <p className="text-[11px] text-ink-400 mt-1">
                    Última entrada: {c.last_attendance ? new Date(c.last_attendance).toLocaleDateString('es-CO') : 'Nunca'}
                  </p>
                </div>

                {hasAttendedToday ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-semibold">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Ya entró hoy</span>
                  </span>
                ) : (
                  <form action={recordAttendanceAction}>
                    <input type="hidden" name="client_id" value={c.id} />
                    <Button variant="primary" size="sm" type="submit">
                      Marcar Ingreso
                    </Button>
                  </form>
                )}
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}