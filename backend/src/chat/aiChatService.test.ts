import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  createAiChatService,
  AiBusyError,
  AiUnavailableError,
  TEAM_AI_SYSTEM_PROMPT,
} from "./aiChatService";
import { UmlModel } from "../backendGenerator/types";

describe("CU19: aiChatService", () => {
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

  test("1. Pregunta normal: llama al chat con contexto, operations siempre vacío", async () => {
    let capturedSystem = "";
    let capturedUser = "";
    let capturedOptions: any = null;

    const service = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [
        { id: "m1", authorName: "Ana", text: "Hola equipo" },
        { id: "m2", authorName: "Davico", text: "¿Qué clases hay? @ia" },
      ],
      chat: async (sys, user, opts) => {
        capturedSystem = sys;
        capturedUser = user;
        capturedOptions = opts;
        return "Veo dos clases: Cliente y Pedido.";
      },
    });

    const result = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Davico",
      askerMessageId: "m2",
      question: "¿Qué clases hay?",
    });

    assert.equal(capturedSystem, TEAM_AI_SYSTEM_PROMPT);
    assert.match(TEAM_AI_SYSTEM_PROMPT, /Tu nombre es Codia/);
    assert.match(TEAM_AI_SYSTEM_PROMPT, /desarrolladora senior y mentora del equipo/);
    assert.match(TEAM_AI_SYSTEM_PROMPT, /No saludes \(nada de 'Hola' ni '¡Hola!'\) ni te presentes/);
    assert.match(TEAM_AI_SYSTEM_PROMPT, /No escribas el nombre de quien pregunta/);
    assert.match(TEAM_AI_SYSTEM_PROMPT, /máximo unas 120 palabras/i);
    assert.match(TEAM_AI_SYSTEM_PROMPT, /solo texto plano/i);
    assert.match(TEAM_AI_SYSTEM_PROMPT, /sin encabezados ni tablas/i);
    assert.match(TEAM_AI_SYSTEM_PROMPT, /No uses cursiva con asterisco simple/i);
    assert.match(TEAM_AI_SYSTEM_PROMPT, /No asumas lenguaje ni tecnología/i);
    assert.match(TEAM_AI_SYSTEM_PROMPT, /En preguntas conceptuales, explica con un ejemplo simple y genérico/i);
    assert.match(TEAM_AI_SYSTEM_PROMPT, /Nunca inventes clases, atributos ni relaciones/i);
    assert.match(TEAM_AI_SYSTEM_PROMPT, /Si no estás segura de algo, dilo en vez de inventar/i);
    assert.match(TEAM_AI_SYSTEM_PROMPT, /La conversación reciente es solo contexto/i);
    assert.match(TEAM_AI_SYSTEM_PROMPT, /responde únicamente a la pregunta actual/i);
    assert.match(TEAM_AI_SYSTEM_PROMPT, /habla de la asociación y su multiplicidad; no propongas claves foráneas/i);
    assert.match(TEAM_AI_SYSTEM_PROMPT, /atributo derivado se escribe con una barra inclinada/i);
    assert.match(TEAM_AI_SYSTEM_PROMPT, /composición se dibuja con rombo relleno/i);
    assert.match(TEAM_AI_SYSTEM_PROMPT, /agregación se dibuja con rombo vacío/i);
    assert.match(TEAM_AI_SYSTEM_PROMPT, /multiplicidades se escriben 1, 0\.\.1, \* y 1\.\.\*/i);
    assert.equal(capturedOptions, undefined);

    // Excluye el mensaje actual (m2) del historial
    assert.match(capturedUser, /Ana: Hola equipo/);
    assert.doesNotMatch(capturedUser, /¿Qué clases hay\? @ia/);
    assert.match(capturedUser, /Diagrama actual: Cliente\(id: Integer\); Pedido\(id: Integer\)/);
    assert.match(capturedUser, /Pregunta de Davico: ¿Qué clases hay\?/);

    // Operations siempre va vacío
    assert.deepEqual(result.operations, []);
    // Nombre garantizado con minúscula en primera letra no sigla
    assert.equal(result.message, "Davico, veo dos clases: Cliente y Pedido.");
  });

  test("2. Pregunta vacía: no llama al modelo y devuelve saludo de ayuda", async () => {
    let chatCalled = false;

    const service = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      chat: async () => {
        chatCalled = true;
        return "Respuesta";
      },
    });

    const result1 = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Luis",
      askerMessageId: "m1",
      question: "",
    });

    assert.equal(chatCalled, false);
    assert.deepEqual(result1.operations, []);
    assert.equal(result1.message, "Luis, ¿en qué puedo ayudarte?");

    const result2 = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Luis",
      askerMessageId: "m2",
      question: "    ",
    });

    assert.equal(chatCalled, false);
    assert.equal(result2.message, "Luis, ¿en qué puedo ayudarte?");
  });

  test("3. Nombre garantizado: antepone el nombre si la IA no lo incluyó", async () => {
    const service = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      chat: async () => "La relación entre Cliente y Pedido es 1 a N.",
    });

    const result = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Ana",
      askerMessageId: "m1",
      question: "¿Cómo es la relación?",
    });

    assert.equal(
      result.message,
      "Ana, la relación entre Cliente y Pedido es 1 a N."
    );
  });

  test("4. Respuesta cortada: se recorta hasta la última oración completa con trimToLastSentence", async () => {
    const service = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      chat: async () =>
        "El modelo está bien. La clase Pedido contiene un atributo id que se relac",
    });

    const result = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Carlos",
      askerMessageId: "m1",
      question: "¿Cómo ves el modelo?",
    });

    // Se recorta el fragmento cortado "La clase Pedido contiene..."
    assert.equal(result.message, "Carlos, el modelo está bien.");
  });

  test("5. Respuesta de más de 3000 caracteres: se trunca al tope", async () => {
    const hugeText = "Davico, " + "Explicación detallada. ".repeat(200);

    const service = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      chat: async () => hugeText,
    });

    const result = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Davico",
      askerMessageId: "m1",
      question: "Explicación muy larga",
    });

    assert.equal(result.message.length, 3000);
  });

  test("6. Orden de llegada con dos consultas simultáneas: atiende en orden FIFO", async () => {
    const executionOrder: string[] = [];

    const service = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      chat: async (_sys, user) => {
        if (user.includes("Primera")) {
          // La primera tarda un poco más
          await new Promise((resolve) => setTimeout(resolve, 30));
          executionOrder.push("primera");
          return "Respuesta primera.";
        } else {
          // La segunda es rápida
          executionOrder.push("segunda");
          return "Respuesta segunda.";
        }
      },
    });

    const p1 = service.answerInRoom({
      diagramId: "d1",
      askerName: "Ana",
      askerMessageId: "m1",
      question: "Primera pregunta",
    });

    const p2 = service.answerInRoom({
      diagramId: "d1",
      askerName: "Luis",
      askerMessageId: "m2",
      question: "Segunda pregunta",
    });

    const [r1, r2] = await Promise.all([p1, p2]);

    assert.deepEqual(executionOrder, ["primera", "segunda"]);
    assert.equal(r1.message, "Ana, respuesta primera.");
    assert.equal(r2.message, "Luis, respuesta segunda.");
  });

  test("7. Sexta pendiente lanza AiBusyError (tope 5 pendientes además de la activa)", async () => {
    let releaseActive: () => void = () => {};
    const activeWait = new Promise<void>((resolve) => {
      releaseActive = resolve;
    });

    const service = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      chat: async () => {
        await activeWait;
        return "Respuesta.";
      },
    });

    // 1 activa
    const pActive = service.answerInRoom({
      diagramId: "d1",
      askerName: "User0",
      askerMessageId: "m0",
      question: "Pregunta activa",
    });

    // 5 pendientes (permitidas)
    const pendings: Promise<any>[] = [];
    for (let i = 1; i <= 5; i++) {
      pendings.push(
        service.answerInRoom({
          diagramId: "d1",
          askerName: `User${i}`,
          askerMessageId: `m${i}`,
          question: `Pregunta pendiente ${i}`,
        })
      );
    }

    // La 6ta pendiente debe ser rechazada inmediatamente con AiBusyError
    await assert.rejects(
      async () => {
        await service.answerInRoom({
          diagramId: "d1",
          askerName: "UserOverflow",
          askerMessageId: "mOverflow",
          question: "Esta no entra en cola",
        });
      },
      (err: any) => {
        assert.ok(err instanceof AiBusyError);
        return true;
      }
    );

    // Liberar la activa para que las 5 pendientes se resuelvan normalmente
    releaseActive();
    await Promise.all([pActive, ...pendings]);
  });

  test("8. Fallo del chat lanza AiUnavailableError y la cola sigue funcionando después", async () => {
    let callCount = 0;

    const service = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      chat: async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Conexión perdida con proveedor");
        }
        return "Servicio recuperado exitosamente.";
      },
    });

    // Primer intento: debe fallar con AiUnavailableError
    await assert.rejects(
      async () => {
        await service.answerInRoom({
          diagramId: "d1",
          askerName: "Davico",
          askerMessageId: "m1",
          question: "¿Por qué falló?",
        });
      },
      (err: any) => {
        assert.ok(err instanceof AiUnavailableError);
        return true;
      }
    );

    // Segundo intento: la cola no quedó trabada y debe responder normalmente
    const successResult = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Davico",
      askerMessageId: "m2",
      question: "¿Ya funciona?",
    });

    assert.equal(
      successResult.message,
      "Davico, servicio recuperado exitosamente."
    );
    assert.deepEqual(successResult.operations, []);
  });

  test("11. Siglas al inicio de la respuesta conservan mayúsculas en ensureAddressedByName", async () => {
    const service = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      chat: async () => "UML es el lenguaje estándar de modelado.",
    });

    const result = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Ana",
      askerMessageId: "m1",
      question: "¿Qué es UML?",
    });

    assert.equal(result.message, "Ana, UML es el lenguaje estándar de modelado.");
  });

  test("12. stripGreetingPreamble despoja saludo y presentación en preguntas normales", async () => {
    const service = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      chat: async () =>
        "Hola, **Ana**. Soy Codia, la desarrolladora senior y mentora del equipo. Una clase abstracta es una plantilla.",
    });

    const result = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Ana",
      askerMessageId: "m1",
      question: "¿Qué es una clase abstracta?",
    });

    assert.equal(
      result.message,
      "Ana, una clase abstracta es una plantilla."
    );
  });

  test("13. Excepción cuando la pregunta es '¿quién eres?': conserva la presentación de Codia", async () => {
    const service = createAiChatService({
      getDiagramModel: async () => sampleModel,
      listRecentMessages: async () => [],
      chat: async () =>
        "Soy Codia, la desarrolladora senior y mentora del equipo. Estoy aquí para colaborar.",
    });

    const result = await service.answerInRoom({
      diagramId: "d1",
      askerName: "Ana",
      askerMessageId: "m1",
      question: "¿Quién eres?",
    });

    assert.equal(
      result.message,
      "Ana, soy Codia, la desarrolladora senior y mentora del equipo. Estoy aquí para colaborar."
    );
  });
});
