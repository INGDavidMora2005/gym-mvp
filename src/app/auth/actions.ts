'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentOwner } from '@/lib/auth';

export type LoginState = {
  error?: string;
} | null;

export async function loginAction(prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = (formData.get('email') as string | null)?.trim();
  const password = (formData.get('password') as string | null)?.trim();

  if (!email || !password) {
    return { error: 'Credenciales inválidas' };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { error: 'Credenciales inválidas' };
  }

  // Verificar si el usuario autenticado pertenece a la tabla owners
  const owner = await getCurrentOwner();
  if (!owner) {
    await supabase.auth.signOut();
    return { error: 'Credenciales inválidas' };
  }

  redirect('/dashboard');
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/auth/login');
}
