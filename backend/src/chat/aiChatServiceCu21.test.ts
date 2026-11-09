import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createAiChatService } from "./aiChatService";
import { UmlModel } from "../backendGenerator/types";

describe("CU21: aiChatService — Enrutamiento y rama 'review'", () => {
  const sampleModelWithFindings: UmlModel = {
    classes: [
      {
        id: "c1",
        className: "Factura",
        attributes: [], // Dispara R1
        methods: [],
      },
    ],
    relations: [],
  };

  test("1. Pregunta 'review' ('@Codia revisa el diagrama') entra a la rama de revisión, resuelve operations vacío, kind 'answer' y findings", async () => {
    let reviewCalled = false;
    let queryChatCalled = false;
    let editCalled = false;

    const mockFindings = [
      {
        code: "R1",
        severity: "recomendado" as const,
        classNames: ["Factura"],
        message: "Clase sin atributos",
        fix: "@Codia agrega el atributo id a Factura",
      },
    ];

    const service = createAiChatService({
      getDiagramModel: async () => sampleModelWithFindings,
      listRecentMessages: async () => [],
      chat: async () => {
        queryChatCalled = true;
        return "Respuesta de consulta";
      },
      requestDiagramEdit: async () => {
        editCalled = true;
        return { status: "ready", validOperations: [], warnings: [], provider: "mock", fallback: false };
      },
      reviewDiagram: async () => {
        reviewCalled = true;
        return {
          message: "Ana, revisé el diagrama y encontré 1 observación.",
          findings: mockFindings,
        };
      },
    });

    const result = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Ana",
      askerMessageId: "m1",
      question: "@Codia revisa el diagrama",
      onOperations: async () => ({ applied: 1, failed: 0 }),
    });

    assert.equal(reviewCalled, true);
    assert.equal(queryChatCalled, false);
    assert.equal(editCalled, false);
    assert.equal(result.kind, "answer");
    assert.deepEqual(result.operations, []);
    assert.deepEqual(result.findings, mockFindings);
    assert.ok(result.message.includes("Ana, revisé el diagrama"));
  });

  test("2. Pregunta 'query' ('¿qué es una clave primaria?') sigue por la consulta y NO llama a la revisión", async () => {
    let reviewCalled = false;
    let queryChatCalled = false;
    let editCalled = false;

    const service = createAiChatService({
      getDiagramModel: async () => sampleModelWithFindings,
      listRecentMessages: async () => [],
      chat: async () => {
        queryChatCalled = true;
        return "Una clave primaria identifica de forma única cada registro.";
      },
      requestDiagramEdit: async () => {
        editCalled = true;
        return { status: "ready", validOperations: [], warnings: [], provider: "mock", fallback: false };
      },
      reviewDiagram: async () => {
        reviewCalled = true;
        return { message: "revisión mock" };
      },
    });

    const result = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Carlos",
      askerMessageId: "m2",
      question: "¿qué es una clave primaria?",
      onOperations: async () => ({ applied: 1, failed: 0 }),
    });

    assert.equal(reviewCalled, false);
    assert.equal(queryChatCalled, true);
    assert.equal(editCalled, false);
    assert.equal(result.kind, "answer");
    assert.deepEqual(result.operations, []);
    assert.equal(result.findings, undefined);
    assert.ok(result.message.includes("Carlos, una clave primaria"));
  });

  test("3. Pregunta 'modification' con onOperations sigue por modificación", async () => {
    let reviewCalled = false;
    let queryChatCalled = false;
    let editCalled = false;
    let onOpsCalled = false;

    const service = createAiChatService({
      getDiagramModel: async () => sampleModelWithFindings,
      listRecentMessages: async () => [],
      chat: async () => {
        queryChatCalled = true;
        return "consulta mock";
      },
      requestDiagramEdit: async () => {
        editCalled = true;
        return {
          status: "ready",
          validOperations: [{ type: "createClass", name: "Detalle" }],
          warnings: [],
          provider: "mock",
          fallback: false,
        };
      },
      reviewDiagram: async () => {
        reviewCalled = true;
        return { message: "revisión mock" };
      },
    });

    const result = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Luis",
      askerMessageId: "m3",
      question: "agrega la clase Detalle",
      onOperations: async (ops) => {
        onOpsCalled = true;
        return { applied: ops.length, failed: 0 };
      },
    });

    assert.equal(reviewCalled, false);
    assert.equal(queryChatCalled, false);
    assert.equal(editCalled, true);
    assert.equal(onOpsCalled, true);
    assert.equal(result.kind, "modification");
    assert.equal(result.operations.length, 1);
    assert.equal(result.findings, undefined);
  });

  test("4. Pregunta 'modification' SIN onOperations se trata como consulta", async () => {
    let reviewCalled = false;
    let queryChatCalled = false;
    let editCalled = false;

    const service = createAiChatService({
      getDiagramModel: async () => sampleModelWithFindings,
      listRecentMessages: async () => [],
      chat: async () => {
        queryChatCalled = true;
        return "Para agregar una clase debes ingresar al modo edición.";
      },
      requestDiagramEdit: async () => {
        editCalled = true;
        return { status: "ready", validOperations: [], warnings: [], provider: "mock", fallback: false };
      },
      reviewDiagram: async () => {
        reviewCalled = true;
        return { message: "revisión mock" };
      },
    });

    // onOperations omitido intencionalmente
    const result = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Elena",
      askerMessageId: "m4",
      question: "agrega la clase Detalle",
    });

    assert.equal(reviewCalled, false);
    assert.equal(editCalled, false);
    assert.equal(queryChatCalled, true);
    assert.equal(result.kind, "answer");
    assert.deepEqual(result.operations, []);
    assert.equal(result.findings, undefined);
    assert.ok(result.message.includes("Elena, para agregar una clase"));
  });

  test("5. Pregunta 'review' no llama a onOperations ni modifica el diagrama", async () => {
    let editCalled = false;
    let onOpsCalled = false;

    const service = createAiChatService({
      getDiagramModel: async () => sampleModelWithFindings,
      listRecentMessages: async () => [],
      chat: async () => "no se usa",
      requestDiagramEdit: async () => {
        editCalled = true;
        return { status: "ready", validOperations: [], warnings: [], provider: "mock", fallback: false };
      },
      reviewDiagram: async () => ({
        message: "Mario, revisé el diagrama y detecté observaciones.",
        findings: [{ code: "R1", severity: "recomendado", classNames: ["Factura"], message: "vacia", fix: "@Codia agrega id" }],
      }),
    });

    const result = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Mario",
      askerMessageId: "m5",
      question: "@Codia ¿qué le falta a mi diagrama?",
      onOperations: async () => {
        onOpsCalled = true;
        return { applied: 1, failed: 0 };
      },
    });

    assert.equal(editCalled, false, "requestDiagramEdit NO debe ser llamado en review");
    assert.equal(onOpsCalled, false, "onOperations NO debe ser llamado en review");
    assert.equal(result.kind, "answer");
    assert.deepEqual(result.operations, []);
    assert.ok(result.findings && result.findings.length > 0);
  });
});
