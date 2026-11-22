import { redirect } from 'next/navigation';
import { getCurrentOwner } from '@/lib/auth';
import { LoginForm } from './LoginForm';

export default async function LoginPage() {
  const owner = await getCurrentOwner();
  if (owner) redirect('/dashboard');

  return <LoginForm />;
}
