import { describe, it, expect } from "vitest";
import { BOUND_TEXT_PADDING } from "@excalidraw/common";
import {
  computeUmlClassHeight,
  getUmlLineHeightInPx,
} from "../uml/computeUmlClassHeight";
import { createUmlClassElement } from "../uml/createUmlClassElement";
import { buildUmlClassLabel, UmlClassData } from "../uml/types";

describe("computeUmlClassHeight", () => {
  it("calcula correctamente el alto de línea para Liberation Sans a 16px (18.4 px)", () => {
    const lineHeightPx = getUmlLineHeightInPx(16);
    expect(lineHeightPx).toBeCloseTo(18.4, 5);
  });

  it("calcula la altura exacta de tres clases de ejemplo", () => {
    // 1. Solo nombre (1 renglón) -> (1 + 1) * 18.4 = 36.8 px
    const heightSingle = computeUmlClassHeight(1);
    expect(heightSingle).toBeCloseTo(36.8, 5);

    // 2. Nombre con 2 atributos (4 renglones: nombre, sep, attr1, attr2) -> (4 + 1) * 18.4 = 92.0 px
    const heightWithAttrs = computeUmlClassHeight(4);
    expect(heightWithAttrs).toBeCloseTo(92.0, 5);

    // 3. Nombre con 2 atributos y 2 métodos (7 renglones: nombre, sep, attr1, attr2, sep, met1, met2) -> (7 + 1) * 18.4 = 147.2 px
    const heightComplete = computeUmlClassHeight(7);
    expect(heightComplete).toBeCloseTo(147.2, 5);
  });

  it("garantiza que el sobrante vertical supere BOUND_TEXT_PADDING * 2 para evitar auto-expansión", () => {
    const lineHeightPx = getUmlLineHeightInPx(16);
    // El sobrante total entre contenedor y texto es exactamente 1 * lineHeightPx
    // Excalidraw exige que container.height >= text.height + 2 * BOUND_TEXT_PADDING
    expect(lineHeightPx).toBeGreaterThan(2 * BOUND_TEXT_PADDING);
  });

  it("crea un contenedor con la altura calculada y el texto centrado simétricamente", () => {
    const data: UmlClassData = {
      type: "umlClass",
      className: "Usuario",
      attributes: [
        { name: "id", type: "Long", visibility: "private" },
        { name: "nombre", type: "String", visibility: "public" },
      ],
      methods: [
        { name: "getId", returnType: "Long", visibility: "public" },
        { name: "setNombre", returnType: "void", visibility: "public" },
      ],
    };

    const label = buildUmlClassLabel(data);
    const lineCount = label.split("\n").length;
    expect(lineCount).toBe(7);

    const { container, text } = createUmlClassElement(data, { x: 200, y: 200 });

    const expectedHeight = computeUmlClassHeight(lineCount);
    expect(container.height).toBeCloseTo(expectedHeight, 5);

    // Margen superior e inferior deben ser exactamente iguales a media línea (18.4 / 2 = 9.2 px)
    const topGap = text.y - container.y;
    const bottomGap = container.y + container.height - (text.y + text.height);

    expect(topGap).toBeCloseTo(9.2, 4);
    expect(bottomGap).toBeCloseTo(9.2, 4);
    expect(topGap).toBeCloseTo(bottomGap, 4);
  });
});
