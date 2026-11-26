/**
 * Utilidades puras para generar CSV con separador ';' y BOM UTF-8.
 * Compatible con Excel en español.
 */

export interface CsvColumn<T> {
  header: string;
  getValue: (row: T) => unknown;
  isFormulaSafe?: boolean; // Si false, aplica protección contra inyección de fórmulas
}

export type CsvColumns<T> = ReadonlyArray<CsvColumn<T>>;

/**
 * Escapa un valor para CSV.
 * - Encierra entre comillas dobles si contiene ;, ", \n o \r
 * - Duplica las comillas internas
 * - Protección contra inyección de fórmulas: si empieza con =, +, -, @, tab o retorno de carro,
 *   antepone un apóstrofo (solo para campos de texto, no para números/fechas)
 * - null/undefined -> cadena vacía
 */
function escapeCsvValue(value: unknown, isFormulaSafe: boolean = false): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);

  // Protección contra inyección de fórmulas (solo para campos NO formula-safe)
  let result = str;
  if (!isFormulaSafe) {
    const startsWithFormulaChar = /^[=+\-@\t\r]/.test(str);
    if (startsWithFormulaChar) {
      result = "'" + str;
    }
  }

  // Verificar si necesita comillas
  const needsQuotes = /[;"\n\r]/.test(result);
  if (needsQuotes) {
    // Duplicar comillas internas
    result = result.replace(/"/g, '""');
    result = `"${result}"`;
  }

  return result;
}

/**
 * Genera CSV con delimitador ';', saltos \r\n, primera fila con encabezados,
 * y BOM UTF-8 (\uFEFF).
 * 
 * @param rows - Array de objetos a exportar
 * @param columns - Definición de columnas (header + getter)
 * @returns String CSV con BOM
 */
export function toCsv<T>(rows: T[], columns: CsvColumns<T>): string {
  // BOM UTF-8
  const bom = '\uFEFF';
  
  // Encabezados
  const headers = columns.map(col => escapeCsvValue(col.header, true)).join(';');
  
  // Filas de datos
  const dataRows = rows.map(row => 
    columns.map(col => escapeCsvValue(col.getValue(row), col.isFormulaSafe)).join(';')
  ).join('\r\n');
  
  // Combinar todo con saltos de línea CRLF
  const csvContent = [headers, dataRows].filter(Boolean).join('\r\n');
  
  return bom + csvContent;
}

/**
 * Convierte una fecha ISO a fecha de Bogotá YYYY-MM-DD
 */
export function toBogotaDateString(isoString: string): string {
  const date = new Date(isoString);
  // Bogotá es UTC-5
  const bogotaOffsetMs = -5 * 60 * 60 * 1000;
  const bogotaDate = new Date(date.getTime() + bogotaOffsetMs);
  const y = bogotaDate.getUTCFullYear();
  const m = String(bogotaDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(bogotaDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Convierte una fecha ISO a hora de Bogotá HH:mm
 */
export function toBogotaTimeString(isoString: string): string {
  const date = new Date(isoString);
  const bogotaOffsetMs = -5 * 60 * 60 * 1000;
  const bogotaDate = new Date(date.getTime() + bogotaOffsetMs);
  const h = String(bogotaDate.getUTCHours()).padStart(2, '0');
  const m = String(bogotaDate.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}