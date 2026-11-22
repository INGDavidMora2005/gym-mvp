import { requireOwner } from '@/lib/auth';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/UIComponents';
import { ClientForm } from '@/components/ClientForm';
import { createClientAction } from '@/app/actions/clients';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default async function NewClientPage() {
  const owner = await requireOwner();

  return (
    <div className="min-h-screen flex flex-col pb-12">
      <Navigation ownerName={owner.name} />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-ink-600 hover:text-ink-900 transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al Dashboard</span>
          </Link>
          <h1 className="font-display text-2xl font-bold text-ink-900">Registrar Nuevo Cliente</h1>
          <p className="text-sm text-ink-500">Ingresa la información básica y el método de pago inicial</p>
        </div>

        <Card>
          <ClientForm
            action={createClientAction}
            mode="create"
            submitLabel="Guardar Cliente"
          />
        </Card>
      </main>
    </div>
  );
}
