'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type LoginState = {
  error?: string;
} | null;

export async function loginAction(
  prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = (formData.get('email') as string | null)?.trim().toLowerCase();
  const password = (formData.get('password') as string | null)?.trim();

  if (!email || !password) {
    return { error: 'Credenciales inválidas' };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user?.email) {
    return { error: 'Credenciales inválidas' };
  }

  // El usuario debe existir también en la tabla `owners`.
  const { data: owner, error: ownerError } = await createSupabaseAdminClient()
    .from('owners')
    .select('id')
    .eq('email', data.user.email.toLowerCase())
    .maybeSingle();

  if (ownerError) {
    // Sin detalle al usuario, pero con rastro en el servidor.
    console.error('Error consultando owners:', ownerError.message);
    return { error: 'Error del servidor. Intenta de nuevo.' };
  }

  if (!owner) {
    await supabase.auth.signOut();
    return { error: 'Acceso no autorizado' };
  }

  redirect('/dashboard');
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/auth/login');
}
