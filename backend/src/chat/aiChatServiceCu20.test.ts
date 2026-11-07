import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createAiChatService } from "./aiChatService";
import { UmlModel } from "../backendGenerator/types";

describe("CU20: aiChatService con modificaciones de diagrama", () => {
  const sampleModel: UmlModel = {
    classes: [
      {
        id: "c1",
        className: "Cliente",
        attributes: [{ name: "id", type: "Integer", visibility: "public" }],
        methods: [],
      },
    ],
    relations: [],
  };

  test("1. Consulta ('¿cómo agrego una clase?') sin cambios responde como en CU19", async () => {
    let chatCalled = false;
    let editCalled = false;

    const service = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      chat: async () => {
        chatCalled = true;
        return "Para agregar una clase usa el botón en el menú.";
      },
      requestDiagramEdit: async () => {
        editCalled = true;
        return { status: "ready", validOperations: [], warnings: [], provider: "mock", fallback: false };
      },
    });

    const result = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Ana",
      askerMessageId: "m1",
      question: "¿cómo agrego una clase?",
      onOperations: async () => ({ applied: 1, failed: 0 }),
    });

    assert.equal(chatCalled, true);
    assert.equal(editCalled, false);
    assert.equal(result.kind, "answer");
    assert.deepEqual(result.operations, []);
    assert.equal(result.message, "Ana, para agregar una clase usa el botón en el menú.");
  });

  test("2. Modificación con callback { applied: 1, failed: 0 } genera plantilla de confirmación y kind modification", async () => {
    let editParams: any = null;
    let onOpsParams: any = null;

    const service = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      chat: async () => "no deberia llamarse",
      requestDiagramEdit: async (params) => {
        editParams = params;
        return {
          status: "ready",
          validOperations: [
            { action: "createClass", className: "Cliente" },
          ],
          warnings: [],
          provider: "mock",
          fallback: false,
        };
      },
    });

    const result = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Davico",
      askerMessageId: "m2",
      question: "agrega la clase Cliente",
      onOperations: async (ops, warnings) => {
        onOpsParams = { ops, warnings };
        return { applied: 1, failed: 0 };
      },
    });

    assert.deepEqual(editParams, { diagramId: "d1", instruction: "agrega la clase Cliente" });
    assert.equal(onOpsParams.ops.length, 1);
    assert.equal(result.kind, "modification");
    assert.equal(result.operations.length, 1);
    assert.equal(result.warnings?.length, 0);
    assert.match(result.message, /^Davico, creé la clase Cliente\.$/);
  });

  test("3. Modificación donde el callback devuelve null (timeout/desconexión) devuelve aviso y kind answer", async () => {
    const service = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      chat: async () => "no deberia llamarse",
      requestDiagramEdit: async () => ({
        status: "ready",
        validOperations: [{ action: "createClass", className: "Cliente" }],
        warnings: [],
        provider: "mock",
        fallback: false,
      }),
    });

    const result = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Carlos",
      askerMessageId: "m3",
      question: "agrega la clase Cliente",
      onOperations: async () => null,
    });

    assert.equal(result.kind, "answer");
    assert.deepEqual(result.operations, []);
    assert.match(result.message, /Carlos, no pude aplicar los cambios al diagrama.*repite tu pedido/i);
  });

  test("4. Modificación donde el callback devuelve { applied: 0, failed: 1 } devuelve aviso y kind answer", async () => {
    const service = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      chat: async () => "no deberia llamarse",
      requestDiagramEdit: async () => ({
        status: "ready",
        validOperations: [{ action: "createClass", className: "Cliente" }],
        warnings: [],
        provider: "mock",
        fallback: false,
      }),
    });

    const result = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Carlos",
      askerMessageId: "m4",
      question: "agrega la clase Cliente",
      onOperations: async () => ({ applied: 0, failed: 1 }),
    });

    assert.equal(result.kind, "answer");
    assert.deepEqual(result.operations, []);
    assert.match(result.message, /Carlos, no pude aplicar los cambios al diagrama.*repite tu pedido/i);
  });

  test("5. Modificación donde el callback devuelve { applied: 1, failed: 1 } añade conteo de fallidos y kind modification", async () => {
    const service = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      chat: async () => "no deberia llamarse",
      requestDiagramEdit: async () => ({
        status: "ready",
        validOperations: [
          { action: "createClass", className: "Cliente" },
          { action: "createClass", className: "Pedido" },
        ],
        warnings: [],
        provider: "mock",
        fallback: false,
      }),
    });

    const result = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Elena",
      askerMessageId: "m5",
      question: "agrega las clases Cliente y Pedido",
      onOperations: async () => ({ applied: 1, failed: 1 }),
    });

    assert.equal(result.kind, "modification");
    assert.equal(result.operations.length, 2);
    assert.match(result.message, /Elena, creé la clase Cliente y creé la clase Pedido/);
    assert.match(result.message, /\(1 cambio no se pudo aplicar\)\./);
  });

  test("6. Caso noChanges cae al camino de consulta con chatReply", async () => {
    let chatCalled = false;

    const service = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      chat: async () => {
        chatCalled = true;
        return "El modelo ya está actualizado.";
      },
      requestDiagramEdit: async () => ({
        status: "noChanges",
      }),
    });

    const result = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Marcos",
      askerMessageId: "m6",
      question: "agrega lo que consideres",
      onOperations: async () => ({ applied: 1, failed: 0 }),
    });

    assert.equal(chatCalled, true);
    assert.equal(result.kind, "answer");
    assert.deepEqual(result.operations, []);
    assert.equal(result.message, "Marcos, el modelo ya está actualizado.");
  });

  test("7. Caso onlyWarnings devuelve los avisos y kind answer", async () => {
    const service = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      chat: async () => "no deberia llamarse",
      requestDiagramEdit: async () => ({
        status: "onlyWarnings",
        warnings: ["La clase Pedido ya existe en el diagrama."],
      }),
    });

    const result = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Sofia",
      askerMessageId: "m7",
      question: "agrega la clase Pedido",
      onOperations: async () => ({ applied: 1, failed: 0 }),
    });

    assert.equal(result.kind, "answer");
    assert.deepEqual(result.operations, []);
    assert.match(result.message, /Sofia, no se aplicaron cambios: La clase Pedido ya existe en el diagrama\./);
  });

  test("8. Caso tooMany devuelve mensaje para dividir el pedido y kind answer", async () => {
    const service = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      chat: async () => "no deberia llamarse",
      requestDiagramEdit: async () => ({
        status: "tooMany",
        message:
          "El pedido genera 12 cambios. El máximo permitido por pedido es 10. Por favor, divide tu pedido en cambios más pequeños.",
      }),
    });

    const result = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Lucia",
      askerMessageId: "m8",
      question: "crea 12 clases",
      onOperations: async () => ({ applied: 1, failed: 0 }),
    });

    assert.equal(result.kind, "answer");
    assert.deepEqual(result.operations, []);
    assert.match(
      result.message,
      /Lucia, el pedido genera 12 cambios\. El máximo permitido por pedido es 10\./
    );
  });

  test("9. Caso diagramNotFound devuelve aviso de diagrama no encontrado y kind answer", async () => {
    const service = createAiChatService({
      getDiagramModel: async () => null,
      listRecentMessages: async () => [],
      chat: async () => "no deberia llamarse",
      requestDiagramEdit: async () => ({
        status: "diagramNotFound",
      }),
    });

    const result = await service.answerInRoom({
      diagramId: "missing-diagram",
      askerName: "Tomas",
      askerMessageId: "m9",
      question: "crea la clase Factura",
      onOperations: async () => ({ applied: 1, failed: 0 }),
    });

    assert.equal(result.kind, "answer");
    assert.deepEqual(result.operations, []);
    assert.match(result.message, /Tomas, no encontré el diagrama/);
  });

  test("10. El turno de la cola se mantiene hasta que onOperations responde", async () => {
    const order: string[] = [];
    let resolveFirstOp!: (res: { applied: number; failed: number }) => void;
    const firstOpPromise = new Promise<{ applied: number; failed: number }>((res) => {
      resolveFirstOp = res;
    });

    const service = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      chat: async () => "no deberia llamarse",
      requestDiagramEdit: async (params) => {
        order.push(`edit:${params.instruction}`);
        return {
          status: "ready",
          validOperations: [{ action: "createClass", className: "C" }],
          warnings: [],
          provider: "mock",
          fallback: false,
        };
      },
    });

    const p1 = service.answerInRoom({
      diagramId: "d1",
      askerName: "User1",
      askerMessageId: "m10",
      question: "agrega la clase C1",
      onOperations: async () => {
        order.push("onOps1:start");
        const res = await firstOpPromise;
        order.push("onOps1:end");
        return res;
      },
    });

    // Pequeño retardo para asegurar que p1 entró en ejecución
    await new Promise((r) => setTimeout(r, 20));

    const p2 = service.answerInRoom({
      diagramId: "d1",
      askerName: "User2",
      askerMessageId: "m11",
      question: "agrega la clase C2",
      onOperations: async () => {
        order.push("onOps2:done");
        return { applied: 1, failed: 0 };
      },
    });

    // p2 no debe haber comenzado aún porque p1 está esperando firstOpPromise en su turno de cola
    await new Promise((r) => setTimeout(r, 30));
    assert.deepEqual(order, ["edit:agrega la clase C1", "onOps1:start"]);

    // Ahora resolvemos la primera operación
    resolveFirstOp({ applied: 1, failed: 0 });

    const [res1, res2] = await Promise.all([p1, p2]);

    assert.equal(res1.kind, "modification");
    assert.equal(res2.kind, "modification");
    assert.deepEqual(order, [
      "edit:agrega la clase C1",
      "onOps1:start",
      "onOps1:end",
      "edit:agrega la clase C2",
      "onOps2:done",
    ]);
  });

  test("11. Si no se pasa onOperations, todo sigue funcionando como en CU19 (regresión cero)", async () => {
    let chatCalled = false;
    let editCalled = false;

    const service = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      chat: async () => {
        chatCalled = true;
        return "Respuesta de CU19 tradicional.";
      },
      requestDiagramEdit: async () => {
        editCalled = true;
        return { status: "ready", validOperations: [], warnings: [], provider: "mock", fallback: false };
      },
    });

    // Aunque la frase sea de modificación ("agrega la clase Cliente"), sin onOperations va por consulta
    const result = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Clara",
      askerMessageId: "m12",
      question: "agrega la clase Cliente",
    });

    assert.equal(chatCalled, true);
    assert.equal(editCalled, false);
    assert.equal(result.kind, "answer");
    assert.deepEqual(result.operations, []);
    assert.equal(result.message, "Clara, respuesta de CU19 tradicional.");
  });
});
