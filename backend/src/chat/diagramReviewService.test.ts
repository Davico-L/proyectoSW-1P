import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { reviewDiagramInRoom } from "./diagramReviewService";
import {
  formatEmptyDiagramMessage,
  formatNoFindingsMessage,
  formatFindingsFallback,
  MAX_CHAT_MESSAGE_LENGTH,
} from "./diagramReview";
import { UmlModel } from "../backendGenerator/types";

describe("CU21: diagramReviewService", () => {
  // Modelo limpio (sin observaciones): clases con 'id' y multiplicidades completas
  const modelClean: UmlModel = {
    classes: [
      {
        id: "c1",
        className: "Cliente",
        attributes: [{ name: "id", type: "Integer", visibility: "public" }],
        methods: [],
      },
      {
        id: "c2",
        className: "Pedido",
        attributes: [{ name: "id", type: "Integer", visibility: "public" }],
        methods: [],
      },
    ],
    relations: [
      {
        relationType: "association",
        sourceClassId: "c1",
        targetClassId: "c2",
        multiplicitySource: "1",
        multiplicityTarget: "*",
      },
    ],
  };

  // Modelo con observaciones: clase sin atributos (R1) y primer atributo que no es id (R2)
  const modelWithFindings: UmlModel = {
    classes: [
      {
        id: "c1",
        className: "Producto",
        attributes: [],
        methods: [],
      },
      {
        id: "c2",
        className: "Factura",
        attributes: [
          { name: "total", type: "Double", visibility: "public" },
          { name: "id", type: "Integer", visibility: "public" },
        ],
        methods: [],
      },
    ],
    relations: [],
  };

  test("1. Modelo vacío: devuelve formatEmptyDiagramMessage y NO llama a la IA", async () => {
    let chatCalled = false;

    // Caso A: model es null
    const resultNull = await reviewDiagramInRoom(
      { diagramId: "d-empty-1", askerName: "Ana" },
      {
        getDiagramModel: async () => null,
        chat: async () => {
          chatCalled = true;
          return "respuesta que no debería ocurrir";
        },
      }
    );

    assert.equal(chatCalled, false);
    assert.equal(resultNull.message, formatEmptyDiagramMessage("Ana"));
    assert.equal(resultNull.findings, undefined);

    // Caso B: model con classes array vacío
    const resultEmptyClasses = await reviewDiagramInRoom(
      { diagramId: "d-empty-2", askerName: "Carlos" },
      {
        getDiagramModel: async () => ({ classes: [], relations: [] }),
        chat: async () => {
          chatCalled = true;
          return "otra respuesta";
        },
      }
    );

    assert.equal(chatCalled, false);
    assert.equal(resultEmptyClasses.message, formatEmptyDiagramMessage("Carlos"));
    assert.equal(resultEmptyClasses.findings, undefined);
  });

  test("2. Modelo sin observaciones: devuelve formatNoFindingsMessage y NO llama a la IA", async () => {
    let chatCalled = false;

    const result = await reviewDiagramInRoom(
      { diagramId: "d-clean", askerName: "Luis" },
      {
        getDiagramModel: async () => modelClean,
        chat: async () => {
          chatCalled = true;
          return "no debería ser llamado";
        },
      }
    );

    assert.equal(chatCalled, false);
    assert.equal(result.message, formatNoFindingsMessage("Luis"));
    assert.equal(result.findings, undefined);
  });

  test("3. Modelo con observaciones y respuesta normal de la IA: mensaje dirigido, sin saludo, sin markdown y con findings", async () => {
    let capturedSystemPrompt = "";
    let capturedUserContent = "";
    let chatCalled = false;

    const result = await reviewDiagramInRoom(
      { diagramId: "d-findings", askerName: "Ana" },
      {
        getDiagramModel: async () => modelWithFindings,
        chat: async (sys, user) => {
          chatCalled = true;
          capturedSystemPrompt = sys;
          capturedUserContent = user;
          // Respuesta que incluye saludo inicial y texto normal
          return "Hola Ana. Revisé el diagrama y encontré que Producto no tiene atributos. Te sugiero agregar el atributo id. En Factura el primer atributo es total en vez de id.";
        },
      }
    );

    assert.equal(chatCalled, true);
    assert.ok(capturedSystemPrompt.includes("Eres Codia"));
    assert.equal(capturedSystemPrompt.includes("Idea:"), false);
    assert.ok(capturedUserContent.includes("Hay exactamente 3 observaciones."));
    assert.ok(capturedUserContent.includes("Observaciones detectadas automáticamente"));
    assert.ok(capturedUserContent.includes("Producto"));

    // Dirigido al autor por su nombre
    assert.ok(
      result.message.startsWith("Ana,") || result.message.startsWith("Ana:"),
      `El mensaje debe comenzar nombrándolo: ${result.message}`
    );

    // Sin saludo ('Hola Ana' debe ser despojado por stripGreetingPreamble)
    assert.equal(
      /hola\s+ana/i.test(result.message),
      false,
      `No debe incluir saludo de bienvenida: ${result.message}`
    );

    // Sin markdown (sin asteriscos, almohadillas, tildes invertidas)
    assert.equal(/[*#`_]/.test(result.message), false);

    // Retorna findings
    assert.ok(Array.isArray(result.findings));
    assert.ok(result.findings!.length > 0);
    const codes = result.findings!.map((f) => f.code);
    assert.ok(codes.includes("R1") || codes.includes("R2"));
  });

  test("4. La IA falla (lanza error): devuelve formatFindingsFallback con las observaciones", async () => {
    const result = await reviewDiagramInRoom(
      { diagramId: "d-findings", askerName: "David" },
      {
        getDiagramModel: async () => modelWithFindings,
        chat: async () => {
          throw new Error("503 Service Unavailable / Timeout");
        },
      }
    );

    assert.ok(Array.isArray(result.findings));
    assert.ok(result.findings!.length > 0);
    assert.equal(
      result.message,
      formatFindingsFallback(result.findings!, "David")
    );
    assert.ok(result.message.includes("David, revisé el diagrama"));
  });

  test("5. La IA devuelve vacío o solo espacios: devuelve formatFindingsFallback", async () => {
    // Caso vacío
    const resultEmpty = await reviewDiagramInRoom(
      { diagramId: "d-findings", askerName: "Elena" },
      {
        getDiagramModel: async () => modelWithFindings,
        chat: async () => "    \n\t   ",
      }
    );

    assert.ok(Array.isArray(resultEmpty.findings));
    assert.equal(
      resultEmpty.message,
      formatFindingsFallback(resultEmpty.findings!, "Elena")
    );

    // Caso nulo / undefined como string
    const resultNullString = await reviewDiagramInRoom(
      { diagramId: "d-findings", askerName: "Elena" },
      {
        getDiagramModel: async () => modelWithFindings,
        chat: async () => "" as any,
      }
    );

    assert.ok(Array.isArray(resultNullString.findings));
    assert.equal(
      resultNullString.message,
      formatFindingsFallback(resultNullString.findings!, "Elena")
    );
  });

  test("6. El mensaje final nunca supera 2000 caracteres (MAX_CHAT_MESSAGE_LENGTH)", async () => {
    // Simulamos respuesta de IA larguísima (> 3000 caracteres)
    const longAiReply = "Esta es una observación muy detallada. ".repeat(150);

    const result = await reviewDiagramInRoom(
      { diagramId: "d-findings", askerName: "Marcos" },
      {
        getDiagramModel: async () => modelWithFindings,
        chat: async () => longAiReply,
      }
    );

    assert.ok(result.message.length <= MAX_CHAT_MESSAGE_LENGTH);
    assert.ok(result.message.length <= 2000);
  });
});
