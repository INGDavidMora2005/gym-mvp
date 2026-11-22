import { requireOwner } from '@/lib/auth';
import { fetchClientsWithStatus } from '@/lib/db';
import { Navigation } from '@/components/Navigation';
import { Card, Button, StatusBadge } from '@/components/UIComponents';
import { AlertTriangle, MessageCircle } from 'lucide-react';
import { formatDate, buildWhatsAppUrl, generateExpirationMessage } from '@/lib/utils';
import Link from 'next/link';

export const revalidate = 0;

export default async function ExpirationsPage() {
  const owner = await requireOwner();

  const clients = await fetchClientsWithStatus();

  // Filtrar solo los por vencer y los ya vencidos, ordenados por los que están más próximos o más vencidos
  const urgentClients = clients
    .filter((c) => c.status === 'POR_VENCER' || c.status === 'VENCIDO')
    .sort((a, b) => (a.days_left ?? 999) - (b.days_left ?? 999));

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-8">
      <Navigation ownerName={owner.name} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-ink-200">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink-900 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              <span>Suscripciones por Vencer / Vencidas</span>
            </h1>
            <p className="text-sm text-ink-500 mt-1">
              Envía recordatorios inmediatos por WhatsApp para asegurar el pago
            </p>
          </div>
          <div className="bg-amber-50 text-amber-800 border border-amber-200 px-4 py-2 rounded-xl text-center">
            <span className="text-xs font-semibold block uppercase tracking-wider">Requieren Atención</span>
            <span className="text-2xl font-bold">{urgentClients.length} clientes</span>
          </div>
        </div>

        <div className="space-y-3">
          {urgentClients.map((c) => {
            const waUrl = buildWhatsAppUrl(
              c.phone,
              generateExpirationMessage(c.name, c.days_left, c.next_expiration)
            );

            return (
              <Card key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <Link href={`/clients/${c.id}`} className="font-bold text-ink-900 hover:text-brand-600 text-base">
                      {c.name}
                    </Link>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-600">
                    <span>Teléfono: <strong>{c.phone}</strong></span>
                    <span>Vencimiento: <strong>{formatDate(c.next_expiration)}</strong></span>
                  </div>
                  {c.days_left !== null && (
                    <p className="text-xs text-rose-600 font-medium">
                      {c.days_left < 0
                        ? `Vencido hace ${Math.abs(c.days_left)} días`
                        : c.days_left === 0
                        ? '¡Vence HOY!'
                        : `Vence en ${c.days_left} días`}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-all shadow-xs"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Enviar Recordatorio</span>
                  </a>

                  <Link href={`/clients/${c.id}`}>
                    <Button variant="secondary" size="sm">
                      Ver Ficha
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}

          {urgentClients.length === 0 && (
            <Card className="text-center py-12">
              <p className="text-ink-500 font-medium text-sm">
                🎉 ¡Excelente! No hay suscripciones vencidas ni por vencer en los próximos 5 días.
              </p>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}