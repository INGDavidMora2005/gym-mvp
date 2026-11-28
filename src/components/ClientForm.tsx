'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { Button } from './UIComponents';
import { SubmitButton } from './SubmitButton';
import { FIXED_FEE_COP, formatCOP } from '@/lib/utils';
import type { ActionState } from '@/lib/validation';
import type { PaymentMethod } from '@/types';

type ClientFormDefaults = {
  name?: string;
  age?: number | null;
  phone?: string;
  address?: string | null;
  payment_method?: PaymentMethod;
};

export function ClientForm({
  action,
  mode,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  mode: 'create' | 'edit';
  defaultValues?: ClientFormDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, null);

  const [name, setName] = useState(defaultValues?.name ?? '');
  const [age, setAge] = useState(
    defaultValues?.age !== null && defaultValues?.age !== undefined
      ? String(defaultValues.age)
      : ''
  );
  const [phone, setPhone] = useState(defaultValues?.phone ?? '');
  const [address, setAddress] = useState(defaultValues?.address ?? '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    defaultValues?.payment_method ?? 'EFECTIVO'
  );
  const [firstPayment, setFirstPayment] = useState(true);

  const isCreate = mode === 'create';

  const labelClass = isCreate
    ? 'block text-sm font-medium text-ink-800 mb-1'
    : 'block text-xs font-medium text-ink-700 mb-1';

  const inputClass = isCreate
    ? 'w-full px-4 py-2.5 rounded-xl border border-ink-200 bg-surface text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none'
    : 'w-full px-3.5 py-2 rounded-xl border border-ink-200 bg-surface text-sm focus:ring-2 focus:ring-brand-500';

  function fieldError(field: string) {
    const messages = state?.fieldErrors?.[field];
    if (!messages || messages.length === 0) return null;

    return <p className="text-xs text-rose-600 mt-1">{messages[0]}</p>;
  }

  return (
    <form action={formAction} className={isCreate ? 'space-y-5' : 'space-y-4'}>
      {state?.error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
          {state.error}
        </div>
      )}

      {!isCreate && state?.ok && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
          Cambios guardados
        </div>
      )}

      <div>
        <label htmlFor="client-name" className={labelClass}>
          Nombre Completo{isCreate ? ' *' : ''}
        </label>
        <input
          id="client-name"
          type="text"
          name="name"
          required
          maxLength={100}
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={isCreate ? 'Ej. María Fernanda Gómez' : undefined}
          className={inputClass}
        />
        {fieldError('name')}
      </div>

      <div className={isCreate ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'grid grid-cols-2 gap-3'}>
        <div>
          <label htmlFor="client-age" className={labelClass}>
            Edad
          </label>
          <input
            id="client-age"
            type="number"
            name="age"
            min={10}
            max={100}
            inputMode="numeric"
            value={age}
            onChange={(event) => setAge(event.target.value)}
            placeholder={isCreate ? 'Ej. 28' : undefined}
            className={inputClass}
          />
          {fieldError('age')}
        </div>

        <div>
          <label htmlFor="client-phone" className={labelClass}>
            {isCreate ? 'Número Telefónico (WhatsApp) *' : 'Teléfono'}
          </label>
          <input
            id="client-phone"
            type="tel"
            name="phone"
            required
            maxLength={20}
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder={isCreate ? 'Ej. 3001234567' : undefined}
            className={inputClass}
          />
          {fieldError('phone')}
        </div>
      </div>

      <div>
        <label htmlFor="client-address" className={labelClass}>
          {isCreate ? 'Dirección de Residencia' : 'Dirección'}
        </label>
        <input
          id="client-address"
          type="text"
          name="address"
          maxLength={200}
          autoComplete="street-address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder={isCreate ? 'Ej. Calle 45 # 12-34 Barrio Centro' : undefined}
          className={inputClass}
        />
        {fieldError('address')}
      </div>

      <div>
        <label htmlFor="client-payment-method" className={labelClass}>
          Método de Pago Habitual{isCreate ? ' *' : ''}
        </label>
        <select
          id="client-payment-method"
          name="payment_method"
          required
          value={paymentMethod}
          onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
          className={inputClass}
        >
          <option value="EFECTIVO">Efectivo</option>
          <option value="NEQUI">Nequi</option>
          <option value="DAVPLATA">Daviplata</option>
          <option value="PSE">PSE / Transferencia</option>
          <option value="OTRO">Otro</option>
        </select>
        {fieldError('payment_method')}
      </div>

      {isCreate && (
        <div className="p-4 rounded-xl bg-brand-50 border border-brand-200 flex items-start gap-3">
          <input
            type="checkbox"
            name="first_payment"
            id="first_payment"
            checked={firstPayment}
            onChange={(event) => setFirstPayment(event.target.checked)}
            className="mt-1 w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-ink-300"
          />
          <label htmlFor="first_payment" className="text-xs text-brand-900 leading-relaxed cursor-pointer">
            <strong>
              Registrar pago de mensualidad inicial de {formatCOP(FIXED_FEE_COP)} COP hoy mismo.
            </strong>{' '}
            Se activará por 30 días a partir de este momento.
          </label>
        </div>
      )}

      {isCreate ? (
        <div className="flex gap-3 pt-2">
          <Link href="/dashboard" className="flex-1">
            <Button variant="secondary" className="w-full" type="button">
              Cancelar
            </Button>
          </Link>
          <SubmitButton size="md" className="flex-1">
            <UserPlus className="w-4 h-4" />
            <span>{submitLabel}</span>
          </SubmitButton>
        </div>
      ) : (
        <div className="flex items-center justify-between pt-2">
          <SubmitButton size="sm">{submitLabel}</SubmitButton>
        </div>
      )}
    </form>
  );
}
