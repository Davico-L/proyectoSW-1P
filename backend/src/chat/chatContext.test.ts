import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatModelCompact, buildChatContext } from "./chatContext";
import { UmlModel } from "../backendGenerator/types";

describe("CU19: chatContext", () => {
  describe("formatModelCompact", () => {
    test("modelo vacío: devuelve 'El diagrama está vacío.'", () => {
      assert.equal(formatModelCompact(null), "El diagrama está vacío.");
      assert.equal(formatModelCompact(undefined), "El diagrama está vacío.");
      assert.equal(
        formatModelCompact({ classes: [], relations: [] }),
        "El diagrama está vacío."
      );
    });

    test("un modelo con 2 clases y 1 relación", () => {
      const model: UmlModel = {
        classes: [
          {
            id: "id-cliente",
            className: "Cliente",
            attributes: [
              { name: "id", type: "Integer", visibility: "public" },
              { name: "nombre", type: "String", visibility: "public" },
            ],
            methods: [],
          },
          {
            id: "id-pedido",
            className: "Pedido",
            attributes: [
              { name: "id", type: "Integer", visibility: "public" },
              { name: "total", type: "Double", visibility: "public" },
            ],
            methods: [
              { name: "cancelar", returnType: "void", visibility: "public" },
            ],
          },
        ],
        relations: [
          {
            relationType: "association",
            sourceClassId: "id-cliente",
            targetClassId: "id-pedido",
            multiplicitySource: "1",
            multiplicityTarget: "*",
          },
        ],
      };

      const result = formatModelCompact(model);
      assert.equal(
        result,
        "Cliente(id: Integer, nombre: String); Pedido(id: Integer, total: Double, cancelar(): void); relaciones: Cliente 1 — * Pedido (asociación)"
      );
    });

    test("más de 40 clases: corta a 40 y agrega (+N clases omitidas)", () => {
      const classes = Array.from({ length: 45 }, (_, i) => ({
        id: `cls-${i + 1}`,
        className: `Clase${i + 1}`,
        attributes: [{ name: "id", type: "Integer", visibility: "public" }],
        methods: [],
      }));

      const model: UmlModel = {
        classes,
        relations: [],
      };

      const result = formatModelCompact(model);
      assert.match(result, /Clase1\(id: Integer\)/);
      assert.match(result, /Clase40\(id: Integer\)/);
      assert.doesNotMatch(result, /Clase41\(/);
      assert.match(result, /\(\+5 clases omitidas\)/);
    });

    test("relación con id inexistente: se omite sin fallar", () => {
      const model: UmlModel = {
        classes: [
          {
            id: "c1",
            className: "Factura",
            attributes: [{ name: "numero", type: "String", visibility: "public" }],
            methods: [],
          },
        ],
        relations: [
          {
            relationType: "association",
            sourceClassId: "c1",
            targetClassId: "id-fantasma",
            multiplicitySource: "1",
            multiplicityTarget: "1",
          },
          {
            relationType: "inheritance",
            sourceClassId: "id-fantasma-2",
            targetClassId: "c1",
            multiplicitySource: "",
            multiplicityTarget: "",
          },
        ],
      };

      const result = formatModelCompact(model);
      assert.equal(result, "Factura(numero: String)");
      assert.doesNotMatch(result, /relaciones:/);
    });
  });

  describe("buildChatContext", () => {
    test("más de 6 mensajes: toma solo los últimos 6, rotula 'solo contexto' y separa con línea en blanco", () => {
      const recentMessages = Array.from({ length: 10 }, (_, i) => ({
        authorName: `User${i + 1}`,
        text: `Mensaje número ${i + 1}`,
      }));

      const context = buildChatContext({
        modelCompact: "Cliente(id: Integer)",
        recentMessages,
        askerName: "Davico",
        question: "¿Cómo funciona el modelo?",
      });

      // No deben aparecer los primeros 4 mensajes (1 a 4)
      assert.doesNotMatch(context, /User1: Mensaje número 1\b/);
      assert.doesNotMatch(context, /User4: Mensaje número 4\b/);

      // Deben aparecer del 5 al 10 (últimos 6 mensajes)
      assert.match(context, /User5: Mensaje número 5/);
      assert.match(context, /User10: Mensaje número 10/);

      // Verificación de estructura y rotulación
      assert.match(context, /^Diagrama actual: Cliente\(id: Integer\)/);
      assert.match(context, /Conversación reciente \(solo contexto\):\n/);
      // Claramente separada al final con una línea en blanco antes
      assert.match(context, /\n\nPregunta de Davico: ¿Cómo funciona el modelo\?$/);
    });

    test("mensaje de más de 250 caracteres: se recorta a 250 caracteres", () => {
      const longText = "A".repeat(300);
      const recentMessages = [
        {
          authorName: "Ana",
          text: longText,
        },
      ];

      const context = buildChatContext({
        modelCompact: "Pedido(id: Integer)",
        recentMessages,
        askerName: "Luis",
        question: "¿Qué opinas?",
      });

      const expectedTruncated = "A".repeat(250);
      assert.match(context, new RegExp(`Ana: ${expectedTruncated}`));
      assert.doesNotMatch(context, new RegExp(`Ana: ${expectedTruncated}A`));
      assert.match(context, /\n\nPregunta de Luis: ¿Qué opinas\?$/);
    });

    test("lista de mensajes vacía: omite el bloque de Conversación reciente", () => {
      const context = buildChatContext({
        modelCompact: "El diagrama está vacío.",
        recentMessages: [],
        askerName: "Davico",
        question: "¿Qué diagramas tenemos?",
      });

      assert.doesNotMatch(context, /Conversación reciente/);
      assert.match(context, /^Diagrama actual: El diagrama está vacío\./);
      assert.match(context, /\n\nPregunta de Davico: ¿Qué diagramas tenemos\?$/);
    });

    test("mensajes previos de la IA (role 'ai'): quita prefijo '{addressedTo}, ' y despoja saludo/presentación", () => {
      const recentMessages = [
        {
          authorName: "Davico",
          role: "user",
          text: "¿Qué es una clase abstracta?",
        },
        {
          authorName: "Codia",
          role: "ai",
          addressedTo: "Davico",
          text: "Davico, ¡Hola! Soy Codia, la desarrolladora senior y mentora del equipo. Una clase abstracta es una clase que no puede instanciarse.",
        },
      ];

      const context = buildChatContext({
        modelCompact: "Cliente(id: Integer)",
        recentMessages,
        askerName: "Davico",
        question: "¿Y cómo se dibuja?",
      });

      assert.match(context, /Conversación reciente \(solo contexto\):/);
      // El mensaje de Davico se mantiene normal
      assert.match(context, /Davico: ¿Qué es una clase abstracta\?/);
      // El mensaje de Codia NO debe contener "Davico, ", ni "¡Hola!", ni "Soy Codia..."
      assert.match(context, /Codia: Una clase abstracta es una clase que no puede instanciarse\./);
      assert.doesNotMatch(context, /Codia: Davico,/);
      assert.doesNotMatch(context, /¡Hola!/);
      assert.doesNotMatch(context, /Soy Codia/);
    });
  });
});
