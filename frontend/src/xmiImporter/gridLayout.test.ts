import { describe, it, expect } from "vitest";
import {
  computeGridLayout,
  MIN_HORIZONTAL_SPACING,
  MIN_VERTICAL_SPACING,
  ClassSize,
} from "./gridLayout";

describe("computeGridLayout", () => {
  it("devuelve un mapa vacío si no hay clases", () => {
    const result = computeGridLayout([]);
    expect(result.size).toBe(0);
  });

  it("calcula correctamente la posición para una sola clase", () => {
    const sizes: ClassSize[] = [{ id: "c1", width: 220, height: 140 }];
    const result = computeGridLayout(sizes, { x: 100, y: 100 });

    expect(result.size).toBe(1);
    const pos = result.get("c1");
    expect(pos).toBeDefined();
    expect(pos?.x).toBe(100 + 220 / 2);
    expect(pos?.y).toBe(100 + 140 / 2);
  });

  it("mantiene orden estable respecto a la entrada", () => {
    const sizes: ClassSize[] = [
      { id: "c1", width: 200, height: 100 },
      { id: "c2", width: 250, height: 120 },
      { id: "c3", width: 220, height: 110 },
      { id: "c4", width: 300, height: 150 },
    ];
    const result = computeGridLayout(sizes);
    expect(Array.from(result.keys())).toEqual(["c1", "c2", "c3", "c4"]);
  });

  it("garantiza que ninguna clase se solape y respete los márgenes mínimos entre bordes (>= 300 horizontal, >= 250 vertical)", () => {
    // 6 clases en cuadrícula (2 columnas x 3 filas o 3 columnas x 2 filas)
    // ceil(sqrt(6)) = 3 columnas, 2 filas
    const sizes: ClassSize[] = [
      { id: "c1", width: 220, height: 140 },
      { id: "c2", width: 320, height: 180 },
      { id: "c3", width: 200, height: 120 },
      { id: "c4", width: 260, height: 160 },
      { id: "c5", width: 350, height: 200 },
      { id: "c6", width: 240, height: 150 },
    ];

    const result = computeGridLayout(sizes);
    expect(result.size).toBe(6);

    // Calcular bounding box de cada clase
    const boxes = sizes.map((s) => {
      const pos = result.get(s.id)!;
      return {
        id: s.id,
        left: pos.x - s.width / 2,
        right: pos.x + s.width / 2,
        top: pos.y - s.height / 2,
        bottom: pos.y + s.height / 2,
        width: s.width,
        height: s.height,
      };
    });

    // Validar pares en la misma fila y misma columna
    // numCols = ceil(sqrt(6)) = 3
    const numCols = Math.ceil(Math.sqrt(sizes.length));

    for (let i = 0; i < sizes.length; i++) {
      const rowI = Math.floor(i / numCols);
      const colI = i % numCols;
      const bI = boxes[i];

      for (let j = 0; j < sizes.length; j++) {
        if (i === j) continue;
        const rowJ = Math.floor(j / numCols);
        const colJ = j % numCols;
        const bJ = boxes[j];

        // 1. No solapamiento estricto
        const horizontalOverlap = !(bI.right <= bJ.left || bI.left >= bJ.right);
        const verticalOverlap = !(bI.bottom <= bJ.top || bI.top >= bJ.bottom);
        expect(horizontalOverlap && verticalOverlap).toBe(false);

        // 2. Si están en la misma fila y son adyacentes horizontalmente (colJ === colI + 1)
        if (rowI === rowJ && colJ === colI + 1) {
          const horizontalDistance = bJ.left - bI.right;
          expect(horizontalDistance).toBeGreaterThanOrEqual(
            MIN_HORIZONTAL_SPACING
          );
        }

        // 3. Si están en la misma columna y son adyacentes verticalmente (rowJ === rowI + 1)
        if (colI === colJ && rowJ === rowI + 1) {
          const verticalDistance = bJ.top - bI.bottom;
          expect(verticalDistance).toBeGreaterThanOrEqual(MIN_VERTICAL_SPACING);
        }
      }
    }
  });
});
