import { describe, it, expect } from "vitest";
import { formatImportSummary } from "./formatImportSummary";

describe("formatImportSummary", () => {
  it("debe formatear singular de clase y relación sin elementos ignorados ni descartados", () => {
    const text = formatImportSummary({
      classes: 1,
      relations: 1,
      ignoredElements: 0,
      discardedRelations: 0,
    });
    expect(text).toBe("1 clase y 1 relación importadas");
  });

  it("debe formatear plural de clases y relaciones sin elementos ignorados ni descartados", () => {
    const text = formatImportSummary({
      classes: 6,
      relations: 5,
      ignoredElements: 0,
      discardedRelations: 0,
    });
    expect(text).toBe("6 clases y 5 relaciones importadas");
  });

  it("debe formatear con 1 elemento ignorado (singular)", () => {
    const text = formatImportSummary({
      classes: 3,
      relations: 2,
      ignoredElements: 1,
      discardedRelations: 0,
    });
    expect(text).toBe(
      "3 clases y 2 relaciones importadas; 1 elemento no soportado fue ignorado"
    );
  });

  it("debe formatear con múltiples elementos ignorados (plural)", () => {
    const text = formatImportSummary({
      classes: 5,
      relations: 6,
      ignoredElements: 2,
      discardedRelations: 0,
    });
    expect(text).toBe(
      "5 clases y 6 relaciones importadas; 2 elementos no soportados fueron ignorados"
    );
  });

  it("debe formatear con 1 relación descartada (singular)", () => {
    const text = formatImportSummary({
      classes: 2,
      relations: 1,
      ignoredElements: 0,
      discardedRelations: 1,
    });
    expect(text).toBe(
      "2 clases y 1 relación importadas; 1 relación descartada por referenciar una clase inexistente"
    );
  });

  it("debe formatear con múltiples relaciones descartadas (plural)", () => {
    const text = formatImportSummary({
      classes: 4,
      relations: 2,
      ignoredElements: 0,
      discardedRelations: 3,
    });
    expect(text).toBe(
      "4 clases y 2 relaciones importadas; 3 relaciones descartadas por referenciar una clase inexistente"
    );
  });

  it("debe formatear singular en todas las partes (1 clase, 1 relación, 1 ignorado, 1 descartado)", () => {
    const text = formatImportSummary({
      classes: 1,
      relations: 1,
      ignoredElements: 1,
      discardedRelations: 1,
    });
    expect(text).toBe(
      "1 clase y 1 relación importadas; 1 elemento no soportado fue ignorado; 1 relación descartada por referenciar una clase inexistente"
    );
  });

  it("debe formatear plural completo con ignorados y descartados", () => {
    const text = formatImportSummary({
      classes: 10,
      relations: 8,
      ignoredElements: 4,
      discardedRelations: 2,
    });
    expect(text).toBe(
      "10 clases y 8 relaciones importadas; 4 elementos no soportados fueron ignorados; 2 relaciones descartadas por referenciar una clase inexistente"
    );
  });

  it("debe manejar 0 relaciones correctamente", () => {
    const text = formatImportSummary({
      classes: 2,
      relations: 0,
      ignoredElements: 0,
      discardedRelations: 0,
    });
    expect(text).toBe("2 clases y 0 relaciones importadas");
  });
});
