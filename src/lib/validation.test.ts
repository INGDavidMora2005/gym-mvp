import { describe, expect, it } from 'vitest';
import { clientSchema, createClientSchema, uuidSchema, voidReasonSchema } from './validation';

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
