import { ClientStatus } from '@/types';

export const FIXED_FEE_COP = 65000;
export const EXPIRATION_WARNING_DAYS = 5;

/**
 * Dada una fecha de último pago ISO string, calcula el estado y días restantes.
 * El periodo cubre 30 días a partir de la fecha de pago.
 */
export function calculateMembershipStatus(lastPaymentAt: string | null): {
  status: ClientStatus;
  next_expiration: string | null;
  days_left: number | null;
} {
  if (!lastPaymentAt) {
    return { status: 'VENCIDO', next_expiration: null, days_left: null };
  }

  const payDate = new Date(lastPaymentAt);
  if (isNaN(payDate.getTime())) {
    return { status: 'VENCIDO', next_expiration: null, days_left: null };
  }

  const expiration = new Date(payDate);
  expiration.setDate(expiration.getDate() + 30);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expDateOnly = new Date(expiration);
  expDateOnly.setHours(0, 0, 0, 0);

  const diffMs = expDateOnly.getTime() - today.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let status: ClientStatus = 'ACTIVO';
  if (daysLeft < 0) {
    status = 'VENCIDO';
  } else if (daysLeft <= EXPIRATION_WARNING_DAYS) {
    status = 'POR_VENCER';
  }

  return {
    status,
    next_expiration: expiration.toISOString(),
    days_left: daysLeft,
  };
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
 * Formatea fechas a formato legible en español.
 */
export function formatDate(isoString: string | null): string {
  if (!isoString) return 'Sin fecha';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return 'Fecha inválida';
  return d.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
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
export function generateInactivityMessage(clientName: string, daysAbsent: number): string {
  return `¡Hola ${clientName}! Te extrañamos en el gimnasio. Han pasado ${daysAbsent} días desde tu última visita. Recuerda que la constancia hace el resultado. ¡Te esperamos hoy! 💪🏻🔥`;
}