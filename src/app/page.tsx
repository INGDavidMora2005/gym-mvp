export const revalidate = 0;

export default async function HomePage() {
  const { cookies } = await import('next/headers');
  const cookieStore = cookies();
  const userSession = (cookieStore as any).get('gym_owner_id');

  if (!userSession) {
    const { redirect } = await import('next/navigation');
    redirect('/auth/login');
  }

  const { redirect } = await import('next/navigation');
  redirect('/dashboard');
}