import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña requeridos' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
      },
    });

    // Buscar el dueño por email
    const { data: owner, error: ownerError } = await supabase
      .from('owners')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (ownerError || !owner) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    // Si tiene password_hash, verificar con bcrypt
    if (owner.password_hash && owner.password_hash.length > 0) {
      const bcrypt = await import('bcryptjs');
      const ok = await bcrypt.compare(password, owner.password_hash);
      if (!ok) {
        return NextResponse.json(
          { error: 'Credenciales inválidas' },
          { status: 401 }
        );
      }
    } else {
      // Si no tiene password_hash, verificar con Supabase Auth
      const authClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error: authError } = await authClient.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        return NextResponse.json(
          { error: 'Credenciales inválidas' },
          { status: 401 }
        );
      }
    }

    // Crear cookie de sessión
    const response = NextResponse.json({ success: true, owner: { id: owner.id, name: owner.name, email: owner.email } });
    
    response.cookies.set('gym_owner_id', owner.id, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 días
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}