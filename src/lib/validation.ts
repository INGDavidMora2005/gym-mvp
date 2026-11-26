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

export const paymentMethodSchema = z.enum(PAYMENT_METHODS, {
  error: 'Selecciona un método de pago válido',
});

export const cashDateSchema = z
  .string({ error: 'La fecha es obligatoria' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Formato de fecha inválido (YYYY-MM-DD)' })
  .refine((dateStr) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (!match) return false;
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    // Validar que la fecha sea real (no 2026-02-30, etc.)
    const date = new Date(Date.UTC(year, month, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
      return false;
    }
    // Validar que no sea futura según Bogotá
    const now = new Date();
    const bogotaOffsetMs = -5 * 60 * 60 * 1000; // UTC-5
    const bogotaNow = new Date(now.getTime() + bogotaOffsetMs);
    // bogotaToday en UTC (00:00 Bogotá de hoy = 05:00 UTC de hoy)
    const bogotaToday = new Date(Date.UTC(bogotaNow.getUTCFullYear(), bogotaNow.getUTCMonth(), bogotaNow.getUTCDate()));
    // inputDate en UTC (00:00 Bogotá del día input = 05:00 UTC de ese día)
    const inputDate = new Date(Date.UTC(year, month, day));
    return inputDate <= bogotaToday;
  }, { error: 'La fecha no puede ser futura o es inválida' });

export const countedCashSchema = z
  .string({ error: 'El efectivo contado es obligatorio' })
  .refine((value) => {
    const trimmed = value.trim();
    // Rechazar decimales: punto o coma seguido de 1-2 dígitos al final
    // (ej: "150.00", "150,50", "150.5", "150,5")
    if (/[.,]\d{1,2}$/.test(trimmed)) return false;
    // Quitar separadores de miles (puntos, comas, espacios)
    const cleaned = trimmed.replace(/[.,\s]/g, '');
    // Debe ser solo dígitos
    return /^\d+$/.test(cleaned);
  }, { error: 'Solo se permiten dígitos enteros (sin decimales, letras ni signos)' })
  .refine((value) => {
    const trimmed = value.trim();
    const cleaned = trimmed.replace(/[.,\s]/g, '');
    return cleaned.length <= 9;
  }, { error: 'Máximo 9 dígitos' })
  .transform((value) => {
    const trimmed = value.trim();
    const cleaned = trimmed.replace(/[.,\s]/g, '');
    return parseInt(cleaned, 10);
  });

export const noteSchema = z
  .string()
  .trim()
  .max(200, { error: 'La nota no puede superar los 200 caracteres' })
  .optional()
  .nullable();

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

export const voidReasonSchema = z
  .string({ error: 'El motivo es obligatorio' })
  .trim()
  .min(3, { error: 'El motivo debe tener al menos 3 caracteres' })
  .max(200, { error: 'El motivo no puede superar los 200 caracteres' });

export const voidPaymentFormSchema = z.object({
  reason: voidReasonSchema,
});

/**
 * Esquema para validar rango de exportación.
 * - from y to: YYYY-MM-DD válidos en Bogotá
 * - to >= from
 * - Rango máximo 366 días
 * - Ninguna fecha futura (según Bogotá)
 */
export const exportRangeSchema = z
  .object({
    from: z
      .string({ error: 'La fecha desde es obligatoria' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Formato de fecha inválido (YYYY-MM-DD)' })
      .refine((dateStr) => {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
        if (!match) return false;
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        const day = parseInt(match[3], 10);
        const date = new Date(Date.UTC(year, month, day));
        if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
          return false;
        }
        // No futura según Bogotá
        const now = new Date();
        const bogotaOffsetMs = -5 * 60 * 60 * 1000;
        const bogotaNow = new Date(now.getTime() + bogotaOffsetMs);
        const bogotaToday = new Date(Date.UTC(bogotaNow.getUTCFullYear(), bogotaNow.getUTCMonth(), bogotaNow.getUTCDate()));
        const inputDate = new Date(Date.UTC(year, month, day));
        return inputDate <= bogotaToday;
      }, { error: 'La fecha desde no puede ser futura o es inválida' }),
    to: z
      .string({ error: 'La fecha hasta es obligatoria' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Formato de fecha inválido (YYYY-MM-DD)' })
      .refine((dateStr) => {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
        if (!match) return false;
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        const day = parseInt(match[3], 10);
        const date = new Date(Date.UTC(year, month, day));
        if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
          return false;
        }
        const now = new Date();
        const bogotaOffsetMs = -5 * 60 * 60 * 1000;
        const bogotaNow = new Date(now.getTime() + bogotaOffsetMs);
        const bogotaToday = new Date(Date.UTC(bogotaNow.getUTCFullYear(), bogotaNow.getUTCMonth(), bogotaNow.getUTCDate()));
        const inputDate = new Date(Date.UTC(year, month, day));
        return inputDate <= bogotaToday;
      }, { error: 'La fecha hasta no puede ser futura o es inválida' }),
  })
  .refine((data) => {
    const fromDate = new Date(data.from + 'T00:00:00Z');
    const toDate = new Date(data.to + 'T00:00:00Z');
    return toDate >= fromDate;
  }, { error: 'La fecha hasta debe ser igual o posterior a la fecha desde' })
  .refine((data) => {
    const fromDate = new Date(data.from + 'T00:00:00Z');
    const toDate = new Date(data.to + 'T00:00:00Z');
    const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
    return diffDays <= 366;
  }, { error: 'El rango máximo permitido es de 366 días' });

export type ExportRangeInput = z.infer<typeof exportRangeSchema>;

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
