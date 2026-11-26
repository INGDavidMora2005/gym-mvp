export const TIMEZONE = 'America/Bogota';

// Colombia no tiene horario de verano: offset fijo UTC-5.
// Toda la aritmética se hace sobre ms "locales" de Bogotá (como si
// Bogotá fuera el meridiano cero) para no depender de la zona horaria
// del proceso (TZ) ni de Intl con timeZone del entorno.
const BOGOTA_OFFSET_HOURS = -5;
const BOGOTA_OFFSET_MS = BOGOTA_OFFSET_HOURS * 60 * 60 * 1000; // -18_000_000

/** Convierte ms UTC a ms "local" de Bogotá. */
function toBogotaLocalMs(date: Date): number {
  return date.getTime() + BOGOTA_OFFSET_MS;
}

/** Convierte ms "local" de Bogotá de vuelta a ms UTC. */
function fromBogotaLocalMs(localMs: number): number {
  return localMs - BOGOTA_OFFSET_MS;
}

/** 'YYYY-MM-DD' en calendario de Bogotá. */
export function toBogotaDayKey(date: Date): string {
  const d = new Date(toBogotaLocalMs(date));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface BogotaDateTimeParts {
  year: number;
  /** Mes 1-12. */
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/**
 * Componentes de fecha/hora de Bogotá (hora de pared) de un instante UTC.
 * Útil para construir fechas "sin zona horaria" en Excel: Excel no entiende
 * de zonas horarias, así que se escribe la hora local tal como se ve en Bogotá.
 */
export function bogotaDateTimeParts(date: Date): BogotaDateTimeParts {
  const d = new Date(toBogotaLocalMs(date));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

/** 'HH:mm' en calendario de Bogotá. */
export function toBogotaTimeKey(date: Date): string {
  const { hour, minute } = bogotaDateTimeParts(date);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Instante UTC de las 00:00:00.000 del día de Bogotá de `date`. */
export function startOfBogotaDay(date: Date): Date {
  const d = new Date(toBogotaLocalMs(date));
  d.setUTCHours(0, 0, 0, 0);
  return new Date(fromBogotaLocalMs(d.getTime()));
}

/** Instante UTC de las 00:00:00.000 del primer día del mes de Bogotá,
 * opcionalmente desplazado `monthOffset` meses. */
export function startOfBogotaMonth(date: Date, monthOffset = 0): Date {
  const d = new Date(toBogotaLocalMs(date));
  d.setUTCMonth(d.getUTCMonth() + monthOffset, 1);
  d.setUTCHours(0, 0, 0, 0);
  return new Date(fromBogotaLocalMs(d.getTime()));
}

/** Suma `n` días de calendario (24h cada uno; Colombia sin DST). */
export function addDays(date: Date, n: number): Date {
  return new Date(date.getTime() + n * 24 * 60 * 60 * 1000);
}

/** Diferencia en días de calendario (Bogotá): to - from. */
export function diffBogotaDays(from: Date, to: Date): number {
  const fromDay = new Date(toBogotaDayKey(from) + 'T00:00:00Z');
  const toDay = new Date(toBogotaDayKey(to) + 'T00:00:00Z');
  return Math.round((toDay.getTime() - fromDay.getTime()) / (24 * 60 * 60 * 1000));
}

/** 'YYYY-MM' del mes de Bogotá de `date`. */
export function bogotaMonthKey(date: Date): string {
  const d = new Date(toBogotaLocalMs(date));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Parsea 'YYYY-MM-DD' como 00:00 de Bogotá y devuelve el instante UTC.
 * Lanza si el string no es una fecha válida.
 */
export function parseBogotaDateKey(dateStr: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) {
    throw new Error('Formato de fecha inválido (YYYY-MM-DD)');
  }
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  const date = new Date(Date.UTC(year, month, day, 5, 0, 0)); // 00:00 Bogotá = 05:00 UTC
  if (isNaN(date.getTime()) || date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
    throw new Error('Fecha inválida');
  }
  return date;
}
