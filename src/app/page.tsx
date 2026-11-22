import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/auth';

export const revalidate = 0;

export default async function HomePage() {
  await requireOwner();
  redirect('/dashboard');
}
