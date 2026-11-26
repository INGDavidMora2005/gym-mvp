import { describe, expect, it } from 'vitest';
import {
  clientSchema,
  createClientSchema,
  uuidSchema,
  voidReasonSchema,
  paymentMethodSchema,
  cashDateSchema,
  countedCashSchema,
  noteSchema,
  exportRangeSchema,
  PAYMENT_METHODS,
} from './validation';
import { parseBogotaDateKey } from './dates';

const validClient = {
  name: 'Ana Gómez',
  age: '28',
  phone: '3001234567',
  address: 'Calle 1 # 2-3',
  payment_method: 'EFECTIVO',
} as const;

describe('normalización de teléfono', () => {
  it.each([
    '300 123 4567',
    '+57 300 123 4567',
    '573001234567',
    '(300)123-4567',
  ])('normaliza %s a 3001234567', (phone) => {
    const result = clientSchema.safeParse({ ...validClient, phone });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe('3001234567');
    }
  });

  it.each(['123', '2001234567', '30012345678'])(
    'rechaza el teléfono inválido %s',
    (phone) => {
      const result = clientSchema.safeParse({ ...validClient, phone });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: ['phone'],
              message: 'Teléfono colombiano inválido (10 dígitos, empieza por 3)',
            }),
          ])
        );
      }
    }
  );
});

describe('edad', () => {
  it('convierte una cadena vacía en null', () => {
    const result = clientSchema.safeParse({ ...validClient, age: '' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.age).toBeNull();
    }
  });

  it.each(['9', '101'])('rechaza la edad fuera de rango %s', (age) => {
    const result = clientSchema.safeParse({ ...validClient, age });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['age'],
            message: 'La edad debe estar entre 10 y 100',
          }),
        ])
      );
    }
  });

  it('rechaza una edad no numérica', () => {
    const result = clientSchema.safeParse({ ...validClient, age: 'abc' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['age'],
            message: 'La edad debe ser un número entero',
          }),
        ])
      );
    }
  });
});

describe('nombre', () => {
  it.each(['', '   '])('rechaza el nombre vacío %j', (name) => {
    const result = clientSchema.safeParse({ ...validClient, name });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: ['name'] })])
      );
    }
  });
});

describe('método de pago', () => {
  it('rechaza un método desconocido', () => {
    const result = clientSchema.safeParse({
      ...validClient,
      payment_method: 'TARJETA',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['payment_method'],
            message: 'Selecciona un método de pago válido',
          }),
        ])
      );
    }
  });
});

describe('uuid', () => {
  it('rechaza un id inválido', () => {
    expect(uuidSchema.safeParse('no-es-un-uuid').success).toBe(false);
  });

  it('acepta un uuid válido', () => {
    expect(uuidSchema.safeParse('3f5c1a9e-2b4d-4c8a-9f1e-7d6b5a4c3e2f').success).toBe(true);
  });
});

describe('pago inicial', () => {
  it("convierte 'on' en true", () => {
    const result = createClientSchema.safeParse({
      ...validClient,
      first_payment: 'on',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.first_payment).toBe(true);
    }
  });

  it('usa false cuando el checkbox no viene', () => {
    const result = createClientSchema.safeParse(validClient);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.first_payment).toBe(false);
    }
  });
});

describe('motivo de anulación (voidReasonSchema)', () => {
  it('rechaza un valor vacío', () => {
    const result = voidReasonSchema.safeParse('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('El motivo debe tener al menos 3 caracteres');
    }
  });

  it('rechaza dos caracteres (mínimo 3)', () => {
    const result = voidReasonSchema.safeParse('ab');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('El motivo debe tener al menos 3 caracteres');
    }
  });

  it('rechaza 201 caracteres (máximo 200)', () => {
    const longReason = 'a'.repeat(201);
    const result = voidReasonSchema.safeParse(longReason);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('El motivo no puede superar los 200 caracteres');
    }
  });

  it('acepta un valor válido con espacios alrededor (se trimsea)', () => {
    const result = voidReasonSchema.safeParse('  motivo válido  ');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('motivo válido');
    }
  });

  it('acepta exactamente 3 caracteres', () => {
    const result = voidReasonSchema.safeParse('abc');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('abc');
    }
  });

  it('acepta exactamente 200 caracteres', () => {
    const maxReason = 'a'.repeat(200);
    const result = voidReasonSchema.safeParse(maxReason);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(maxReason);
    }
  });
});

describe('paymentMethodSchema (exportado)', () => {
  it.each(PAYMENT_METHODS)('acepta %s', (method) => {
    const result = paymentMethodSchema.safeParse(method);
    expect(result.success).toBe(true);
  });

  it('rechaza método desconocido', () => {
    const result = paymentMethodSchema.safeParse('TARJETA');
    expect(result.success).toBe(false);
  });
});

describe('cashDateSchema', () => {
  // Calcular fechas relativas a "hoy en Bogotá" para evitar dependencia de zona horaria
  function getBogotaDayKey(date: Date): string {
    const bogotaOffsetMs = -5 * 60 * 60 * 1000;
    const bogotaDate = new Date(date.getTime() + bogotaOffsetMs);
    const y = bogotaDate.getUTCFullYear();
    const m = String(bogotaDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(bogotaDate.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const now = new Date();
  const todayBogota = getBogotaDayKey(now);
  const yesterdayBogota = getBogotaDayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const tomorrowBogota = getBogotaDayKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));

  it('acepta fecha de hoy (YYYY-MM-DD)', () => {
    const result = cashDateSchema.safeParse(todayBogota);
    expect(result.success).toBe(true);
  });

  it('acepta fecha pasada', () => {
    const result = cashDateSchema.safeParse(yesterdayBogota);
    expect(result.success).toBe(true);
  });

  it('rechaza fecha futura', () => {
    const result = cashDateSchema.safeParse(tomorrowBogota);
    expect(result.success).toBe(false);
  });

  it('rechaza formato inválido', () => {
    const result = cashDateSchema.safeParse('24/11/2026');
    expect(result.success).toBe(false);
  });

  it('rechaza fecha inexistente', () => {
    const result = cashDateSchema.safeParse('2026-02-30');
    expect(result.success).toBe(false);
  });
});

describe('countedCashSchema', () => {
  it('acepta número simple "150000"', () => {
    const result = countedCashSchema.safeParse('150000');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(150000);
  });

  it('acepta con puntos "150.000"', () => {
    const result = countedCashSchema.safeParse('150.000');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(150000);
  });

  it('acepta con comas "150,000"', () => {
    const result = countedCashSchema.safeParse('150,000');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(150000);
  });

  it('acepta con espacios " 150 000 " ', () => {
    const result = countedCashSchema.safeParse(' 150 000 ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(150000);
  });

  it('rechaza negativo', () => {
    const result = countedCashSchema.safeParse('-1000');
    expect(result.success).toBe(false);
  });

  it('rechaza decimales', () => {
    const result = countedCashSchema.safeParse('150000.50');
    expect(result.success).toBe(false);
  });

  it('rechaza letras', () => {
    const result = countedCashSchema.safeParse('abc');
    expect(result.success).toBe(false);
  });

  it('rechaza más de 9 dígitos', () => {
    const result = countedCashSchema.safeParse('1000000000');
    expect(result.success).toBe(false);
  });

  it('acepta 0', () => {
    const result = countedCashSchema.safeParse('0');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(0);
  });
});

describe('noteSchema', () => {
  it('acepta undefined', () => {
    const result = noteSchema.safeParse(undefined);
    expect(result.success).toBe(true);
  });

  it('acepta null', () => {
    const result = noteSchema.safeParse(null);
    expect(result.success).toBe(true);
  });

  it('acepta string vacío', () => {
    const result = noteSchema.safeParse('');
    expect(result.success).toBe(true);
  });

  it('acepta string con espacios (se trimea)', () => {
    const result = noteSchema.safeParse('  nota  ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('nota');
  });

  it('rechaza más de 200 caracteres', () => {
    const result = noteSchema.safeParse('a'.repeat(201));
    expect(result.success).toBe(false);
  });

  it('acepta exactamente 200 caracteres', () => {
    const result = noteSchema.safeParse('a'.repeat(200));
    expect(result.success).toBe(true);
  });
});

describe('parseBogotaDateKey', () => {
  it('parsea YYYY-MM-DD a 00:00 Bogotá (05:00 UTC)', () => {
    const date = parseBogotaDateKey('2026-11-24');
    expect(date.getUTCFullYear()).toBe(2026);
    expect(date.getUTCMonth()).toBe(10); // 0-indexed
    expect(date.getUTCDate()).toBe(24);
    expect(date.getUTCHours()).toBe(5); // 00:00 Bogotá = 05:00 UTC
    expect(date.getUTCMinutes()).toBe(0);
  });

  it('lanza en formato inválido', () => {
    expect(() => parseBogotaDateKey('24/11/2026')).toThrow('Formato de fecha inválido');
  });

  it('lanza en fecha inexistente', () => {
    expect(() => parseBogotaDateKey('2026-02-30')).toThrow('Fecha inválida');
  });

  it('maneja fin de año', () => {
    const date = parseBogotaDateKey('2026-12-31');
    expect(date.getUTCFullYear()).toBe(2026);
    expect(date.getUTCMonth()).toBe(11);
    expect(date.getUTCDate()).toBe(31);
  });

  it('maneja año bisiesto', () => {
    const date = parseBogotaDateKey('2024-02-29');
    expect(date.getUTCFullYear()).toBe(2024);
    expect(date.getUTCMonth()).toBe(1);
    expect(date.getUTCDate()).toBe(29);
  });
});

describe('exportRangeSchema', () => {
  // Calcular fechas relativas a "hoy en Bogotá" para evitar dependencia de zona horaria
  function getBogotaDayKey(date: Date): string {
    const bogotaOffsetMs = -5 * 60 * 60 * 1000;
    const bogotaDate = new Date(date.getTime() + bogotaOffsetMs);
    const y = bogotaDate.getUTCFullYear();
    const m = String(bogotaDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(bogotaDate.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const now = new Date();
  const today = getBogotaDayKey(now);
  const yesterday = getBogotaDayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const lastWeek = getBogotaDayKey(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  const lastMonth = getBogotaDayKey(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
  const future = getBogotaDayKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const invalidFormat = '24/11/2026';
  const invalidDate = '2026-02-30';

  it('acepta rango válido (hoy a hoy)', () => {
    const result = exportRangeSchema.safeParse({ from: today, to: today });
    expect(result.success).toBe(true);
  });

  it('acepta rango válido (semana pasada a hoy)', () => {
    const result = exportRangeSchema.safeParse({ from: lastWeek, to: today });
    expect(result.success).toBe(true);
  });

  it('acepta rango válido (mes pasado a hoy)', () => {
    const result = exportRangeSchema.safeParse({ from: lastMonth, to: today });
    expect(result.success).toBe(true);
  });

  it('rechaza fecha desde futura', () => {
    const result = exportRangeSchema.safeParse({ from: future, to: future });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('futura');
    }
  });

  it('rechaza fecha hasta futura', () => {
    const result = exportRangeSchema.safeParse({ from: today, to: future });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('futura');
    }
  });

  it('rechaza formato inválido en desde', () => {
    const result = exportRangeSchema.safeParse({ from: invalidFormat, to: today });
    expect(result.success).toBe(false);
  });

  it('rechaza formato inválido en hasta', () => {
    const result = exportRangeSchema.safeParse({ from: today, to: invalidFormat });
    expect(result.success).toBe(false);
  });

  it('rechaza fecha inexistente en desde', () => {
    const result = exportRangeSchema.safeParse({ from: invalidDate, to: today });
    expect(result.success).toBe(false);
  });

  it('rechaza fecha inexistente en hasta', () => {
    const result = exportRangeSchema.safeParse({ from: today, to: invalidDate });
    expect(result.success).toBe(false);
  });

  it('rechaza cuando hasta < desde', () => {
    const result = exportRangeSchema.safeParse({ from: today, to: yesterday });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('posterior');
    }
  });

  it('rechaza rango mayor a 366 días', () => {
    const result = exportRangeSchema.safeParse({ from: '2025-01-01', to: today });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('366');
    }
  });

  it('acepta rango exactamente de 366 días', () => {
    // 2025-11-24 a 2026-11-24 = 366 días (año bisiesto incluido)
    const result = exportRangeSchema.safeParse({ from: '2025-11-24', to: '2026-11-24' });
    expect(result.success).toBe(true);
  });

  it('rechaza cuando falta desde', () => {
    const result = exportRangeSchema.safeParse({ to: today });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('obligatoria');
    }
  });

  it('rechaza cuando falta hasta', () => {
    const result = exportRangeSchema.safeParse({ from: today });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('obligatoria');
    }
  });
});
