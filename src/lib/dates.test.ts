import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  TIMEZONE,
  addDays,
  bogotaMonthKey,
  diffBogotaDays,
  startOfBogotaDay,
  startOfBogotaMonth,
  toBogotaDayKey,
} from './dates';

const ORIGINAL_TZ = process.env.TZ;

afterEach(() => {
  process.env.TZ = ORIGINAL_TZ;
});

/** Construye un Date (UTC) que, interpretado como hora local de Bogotá,
 * representa la fecha/hora dada. Bogotá = UTC - 5h, por eso se suman 5h. */
function mkBogota(
  y: number,
  mo: number,
  d: number,
  h = 0,
  min = 0,
): Date {
  return new Date(Date.UTC(y, mo - 1, d, h + 5, min));
}

describe('TIMEZONE', () => {
  it('es America/Bogota', () => {
    expect(TIMEZONE).toBe('America/Bogota');
  });
});

describe('toBogotaDayKey', () => {
  it('23:30 de Bogotá sigue siendo el mismo día', () => {
    // 2026-11-22 23:30 Bogotá = 2026-11-23 04:30 UTC
    expect(toBogotaDayKey(mkBogota(2026, 11, 22, 23, 30))).toBe('2026-11-22');
  });

  it('00:30 de Bogotá es el día siguiente en UTC pero mismo día clave', () => {
    // 2026-11-23 00:30 Bogotá = 2026-11-23 05:30 UTC
    expect(toBogotaDayKey(mkBogota(2026, 11, 23, 0, 30))).toBe('2026-11-23');
  });

  it('cambio de mes', () => {
    // 2026-11-30 23:30 Bogotá
    expect(toBogotaDayKey(mkBogota(2026, 11, 30, 23, 30))).toBe('2026-11-30');
  });

  it('cambio de año', () => {
    // 2026-12-31 23:30 Bogotá
    expect(toBogotaDayKey(mkBogota(2026, 12, 31, 23, 30))).toBe('2026-12-31');
  });
});

describe('startOfBogotaDay', () => {
  it('devuelve las 00:00 de Bogotá como instante UTC', () => {
    const d = startOfBogotaDay(mkBogota(2026, 11, 22, 14, 30));
    expect(toBogotaDayKey(d)).toBe('2026-11-22');
    // 00:00 Bogotá = 05:00 UTC del mismo día clave
    expect(d.getUTCHours()).toBe(5);
    expect(d.getUTCMinutes()).toBe(0);
  });
});

describe('startOfBogotaMonth', () => {
  it('mes sin offset', () => {
    const d = startOfBogotaMonth(mkBogota(2026, 11, 15, 20, 0));
    expect(toBogotaDayKey(d)).toBe('2026-11-01');
  });

  it('mes siguiente', () => {
    const d = startOfBogotaMonth(mkBogota(2026, 11, 15), 1);
    expect(toBogotaDayKey(d)).toBe('2026-12-01');
  });

  it('mes anterior', () => {
    const d = startOfBogotaMonth(mkBogota(2026, 11, 15), -1);
    expect(toBogotaDayKey(d)).toBe('2026-10-01');
  });

  it('cambio de año con offset positivo', () => {
    const d = startOfBogotaMonth(mkBogota(2026, 12, 15), 1);
    expect(toBogotaDayKey(d)).toBe('2027-01-01');
  });
});

describe('addDays', () => {
  it('suma días de calendario', () => {
    const base = mkBogota(2026, 11, 22, 23, 30);
    expect(toBogotaDayKey(addDays(base, 1))).toBe('2026-11-23');
    expect(toBogotaDayKey(addDays(base, -1))).toBe('2026-11-21');
  });
});

describe('diffBogotaDays', () => {
  it('to - from en días de Bogotá', () => {
    expect(diffBogotaDays(mkBogota(2026, 11, 1), mkBogota(2026, 11, 1))).toBe(0);
    expect(diffBogotaDays(mkBogota(2026, 11, 1), mkBogota(2026, 11, 2))).toBe(1);
    expect(diffBogotaDays(mkBogota(2026, 11, 2), mkBogota(2026, 11, 1))).toBe(-1);
  });

  it('ignora la hora del día', () => {
    expect(
      diffBogotaDays(mkBogota(2026, 11, 1, 23, 59), mkBogota(2026, 11, 2, 0, 1)),
    ).toBe(1);
  });
});

describe('bogotaMonthKey', () => {
  it('YYYY-MM de Bogotá', () => {
    expect(bogotaMonthKey(mkBogota(2026, 11, 15))).toBe('2026-11');
  });
});

describe('independencia de la zona horaria del proceso', () => {
  const base = mkBogota(2026, 11, 22, 14, 30);
  const expected = {
    dayKey: '2026-11-22',
    monthKey: '2026-11',
    diff: 21,
  };

  it('mismo resultado con TZ=UTC', () => {
    runWithTZ('UTC', () => {
      expect(toBogotaDayKey(base)).toBe(expected.dayKey);
      expect(bogotaMonthKey(base)).toBe(expected.monthKey);
      expect(diffBogotaDays(mkBogota(2026, 11, 1), base)).toBe(expected.diff);
    });
  });

  it('mismo resultado con TZ=Asia/Tokyo', () => {
    runWithTZ('Asia/Tokyo', () => {
      expect(toBogotaDayKey(base)).toBe(expected.dayKey);
      expect(bogotaMonthKey(base)).toBe(expected.monthKey);
      expect(diffBogotaDays(mkBogota(2026, 11, 1), base)).toBe(expected.diff);
    });
  });

  it('mismo resultado sin TZ', () => {
    runWithTZ(undefined, () => {
      expect(toBogotaDayKey(base)).toBe(expected.dayKey);
      expect(bogotaMonthKey(base)).toBe(expected.monthKey);
      expect(diffBogotaDays(mkBogota(2026, 11, 1), base)).toBe(expected.diff);
    });
  });
});

function runWithTZ(tz: string | undefined, fn: () => void) {
  const prev = process.env.TZ;
  process.env.TZ = tz;
  try {
    fn();
  } finally {
    process.env.TZ = prev;
  }
}
