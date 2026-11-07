/**
 * Script de prueba de integración Socket.IO para CU19 (Fases 3B y Verificación).
 *
 * Simula dos clientes colaborativos (Ana y Luis) en la misma sala de diagrama:
 * 1. "@ia ¿cómo relaciono Venta con Producto?" -> ambos reciben status thinking/idle y respuesta dirigida a Ana.
 * 2. "@ia" a secas -> responde pidiendo la consulta ("Ana, ¿en qué puedo ayudarte?").
 * 3. Mensaje sin @ia -> no responde la IA ni emite status.
 * 4. Ana y Luis preguntando casi a la vez -> ambas respondidas en orden FIFO, dirigidas a su autor.
 * 5. GET /diagrams/:id/chat -> incluye los mensajes con role "ai", replyTo y addressedTo.
 * 6. 6 consultas rápidas con cola llena -> la sexta recibe el mensaje de "la IA está atendiendo otras consultas" (AiBusyError).
 * 7. Fallo de proveedores de IA -> responde con mensaje "no pude responder, reintenta" dirigido a quien preguntó (AiUnavailableError).
 *
 * Ejecución:
 *   npx tsx backend/src/scripts/testTeamChatAi.ts
 *   o
 *   npx tsx backend/scripts/testTeamChatAi.ts
 */

import http from "http";
import { AddressInfo } from "net";
import { io as ClientSocket, Socket as ClientSocketType } from "socket.io-client";
import path from "path";
import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "backend/.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { app } from "../app";
import { initSocket } from "../socket";
import { pool } from "../db";
import { getMongoDb, closeMongoConnection } from "../db/mongo";
import { CHAT_COLLECTION_NAME, listMessages } from "../chat/chatRepository";
import { createAiChatService } from "../chat/aiChatService";
import { AI_DISPLAY_NAME } from "../chat/aiChatHelpers";
import { getDiagramById } from "../services/diagramService";
import { extractUmlModel } from "../backendGenerator/extractModel";
import { chatWithFallback } from "../ai/providers/providerManager";

const TEST_DIAGRAM_ID = `diagram-cu19-test-${Date.now()}`;
const SESSION_ANA = "session-ana-cu19";
const SESSION_LUIS = "session-luis-cu19";

const sampleDiagramData = {
  elements: [
    {
      id: "elem-venta",
      type: "rectangle",
      customData: {
        type: "umlClass",
        className: "Venta",
        attributes: [
          { name: "id", type: "Integer", visibility: "public" },
          { name: "total", type: "Double", visibility: "public" },
        ],
        methods: [],
      },
    },
    {
      id: "elem-producto",
      type: "rectangle",
      customData: {
        type: "umlClass",
        className: "Producto",
        attributes: [
          { name: "id", type: "Integer", visibility: "public" },
          { name: "nombre", type: "String", visibility: "public" },
          { name: "precio", type: "Double", visibility: "public" },
        ],
        methods: [],
      },
    },
  ],
};

async function main() {
  console.log("===============================================================");
  console.log("Iniciando prueba de integración CU19: AI Team Chat (7 Escenarios)");
  console.log("===============================================================\n");

  // 1. Interceptar pool.query para sesiones y diagrama en pruebas
  const originalPoolQuery = pool.query;
  (pool as any).query = async (text: any, params?: any[]) => {
    const queryStr = typeof text === "string" ? text : text?.text || "";

    if (queryStr.includes("FROM sessions") && queryStr.includes("WHERE id = $1")) {
      const sessionId = params?.[0];
      if (sessionId === SESSION_ANA) {
        return {
          rows: [
            { id: SESSION_ANA, username: "Ana", created_at: new Date().toISOString() },
          ],
          rowCount: 1,
        };
      }
      if (sessionId === SESSION_LUIS) {
        return {
          rows: [
            { id: SESSION_LUIS, username: "Luis", created_at: new Date().toISOString() },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    }

    if (queryStr.includes("SELECT 1 FROM sessions WHERE id = $1")) {
      const sessionId = params?.[0];
      if (sessionId === SESSION_ANA || sessionId === SESSION_LUIS) {
        return { rows: [{ "?column?": 1 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (queryStr.includes("FROM diagrams") && queryStr.includes("WHERE id = $1")) {
      const diagId = params?.[0];
      if (diagId === TEST_DIAGRAM_ID) {
        return {
          rows: [
            {
              id: TEST_DIAGRAM_ID,
              session_id: SESSION_ANA,
              name: "Diagrama Ventas y Productos",
              data: sampleDiagramData,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    }

    return { rows: [], rowCount: 0 };
  };

  // 2. Configurar servicio de IA con chatHandler controlable para simular cola llena y fallos
  let chatHandler: (
    systemPrompt: string,
    userContent: string,
    options?: any
  ) => Promise<string> = async (systemPrompt, userContent, options) => {
    const res = await chatWithFallback(systemPrompt, userContent, options);
    return res.text;
  };

  const controllableAiChatService = createAiChatService({
    getDiagramModel: async (diagId: string) => {
      const diagram = await getDiagramById(diagId);
      if (!diagram || !diagram.data) return null;
      return extractUmlModel(diagram.data);
    },
    listRecentMessages: async (diagId: string, limit: number) => {
      const docs = await listMessages(diagId, limit);
      return docs.map((d) => ({
        id: d.id,
        authorName: d.authorName,
        text: d.text,
      }));
    },
    chat: async (sysPrompt, userContent, options) => {
      return chatHandler(sysPrompt, userContent, options);
    },
  });

  // 3. Iniciar servidor HTTP con Socket.IO usando el servicio controlable
  const server = http.createServer(app);
  const ioServer = initSocket(server, controllableAiChatService);
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const serverUrl = `http://localhost:${port}`;
  console.log(`[Setup] Servidor de prueba iniciado en ${serverUrl}`);

  // Helper para conectar cliente y unirlo a la sala
  const createClient = (sessionId: string, username: string): Promise<ClientSocketType> => {
    return new Promise((resolve, reject) => {
      const socket = ClientSocket(serverUrl, {
        transports: ["websocket"],
        forceNew: true,
      });

      socket.on("connect", () => {
        socket.emit("join-diagram", { diagramId: TEST_DIAGRAM_ID });

        socket.once("diagram-state", () => {
          socket.emit(
            "chat-join",
            { diagramId: TEST_DIAGRAM_ID, sessionId },
            (res: { ok: boolean; error?: string }) => {
              if (res && res.ok) {
                console.log(`[Setup] Cliente ${username} conectado y unido al chat.`);
                resolve(socket);
              } else {
                reject(new Error(`chat-join falló para ${username}: ${res?.error}`));
              }
            }
          );
        });
      });

      socket.on("connect_error", (err) => reject(err));
    });
  };

  // Helper para esperar respuestas de IA
  const waitForAiResponse = (list: any[], timeoutMs = 15000) => {
    return new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout esperando respuesta de IA")), timeoutMs);
      const check = () => {
        const aiMsg = list.find((m) => m.role === "ai");
        if (aiMsg) {
          clearTimeout(timeout);
          resolve(aiMsg);
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });
  };

  let clientAna: ClientSocketType | null = null;
  let clientLuis: ClientSocketType | null = null;

  try {
    clientAna = await createClient(SESSION_ANA, "Ana");
    clientLuis = await createClient(SESSION_LUIS, "Luis");

    // =========================================================================
    // Prueba 1: @codia ¿cómo relaciono Venta con Producto? (Respuesta + ai-status)
    // =========================================================================
    console.log("\n-----------------------------------------------------------");
    console.log("PRUEBA 1: Ana pregunta '@codia ¿cómo relaciono Venta con Producto?'");
    console.log("-----------------------------------------------------------");

    const p1AnaMsgs: any[] = [];
    const p1LuisMsgs: any[] = [];
    const p1AnaStatus: any[] = [];
    const p1LuisStatus: any[] = [];

    const onMsg1Ana = (msg: any) => p1AnaMsgs.push(msg);
    const onMsg1Luis = (msg: any) => p1LuisMsgs.push(msg);
    const onStatus1Ana = (st: any) => p1AnaStatus.push(st);
    const onStatus1Luis = (st: any) => p1LuisStatus.push(st);

    clientAna.on("chat-message", onMsg1Ana);
    clientLuis.on("chat-message", onMsg1Luis);
    clientAna.on("ai-status", onStatus1Ana);
    clientLuis.on("ai-status", onStatus1Luis);

    const sendAck1: any = await new Promise((res) => {
      clientAna!.emit(
        "chat-message",
        {
          diagramId: TEST_DIAGRAM_ID,
          text: "@codia ¿cómo relaciono Venta con Producto?",
        },
        res
      );
    });
    console.log(`[P1] Ack de envío recibido: ok=${sendAck1?.ok}, error=${sendAck1?.error}`);

    const aiMsgAna = await waitForAiResponse(p1AnaMsgs);
    const aiMsgLuis = await waitForAiResponse(p1LuisMsgs);

    console.log(`[P1] Ana recibió mensaje de Codia: "${aiMsgAna.text.slice(0, 80)}..."`);
    console.log(`[P1] Luis recibió mensaje de Codia: "${aiMsgLuis.text.slice(0, 80)}..."`);

    // Esperar a que se emita el status idle en finally
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout esperando estados ai-status")), 5000);
      const check = () => {
        if (p1AnaStatus.length >= 2 && p1LuisStatus.length >= 2) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });

    console.log(`[P1] Estados recibidos por Ana: ${p1AnaStatus.map((s) => `${s.state}(${s.askerName})`).join(" -> ")}`);
    console.log(`[P1] Estados recibidos por Luis: ${p1LuisStatus.map((s) => `${s.state}(${s.askerName})`).join(" -> ")}`);

    // 1. Verificación del mensaje
    if (!aiMsgAna.text.toLowerCase().includes("ana")) {
      throw new Error(`La respuesta de la IA no nombra a Ana: ${aiMsgAna.text}`);
    }
    if (aiMsgAna.authorName !== AI_DISPLAY_NAME || aiMsgAna.role !== "ai") {
      throw new Error(`Autor o rol inválido en respuesta de IA: ${JSON.stringify(aiMsgAna)}`);
    }
    if (aiMsgAna.addressedTo !== "Ana") {
      throw new Error(`addressedTo esperado 'Ana', obtenido: ${aiMsgAna.addressedTo}`);
    }
    if (!aiMsgAna.replyTo) {
      throw new Error("replyTo no está presente en el mensaje de la IA");
    }

    // 2. Verificación de ai-status (thinking antes de respuesta, idle después, con askerName 'Ana')
    if (p1AnaStatus[0].state !== "thinking" || p1AnaStatus[0].askerName !== "Ana" || p1AnaStatus[0].diagramId !== TEST_DIAGRAM_ID) {
      throw new Error(`Estado inicial de Ana incorrecto: ${JSON.stringify(p1AnaStatus[0])}`);
    }
    if (p1AnaStatus[1].state !== "idle" || p1AnaStatus[1].askerName !== "Ana" || p1AnaStatus[1].diagramId !== TEST_DIAGRAM_ID) {
      throw new Error(`Estado final de Ana incorrecto: ${JSON.stringify(p1AnaStatus[1])}`);
    }
    if (p1LuisStatus[0].state !== "thinking" || p1LuisStatus[0].askerName !== "Ana" || p1LuisStatus[0].diagramId !== TEST_DIAGRAM_ID) {
      throw new Error(`Estado inicial de Luis incorrecto: ${JSON.stringify(p1LuisStatus[0])}`);
    }
    if (p1LuisStatus[1].state !== "idle" || p1LuisStatus[1].askerName !== "Ana" || p1LuisStatus[1].diagramId !== TEST_DIAGRAM_ID) {
      throw new Error(`Estado final de Luis incorrecto: ${JSON.stringify(p1LuisStatus[1])}`);
    }

    console.log("✓ P1 APROBADA: Ambos recibieron respuesta dirigida a Ana y eventos 'ai-status' thinking/idle correspondientes.");

    clientAna.off("chat-message", onMsg1Ana);
    clientLuis.off("chat-message", onMsg1Luis);
    clientAna.off("ai-status", onStatus1Ana);
    clientLuis.off("ai-status", onStatus1Luis);

    // =========================================================================
    // Prueba 2: @codia a secas
    // =========================================================================
    console.log("\n-----------------------------------------------------------");
    console.log("PRUEBA 2: Ana envía '@codia' a secas");
    console.log("-----------------------------------------------------------");

    const p2AnaMsgs: any[] = [];
    clientAna.on("chat-message", (msg) => p2AnaMsgs.push(msg));

    await new Promise((res) => {
      clientAna!.emit(
        "chat-message",
        {
          diagramId: TEST_DIAGRAM_ID,
          text: "@codia",
        },
        res
      );
    });

    const aiMsgAsecas = await waitForAiResponse(p2AnaMsgs);
    console.log(`[P2] Respuesta de Codia a secas: "${aiMsgAsecas.text}"`);

    if (!aiMsgAsecas.text.includes("Ana, ¿en qué puedo ayudarte?")) {
      throw new Error(`Respuesta inesperada para @codia a secas: ${aiMsgAsecas.text}`);
    }
    console.log("✓ P2 APROBADA: Respondió con saludo de ayuda.");
    clientAna.removeAllListeners("chat-message");

    // =========================================================================
    // Prueba 3: Mensaje sin mención o con @codiax (no responde la IA ni emite status)
    // =========================================================================
    console.log("\n-----------------------------------------------------------");
    console.log("PRUEBA 3: Mensaje normal o con '@codiax' (no debe activar a la IA)");
    console.log("-----------------------------------------------------------");

    const p3Msgs: any[] = [];
    const p3Status: any[] = [];
    clientAna.on("chat-message", (msg) => p3Msgs.push(msg));
    clientAna.on("ai-status", (st) => p3Status.push(st));

    await new Promise((res) => {
      clientLuis!.emit(
        "chat-message",
        {
          diagramId: TEST_DIAGRAM_ID,
          text: "Hola @codiax, qué opinas del diagrama?",
        },
        res
      );
    });

    await new Promise((res) => setTimeout(res, 1500));

    const aiP3 = p3Msgs.filter((m) => m.role === "ai");
    if (aiP3.length > 0 || p3Status.length > 0) {
      throw new Error("La IA respondió o emitió status ante un mensaje con @codiax");
    }
    console.log("✓ P3 APROBADA: La IA no se activó ante '@codiax'.");
    clientAna.removeAllListeners("chat-message");
    clientAna.removeAllListeners("ai-status");

    // =========================================================================
    // Prueba 4: Ana y Luis preguntando casi a la vez (menciones @ia y @Codia)
    // =========================================================================
    console.log("\n-----------------------------------------------------------");
    console.log("PRUEBA 4: Ana pregunta con '@ia' y Luis con '@Codia' simultáneamente");
    console.log("-----------------------------------------------------------");

    const p4AiMsgs: any[] = [];
    clientAna.on("chat-message", (msg) => {
      if (msg.role === "ai") p4AiMsgs.push(msg);
    });

    clientAna.emit("chat-message", {
      diagramId: TEST_DIAGRAM_ID,
      text: "@ia ¿cuántas clases ves en el modelo?",
    });

    clientLuis.emit("chat-message", {
      diagramId: TEST_DIAGRAM_ID,
      text: "@Codia ¿qué campos tiene Producto?",
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout esperando 2 respuestas de IA")), 20000);
      const check = () => {
        if (p4AiMsgs.length >= 2) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });

    console.log(`[P4] Respuesta 1 para: ${p4AiMsgs[0].addressedTo} -> "${p4AiMsgs[0].text.slice(0, 60)}..."`);
    console.log(`[P4] Respuesta 2 para: ${p4AiMsgs[1].addressedTo} -> "${p4AiMsgs[1].text.slice(0, 60)}..."`);

    if (p4AiMsgs[0].addressedTo !== "Ana" || p4AiMsgs[1].addressedTo !== "Luis") {
      throw new Error(
        `Orden o destinatario incorrecto en respuestas concurrentes: [${p4AiMsgs[0].addressedTo}, ${p4AiMsgs[1].addressedTo}]`
      );
    }
    console.log("✓ P4 APROBADA: Ambas consultas atendidas en orden FIFO dirigidas a sus autores.");
    clientAna.removeAllListeners("chat-message");

    // =========================================================================
    // Prueba 5: GET /diagrams/:id/chat incluye mensajes role 'ai'
    // =========================================================================
    console.log("\n-----------------------------------------------------------");
    console.log("PRUEBA 5: GET /diagrams/:id/chat incluye mensajes role 'ai'");
    console.log("-----------------------------------------------------------");

    const httpRes = await fetch(`${serverUrl}/diagrams/${TEST_DIAGRAM_ID}/chat?limit=50`, {
      method: "GET",
      headers: {
        "x-session-id": SESSION_ANA,
      },
    });

    if (httpRes.status !== 200) {
      throw new Error(`HTTP status esperado 200, obtenido: ${httpRes.status}`);
    }

    const chatData: any = await httpRes.json();
    const messages = chatData.messages || [];

    const aiMessagesInHistory = messages.filter((m: any) => m.role === "ai");
    console.log(`[P5] Mensajes totales recuperados: ${messages.length}`);
    console.log(`[P5] Mensajes de IA recuperados: ${aiMessagesInHistory.length}`);

    if (aiMessagesInHistory.length === 0) {
      throw new Error("No se encontraron mensajes con role 'ai' en el historial de chat.");
    }

    const firstAiMsg = aiMessagesInHistory[0];
    if (!firstAiMsg.replyTo || !firstAiMsg.addressedTo) {
      throw new Error(
        `Mensaje de IA en historial carece de replyTo o addressedTo: ${JSON.stringify(firstAiMsg)}`
      );
    }
    console.log(`[P5] Primer mensaje de IA verificado: role=${firstAiMsg.role}, addressedTo=${firstAiMsg.addressedTo}, replyTo=${firstAiMsg.replyTo}`);
    console.log("✓ P5 APROBADA: GET /diagrams/:id/chat expone los mensajes de IA con metadatos.");

    // =========================================================================
    // Prueba 6: 6 consultas rápidas con cola llena (AiBusyError en la 6ta pendiente)
    // =========================================================================
    console.log("\n-----------------------------------------------------------");
    console.log("PRUEBA 6: 6 consultas rápidas (la sexta recibe 'atendiendo otras consultas')");
    console.log("-----------------------------------------------------------");

    let releaseBlockGate: () => void = () => {};
    const blockGatePromise = new Promise<void>((r) => {
      releaseBlockGate = r;
    });

    let onBlockingChatStarted: () => void = () => {};
    const blockingChatStartedPromise = new Promise<void>((r) => {
      onBlockingChatStarted = r;
    });

    chatHandler = async (_sys, user) => {
      if (user.includes("ConsultaBloqueante")) {
        onBlockingChatStarted();
        await blockGatePromise;
        return "Respuesta a consulta bloqueante.";
      }
      return "Respuesta normal a consulta en cola.";
    };

    const p6AiMsgs: any[] = [];
    const onMsg6 = (msg: any) => {
      if (msg.role === "ai") p6AiMsgs.push(msg);
    };
    clientAna.on("chat-message", onMsg6);
    clientLuis.on("chat-message", onMsg6);

    // 1. Iniciar consulta bloqueante para ocupar el slot activo
    clientAna.emit("chat-message", {
      diagramId: TEST_DIAGRAM_ID,
      text: "@ia ConsultaBloqueante inicial",
    });

    // Esperar a que la consulta bloqueante tome el slot activo
    await blockingChatStartedPromise;
    console.log("[P6] Consulta bloqueante activa ocupando el worker de IA.");

    // 2. Enviar 5 consultas que ocupan los 5 slots de espera en la cola
    for (let i = 1; i <= 5; i++) {
      await new Promise((res) => {
        clientAna!.emit(
          "chat-message",
          {
            diagramId: TEST_DIAGRAM_ID,
            text: `@ia Consulta rápida ${i}`,
          },
          res
        );
      });
    }
    console.log("[P6] 5 consultas encoladas (cola al máximo de su capacidad: 5).");

    // 3. La 6ta consulta rápida la envía Luis y debe rebotar de inmediato con AiBusyError
    await new Promise((res) => {
      clientLuis!.emit(
        "chat-message",
        {
          diagramId: TEST_DIAGRAM_ID,
          text: "@ia Consulta rápida 6 (debe rebotar por cola llena)",
        },
        res
      );
    });

    // Esperar a que llegue el mensaje de rechazo por ocupado (AiBusyError es inmediato)
    const busyMsg = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout esperando mensaje de ocupado para la 6ta consulta")), 5000);
      const check = () => {
        const found = p6AiMsgs.find(
          (m) =>
            m.addressedTo === "Luis" &&
            m.text.toLowerCase().includes("atendiendo otras consultas")
        );
        if (found) {
          clearTimeout(timeout);
          resolve(found);
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });

    console.log(`[P6] Mensaje de ocupado recibido por Luis: "${busyMsg.text}"`);

    if (!busyMsg.text.includes("estoy atendiendo otras consultas del equipo en este momento")) {
      throw new Error(`Texto de mensaje de ocupado inesperado: ${busyMsg.text}`);
    }
    if (busyMsg.addressedTo !== "Luis") {
      throw new Error(`addressedTo esperado 'Luis', obtenido: ${busyMsg.addressedTo}`);
    }
    if (busyMsg.role !== "ai" || busyMsg.authorName !== AI_DISPLAY_NAME) {
      throw new Error(`Rol o autor incorrecto en mensaje de ocupado: ${JSON.stringify(busyMsg)}`);
    }

    // Liberar la tarea bloqueante para vaciar la cola normalmente
    releaseBlockGate();

    // Esperar a que se procesen las 5 consultas pendientes y la bloqueante (total 6 respuestas + 1 busy = 7)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout esperando resolución de cola en P6")), 10000);
      const check = () => {
        if (p6AiMsgs.length >= 7) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });

    console.log("✓ P6 APROBADA: La sexta consulta rápida recibió de inmediato el aviso de IA ocupada.");
    clientAna.off("chat-message", onMsg6);
    clientLuis.off("chat-message", onMsg6);

    // =========================================================================
    // Prueba 7: Fallo de proveedores de IA (AiUnavailableError con mensaje de reintento)
    // =========================================================================
    console.log("\n-----------------------------------------------------------");
    console.log("PRUEBA 7: Proveedores de IA caídos (AiUnavailableError)");
    console.log("-----------------------------------------------------------");

    // Simular que todos los proveedores fallan
    chatHandler = async () => {
      throw new Error("Simulación: Conexión rechazada con los servicios de IA (503 Service Unavailable)");
    };

    const p7AiMsgs: any[] = [];
    const p7Status: any[] = [];
    const onMsg7 = (msg: any) => {
      if (msg.role === "ai") p7AiMsgs.push(msg);
    };
    const onStatus7 = (st: any) => p7Status.push(st);

    clientAna.on("chat-message", onMsg7);
    clientLuis.on("chat-message", onMsg7);
    clientAna.on("ai-status", onStatus7);

    // Ana consulta a la IA sabiendo que fallará
    clientAna.emit("chat-message", {
      diagramId: TEST_DIAGRAM_ID,
      text: "@ia ¿puedes sugerirme un patrón para este diagrama?",
    });

    // Esperar mensaje de error
    const errorMsg = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout esperando mensaje de fallo de IA")), 8000);
      const check = () => {
        const found = p7AiMsgs.find(
          (m) =>
            m.addressedTo === "Ana" &&
            m.text.toLowerCase().includes("no pude responder")
        );
        if (found) {
          clearTimeout(timeout);
          resolve(found);
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });

    console.log(`[P7] Mensaje de fallo recibido por Ana: "${errorMsg.text}"`);

    // Esperar a que el status retorne a idle
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout esperando status en P7")), 4000);
      const check = () => {
        if (p7Status.some((s) => s.state === "idle")) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });

    if (!errorMsg.text.includes("no pude responder en este momento debido a un problema con los servicios de IA. Por favor, reintenta tu consulta.")) {
      throw new Error(`Texto de mensaje de indisponibilidad inesperado: ${errorMsg.text}`);
    }
    if (errorMsg.addressedTo !== "Ana") {
      throw new Error(`addressedTo esperado 'Ana', obtenido: ${errorMsg.addressedTo}`);
    }
    if (errorMsg.role !== "ai" || errorMsg.authorName !== AI_DISPLAY_NAME) {
      throw new Error(`Rol o autor incorrecto en mensaje de fallo: ${JSON.stringify(errorMsg)}`);
    }

    const thinkingSt = p7Status.find((s) => s.state === "thinking" && s.askerName === "Ana");
    const idleSt = p7Status.find((s) => s.state === "idle" && s.askerName === "Ana");
    if (!thinkingSt || !idleSt) {
      throw new Error(`Estados ai-status incompletos en P7: ${JSON.stringify(p7Status)}`);
    }

    console.log("✓ P7 APROBADA: Fallo controlado emitió aviso de reintento dirigido a Ana y restauró ai-status a idle.");
    clientAna.off("chat-message", onMsg7);
    clientLuis.off("chat-message", onMsg7);
    clientAna.off("ai-status", onStatus7);

    console.log("\n===============================================================");
    console.log("TODAS LAS PRUEBAS DE INTEGRACIÓN CU19 PASARON EXITOSAMENTE (7/7)");
    console.log("===============================================================");
  } finally {
    // Breve pausa para asegurar que cualquier escritura en segundo plano termine antes del cierre
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Limpieza
    if (clientAna) clientAna.disconnect();
    if (clientLuis) clientLuis.disconnect();
    (pool as any).query = originalPoolQuery;

    try {
      const db = await getMongoDb();
      if (db) {
        await db.collection(CHAT_COLLECTION_NAME).deleteMany({
          diagramId: TEST_DIAGRAM_ID,
        });
      }
    } catch {
      // Ignorar errores en limpieza de tests
    }

    await new Promise<void>((resolve) => ioServer.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeMongoConnection();
  }
}

main().catch((err) => {
  console.error("\n✗ ERROR EN PRUEBA DE INTEGRACIÓN:", err);
  process.exit(1);
});
