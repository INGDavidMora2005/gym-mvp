import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  
  // Borrar la cookie de sessión
  response.cookies.delete('gym_owner_id');
  
  // Redirigir al login de nuestra aplicación (localhost:3000)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return NextResponse.redirect(new URL('/auth/login', baseUrl));
}

export async function GET() {
  return POST();
}