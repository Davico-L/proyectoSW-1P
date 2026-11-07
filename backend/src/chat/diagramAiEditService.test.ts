import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { requestDiagramEdit } from "./diagramAiEditService";

describe("CU20: diagramAiEditService", () => {
  const sampleDiagram = {
    id: "diag-1",
    name: "Diagrama Test",
    data: {
      elements: [],
      appState: {},
    },
  };

  const sampleModel = {
    classes: [
      {
        id: "c-1",
        className: "Cliente",
        attributes: [{ name: "id", type: "Integer", visibility: "public" }],
        methods: [],
      },
      {
        id: "c-2",
        className: "Pedido",
        attributes: [{ name: "id", type: "Integer", visibility: "public" }],
        methods: [],
      },
    ],
    relations: [
      {
        relationType: "association",
        sourceClassId: "c-1",
        targetClassId: "c-2",
        multiplicitySource: "1",
        multiplicityTarget: "*",
      },
    ],
  };

  test("1. Caso 'ready' con aviso incluido: devuelve operaciones válidas, avisos, provider y fallback", async () => {
    let capturedModel: any = null;
    let capturedInstruction = "";

    const deps = {
      getDiagramById: async (id: string) => {
        assert.equal(id, "diag-1");
        return sampleDiagram;
      },
      extractUmlModel: () => sampleModel,
      editWithFallback: async (model: any, instruction: string) => {
        capturedModel = model;
        capturedInstruction = instruction;
        return {
          operations: [
            { action: "createClass", className: "Factura", attributes: [], methods: [] },
            { action: "deleteClass", className: "Inexistente" },
          ],
          provider: "groq" as const,
          fallback: false,
        };
      },
      validateAndResolveOperations: (ops: any[], classes: any[]) => {
        assert.equal(ops.length, 2);
        assert.equal(classes.length, 2);
        return {
          validOperations: [{ action: "createClass", className: "Factura", attributes: [], methods: [] }],
          warnings: ["No encontré la clase 'Inexistente'"],
        };
      },
    };

    const result = await requestDiagramEdit(
      { diagramId: "diag-1", instruction: "  crear Factura y borrar Inexistente  " },
      deps
    );

    assert.equal(result.status, "ready");
    if (result.status === "ready") {
      assert.equal(result.validOperations.length, 1);
      assert.equal(result.validOperations[0].className, "Factura");
      assert.deepEqual(result.warnings, ["No encontré la clase 'Inexistente'"]);
      assert.equal(result.provider, "groq");
      assert.equal(result.fallback, false);
    }

    // Verifica que la instrucción se recortó (trim)
    assert.equal(capturedInstruction, "crear Factura y borrar Inexistente");

    // Verifica la conversión de IDs a nombres en las relaciones del modelo enviado a la IA
    assert.equal(capturedModel.relations.length, 1);
    assert.equal(capturedModel.relations[0].sourceClassName, "Cliente");
    assert.equal(capturedModel.relations[0].targetClassName, "Pedido");
  });

  test("2. Caso 'onlyWarnings': cero operaciones válidas y al menos un aviso", async () => {
    const deps = {
      getDiagramById: async () => sampleDiagram,
      extractUmlModel: () => sampleModel,
      editWithFallback: async () => ({
        operations: [{ action: "deleteClass", className: "Inexistente" }],
        provider: "groq" as const,
        fallback: false,
      }),
      validateAndResolveOperations: () => ({
        validOperations: [],
        warnings: ["No encontré la clase 'Inexistente'"],
      }),
    };

    const result = await requestDiagramEdit(
      { diagramId: "diag-1", instruction: "borrar Inexistente" },
      deps
    );

    assert.equal(result.status, "onlyWarnings");
    if (result.status === "onlyWarnings") {
      assert.deepEqual(result.warnings, ["No encontré la clase 'Inexistente'"]);
      assert.equal(result.provider, "groq");
      assert.equal(result.fallback, false);
    }
  });

  test("3. Caso 'noChanges': cero operaciones y cero avisos (IA no encontró nada que cambiar)", async () => {
    const deps = {
      getDiagramById: async () => sampleDiagram,
      extractUmlModel: () => sampleModel,
      editWithFallback: async () => ({
        operations: [],
        provider: "gemini" as const,
        fallback: true,
      }),
      validateAndResolveOperations: () => ({
        validOperations: [],
        warnings: [],
      }),
    };

    const result = await requestDiagramEdit(
      { diagramId: "diag-1", instruction: "hola Codia" },
      deps
    );

    assert.equal(result.status, "noChanges");
    if (result.status === "noChanges") {
      assert.equal(result.provider, "gemini");
      assert.equal(result.fallback, true);
    }
  });

  test("4. Caso 'tooMany' con 11 operaciones: no valida y devuelve status tooMany con mensaje", async () => {
    let validateCalled = false;

    const elevenOps = Array.from({ length: 11 }, (_, i) => ({
      action: "createClass",
      className: `Clase${i}`,
      attributes: [],
      methods: [],
    }));

    const deps = {
      getDiagramById: async () => sampleDiagram,
      extractUmlModel: () => sampleModel,
      editWithFallback: async () => ({
        operations: elevenOps,
        provider: "groq" as const,
        fallback: false,
      }),
      validateAndResolveOperations: () => {
        validateCalled = true;
        return { validOperations: [], warnings: [] };
      },
    };

    const result = await requestDiagramEdit(
      { diagramId: "diag-1", instruction: "crear 11 clases" },
      deps
    );

    assert.equal(result.status, "tooMany");
    assert.equal(validateCalled, false); // No debe llamar a validación si supera el tope

    if (result.status === "tooMany") {
      assert.equal(result.count, 11);
      assert.match(
        result.message || "",
        /el pedido contiene 11 operaciones y supera el tope máximo de 10/i
      );
      assert.match(
        result.message || "",
        /dividilo en cambios más pequeños/i
      );
    }
  });

  test("5. Caso 'diagramNotFound': devuelve status diagramNotFound si el diagrama no existe", async () => {
    let editCalled = false;

    const deps = {
      getDiagramById: async () => null,
      extractUmlModel: () => sampleModel,
      editWithFallback: async () => {
        editCalled = true;
        return { operations: [], provider: "groq" as const, fallback: false };
      },
      validateAndResolveOperations: () => ({ validOperations: [], warnings: [] }),
    };

    const result = await requestDiagramEdit(
      { diagramId: "diag-inexistente", instruction: "crear Factura" },
      deps
    );

    assert.equal(result.status, "diagramNotFound");
    assert.equal(editCalled, false);
  });

  test("6. Propagación de error de proveedor: no captura el error de editWithFallback", async () => {
    const deps = {
      getDiagramById: async () => sampleDiagram,
      extractUmlModel: () => sampleModel,
      editWithFallback: async () => {
        throw new Error("AI_ALL_PROVIDERS_FAILED");
      },
      validateAndResolveOperations: () => ({ validOperations: [], warnings: [] }),
    };

    await assert.rejects(
      async () => {
        await requestDiagramEdit(
          { diagramId: "diag-1", instruction: "crear Factura" },
          deps
        );
      },
      (err: any) => {
        assert.equal(err.message, "AI_ALL_PROVIDERS_FAILED");
        return true;
      }
    );
  });

  test("7. Pedido no soportado (eliminar atributo): devuelve 'onlyWarnings' sin llamar a editWithFallback", async () => {
    let editCalled = false;

    const deps = {
      getDiagramById: async () => sampleDiagram,
      extractUmlModel: () => sampleModel,
      editWithFallback: async () => {
        editCalled = true;
        return { operations: [], provider: "groq" as const, fallback: false };
      },
      validateAndResolveOperations: () => ({ validOperations: [], warnings: [] }),
    };

    const result = await requestDiagramEdit(
      { diagramId: "diag-1", instruction: "elimina el atributo nombre de la clase Proveedor" },
      deps
    );

    assert.equal(editCalled, false);
    assert.equal(result.status, "onlyWarnings");
    if (result.status === "onlyWarnings") {
      assert.equal(result.warnings.length, 1);
      assert.match(
        result.warnings[0],
        /Por ahora no puedo eliminar atributos ni métodos individuales/i
      );
      assert.match(
        result.warnings[0],
        /Editar Clase UML/i
      );
    }
  });

  test("8. Pedido no soportado (renombrar atributo): devuelve 'onlyWarnings' sin llamar a editWithFallback", async () => {
    let editCalled = false;

    const deps = {
      getDiagramById: async () => sampleDiagram,
      extractUmlModel: () => sampleModel,
      editWithFallback: async () => {
        editCalled = true;
        return { operations: [], provider: "groq" as const, fallback: false };
      },
      validateAndResolveOperations: () => ({ validOperations: [], warnings: [] }),
    };

    const result = await requestDiagramEdit(
      { diagramId: "diag-1", instruction: "renombra el atributo total a montoTotal en Factura" },
      deps
    );

    assert.equal(editCalled, false);
    assert.equal(result.status, "onlyWarnings");
    if (result.status === "onlyWarnings") {
      assert.equal(result.warnings.length, 1);
      assert.match(
        result.warnings[0],
        /Por ahora no puedo renombrar atributos ni métodos individuales/i
      );
      assert.match(
        result.warnings[0],
        /Editar Clase UML/i
      );
    }
  });
});
