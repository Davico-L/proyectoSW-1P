import { describe, it, expect, vi } from "vitest";
import {
  BoundedSet,
  validateAiOperations,
  calculateOperationCounts,
  hasCodiaMention,
  saveDiagramWithTimeout,
} from "./aiOperationsHandler";

describe("CU20 Fase 3: aiOperationsHandler", () => {
  describe("BoundedSet", () => {
    it("almacena elementos y verifica pertenencia", () => {
      const set = new BoundedSet<string>(3);
      set.add("m1");
      set.add("m2");

      expect(set.has("m1")).toBe(true);
      expect(set.has("m2")).toBe(true);
      expect(set.has("m3")).toBe(false);
      expect(set.size).toBe(2);
    });

    it("no duplica elementos existentes", () => {
      const set = new BoundedSet<string>(3);
      set.add("m1");
      set.add("m1");

      expect(set.size).toBe(1);
    });

    it("desaloja el elemento más antiguo al superar el tope (FIFO)", () => {
      const set = new BoundedSet<string>(3);
      set.add("m1");
      set.add("m2");
      set.add("m3");
      set.add("m4"); // Debe desalojar m1

      expect(set.has("m1")).toBe(false);
      expect(set.has("m2")).toBe(true);
      expect(set.has("m3")).toBe(true);
      expect(set.has("m4")).toBe(true);
      expect(set.size).toBe(3);
    });

    it("limpia todos los elementos con clear()", () => {
      const set = new BoundedSet<string>(3);
      set.add("m1");
      set.clear();

      expect(set.has("m1")).toBe(false);
      expect(set.size).toBe(0);
    });
  });

  describe("validateAiOperations", () => {
    it("si ya se procesó el messageId, responde ack { applied: 0, failed: 0 } sin aplicar", () => {
      const result = validateAiOperations({
        payload: {
          messageId: "msg-1",
          diagramId: "diag-1",
          operations: [{ action: "createClass" }],
        },
        activeDiagramId: "diag-1",
        hasExcalidrawApi: true,
        isAlreadyProcessed: true,
      });

      expect(result.canApply).toBe(false);
      expect(result.reason).toBe("already_processed");
      expect(result.ack).toEqual({ applied: 0, failed: 0 });
    });

    it("si el payload es inválido o no es objeto, responde ack { applied: 0, failed: 0 }", () => {
      const result = validateAiOperations({
        payload: null,
        activeDiagramId: "diag-1",
        hasExcalidrawApi: true,
        isAlreadyProcessed: false,
      });

      expect(result.canApply).toBe(false);
      expect(result.reason).toBe("invalid_payload");
      expect(result.ack).toEqual({ applied: 0, failed: 0 });
    });

    it("si el diagramId no coincide con el diagrama abierto, responde { applied: 0, failed: operations.length }", () => {
      const result = validateAiOperations({
        payload: {
          messageId: "msg-2",
          diagramId: "otro-diag",
          operations: [{ action: "createClass" }, { action: "deleteClass" }],
        },
        activeDiagramId: "diag-activo",
        hasExcalidrawApi: true,
        isAlreadyProcessed: false,
      });

      expect(result.canApply).toBe(false);
      expect(result.reason).toBe("diagram_mismatch");
      expect(result.ack).toEqual({ applied: 0, failed: 2 });
    });

    it("si no hay excalidrawAPI disponible, responde { applied: 0, failed: operations.length }", () => {
      const result = validateAiOperations({
        payload: {
          messageId: "msg-3",
          diagramId: "diag-1",
          operations: [{ action: "createClass" }],
        },
        activeDiagramId: "diag-1",
        hasExcalidrawApi: false,
        isAlreadyProcessed: false,
      });

      expect(result.canApply).toBe(false);
      expect(result.reason).toBe("no_api");
      expect(result.ack).toEqual({ applied: 0, failed: 1 });
    });

    it("si operations no es un arreglo, responde { applied: 0, failed: 0 }", () => {
      const result = validateAiOperations({
        payload: {
          messageId: "msg-4",
          diagramId: "diag-1",
          operations: "no-es-arreglo",
        },
        activeDiagramId: "diag-1",
        hasExcalidrawApi: true,
        isAlreadyProcessed: false,
      });

      expect(result.canApply).toBe(false);
      expect(result.reason).toBe("invalid_operations");
      expect(result.ack).toEqual({ applied: 0, failed: 0 });
    });

    it("si se cumplen todas las precondiciones, retorna canApply: true", () => {
      const result = validateAiOperations({
        payload: {
          messageId: "msg-5",
          diagramId: "diag-1",
          operations: [{ action: "createClass", className: "Cliente" }],
        },
        activeDiagramId: "diag-1",
        hasExcalidrawApi: true,
        isAlreadyProcessed: false,
      });

      expect(result.canApply).toBe(true);
      expect(result.ack).toBeUndefined();
    });
  });

  describe("calculateOperationCounts", () => {
    it("calcula applied para resultados no-skipped y failed para los demás", () => {
      const results: Array<{ status: "applied" | "skipped" }> = [
        { status: "applied" },
        { status: "applied" },
        { status: "skipped" },
      ];
      const counts = calculateOperationCounts(results, 3);
      expect(counts).toEqual({ applied: 2, failed: 1 });
    });

    it("cuando todas las operaciones son aplicadas", () => {
      const results: Array<{ status: "applied" | "skipped" }> = [
        { status: "applied" },
      ];
      const counts = calculateOperationCounts(results, 1);
      expect(counts).toEqual({ applied: 1, failed: 0 });
    });

    it("cuando todas las operaciones son omitidas (skipped)", () => {
      const results: Array<{ status: "applied" | "skipped" }> = [
        { status: "skipped" },
        { status: "skipped" },
      ];
      const counts = calculateOperationCounts(results, 2);
      expect(counts).toEqual({ applied: 0, failed: 2 });
    });

    it("cuando se recibieron menos resultados que operaciones enviadas", () => {
      const results: Array<{ status: "applied" | "skipped" }> = [
        { status: "applied" },
      ];
      const counts = calculateOperationCounts(results, 3);
      expect(counts).toEqual({ applied: 1, failed: 2 });
    });

    it("con lista vacía", () => {
      const counts = calculateOperationCounts([], 0);
      expect(counts).toEqual({ applied: 0, failed: 0 });
    });
  });

  describe("hasCodiaMention", () => {
    it("detecta mención a @Codia o @ia en cualquier posición", () => {
      expect(hasCodiaMention("@Codia crea una clase")).toBe(true);
      expect(hasCodiaMention("@ia agrega el atributo nombre")).toBe(true);
      expect(hasCodiaMention("@codia")).toBe(true);
      expect(hasCodiaMention("@IA")).toBe(true);
      expect(hasCodiaMention("hola @Codia por favor")).toBe(true);
      expect(hasCodiaMention("ayuda @ia.")).toBe(true);
      expect(hasCodiaMention("¿@codia?")).toBe(true);
    });

    it("no confunde correos ni palabras que contengan codia/ia como subcadena", () => {
      expect(hasCodiaMention("usuario@codia.com")).toBe(false);
      expect(hasCodiaMention("contacto@ia.org")).toBe(false);
      expect(hasCodiaMention("@codiax")).toBe(false);
      expect(hasCodiaMention("@iab")).toBe(false);
      expect(hasCodiaMention("mensaje sin mencion")).toBe(false);
      expect(hasCodiaMention("")).toBe(false);
    });
  });

  describe("saveDiagramWithTimeout", () => {
    it("retorna true si la función de guardado completa a tiempo", async () => {
      const fakeSave = vi.fn().mockResolvedValue(undefined);
      const ok = await saveDiagramWithTimeout(fakeSave, 5000);

      expect(ok).toBe(true);
      expect(fakeSave).toHaveBeenCalledTimes(1);
    });

    it("retorna false si la función de guardado falla", async () => {
      const fakeSave = vi.fn().mockRejectedValue(new Error("Network error"));
      const ok = await saveDiagramWithTimeout(fakeSave, 5000);

      expect(ok).toBe(false);
    });

    it("retorna false si la función de guardado supera el tiempo límite", async () => {
      const fakeSave = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 500))
      );
      // Timeout muy corto para probar la expiración
      const ok = await saveDiagramWithTimeout(fakeSave, 50);

      expect(ok).toBe(false);
    });
  });
});
