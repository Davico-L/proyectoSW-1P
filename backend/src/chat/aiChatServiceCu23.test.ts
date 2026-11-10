import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  createAiChatService,
  TEAM_AI_SYSTEM_PROMPT,
} from "./aiChatService";
import { REVIEW_SYSTEM_PROMPT } from "./diagramReviewService";
import {
  DIRECTA_STYLE_FRAGMENT,
  DETALLADA_STYLE_FRAGMENT,
} from "./styleFragments";
import { UmlModel } from "../backendGenerator/types";
import { RoomSettings } from "./roomSettingsRepository";

describe("CU23: aiChatService con configuración por sala (modo y estilo)", () => {
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

  const sampleModelWithFindings: UmlModel = {
    classes: [
      {
        id: "c1",
        className: "Factura",
        attributes: [], // Dispara regla automática de revisión R1
        methods: [],
      },
    ],
    relations: [],
  };

  test("1. El estilo llega al prompt de consulta y al de revisión", async () => {
    let capturedQueryPrompt = "";
    let capturedReviewPrompt = "";

    // 1a. Consulta con estilo 'directa'
    const serviceDirecta = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      getRoomSettings: async () => ({ mode: "apply", style: "directa" }),
      chat: async (sys) => {
        capturedQueryPrompt = sys;
        return "Respuesta directa a la consulta.";
      },
    });

    await serviceDirecta.answerInRoom({
      diagramId: "d1",
      askerName: "Ana",
      askerMessageId: "m1",
      question: "¿Qué es una asociación en UML?",
    });

    assert.ok(capturedQueryPrompt.startsWith(TEAM_AI_SYSTEM_PROMPT));
    assert.ok(capturedQueryPrompt.includes(DIRECTA_STYLE_FRAGMENT));
    assert.match(capturedQueryPrompt, /60 palabras/i);

    // 1b. Consulta con estilo 'detallada'
    let capturedDetailedQuery = "";
    const serviceDetallada = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      getRoomSettings: async () => ({ mode: "apply", style: "detallada" }),
      chat: async (sys) => {
        capturedDetailedQuery = sys;
        return "Respuesta detallada con amplia explicación.";
      },
    });

    await serviceDetallada.answerInRoom({
      diagramId: "d1",
      askerName: "Ana",
      askerMessageId: "m2",
      question: "¿Qué es una asociación en UML?",
    });

    assert.ok(capturedDetailedQuery.startsWith(TEAM_AI_SYSTEM_PROMPT));
    assert.ok(capturedDetailedQuery.includes(DETALLADA_STYLE_FRAGMENT));
    assert.match(capturedDetailedQuery, /180 palabras/i);

    // 1c. Revisión con estilo 'directa'
    const serviceReviewDirecta = createAiChatService({
      getDiagramModel: async () => sampleModelWithFindings,
      listRecentMessages: async () => [],
      getRoomSettings: async () => ({ mode: "apply", style: "directa" }),
      chat: async (sys) => {
        capturedReviewPrompt = sys;
        return "Revisión breve: la clase Factura no tiene atributos. ¿Quieres que aplique alguna?";
      },
    });

    await serviceReviewDirecta.answerInRoom({
      diagramId: "d1",
      askerName: "Carlos",
      askerMessageId: "m3",
      question: "Codia, revisa el diagrama por favor",
    });

    assert.ok(capturedReviewPrompt.startsWith(REVIEW_SYSTEM_PROMPT));
    assert.ok(capturedReviewPrompt.includes(DIRECTA_STYLE_FRAGMENT));
  });

  test("2. Estilo mentora deja el prompt base idéntico (consulta y revisión)", async () => {
    let capturedQueryPrompt = "";
    let capturedReviewPrompt = "";

    const serviceMentora = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      getRoomSettings: async () => ({ mode: "apply", style: "mentora" }),
      chat: async (sys) => {
        capturedQueryPrompt = sys;
        return "Respuesta en estilo mentora.";
      },
    });

    await serviceMentora.answerInRoom({
      diagramId: "d1",
      askerName: "Ana",
      askerMessageId: "m1",
      question: "¿Cómo se dibuja una composición?",
    });

    assert.equal(capturedQueryPrompt, TEAM_AI_SYSTEM_PROMPT);

    const serviceReviewMentora = createAiChatService({
      getDiagramModel: async () => sampleModelWithFindings,
      listRecentMessages: async () => [],
      getRoomSettings: async () => ({ mode: "apply", style: "mentora" }),
      chat: async (sys) => {
        capturedReviewPrompt = sys;
        return "Revisión en estilo mentora. ¿Quieres que aplique alguna?";
      },
    });

    await serviceReviewMentora.answerInRoom({
      diagramId: "d1",
      askerName: "Carlos",
      askerMessageId: "m2",
      question: "evalúa el modelo",
    });

    assert.equal(capturedReviewPrompt, REVIEW_SYSTEM_PROMPT);
  });

  test("3. Modo advise no llama a onOperations y el texto contiene la propuesta determinista", async () => {
    let onOperationsCalls = 0;

    const service = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      getRoomSettings: async () => ({ mode: "advise", style: "mentora" }),
      requestDiagramEdit: async () => ({
        status: "ready",
        validOperations: [
          { action: "createClass", className: "Factura" },
          { action: "addAttribute", className: "Factura", attribute: { name: "total", type: "number" } },
        ],
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

    assert.equal(onOperationsCalls, 0, "No debe llamar a onOperations en modo advise");
    assert.deepEqual(result.operations, [], "Las operaciones deben resolverse vacías");
    assert.equal(result.kind, "answer");
    assert.match(result.message, /^Carlos,\s+propongo:/i);
    assert.match(result.message, /clase Factura/i);
    assert.match(
      result.message,
      /Para que lo aplique, pon mi modo en «Aplica los cambios» y repite el pedido, o hazlo manualmente\./
    );
  });

  test("4. Modo advise con onlyWarnings, noChanges o tooMany entrega los mensajes estándar de CU20", async () => {
    // 4a. onlyWarnings
    const serviceWarnings = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      getRoomSettings: async () => ({ mode: "advise", style: "mentora" }),
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
    assert.match(resWarnings.message, /no se aplicaron cambios: la clase Persona ya existe\./i);

    // 4b. noChanges sin interrogación
    const serviceNoChanges = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      getRoomSettings: async () => ({ mode: "advise", style: "mentora" }),
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
    assert.match(resNoChanges.message, /no encontré qué cambiar en el diagrama con ese pedido/i);

    // 4c. tooMany
    const serviceTooMany = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      getRoomSettings: async () => ({ mode: "advise", style: "mentora" }),
      requestDiagramEdit: async () => ({
        status: "tooMany",
        validOperations: [],
        warnings: [],
        message: "el pedido contiene demasiadas operaciones. Por favor, dividilo en cambios más pequeños.",
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
    assert.match(resTooMany.message, /el pedido contiene demasiadas operaciones/i);
  });

  test("5. Modo apply sigue llamando a onOperations igual que antes", async () => {
    let capturedOps: any[] = [];
    const opsToApply = [{ action: "createClass", className: "Factura" }];

    const service = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      getRoomSettings: async () => ({ mode: "apply", style: "mentora" }),
      requestDiagramEdit: async () => ({
        status: "ready",
        validOperations: opsToApply,
        warnings: [],
        provider: "mock",
        fallback: false,
      }),
      chat: async () => "no debe llamarse",
    });

    const result = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Lucía",
      askerMessageId: "m1",
      question: "agrega la clase Factura",
      onOperations: async (ops) => {
        capturedOps = ops;
        return { applied: 1, failed: 0 };
      },
    });

    assert.deepEqual(capturedOps, opsToApply, "onOperations debe ser llamado con las operaciones válidas");
    assert.equal(result.kind, "modification");
    assert.deepEqual(result.operations, opsToApply);
    assert.match(result.message, /Lucía,\s+cre[eé] la clase Factura/i);
  });

  test("6. La configuración se lee al ejecutar (si cambia entre encolar y ejecutar, rige la nueva)", async () => {
    let currentSettings: RoomSettings = { mode: "apply", style: "mentora" };

    let releaseFirstTask: () => void = () => {};
    const firstTaskWait = new Promise<void>((resolve) => {
      releaseFirstTask = resolve;
    });

    let secondTaskCalledOnOps = false;

    const service = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      getRoomSettings: async () => ({ ...currentSettings }),
      requestDiagramEdit: async () => ({
        status: "ready",
        validOperations: [{ action: "createClass", className: "Producto" }],
        warnings: [],
        provider: "mock",
        fallback: false,
      }),
      chat: async () => {
        await firstTaskWait;
        return "Respuesta tarea 1.";
      },
    });

    // Tarea 1: Ocupa el worker activo con una consulta que espera releaseFirstTask
    const p1 = service.answerInRoom({
      diagramId: "d1",
      askerName: "User1",
      askerMessageId: "m1",
      question: "¿Qué es UML?",
    });

    // Tarea 2: Encolada mientras currentSettings es 'apply'
    const p2 = service.answerInRoom({
      diagramId: "d1",
      askerName: "User2",
      askerMessageId: "m2",
      question: "agrega la clase Producto",
      onOperations: async () => {
        secondTaskCalledOnOps = true;
        return { applied: 1, failed: 0 };
      },
    });

    // Antes de que termine la Tarea 1, se actualiza la configuración a 'advise'
    currentSettings = { mode: "advise", style: "directa" };

    // Liberamos la Tarea 1; la Tarea 2 arranca su ejecución y debe leer 'advise'
    releaseFirstTask();

    const [res1, res2] = await Promise.all([p1, p2]);

    assert.ok(res1.message);
    assert.equal(
      secondTaskCalledOnOps,
      false,
      "La tarea 2 debió leer la configuración 'advise' vigente al momento de ejecutar"
    );
    assert.equal(res2.kind, "answer");
    assert.match(res2.message, /propongo:/i);
    assert.match(res2.message, /Aplica los cambios/);
  });

  test("7. Si leer la configuración falla, usa los defaults (apply / mentora)", async () => {
    let onOperationsCalls = 0;
    let capturedPrompt = "";

    const serviceWithFailingSettings = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      getRoomSettings: async () => {
        throw new Error("Conexión perdida con la base de datos");
      },
      requestDiagramEdit: async () => ({
        status: "ready",
        validOperations: [{ action: "createClass", className: "Proveedor" }],
        warnings: [],
        provider: "mock",
        fallback: false,
      }),
      chat: async (sys) => {
        capturedPrompt = sys;
        return "Respuesta de consulta normal.";
      },
    });

    // Consulta: debe usar el prompt base de mentora por defecto
    const queryResult = await serviceWithFailingSettings.answerInRoom({
      diagramId: "d1",
      askerName: "Marcos",
      askerMessageId: "m1",
      question: "¿Qué es una interfaz?",
    });

    assert.equal(capturedPrompt, TEAM_AI_SYSTEM_PROMPT);
    assert.ok(queryResult.message);

    // Modificación: debe usar 'apply' por defecto y llamar a onOperations
    const modResult = await serviceWithFailingSettings.answerInRoom({
      diagramId: "d1",
      askerName: "Marcos",
      askerMessageId: "m2",
      question: "crea la clase Proveedor",
      onOperations: async () => {
        onOperationsCalls += 1;
        return { applied: 1, failed: 0 };
      },
    });

    assert.equal(onOperationsCalls, 1, "Debe llamar a onOperations usando modo apply por defecto");
    assert.equal(modResult.kind, "modification");
  });
});
