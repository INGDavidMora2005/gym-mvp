import { z } from 'zod';
import { normalizePhone } from './utils';

export const PAYMENT_METHODS = ['EFECTIVO', 'NEQUI', 'DAVPLATA', 'PSE', 'OTRO'] as const;

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

const nameSchema = z
  .string({ error: 'El nombre es obligatorio' })
  .trim()
  .min(2, { error: 'El nombre debe tener al menos 2 caracteres' })
  .max(100, { error: 'El nombre no puede superar los 100 caracteres' });

const phoneSchema = z
  .string({ error: 'El teléfono es obligatorio' })
  .transform((value) => normalizePhone(value))
  .refine((value) => /^3\d{9}$/.test(value), {
    error: 'Teléfono colombiano inválido (10 dígitos, empieza por 3)',
  });

const ageSchema = z.preprocess(
  (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') return null;
      return Number(trimmed);
    }
    return value;
  },
  z
    .number({ error: 'La edad debe ser un número entero' })
    .int({ error: 'La edad debe ser un número entero' })
    .min(10, { error: 'La edad debe estar entre 10 y 100' })
    .max(100, { error: 'La edad debe estar entre 10 y 100' })
    .nullable()
);

const addressSchema = z.preprocess(
  (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    }
    return value;
  },
  z
    .string({ error: 'La dirección debe ser texto' })
    .max(200, { error: 'La dirección no puede superar los 200 caracteres' })
    .nullable()
);

const paymentMethodSchema = z.enum(PAYMENT_METHODS, {
  error: 'Selecciona un método de pago válido',
});

export const clientSchema = z.object({
  name: nameSchema,
  age: ageSchema,
  phone: phoneSchema,
  address: addressSchema,
  payment_method: paymentMethodSchema,
});

export const createClientSchema = clientSchema.extend({
  first_payment: z.preprocess(
    (value) => value === 'on' || value === true,
    z.boolean({ error: 'El valor del pago inicial es inválido' })
  ),
});

export const uuidSchema = z.uuid({ error: 'ID de cliente inválido' });

export type ClientInput = z.infer<typeof clientSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;

export type ActionState =
  | {
      ok?: boolean;
      error?: string;
      fieldErrors?: Record<string, string[]>;
    }
  | null;

/**
 * Convierte un FormData en un objeto listo para validar.
 * Los campos opcionales vacíos se envían como null; el resto se omite.
 */
export function parseFormData<T extends z.ZodType>(
  schema: T,
  formData: FormData
): { ok: true; data: z.infer<T> } | { ok: false; fieldErrors: Record<string, string[]> } {
  const raw: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string') continue;

    if (key === 'first_payment') {
      raw[key] = value === 'on';
      continue;
    }

    if (value.trim() === '') {
      if (key === 'age' || key === 'address') raw[key] = null;
      continue;
    }

    raw[key] = value;
  }

  const result = schema.safeParse(raw);
  if (result.success) {
    return { ok: true, data: result.data };
  }

  const flattened = z.flattenError(result.error).fieldErrors as Record<
    string,
    string[] | undefined
  >;
  const fieldErrors: Record<string, string[]> = {};

  for (const [key, messages] of Object.entries(flattened)) {
    if (messages && messages.length > 0) {
      fieldErrors[key] = messages;
    }
  }

  return { ok: false, fieldErrors };
}
