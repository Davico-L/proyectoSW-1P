export interface ClassSize {
  id: string;
  width: number;
  height: number;
}

export interface GridPosition {
  x: number;
  y: number;
}

export const MIN_HORIZONTAL_SPACING = 300;
export const MIN_VERTICAL_SPACING = 250;
export const DEFAULT_ORIGIN_X = 100;
export const DEFAULT_ORIGIN_Y = 100;

/**
 * Calcula las coordenadas de centro { x, y } para cada clase en una cuadrícula.
 *
 * Reglas:
 * - Columnas = ceil(sqrt(n))
 * - Espaciado horizontal mínimo de 300 px entre bordes
 * - Espaciado vertical mínimo de 250 px entre bordes
 * - Ancho de cada columna = ancho máximo de sus clases
 * - Alto de cada fila = alto máximo de sus clases
 * - El orden devuelto es estable respecto al array de entrada
 */
export function computeGridLayout(
  sizes: ClassSize[],
  origin: { x: number; y: number } = { x: DEFAULT_ORIGIN_X, y: DEFAULT_ORIGIN_Y }
): Map<string, GridPosition> {
  const result = new Map<string, GridPosition>();
  const n = sizes.length;

  if (n === 0) {
    return result;
  }

  const numCols = Math.ceil(Math.sqrt(n));
  const numRows = Math.ceil(n / numCols);

  // 1. Calcular el ancho máximo por columna y alto máximo por fila
  const colWidths = new Array<number>(numCols).fill(0);
  const rowHeights = new Array<number>(numRows).fill(0);

  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / numCols);
    const c = i % numCols;
    const item = sizes[i];

    if (item.width > colWidths[c]) {
      colWidths[c] = item.width;
    }
    if (item.height > rowHeights[r]) {
      rowHeights[r] = item.height;
    }
  }

  // 2. Calcular los bordes superiores izquierdos de cada celda
  const colLefts = new Array<number>(numCols).fill(0);
  colLefts[0] = origin.x;
  for (let c = 1; c < numCols; c++) {
    colLefts[c] = colLefts[c - 1] + colWidths[c - 1] + MIN_HORIZONTAL_SPACING;
  }

  const rowTops = new Array<number>(numRows).fill(0);
  rowTops[0] = origin.y;
  for (let r = 1; r < numRows; r++) {
    rowTops[r] = rowTops[r - 1] + rowHeights[r - 1] + MIN_VERTICAL_SPACING;
  }

  // 3. Asignar el centro de cada elemento
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / numCols);
    const c = i % numCols;
    const item = sizes[i];

    const centerX = colLefts[c] + colWidths[c] / 2;
    const centerY = rowTops[r] + rowHeights[r] / 2;

    result.set(item.id, { x: centerX, y: centerY });
  }

  return result;
}
