import { describe, it, expect } from "vitest";
import { normalizeUmlClassCorners } from "../uml/normalizeUmlClassCorners";
import { newElement, newTextElement } from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element/types";

describe("normalizeUmlClassCorners", () => {
  it("normaliza clases UML con roundness distinto de null a roundness: null con nueva versión", () => {
    const roundedClass = newElement({
      type: "rectangle",
      x: 10,
      y: 20,
      width: 100,
      height: 80,
      roundness: { type: 3 },
      customData: { type: "umlClass", className: "Usuario", attributes: [], methods: [] },
    });

    const otherElement = newElement({
      type: "rectangle",
      x: 200,
      y: 200,
      width: 50,
      height: 50,
      roundness: { type: 3 },
    });

    const elements: ExcalidrawElement[] = [roundedClass, otherElement];
    const normalized = normalizeUmlClassCorners(elements);

    // La clase UML se normaliza a null
    expect(normalized[0].roundness).toBeNull();
    expect(normalized[0].version).toBeGreaterThan(roundedClass.version);
    expect(normalized[0].id).toBe(roundedClass.id);
    expect(normalized[0]).not.toBe(roundedClass);

    // El otro elemento no se modifica y conserva su referencia
    expect(normalized[1]).toBe(otherElement);
    expect(normalized[1].roundness).toEqual({ type: 3 });
  });

  it("mantiene la misma referencia cuando la clase UML ya tiene roundness: null y texto sin guiones", () => {
    const squareClass = newElement({
      type: "rectangle",
      x: 10,
      y: 20,
      width: 100,
      height: 80,
      roundness: null,
      customData: { type: "umlClass", className: "Pedido", attributes: [], methods: [] },
    });

    const elements = [squareClass];
    const normalized = normalizeUmlClassCorners(elements);

    expect(normalized).toBe(elements);
    expect(normalized[0]).toBe(squareClass);
  });

  it("regenera el texto y renueva versión de contenedor si el texto vinculado contiene guiones '─'", () => {
    const textElement = newTextElement({
      text: "CLIENTE\n──────────────\n+ nombre: String\n──────────────\n+ getNombre(): String",
      x: 10,
      y: 20,
    });

    const container = newElement({
      type: "rectangle",
      x: 10,
      y: 20,
      width: 220,
      height: 140,
      roundness: null,
      boundElements: [{ id: textElement.id, type: "text" }],
      customData: {
        type: "umlClass",
        className: "Cliente",
        attributes: [{ name: "nombre", type: "String", visibility: "public" }],
        methods: [{ name: "getNombre", returnType: "String", visibility: "public" }],
      },
    });

    const elements: ExcalidrawElement[] = [container, textElement];
    const normalized = normalizeUmlClassCorners(elements);

    const normContainer = normalized[0];
    const normText = normalized[1] as any;

    // El contenedor debe haber actualizado su versión para forzar re-renderizado
    expect(normContainer.version).toBeGreaterThan(container.version);

    // El texto vinculado ya no debe contener "─"
    expect(normText.text).not.toContain("─");
    expect(normText.text).toContain("+ nombre: String");
    expect(normText.text).toContain("+ getNombre(): String");

    // Debe contener renglones vacíos donde antes estaban los separadores
    const lines = normText.text.split("\n");
    expect(lines[1]).toBe("");
    expect(lines[3]).toBe("");
  });

  it("mantiene la misma referencia para listas vacías o elementos sin clases UML", () => {
    const textEl = newElement({
      type: "text",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });

    const elements = [textEl];
    const normalized = normalizeUmlClassCorners(elements);

    expect(normalized).toBe(elements);
    expect(normalized[0]).toBe(textEl);
  });
});
