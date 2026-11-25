'use client';

import { useActionState } from 'react';
import { voidPaymentAction } from '@/app/actions/payments';
import { SubmitButton } from '@/components/SubmitButton';

export function VoidPaymentForm({
  clientId,
  paymentId,
}: {
  clientId: string;
  paymentId: string;
}) {
  const [state, formAction] = useActionState(
    voidPaymentAction.bind(null, clientId, paymentId),
    null as { ok?: boolean; error?: string; fieldErrors?: Record<string, string[]> } | null
  );

  return (
    <details className="border border-ink-200 rounded-lg p-3">
      <summary className="cursor-pointer text-xs font-semibold text-ink-600 hover:text-ink-900 mb-2">
        Anular
      </summary>
      <form action={formAction} className="space-y-3">
        <div>
          <label htmlFor={`reason-${paymentId}`} className="block text-xs font-medium text-ink-700 mb-1">
            Motivo de la anulación
          </label>
          <textarea
            id={`reason-${paymentId}`}
            name="reason"
            placeholder="Motivo de la anulación"
            minLength={3}
            maxLength={200}
            required
            className={`w-full px-3 py-2 text-sm border rounded-lg transition-all ${
              state?.fieldErrors?.reason
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-ink-200 focus:ring-brand-500 focus:border-brand-500'
            }`}
            rows={2}
          />
          {state?.fieldErrors?.reason && (
            <p className="text-xs text-red-600 mt-1">{state.fieldErrors.reason[0]}</p>
          )}
          {state?.error && (
            <p className="text-xs text-red-600 mt-1">{state.error}</p>
          )}
        </div>
        <SubmitButton>Confirmar Anulación</SubmitButton>
      </form>
    </details>
  );
}