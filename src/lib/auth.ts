import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from './supabase/server';
import { createSupabaseAdminClient } from './supabase/admin';

// Devuelve el dueño autenticado o null si no hay sesión válida
// o si el usuario no está registrado en la tabla `owners`.
export async function getCurrentOwner() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) return null;

  const { data: owner, error: ownerError } = await createSupabaseAdminClient()
    .from('owners')
    .select('*')
    .eq('email', user.email.toLowerCase())
    .maybeSingle();

  if (ownerError || !owner) return null;

  return owner;
}

// Exige sesión de dueño; redirige al login si no la hay.
export async function requireOwner() {
  const owner = await getCurrentOwner();
  if (!owner) redirect('/auth/login');
  return owner;
}
