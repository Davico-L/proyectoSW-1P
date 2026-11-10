import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createAiChatService } from "./aiChatService";
import { UmlModel } from "../backendGenerator/types";

describe("CU22 Fase 2A-1: aiChatService con modo 'approval' ('Pide aprobación')", () => {
  const sampleModel: UmlModel = {
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

  test("1. Modo approval con status 'ready' NO llama a onOperations y devuelve propuesta pendiente con kind 'proposal'", async () => {
    let onOperationsCalls = 0;

    const validOps = [
      { action: "createClass", className: "Factura" },
      { action: "createClass", className: "Detalle" },
    ];

    const service = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      getRoomSettings: async () => ({ mode: "approval", style: "mentora" }),
      requestDiagramEdit: async () => ({
        status: "ready",
        validOperations: validOps,
        warnings: [],
        provider: "mock",
        fallback: false,
      }),
      chat: async () => "no debe llamarse",
    });

    const result = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Carlos",
      askerMessageId: "m1",
      question: "agrega la clase Factura con el atributo total",
      onOperations: async () => {
        onOperationsCalls += 1;
        return { applied: 2, failed: 0 };
      },
    });

    // 1.1 NO debe llamar a onOperations
    assert.equal(onOperationsCalls, 0, "No debe llamar a onOperations en modo approval");

    // 1.2 Devuelve kind 'proposal'
    assert.equal(result.kind, "proposal");

    // 1.3 Mensaje generado con buildProposalText
    assert.match(result.message, /^Carlos,\s+propongo:/i);
    assert.match(
      result.message,
      /\. Queda pendiente de aprobación del equipo\.$/
    );
    assert.match(result.message, /Factura/);

    // 1.4 operations contiene validOps para persistir en Mongo
    assert.deepEqual(result.operations, validOps);
    assert.deepEqual(result.warnings, []);

    // 1.5 Objeto proposal creado correctamente
    assert.ok(result.proposal, "Debe incluir el objeto proposal");
    assert.equal(result.proposal.status, "pending");
    assert.equal(result.proposal.requestedBy, "Carlos");
    assert.ok(result.proposal.id, "Debe tener id UUID");
    assert.match(
      result.proposal.id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    assert.deepEqual(result.proposal.summary, [
      "creé la clase Factura",
      "creé la clase Detalle",
    ]);
  });

  test("2. Modo approval con warnings: proposal refleja el resumen por operación y los avisos como elementos aparte", async () => {
    let onOperationsCalls = 0;

    const validOps = [{ action: "createClass", className: "Producto" }];
    const warnings = ["el atributo nombre ya existía"];

    const service = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      getRoomSettings: async () => ({ mode: "approval", style: "mentora" }),
      requestDiagramEdit: async () => ({
        status: "ready",
        validOperations: validOps,
        warnings,
        provider: "mock",
        fallback: false,
      }),
      chat: async () => "no debe llamarse",
    });

    const result = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Ana",
      askerMessageId: "m2",
      question: "crea la clase Producto",
      onOperations: async () => {
        onOperationsCalls += 1;
        return { applied: 1, failed: 0 };
      },
    });

    assert.equal(onOperationsCalls, 0);
    assert.equal(result.kind, "proposal");
    assert.deepEqual(result.warnings, warnings);
    assert.ok(result.proposal);
    assert.equal(result.proposal.status, "pending");
    assert.equal(result.proposal.requestedBy, "Ana");
    assert.deepEqual(result.proposal.summary, [
      "creé la clase Producto",
      "el atributo nombre ya existía",
    ]);
    assert.match(result.message, /Ana, propongo:/);
    assert.match(result.message, /Queda pendiente de aprobación del equipo\./);
  });

  test("2b. Modo approval con múltiples operaciones y advertencias: proposal.summary tiene un elemento por cada operación y advertencias aparte", async () => {
    const validOps = [
      { action: "createClass", className: "Factura", attributes: [{ name: "total" }] },
      { action: "updateClass", className: "Cliente", newClassName: "ClienteVIP" },
      { action: "deleteClass", className: "Pedido" },
    ];
    const warnings = ["No encontré la clase 'Pago'", "No se pudo vincular"];

    const service = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      getRoomSettings: async () => ({ mode: "approval", style: "mentora" }),
      requestDiagramEdit: async () => ({
        status: "ready",
        validOperations: validOps,
        warnings,
        provider: "mock",
        fallback: false,
      }),
      chat: async () => "no debe llamarse",
    });

    const result = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Luis",
      askerMessageId: "m3",
      question: "modifica varias clases",
      onOperations: async () => ({ applied: 1, failed: 0 }),
    });

    assert.equal(result.kind, "proposal");
    assert.ok(result.proposal);
    assert.deepEqual(result.proposal.summary, [
      "creé la clase Factura con 1 atributo",
      "renombré la clase Cliente a ClienteVIP",
      "eliminé la clase Pedido",
      "No encontré la clase 'Pago'",
      "No se pudo vincular",
    ]);
    assert.match(result.message, /^Luis, propongo:/);
    assert.match(result.message, /Queda pendiente de aprobación del equipo\.$/);
  });

  test("3. Modo approval con pedido no soportado, sin cambios o con error responde como en CU20 y no genera propuesta", async () => {
    // 3a. onlyWarnings
    const serviceWarnings = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      getRoomSettings: async () => ({ mode: "approval", style: "mentora" }),
      requestDiagramEdit: async () => ({
        status: "onlyWarnings",
        validOperations: [],
        warnings: ["la clase Persona ya existe"],
        provider: "mock",
        fallback: false,
      }),
      chat: async () => "no debe llamarse",
    });

    const resWarnings = await serviceWarnings.answerInRoom({
      diagramId: "d1",
      askerName: "Ana",
      askerMessageId: "m1",
      question: "crea la clase Persona",
      onOperations: async () => ({ applied: 1, failed: 0 }),
    });

    assert.equal(resWarnings.kind, "answer");
    assert.deepEqual(resWarnings.operations, []);
    assert.equal(resWarnings.proposal, undefined, "No debe generar propuesta en onlyWarnings");
    assert.match(resWarnings.message, /no se aplicaron cambios: la clase Persona ya existe\./i);

    // 3b. noChanges sin interrogación
    const serviceNoChanges = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      getRoomSettings: async () => ({ mode: "approval", style: "mentora" }),
      requestDiagramEdit: async () => ({
        status: "noChanges",
        validOperations: [],
        warnings: [],
        provider: "mock",
        fallback: false,
      }),
      chat: async () => "no debe llamarse",
    });

    const resNoChanges = await serviceNoChanges.answerInRoom({
      diagramId: "d1",
      askerName: "Ana",
      askerMessageId: "m2",
      question: "modifica algo",
      onOperations: async () => ({ applied: 1, failed: 0 }),
    });

    assert.equal(resNoChanges.kind, "answer");
    assert.deepEqual(resNoChanges.operations, []);
    assert.equal(resNoChanges.proposal, undefined, "No debe generar propuesta en noChanges");
    assert.match(resNoChanges.message, /no encontré qué cambiar en el diagrama con ese pedido/i);

    // 3c. tooMany
    const serviceTooMany = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      getRoomSettings: async () => ({ mode: "approval", style: "mentora" }),
      requestDiagramEdit: async () => ({
        status: "tooMany",
        validOperations: [],
        warnings: [],
        provider: "mock",
        fallback: false,
      }),
      chat: async () => "no debe llamarse",
    });

    const resTooMany = await serviceTooMany.answerInRoom({
      diagramId: "d1",
      askerName: "Ana",
      askerMessageId: "m3",
      question: "agrega 20 clases a la vez",
      onOperations: async () => ({ applied: 1, failed: 0 }),
    });

    assert.equal(resTooMany.kind, "answer");
    assert.deepEqual(resTooMany.operations, []);
    assert.equal(resTooMany.proposal, undefined, "No debe generar propuesta en tooMany");
    assert.match(resTooMany.message, /demasiadas operaciones/i);

    // 3d. diagramNotFound
    const serviceNotFound = createAiChatService({
      getDiagramModel: async () => null,
      listRecentMessages: async () => [],
      getRoomSettings: async () => ({ mode: "approval", style: "mentora" }),
      requestDiagramEdit: async () => ({
        status: "diagramNotFound",
        validOperations: [],
        warnings: [],
        provider: "mock",
        fallback: false,
      }),
      chat: async () => "no debe llamarse",
    });

    const resNotFound = await serviceNotFound.answerInRoom({
      diagramId: "d-inexistente",
      askerName: "Ana",
      askerMessageId: "m4",
      question: "agrega la clase Caja",
      onOperations: async () => ({ applied: 1, failed: 0 }),
    });

    assert.equal(resNotFound.kind, "answer");
    assert.deepEqual(resNotFound.operations, []);
    assert.equal(resNotFound.proposal, undefined, "No debe generar propuesta en diagramNotFound");
    assert.match(resNotFound.message, /no encontré el diagrama especificado/i);
  });

  test("4. Modos apply y advise permanecen idénticos a CU20/CU23", async () => {
    const validOps = [{ action: "createClass", className: "Factura" }];

    // 4a. Modo apply ejecuta onOperations y devuelve kind 'modification' sin proposal
    let applyCalls = 0;
    const serviceApply = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      getRoomSettings: async () => ({ mode: "apply", style: "mentora" }),
      requestDiagramEdit: async () => ({
        status: "ready",
        validOperations: validOps,
        warnings: [],
        provider: "mock",
        fallback: false,
      }),
      chat: async () => "no debe llamarse",
    });

    const resApply = await serviceApply.answerInRoom({
      diagramId: "d1",
      askerName: "Lucía",
      askerMessageId: "m1",
      question: "agrega la clase Factura",
      onOperations: async (ops) => {
        applyCalls += 1;
        assert.deepEqual(ops, validOps);
        return { applied: 1, failed: 0 };
      },
    });

    assert.equal(applyCalls, 1, "Debe llamar a onOperations en modo apply");
    assert.equal(resApply.kind, "modification");
    assert.deepEqual(resApply.operations, validOps);
    assert.equal(resApply.proposal, undefined, "Modo apply no genera propuesta");
    assert.match(resApply.message, /Lucía,\s+creé la clase Factura\./i);

    // 4b. Modo advise no llama a onOperations y devuelve kind 'answer' sin proposal
    let adviseCalls = 0;
    const serviceAdvise = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      getRoomSettings: async () => ({ mode: "advise", style: "mentora" }),
      requestDiagramEdit: async () => ({
        status: "ready",
        validOperations: validOps,
        warnings: [],
        provider: "mock",
        fallback: false,
      }),
      chat: async () => "no debe llamarse",
    });

    const resAdvise = await serviceAdvise.answerInRoom({
      diagramId: "d1",
      askerName: "Lucía",
      askerMessageId: "m2",
      question: "agrega la clase Factura",
      onOperations: async () => {
        adviseCalls += 1;
        return { applied: 1, failed: 0 };
      },
    });

    assert.equal(adviseCalls, 0, "No debe llamar a onOperations en modo advise");
    assert.equal(resAdvise.kind, "answer");
    assert.deepEqual(resAdvise.operations, []);
    assert.equal(resAdvise.proposal, undefined, "Modo advise no genera propuesta");
    assert.match(resAdvise.message, /Lucía,\s+propongo:/i);
    assert.match(
      resAdvise.message,
      /Para que lo aplique, pon mi modo en «Aplica los cambios»/
    );
  });
});
