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
