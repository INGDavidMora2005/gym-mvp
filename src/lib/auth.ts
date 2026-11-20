import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

// Creador del cliente para server con service role
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
      },
    }
  );
}

// Helper para obtener el dueño actual usando la cookie de sessión
export async function getCurrentOwner() {
  const { cookies } = await import('next/headers');
  const cookieStore = cookies();

  // Cookie de nuestra aplicación (no Supabase)
  const ownerId = (cookieStore as any).get('gym_owner_id')?.value;
  
  if (!ownerId) return null;

  // Buscar el dueño por ID
  const { data: owner, error } = await createSupabaseAdminClient()
    .from('owners')
    .select('*')
    .eq('id', ownerId)
    .maybeSingle();

  if (error || !owner) return null;
  return owner;
}

// Verificar credenciales y devolver el dueño si son válidas
export async function verifyCredentials(email: string, password: string) {
  const supabase = createSupabaseAdminClient();
  
  // Buscar el dueño por email
  const { data: owner, error } = await supabase
    .from('owners')
    .select('*')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (error || !owner) return null;

  // Si tiene password_hash, verificar con bcrypt
  if (owner.password_hash && owner.password_hash.length > 0) {
    const ok = await bcrypt.compare(password, owner.password_hash);
    return ok ? owner : null;
  }

  // Si no tiene password_hash, verificar con Supabase Auth
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { error: authError } = await authClient.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) return null;
  return owner;
}