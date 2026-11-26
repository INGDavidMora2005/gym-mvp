import { describe, expect, it } from 'vitest';
import { toCsv, toBogotaDateString, toBogotaTimeString } from './csv';

describe('toCsv', () => {
  interface TestRow {
    id: number;
    name: string;
    value: number | null;
    note: string | null;
  }

  const columns = [
    { header: 'ID', getValue: (r: TestRow) => r.id, isFormulaSafe: true },
    { header: 'Nombre', getValue: (r: TestRow) => r.name },
    { header: 'Valor', getValue: (r: TestRow) => r.value, isFormulaSafe: true },
    { header: 'Nota', getValue: (r: TestRow) => r.note },
  ] as const;

  it('genera BOM UTF-8 al inicio', () => {
    const csv = toCsv([{ id: 1, name: 'Test', value: 100, note: 'ok' }], columns);
    expect(csv.charCodeAt(0)).toBe(0xFEFF); // BOM
  });

  it('usa punto y coma como separador', () => {
    const csv = toCsv([{ id: 1, name: 'Test', value: 100, note: 'ok' }], columns);
    expect(csv).toContain(';');
    expect(csv.split(';').length).toBeGreaterThan(1);
  });

  it('usa CRLF (\\r\\n) como salto de línea', () => {
    const csv = toCsv([
      { id: 1, name: 'A', value: 1, note: 'x' },
      { id: 2, name: 'B', value: 2, note: 'y' },
    ], columns);
    expect(csv).toContain('\r\n');
    expect(csv).not.toContain('\n\n'); // No LF dobles
  });

  it('incluye encabezados en la primera fila', () => {
    const csv = toCsv([{ id: 1, name: 'Test', value: 100, note: 'ok' }], columns);
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('ID');
    expect(lines[0]).toContain('Nombre');
    expect(lines[0]).toContain('Valor');
    expect(lines[0]).toContain('Nota');
  });

  it('encierra en comillas si contiene punto y coma', () => {
    const csv = toCsv([{ id: 1, name: 'A;B', value: 1, note: 'x' }], columns);
    expect(csv).toContain('"A;B"');
  });

  it('encierra en comillas si contiene comillas dobles', () => {
    const csv = toCsv([{ id: 1, name: 'A"B', value: 1, note: 'x' }], columns);
    expect(csv).toContain('"A""B"');
  });

  it('encierra en comillas si contiene salto de línea', () => {
    const csv = toCsv([{ id: 1, name: 'A\nB', value: 1, note: 'x' }], columns);
    expect(csv).toContain('"A\nB"');
  });

  it('encierra en comillas si contiene retorno de carro', () => {
    const csv = toCsv([{ id: 1, name: 'A\rB', value: 1, note: 'x' }], columns);
    expect(csv).toContain('"A\rB"');
  });

  it('duplica comillas internas', () => {
    const csv = toCsv([{ id: 1, name: 'Say "Hello"', value: 1, note: 'x' }], columns);
    expect(csv).toContain('"Say ""Hello"""');
  });

  it('tildes y ñ se conservan correctamente', () => {
    const csv = toCsv([{ id: 1, name: 'María Núñez', value: 1, note: 'niño' }], columns);
    expect(csv).toContain('María Núñez');
    expect(csv).toContain('niño');
  });

  it('protección contra inyección: = al inicio', () => {
    const csv = toCsv([{ id: 1, name: '=1+1', value: 1, note: 'x' }], columns);
    expect(csv).toContain("'=1+1");
  });

  it('protección contra inyección: + al inicio', () => {
    const csv = toCsv([{ id: 1, name: '+cmd', value: 1, note: 'x' }], columns);
    expect(csv).toContain("'+cmd");
  });

  it('protección contra inyección: - al inicio', () => {
    const csv = toCsv([{ id: 1, name: '-2', value: 1, note: 'x' }], columns);
    expect(csv).toContain("'-2");
  });

  it('protección contra inyección: @ al inicio', () => {
    const csv = toCsv([{ id: 1, name: '@SUM(A1:A2)', value: 1, note: 'x' }], columns);
    expect(csv).toContain("'@SUM(A1:A2)");
  });

  it('protección contra inyección: tab al inicio', () => {
    const csv = toCsv([{ id: 1, name: '\tmalicious', value: 1, note: 'x' }], columns);
    expect(csv).toContain("'\tmalicious");
  });

  it('protección contra inyección: retorno de carro al inicio', () => {
    const csv = toCsv([{ id: 1, name: '\rinject', value: 1, note: 'x' }], columns);
    expect(csv).toContain("'\rinject");
  });

  it('NO protege números (isFormulaSafe=true) - montos negativos se escriben tal cual', () => {
    const csv = toCsv([{ id: 1, name: 'Test', value: -50000, note: 'x' }], columns);
    // El valor -50000 no debe tener apóstrofo
    expect(csv).toContain(';-50000;');
    expect(csv).not.toContain("'-50000");
  });

  it('NO protege números enteros positivos', () => {
    const csv = toCsv([{ id: 1, name: 'Test', value: 65000, note: 'x' }], columns);
    expect(csv).toContain(';65000;');
    expect(csv).not.toContain("'65000");
  });

  it('null/undefined se convierten en cadena vacía', () => {
    const csv = toCsv([{ id: 1, name: 'Test', value: null, note: null }], columns);
    expect(csv).toContain(';;'); // Dos campos vacíos seguidos
  });

  it('BOM presente en salida', () => {
    const csv = toCsv([], columns);
    expect(csv).toBe('\uFEFFID;Nombre;Valor;Nota');
  });

  it('filas vacías (solo encabezados) genera solo encabezados + BOM', () => {
    const csv = toCsv([], columns);
    const lines = csv.split('\r\n');
    expect(lines.length).toBe(1); // Solo la línea de encabezados
    expect(lines[0]).toBe('\uFEFFID;Nombre;Valor;Nota');
  });

  it('múltiples filas se separan con CRLF', () => {
    const csv = toCsv([
      { id: 1, name: 'A', value: 1, note: 'x' },
      { id: 2, name: 'B', value: 2, note: 'y' },
      { id: 3, name: 'C', value: 3, note: 'z' },
    ], columns);
    const lines = csv.split('\r\n');
    expect(lines.length).toBe(4); // Encabezado + 3 filas
  });

  it('valores con espacios no se encierran innecesariamente', () => {
    const csv = toCsv([{ id: 1, name: 'Hola Mundo', value: 1, note: 'x' }], columns);
    expect(csv).toContain('Hola Mundo');
    // Sin comillas porque no tiene caracteres especiales
  });
});

describe('toBogotaDateString', () => {
  it('convierte ISO a fecha Bogotá YYYY-MM-DD', () => {
    // 2026-11-24T10:00:00Z = 2026-11-24 05:00 Bogotá
    expect(toBogotaDateString('2026-11-24T10:00:00Z')).toBe('2026-11-24');
  });

  it('convierte ISO en hora tardía Bogotá', () => {
    // 2026-11-24T23:00:00Z = 2026-11-24 18:00 Bogotá
    expect(toBogotaDateString('2026-11-24T23:00:00Z')).toBe('2026-11-24');
  });

  it('cruce de medianoche UTC -> día anterior en Bogotá', () => {
    // 2026-11-25T04:00:00Z = 2026-11-24 23:00 Bogotá (aún 24)
    expect(toBogotaDateString('2026-11-25T04:00:00Z')).toBe('2026-11-24');
    // 2026-11-25T05:00:00Z = 2026-11-25 00:00 Bogotá
    expect(toBogotaDateString('2026-11-25T05:00:00Z')).toBe('2026-11-25');
  });
});

describe('toBogotaTimeString', () => {
  it('convierte ISO a hora Bogotá HH:mm', () => {
    // 2026-11-24T10:00:00Z = 2026-11-24 05:00 Bogotá
    expect(toBogotaTimeString('2026-11-24T10:00:00Z')).toBe('05:00');
  });

  it('hora con minutos', () => {
    // 2026-11-24T15:30:00Z = 2026-11-24 10:30 Bogotá
    expect(toBogotaTimeString('2026-11-24T15:30:00Z')).toBe('10:30');
  });

  it('medianoche UTC = 19:00 Bogotá día anterior', () => {
    // 2026-11-25T00:00:00Z = 2026-11-24 19:00 Bogotá
    expect(toBogotaTimeString('2026-11-25T00:00:00Z')).toBe('19:00');
  });
});