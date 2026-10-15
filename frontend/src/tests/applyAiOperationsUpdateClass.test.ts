import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  applyAiOperations,
  mergeAttributes,
  mergeMethods,
} from "../aiEdit/applyAiOperations";
import { createUmlClassElement } from "../uml/createUmlClassElement";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { UmlClassData, UmlAttribute, UmlMethod } from "../uml/types";

describe("UC7: Preservación y fusión de atributos y métodos en updateClass", () => {
  let sceneElements: ExcalidrawElement[] = [];
  let mockExcalidrawAPI: ExcalidrawImperativeAPI;

  beforeEach(() => {
    sceneElements = [];

    mockExcalidrawAPI = {
      isDestroyed: false,
      getSceneElements: vi.fn(() => [...sceneElements]),
      updateScene: vi.fn(({ elements }) => {
        sceneElements = [...elements];
      }),
      resetScene: vi.fn(() => {
        sceneElements = [];
      }),
      getAppState: vi.fn(() => ({
        zoom: { value: 1 },
        scrollX: 0,
        scrollY: 0,
        width: 1000,
        height: 800,
      } as any)),
    } as unknown as ExcalidrawImperativeAPI;
  });

  // ==========================================
  // PRUEBAS ESPECÍFICAS DE LAS FUNCIONES DE FUSIÓN
  // ==========================================
  describe("mergeAttributes unit tests", () => {
    it("conserva atributos existentes cuando incomingAttributes es null, undefined o vacío", () => {
      const current: UmlAttribute[] = [
        { name: "id", type: "Integer", visibility: "private" },
      ];

      expect(mergeAttributes(current, null)).toEqual(current);
      expect(mergeAttributes(current, undefined)).toEqual(current);
      expect(mergeAttributes(current, [])).toEqual(current);
      // No mutación
      expect(mergeAttributes(current, null)).not.toBe(current);
    });

    it("agrega nuevos atributos al final conservando el orden", () => {
      const current: UmlAttribute[] = [
        { name: "id", type: "Integer", visibility: "private" },
      ];
      const incoming = [
        { name: "correo", type: "String", visibility: "private" },
      ];

      const merged = mergeAttributes(current, incoming);
      expect(merged).toHaveLength(2);
      expect(merged[0]).toEqual({ name: "id", type: "Integer", visibility: "private" });
      expect(merged[1]).toEqual({ name: "correo", type: "String", visibility: "private" });
    });

    it("actualiza tipo y visibilidad por nombre normalizado (trim y lowercase) sin duplicar", () => {
      const current: UmlAttribute[] = [
        { name: "id", type: "Integer", visibility: "private" },
      ];
      const incoming = [
        { name: "  ID  ", type: "Long" },
      ];

      const merged = mergeAttributes(current, incoming);
      expect(merged).toHaveLength(1);
      expect(merged[0]).toEqual({ name: "id", type: "Long", visibility: "private" });
    });

    it("no sobrescribe propiedades con null o undefined", () => {
      const current: UmlAttribute[] = [
        { name: "saldo", type: "Double", visibility: "protected" },
      ];
      const incoming = [
        { name: "saldo", type: null, visibility: undefined },
      ];

      const merged = mergeAttributes(current, incoming);
      expect(merged).toHaveLength(1);
      expect(merged[0]).toEqual({ name: "saldo", type: "Double", visibility: "protected" });
    });
  });

  describe("mergeMethods unit tests", () => {
    it("conserva métodos existentes cuando incomingMethods es null, undefined o vacío", () => {
      const current: UmlMethod[] = [
        { name: "calcular", returnType: "Double", visibility: "public" },
      ];

      expect(mergeMethods(current, null)).toEqual(current);
      expect(mergeMethods(current, undefined)).toEqual(current);
      expect(mergeMethods(current, [])).toEqual(current);
    });

    it("agrega nuevos métodos al final conservando los existentes", () => {
      const current: UmlMethod[] = [
        { name: "getId", returnType: "Integer", visibility: "public" },
      ];
      const incoming = [
        { name: "getCorreo", returnType: "String", visibility: "public" },
      ];

      const merged = mergeMethods(current, incoming);
      expect(merged).toHaveLength(2);
      expect(merged[0].name).toBe("getId");
      expect(merged[1].name).toBe("getCorreo");
    });

    it("actualiza método existente sin duplicar", () => {
      const current: UmlMethod[] = [
        { name: "calcularTotal", returnType: "Double", visibility: "public" },
      ];
      const incoming = [
        { name: "calcularTotal", returnType: "void", visibility: "private" },
      ];

      const merged = mergeMethods(current, incoming);
      expect(merged).toHaveLength(1);
      expect(merged[0]).toEqual({
        name: "calcularTotal",
        returnType: "void",
        visibility: "private",
      });
    });
  });

  // ==========================================
  // LAS 8 PRUEBAS OBLIGATORIAS DEL REQUERIMIENTO
  // ==========================================

  // 1. Crear Cliente con id: Integer y después agregar correo: String en el mismo lote. Deben conservarse ambos.
  it("Prueba 1: Crear Cliente con id: Integer y después agregar correo: String en el mismo lote", () => {
    const operations = [
      {
        action: "createClass",
        className: "Cliente",
        attributes: [{ name: "id", type: "Integer", visibility: "private" }],
        methods: [],
      },
      {
        action: "updateClass",
        className: "Cliente",
        classId: "pending:Cliente",
        attributes: [{ name: "correo", type: "String", visibility: "private" }],
      },
    ];

    const result = applyAiOperations(operations, mockExcalidrawAPI);
    expect(result.applied).toBe(2);

    const elements = mockExcalidrawAPI.getSceneElements();
    const container = elements.find(
      (el) => !el.isDeleted && el.customData?.type === "umlClass" && el.customData?.className === "Cliente",
    );
    expect(container).toBeDefined();

    const data = container?.customData as UmlClassData;
    expect(data.attributes).toHaveLength(2);
    expect(data.attributes[0]).toEqual({ name: "id", type: "Integer", visibility: "private" });
    expect(data.attributes[1]).toEqual({ name: "correo", type: "String", visibility: "private" });
  });

  // 2. Agregar correo: String a una clase preexistente con id: Integer.
  it("Prueba 2: Agregar correo: String a una clase preexistente con id: Integer", () => {
    const { container, text } = createUmlClassElement(
      {
        type: "umlClass",
        className: "Cliente",
        attributes: [{ name: "id", type: "Integer", visibility: "private" }],
        methods: [],
      },
      { x: 100, y: 100 },
    );
    sceneElements = [container, text];

    const operations = [
      {
        action: "updateClass",
        className: "Cliente",
        classId: container.id,
        attributes: [{ name: "correo", type: "String", visibility: "private" }],
      },
    ];

    const result = applyAiOperations(operations, mockExcalidrawAPI);
    expect(result.applied).toBe(1);

    const updatedContainer = mockExcalidrawAPI
      .getSceneElements()
      .find((el) => !el.isDeleted && el.id === container.id);
    const data = updatedContainer?.customData as UmlClassData;

    expect(data.attributes).toHaveLength(2);
    expect(data.attributes[0]).toEqual({ name: "id", type: "Integer", visibility: "private" });
    expect(data.attributes[1]).toEqual({ name: "correo", type: "String", visibility: "private" });
  });

  // 3. Actualizar el tipo de un atributo existente sin duplicarlo.
  it("Prueba 3: Actualizar el tipo de un atributo existente sin duplicarlo", () => {
    const { container, text } = createUmlClassElement(
      {
        type: "umlClass",
        className: "Cliente",
        attributes: [{ name: "id", type: "Integer", visibility: "private" }],
        methods: [],
      },
      { x: 100, y: 100 },
    );
    sceneElements = [container, text];

    const operations = [
      {
        action: "updateClass",
        className: "Cliente",
        classId: container.id,
        attributes: [{ name: "id", type: "Long" }],
      },
    ];

    const result = applyAiOperations(operations, mockExcalidrawAPI);
    expect(result.applied).toBe(1);

    const updatedContainer = mockExcalidrawAPI
      .getSceneElements()
      .find((el) => !el.isDeleted && el.id === container.id);
    const data = updatedContainer?.customData as UmlClassData;

    expect(data.attributes).toHaveLength(1);
    expect(data.attributes[0]).toEqual({ name: "id", type: "Long", visibility: "private" });
  });

  // 4. Agregar un método conservando los métodos anteriores.
  it("Prueba 4: Agregar un método conservando los métodos anteriores", () => {
    const { container, text } = createUmlClassElement(
      {
        type: "umlClass",
        className: "Factura",
        attributes: [],
        methods: [{ name: "calcularSubtotal", returnType: "Double", visibility: "public" }],
      },
      { x: 100, y: 100 },
    );
    sceneElements = [container, text];

    const operations = [
      {
        action: "updateClass",
        className: "Factura",
        classId: container.id,
        methods: [{ name: "calcularTotal", returnType: "Double", visibility: "public" }],
      },
    ];

    const result = applyAiOperations(operations, mockExcalidrawAPI);
    expect(result.applied).toBe(1);

    const updatedContainer = mockExcalidrawAPI
      .getSceneElements()
      .find((el) => !el.isDeleted && el.id === container.id);
    const data = updatedContainer?.customData as UmlClassData;

    expect(data.methods).toHaveLength(2);
    expect(data.methods[0]).toEqual({ name: "calcularSubtotal", returnType: "Double", visibility: "public" });
    expect(data.methods[1]).toEqual({ name: "calcularTotal", returnType: "Double", visibility: "public" });
  });

  // 5. Actualizar un método existente sin duplicarlo.
  it("Prueba 5: Actualizar un método existente sin duplicarlo", () => {
    const { container, text } = createUmlClassElement(
      {
        type: "umlClass",
        className: "Factura",
        attributes: [],
        methods: [{ name: "calcularTotal", returnType: "Double", visibility: "public" }],
      },
      { x: 100, y: 100 },
    );
    sceneElements = [container, text];

    const operations = [
      {
        action: "updateClass",
        className: "Factura",
        classId: container.id,
        methods: [{ name: "calcularTotal", returnType: "void", visibility: "private" }],
      },
    ];

    const result = applyAiOperations(operations, mockExcalidrawAPI);
    expect(result.applied).toBe(1);

    const updatedContainer = mockExcalidrawAPI
      .getSceneElements()
      .find((el) => !el.isDeleted && el.id === container.id);
    const data = updatedContainer?.customData as UmlClassData;

    expect(data.methods).toHaveLength(1);
    expect(data.methods[0]).toEqual({ name: "calcularTotal", returnType: "void", visibility: "private" });
  });

  // 6. Renombrar una clase sin perder atributos ni métodos.
  it("Prueba 6: Renombrar una clase sin perder atributos ni métodos", () => {
    const { container, text } = createUmlClassElement(
      {
        type: "umlClass",
        className: "Casa",
        attributes: [{ name: "direccion", type: "String", visibility: "private" }],
        methods: [{ name: "abrir", returnType: "void", visibility: "public" }],
      },
      { x: 100, y: 100 },
    );
    sceneElements = [container, text];

    const operations = [
      {
        action: "updateClass",
        className: "Casa",
        newClassName: "Vivienda",
        classId: container.id,
        attributes: undefined,
        methods: undefined,
      },
    ];

    const result = applyAiOperations(operations, mockExcalidrawAPI);
    expect(result.applied).toBe(1);

    const updatedContainer = mockExcalidrawAPI
      .getSceneElements()
      .find((el) => !el.isDeleted && el.id === container.id);
    const data = updatedContainer?.customData as UmlClassData;

    expect(data.className).toBe("Vivienda");
    expect(data.attributes).toHaveLength(1);
    expect(data.attributes[0]).toEqual({ name: "direccion", type: "String", visibility: "private" });
    expect(data.methods).toHaveLength(1);
    expect(data.methods[0]).toEqual({ name: "abrir", returnType: "void", visibility: "public" });
  });

  // 7. Recibir attributes: null y methods: null sin eliminar información.
  it("Prueba 7: Recibir attributes: null y methods: null sin eliminar información", () => {
    const { container, text } = createUmlClassElement(
      {
        type: "umlClass",
        className: "Cliente",
        attributes: [{ name: "id", type: "Integer", visibility: "private" }],
        methods: [{ name: "login", returnType: "Boolean", visibility: "public" }],
      },
      { x: 100, y: 100 },
    );
    sceneElements = [container, text];

    const operations = [
      {
        action: "updateClass",
        className: "Cliente",
        classId: container.id,
        attributes: null,
        methods: null,
      },
    ];

    const result = applyAiOperations(operations, mockExcalidrawAPI);
    expect(result.applied).toBe(1);

    const updatedContainer = mockExcalidrawAPI
      .getSceneElements()
      .find((el) => !el.isDeleted && el.id === container.id);
    const data = updatedContainer?.customData as UmlClassData;

    expect(data.attributes).toHaveLength(1);
    expect(data.attributes[0]).toEqual({ name: "id", type: "Integer", visibility: "private" });
    expect(data.methods).toHaveLength(1);
    expect(data.methods[0]).toEqual({ name: "login", returnType: "Boolean", visibility: "public" });
  });

  // 8. Repetir una operación de adición sin crear duplicados.
  it("Prueba 8: Repetir una operación de adición sin crear duplicados", () => {
    const { container, text } = createUmlClassElement(
      {
        type: "umlClass",
        className: "Cliente",
        attributes: [{ name: "id", type: "Integer", visibility: "private" }],
        methods: [],
      },
      { x: 100, y: 100 },
    );
    sceneElements = [container, text];

    const addEmailOp = {
      action: "updateClass",
      className: "Cliente",
      classId: container.id,
      attributes: [{ name: "correo", type: "String", visibility: "private" }],
    };

    // Primera ejecución
    applyAiOperations([addEmailOp], mockExcalidrawAPI);

    // Segunda ejecución (repetida)
    applyAiOperations([addEmailOp], mockExcalidrawAPI);

    const updatedContainer = mockExcalidrawAPI
      .getSceneElements()
      .find((el) => !el.isDeleted && el.id === container.id);
    const data = updatedContainer?.customData as UmlClassData;

    expect(data.attributes).toHaveLength(2);
    expect(data.attributes[0]).toEqual({ name: "id", type: "Integer", visibility: "private" });
    expect(data.attributes[1]).toEqual({ name: "correo", type: "String", visibility: "private" });
  });
});
