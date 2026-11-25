import { ClientStatus } from '@/types';
import { addDays, diffBogotaDays, TIMEZONE } from './dates';

export const FIXED_FEE_COP = 65000;
export const EXPIRATION_WARNING_DAYS = 5;

/**
 * Dada una fecha de último pago ISO string, calcula el estado y días restantes.
 * El periodo cubre 30 días a partir de la fecha de pago.
 */
export function calculateMembershipStatus(
  expiration: string | Date | null,
  now: Date = new Date(),
): {
  status: ClientStatus;
  next_expiration: string | null;
  days_left: number | null;
} {
  if (!expiration) {
    return { status: 'SIN_PAGO', next_expiration: null, days_left: null };
  }

  const expDate =
    typeof expiration === 'string' ? new Date(expiration) : expiration;
  if (isNaN(expDate.getTime())) {
    return { status: 'SIN_PAGO', next_expiration: null, days_left: null };
  }

  const daysLeft = diffBogotaDays(now, expDate);

  let status: ClientStatus = 'ACTIVO';
  if (daysLeft < 0) {
    status = 'VENCIDO';
  } else if (daysLeft <= EXPIRATION_WARNING_DAYS) {
    status = 'POR_VENCER';
  }

  return {
    status,
    next_expiration: expDate.toISOString(),
    days_left: daysLeft,
  };
}

/**
 * Debe coincidir con getMembershipExpiration() en sql/schema.sql: si cambia la regla, cámbiala en ambos sitios.
 * Devuelve el vencimiento de membresía más lejano entre los pagos:
 * el máximo de (period_end ?? paid_at + 30 días). Null si no hay pagos.
 */
export function getMembershipExpiration(
  payments: { paid_at: string; period_end: string | null }[],
): Date | null {
  if (!payments || payments.length === 0) return null;

  let max: Date | null = null;
  for (const p of payments) {
    const periodEnd = p.period_end ? new Date(p.period_end) : null;
    const paidAtPlus30 = addDays(new Date(p.paid_at), 30);
    const candidate = periodEnd || paidAtPlus30;
    if (!max || candidate.getTime() > max.getTime()) {
      max = candidate;
    }
  }
  return max;
}

/**
 * Calcula el próximo periodo de membresía.
 * - Si hay vencimiento futuro, empieza ahí (renovación anticipada extiende).
 * - Si no, empieza hoy (vencido o sin pagos).
 * period_end = period_start + 30 días.
 */
export function computeNextPeriod(
  currentExpiration: Date | null,
  now: Date = new Date(),
): { period_start: Date; period_end: Date } {
  const periodStart =
    currentExpiration && currentExpiration.getTime() > now.getTime()
      ? currentExpiration
      : now;
  return {
    period_start: periodStart,
    period_end: addDays(periodStart, 30),
  };
}

/**
 * Recordatorio amable para registrar la primera mensualidad (estado SIN_PAGO).
 */
export function generatePendingPaymentMessage(clientName: string): string {
  return `Hola ${clientName}, te damos la bienvenida al gimnasio. Para activar tu membresía, pasa por recepción y registra tu primera mensualidad de ${formatCOP(
    FIXED_FEE_COP,
  )}. ¡Te esperamos para entrenar! 💪`;
}

/**
 * Limpia y normaliza un teléfono colombiano a su forma canónica de 10 dígitos.
 * Acepta espacios, guiones, paréntesis y prefijo +57/57.
 * La validación de que empiece por 3 se hace en el esquema de Zod.
 */
export function normalizePhone(rawPhone: string): string {
  let clean = rawPhone.replace(/\D/g, '');
  if (clean.startsWith('57') && clean.length === 12) {
    clean = clean.slice(2);
  }
  return clean;
}

/**
 * Devuelve el número en formato internacional (57 + 10 dígitos) para wa.me.
 */
export function toWhatsAppPhone(rawPhone: string): string {
  const clean = normalizePhone(rawPhone);
  return clean.length === 10 && clean.startsWith('3') ? '57' + clean : clean;
}

/**
 * Construye el enlace de WhatsApp (wa.me) para enviar mensajes precargados.
 */
export function buildWhatsAppUrl(phone: string, text: string): string {
  const norm = toWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${norm}?text=${encodedText}`;
}

/**
 * Formatea un número como moneda colombiana (COP).
 */
export function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formatea una fecha ISO en zona horaria de Bogotá.
 */
export function formatDate(isoString: string | null): string {
  if (!isoString) return 'Sin fecha';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return 'Fecha inválida';
  return d.toLocaleDateString('es-CO', {
    timeZone: TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Formatea la hora de una fecha ISO en zona horaria de Bogotá.
 */
export function formatTime(isoString: string | null): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-CO', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Plantilla de mensaje de bienvenida.
 */
export function generateWelcomeMessage(clientName: string): string {
  return `¡Hola ${clientName}! 💪 Bienvenido a nuestro gimnasio. Estamos felices de acompañarte en tus metas. Recuerda que tu afiliación tiene un costo fijo de ${formatCOP(FIXED_FEE_COP)} por 30 días. ¡Nos vemos en el entrenamiento!`;
}

/**
 * Plantilla de recordatorio de vencimiento.
 */
export function generateExpirationMessage(
  clientName: string,
  daysLeft: number | null,
  expirationDate: string | null
): string {
  if (daysLeft !== null && daysLeft <= 0) {
    return `Hola ${clientName}, te informamos que tu mensualidad en el gimnasio ha VENCIDO. Te invitamos a renovar en recepción por ${formatCOP(FIXED_FEE_COP)} para mantener activo tu plan. ¡Te esperamos! 🏋️‍♀️`;
  }
  const dateStr = formatDate(expirationDate);
  return `Hola ${clientName}, tu mensualidad vencerá pronto (${dateStr}). Recuerda renovar en recepción por un valor de ${formatCOP(FIXED_FEE_COP)} para no perder la continuidad. ¡Que tengas un excelente día! 🏋️`;
}

/**
 * Plantilla para clientes activos que no han asistido en varios días.
 */
export function generateInactivityMessage(
  clientName: string,
  daysAbsent: number | null,
): string {
  if (daysAbsent === null) {
    return `¡Hola ${clientName}! Te extrañamos en el gimnasio. Aún no has registrado ninguna asistencia. Ven a entrenar y activa tu membresía. ¡Te esperamos! 💪🏻🔥`;
  }
  return `¡Hola ${clientName}! Te extrañamos en el gimnasio. Han pasado ${daysAbsent} días desde tu última visita. Recuerda que la constancia hace el resultado. ¡Te esperamos hoy! 💪🏻🔥`;
}