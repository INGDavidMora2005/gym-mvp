import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from './supabase/server';
import { createSupabaseAdminClient } from './supabase/admin';

// Helper para obtener el dueño actual
export async function getCurrentOwner() {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || !user.email) return null;

  // Buscar dueño por email
  const { data: owner, error: ownerErr } = await createSupabaseAdminClient()
    .from('owners')
    .select('*')
    .eq('email', user.email.toLowerCase())
    .maybeSingle();

  if (ownerErr || !owner) return null;
  return owner;
}

// Requerir dueño (redirige si no hay)
export async function requireOwner() {
  const owner = await getCurrentOwner();
  if (!owner) {
    redirect('/auth/login');
  }
  return owner;
}
