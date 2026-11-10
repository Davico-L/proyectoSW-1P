/**
 * Script de prueba de integración Socket.IO para CU22 (Modo Approval / Pide aprobación).
 *
 * Simula dos clientes Socket.IO (Ana y Luis) en la misma sala colaborativa:
 *   1) Configura el modo de la sala en "approval" ("Pide aprobación").
 *   2) Ana solicita "@Codia agrega la clase Factura": comprueba que ambos clientes
 *      reciben la propuesta pendiente en chat-message sin operations y que ningún
 *      socket recibe el evento 'ai-operations'.
 *   3) Luis rechaza la propuesta: comprueba que ambos reciben 'proposal-updated'
 *      con status "rejected" y el mensaje de sistema en el chat.
 *   4) Nuevo pedido de modificación: Luis aprueba (su cliente responde el ack de
 *      'ai-operations' con applied 1) y ambos reciben 'proposal-updated' con "approved".
 *   5) Doble aprobación concurrente sobre un nuevo pedido: ambos intentan aprobar en
 *      paralelo; comprueba que exactamente una gana (ok: true) y la otra recibe 'already_decided'.
 *
 * Utiliza Groq como proveedor de IA para preservar la cuota de Gemini.
 *
 * Uso:
 *   npx tsx src/scripts/cu22-socket-smoke.ts
 *   o
 *   npm run smoke:cu22
 */

import path from "path";
import http from "http";
import { AddressInfo } from "net";
import dotenv from "dotenv";
import { io as ClientSocket, Socket } from "socket.io-client";

// Cargar variables de entorno desde backend/.env
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

import { initSocket } from "../socket";
import { pool } from "../db";
import { getMongoDb, closeMongoConnection } from "../db/mongo";
import { CHAT_COLLECTION_NAME } from "../chat/chatRepository";
import { ROOM_SETTINGS_COLLECTION_NAME } from "../chat/roomSettingsRepository";
import {
  setActiveProviderId,
  getActiveProviderId,
} from "../ai/providers/providerManager";

const DIAGRAM_ID = `smoke-cu22-${Date.now()}`;
const SESSION_ID_ANA = "smoke-cu22-session-ana";
const SESSION_ID_LUIS = "smoke-cu22-session-luis";
const USERNAME_ANA = "Ana";
const USERNAME_LUIS = "Luis";

console.log("================================================================");
console.log("=== CU22 Socket Smoke Test — Modo Approval (Pide Aprobación) ===");
console.log(`Diagrama        : ${DIAGRAM_ID}`);
console.log(`Usuario A (Ana) : ${SESSION_ID_ANA}`);
console.log(`Usuario B (Luis): ${SESSION_ID_LUIS}`);
console.log("================================================================\n");

// 1. Configurar Groq como proveedor activo para no gastar cuota de Gemini
setActiveProviderId("groq");
console.log(`[Setup] Proveedor de IA configurado a: '${getActiveProviderId()}' (Groq)\n`);

let server: http.Server | null = null;
let ioServer: any = null;
let clientAna: Socket | null = null;
let clientLuis: Socket | null = null;
let originalPoolQuery: any = null;

// Timeout de seguridad global: 60 segundos
const safetyTimeout = setTimeout(() => {
  console.error("\n[Timeout] El smoke test superó el tiempo límite de 60 segundos.");
  cleanup(1);
}, 60000);

async function cleanup(exitCode: number = 0) {
  clearTimeout(safetyTimeout);

  if (clientAna) {
    clientAna.disconnect();
    clientAna = null;
  }
  if (clientLuis) {
    clientLuis.disconnect();
    clientLuis = null;
  }

  try {
    const db = await getMongoDb();
    if (db) {
      await db.collection(CHAT_COLLECTION_NAME).deleteMany({ diagramId: DIAGRAM_ID });
      await db.collection(ROOM_SETTINGS_COLLECTION_NAME).deleteMany({ diagramId: DIAGRAM_ID });
    }
  } catch {
    // Ignorar errores de limpieza
  }

  if (ioServer) {
    await new Promise<void>((resolve) => ioServer.close(() => resolve()));
    ioServer = null;
  }

  if (server) {
    server.close();
    server = null;
  }

  if (originalPoolQuery) {
    (pool as any).query = originalPoolQuery;
  }

  await closeMongoConnection();
  process.exit(exitCode);
}

// Helper para esperar un mensaje de Codia (role: "ai") en un cliente
function waitForCodiaMessage(
  client: Socket,
  predicate?: (msg: any) => boolean,
  timeoutMs = 25000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off("chat-message", listener);
      reject(new Error(`Timeout esperando mensaje de Codia (${timeoutMs}ms)`));
    }, timeoutMs);

    const listener = (msg: any) => {
      if (msg?.role === "ai") {
        if (!predicate || predicate(msg)) {
          clearTimeout(timer);
          client.off("chat-message", listener);
          resolve(msg);
        }
      }
    };

    client.on("chat-message", listener);
  });
}

// Helper para esperar el evento 'proposal-updated'
function waitForProposalUpdated(
  client: Socket,
  timeoutMs = 15000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off("proposal-updated", listener);
      reject(new Error(`Timeout esperando proposal-updated (${timeoutMs}ms)`));
    }, timeoutMs);

    const listener = (evt: any) => {
      clearTimeout(timer);
      client.off("proposal-updated", listener);
      resolve(evt);
    };

    client.on("proposal-updated", listener);
  });
}

// Helper para esperar mensaje de sistema
function waitForSystemMessage(
  client: Socket,
  snippet: string,
  timeoutMs = 15000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off("chat-message", listener);
      reject(new Error(`Timeout esperando mensaje de sistema con '${snippet}'`));
    }, timeoutMs);

    const listener = (msg: any) => {
      if (msg?.role === "system" && typeof msg?.text === "string" && msg.text.includes(snippet)) {
        clearTimeout(timer);
        client.off("chat-message", listener);
        resolve(msg);
      }
    };

    client.on("chat-message", listener);
  });
}

async function run() {
  // 1. Interceptar pool.query para sesiones de Postgres y diagrama
  originalPoolQuery = pool.query;
  (pool as any).query = async (text: any, params?: any[]) => {
    const queryStr = typeof text === "string" ? text : text?.text || "";

    if (queryStr.includes("FROM sessions") && queryStr.includes("WHERE id = $1")) {
      if (params?.[0] === SESSION_ID_ANA) {
        return {
          rows: [{ id: SESSION_ID_ANA, username: USERNAME_ANA, created_at: new Date().toISOString() }],
          rowCount: 1,
        };
      }
      if (params?.[0] === SESSION_ID_LUIS) {
        return {
          rows: [{ id: SESSION_ID_LUIS, username: USERNAME_LUIS, created_at: new Date().toISOString() }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    }

    if (queryStr.includes("SELECT 1 FROM sessions WHERE id = $1")) {
      if (params?.[0] === SESSION_ID_ANA || params?.[0] === SESSION_ID_LUIS) {
        return { rows: [{ "?column?": 1 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (queryStr.includes("FROM diagrams") && queryStr.includes("WHERE id = $1")) {
      return {
        rows: [
          {
            id: DIAGRAM_ID,
            session_id: SESSION_ID_ANA,
            name: "Diagrama Smoke CU22",
            data: { elements: [] },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        rowCount: 1,
      };
    }

    try {
      return await originalPoolQuery.call(pool, text, params);
    } catch {
      return { rows: [], rowCount: 0 };
    }
  };

  // 2. Iniciar servidor Socket.IO en puerto efímero
  server = http.createServer();
  ioServer = initSocket(server);
  await new Promise<void>((resolve) => server!.listen(0, () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const serverUrl = `http://localhost:${port}`;
  console.log(`[Servidor] Escuchando en ${serverUrl}\n`);

  // 3. Conectar cliente Ana y cliente Luis
  clientAna = ClientSocket(serverUrl, { transports: ["websocket"], forceNew: true });
  clientLuis = ClientSocket(serverUrl, { transports: ["websocket"], forceNew: true });

  await Promise.all([
    new Promise<void>((resolve, reject) => {
      clientAna!.on("connect", () => resolve());
      clientAna!.on("connect_error", reject);
    }),
    new Promise<void>((resolve, reject) => {
      clientLuis!.on("connect", () => resolve());
      clientLuis!.on("connect_error", reject);
    }),
  ]);

  console.log(`[Cliente Ana] Conectada (socket ${clientAna.id})`);
  console.log(`[Cliente Luis] Conectado (socket ${clientLuis.id})`);

  // Unir ambos sockets a la sala del diagrama y al chat
  await Promise.all([
    new Promise<void>((resolve) => {
      clientAna!.once("diagram-state", () => resolve());
      clientAna!.emit("join-diagram", { diagramId: DIAGRAM_ID });
    }),
    new Promise<void>((resolve) => {
      clientLuis!.once("diagram-state", () => resolve());
      clientLuis!.emit("join-diagram", { diagramId: DIAGRAM_ID });
    }),
  ]);

  const [joinAnaRes, joinLuisRes]: any[] = await Promise.all([
    new Promise((resolve) =>
      clientAna!.emit("chat-join", { diagramId: DIAGRAM_ID, sessionId: SESSION_ID_ANA }, resolve)
    ),
    new Promise((resolve) =>
      clientLuis!.emit("chat-join", { diagramId: DIAGRAM_ID, sessionId: SESSION_ID_LUIS }, resolve)
    ),
  ]);

  if (!joinAnaRes?.ok || !joinLuisRes?.ok) {
    console.error("-> FALLO en chat-join de Ana o Luis:", { joinAnaRes, joinLuisRes });
    await cleanup(1);
  }
  console.log("-> Ambos clientes unidos exitosamente a la sala y chat.\n");

  // Rastrear si llega 'ai-operations' a alguno de los sockets
  let aiOpsReceivedOnAna = false;
  let aiOpsReceivedOnLuis = false;

  clientAna.on("ai-operations", (_data, ackCallback) => {
    aiOpsReceivedOnAna = true;
    console.log("[Ana] ai-operations RECIBIDO.");
    if (typeof ackCallback === "function") {
      ackCallback({ applied: 1, failed: 0 });
    }
  });

  clientLuis.on("ai-operations", (_data, ackCallback) => {
    aiOpsReceivedOnLuis = true;
    console.log("[Luis] ai-operations RECIBIDO. Respondiendo ack { applied: 1, failed: 0 }");
    if (typeof ackCallback === "function") {
      ackCallback({ applied: 1, failed: 0 });
    }
  });

  // -------------------------------------------------------------------------
  // PASO 1: Poner el modo de sala en "approval" ("Pide aprobación")
  // -------------------------------------------------------------------------
  console.log("----------------------------------------------------------------");
  console.log("[PASO 1] Configurando modo 'approval' en la sala...");
  const setModeRes: any = await new Promise((resolve) => {
    clientAna!.emit(
      "ai-settings-update",
      { diagramId: DIAGRAM_ID, mode: "approval", style: "mentora" },
      resolve
    );
  });

  console.log("-> Ack de ai-settings-update:", setModeRes);
  if (!setModeRes?.ok || setModeRes?.settings?.mode !== "approval") {
    console.error("-> FALLO: No se pudo configurar el modo 'approval'.");
    await cleanup(1);
  }
  console.log("-> OK: Modo 'approval' activo en la sala.\n");

  // -------------------------------------------------------------------------
  // PASO 2: Ana pide "@Codia agrega la clase Factura"
  // Comprobar que ambos reciben propuesta pendiente sin operations y que
  // no llega ai-operations a ningún socket.
  // -------------------------------------------------------------------------
  console.log("----------------------------------------------------------------");
  console.log("[PASO 2] Ana solicita: '@Codia agrega la clase Factura'...");
  aiOpsReceivedOnAna = false;
  aiOpsReceivedOnLuis = false;

  const waitAnaMsgPromise = waitForCodiaMessage(clientAna!);
  const waitLuisMsgPromise = waitForCodiaMessage(clientLuis!);

  // Enviar mensaje de chat
  clientAna.emit("chat-message", {
    diagramId: DIAGRAM_ID,
    text: "@Codia agrega la clase Factura",
  });

  console.log("-> Esperando respuesta de Codia a través de Groq...");
  const [msgOnAna, msgOnLuis] = await Promise.all([
    waitAnaMsgPromise,
    waitLuisMsgPromise,
  ]);

  console.log(`-> Respuesta de Codia recibida por Ana: "${msgOnAna.text}"`);
  console.log(`-> Kind del mensaje recibido: '${msgOnAna.kind}'`);

  if (msgOnAna.kind !== "proposal" || msgOnLuis.kind !== "proposal") {
    console.error("-> FALLO: Se esperaba kind 'proposal', recibido:", {
      anaKind: msgOnAna.kind,
      luisKind: msgOnLuis.kind,
    });
    await cleanup(1);
  }

  if (msgOnAna.operations !== undefined || msgOnLuis.operations !== undefined) {
    console.error("-> FALLO: 'operations' no debe viajar en el broadcast a clientes.");
    await cleanup(1);
  }

  if (msgOnAna.proposal?.status !== "pending" || msgOnLuis.proposal?.status !== "pending") {
    console.error("-> FALLO: La propuesta debe estar en status 'pending'.");
    await cleanup(1);
  }

  if (aiOpsReceivedOnAna || aiOpsReceivedOnLuis) {
    console.error("-> FALLO: NO debió emitirse 'ai-operations' en modo approval.");
    await cleanup(1);
  }

  const proposal1Id = msgOnAna.id;
  console.log(`-> OK: Propuesta pendiente recibida por ambos clientes (ID: ${proposal1Id}).`);
  console.log("-> OK: Ningún cliente recibió 'ai-operations'.\n");

  // -------------------------------------------------------------------------
  // PASO 3: Luis rechaza la propuesta
  // Ambos reciben proposal-updated con "rejected" y mensaje de sistema.
  // -------------------------------------------------------------------------
  console.log("----------------------------------------------------------------");
  console.log("[PASO 3] Luis rechaza la propuesta...");

  const waitUpdatedRejectAna = waitForProposalUpdated(clientAna!);
  const waitUpdatedRejectLuis = waitForProposalUpdated(clientLuis!);
  const waitSysRejectAna = waitForSystemMessage(clientAna!, "Luis rechazó la propuesta");

  const rejectAckRes: any = await new Promise((resolve) => {
    clientLuis!.emit(
      "proposal-decision",
      { diagramId: DIAGRAM_ID, proposalId: proposal1Id, decision: "reject" },
      resolve
    );
  });

  console.log("-> Ack de proposal-decision (reject):", rejectAckRes);
  if (!rejectAckRes?.ok || rejectAckRes?.proposal?.status !== "rejected") {
    console.error("-> FALLO: Ack de rechazo no devolvió ok: true ni status 'rejected'.");
    await cleanup(1);
  }

  const [propUpdAna, propUpdLuis, sysMsg] = await Promise.all([
    waitUpdatedRejectAna,
    waitUpdatedRejectLuis,
    waitSysRejectAna,
  ]);

  if (
    propUpdAna.proposal?.status !== "rejected" ||
    propUpdLuis.proposal?.status !== "rejected" ||
    propUpdAna.proposal?.decidedBy !== USERNAME_LUIS
  ) {
    console.error("-> FALLO en broadcast proposal-updated de rechazo:", {
      propUpdAna,
      propUpdLuis,
    });
    await cleanup(1);
  }

  console.log(`-> Mensaje de sistema recibido: "${sysMsg.text}"`);
  console.log("-> OK: Ambos clientes recibieron 'proposal-updated' con status 'rejected'.\n");

  // -------------------------------------------------------------------------
  // PASO 4: Nuevo pedido, Luis aprueba
  // Luis responde el ack de ai-operations con { applied: 1, failed: 0 }
  // y ambos reciben proposal-updated con "approved".
  // -------------------------------------------------------------------------
  console.log("----------------------------------------------------------------");
  console.log("[PASO 4] Nuevo pedido: Ana solicita '@Codia agrega la clase Cliente'...");

  const waitMsg2Ana = waitForCodiaMessage(clientAna!);
  const waitMsg2Luis = waitForCodiaMessage(clientLuis!);

  clientAna.emit("chat-message", {
    diagramId: DIAGRAM_ID,
    text: "@Codia agrega la clase Cliente",
  });

  console.log("-> Esperando segunda propuesta de Codia...");
  const [msg2Ana] = await Promise.all([waitMsg2Ana, waitMsg2Luis]);
  const proposal2Id = msg2Ana.id;
  console.log(`-> Segunda propuesta recibida (ID: ${proposal2Id}).`);

  console.log("-> Luis aprueba la propuesta...");
  aiOpsReceivedOnAna = false;
  aiOpsReceivedOnLuis = false;

  const waitUpdatedApproveAna = waitForProposalUpdated(clientAna!);
  const waitUpdatedApproveLuis = waitForProposalUpdated(clientLuis!);
  const waitSysApproveAna = waitForSystemMessage(clientAna!, "Luis aprobó la propuesta");

  const approveAckRes: any = await new Promise((resolve) => {
    clientLuis!.emit(
      "proposal-decision",
      { diagramId: DIAGRAM_ID, proposalId: proposal2Id, decision: "approve" },
      resolve
    );
  });

  console.log("-> Ack de proposal-decision (approve):", approveAckRes);
  if (!approveAckRes?.ok || approveAckRes?.proposal?.status !== "approved") {
    console.error("-> FALLO: Ack de aprobación no devolvió status 'approved'.", approveAckRes);
    await cleanup(1);
  }

  if (!aiOpsReceivedOnLuis) {
    console.error("-> FALLO: Luis debió haber recibido 'ai-operations' para aplicar.");
    await cleanup(1);
  }

  if (aiOpsReceivedOnAna) {
    console.error("-> FALLO: Ana NO debió recibir 'ai-operations' (solo el aprobador).");
    await cleanup(1);
  }

  const [prop2UpdAna, prop2UpdLuis, sysApproveMsg] = await Promise.all([
    waitUpdatedApproveAna,
    waitUpdatedApproveLuis,
    waitSysApproveAna,
  ]);

  if (
    prop2UpdAna.proposal?.status !== "approved" ||
    prop2UpdLuis.proposal?.status !== "approved" ||
    prop2UpdAna.proposal?.decidedBy !== USERNAME_LUIS
  ) {
    console.error("-> FALLO en broadcast proposal-updated de aprobación:", {
      prop2UpdAna,
      prop2UpdLuis,
    });
    await cleanup(1);
  }

  console.log(`-> Mensaje de sistema recibido: "${sysApproveMsg.text}"`);
  console.log("-> OK: Ambos clientes recibieron 'proposal-updated' con status 'approved'.\n");

  // -------------------------------------------------------------------------
  // PASO 5: Doble aprobación simultánea con otro pedido
  // Solo una gana (ok: true) y la otra recibe 'already_decided'.
  // -------------------------------------------------------------------------
  console.log("----------------------------------------------------------------");
  console.log("[PASO 5] Tercer pedido: Ana solicita '@Codia agrega la clase Pedido'...");

  const waitMsg3Ana = waitForCodiaMessage(clientAna!);
  const waitMsg3Luis = waitForCodiaMessage(clientLuis!);

  clientAna.emit("chat-message", {
    diagramId: DIAGRAM_ID,
    text: "@Codia agrega la clase Pedido",
  });

  console.log("-> Esperando tercera propuesta de Codia...");
  const [msg3Ana] = await Promise.all([waitMsg3Ana, waitMsg3Luis]);
  const proposal3Id = msg3Ana.id;
  console.log(`-> Tercera propuesta recibida (ID: ${proposal3Id}).`);

  console.log("-> Lanzando aprobaciones concurrentes desde Ana y Luis...");
  const [resConcurrentAna, resConcurrentLuis]: any[] = await Promise.all([
    new Promise((resolve) =>
      clientAna!.emit(
        "proposal-decision",
        { diagramId: DIAGRAM_ID, proposalId: proposal3Id, decision: "approve" },
        resolve
      )
    ),
    new Promise((resolve) =>
      clientLuis!.emit(
        "proposal-decision",
        { diagramId: DIAGRAM_ID, proposalId: proposal3Id, decision: "approve" },
        resolve
      )
    ),
  ]);

  console.log("-> Resultado Ana :", resConcurrentAna);
  console.log("-> Resultado Luis:", resConcurrentLuis);

  const results = [resConcurrentAna, resConcurrentLuis];
  const winners = results.filter((r) => r?.ok === true);
  const losers = results.filter((r) => r?.ok === false);

  if (winners.length !== 1) {
    console.error(`-> FALLO: Se esperaba exactamente 1 ganador, obtenidos: ${winners.length}`);
    await cleanup(1);
  }

  if (losers.length !== 1 || losers[0]?.error !== "already_decided") {
    console.error("-> FALLO: El perdedor debió recibir error 'already_decided', recibido:", losers);
    await cleanup(1);
  }

  console.log("-> OK: Exactamente una aprobación ganó y la otra recibió 'already_decided'.\n");

  console.log("================================================================");
  console.log("=== SMOKE TEST CU22 COMPLETADO EXITOSAMENTE AL 100% ===");
  console.log("================================================================");

  await cleanup(0);
}

run().catch(async (err) => {
  console.error("\n[ERROR FATAL en Smoke Test CU22]:", err);
  await cleanup(1);
});
