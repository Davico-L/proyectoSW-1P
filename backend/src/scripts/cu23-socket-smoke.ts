/**
 * Script de prueba manual / smoke test de Socket.IO para CU23 (Configuración de Codia por sala).
 *
 * Simula dos clientes Socket.IO en la misma sala:
 * 1. Intento sin chat-join previo -> verifica rechazo con 'not_joined'.
 * 2. Ambos clientes completan chat-join -> reciben settings iniciales en el ack.
 * 3. Cliente A envía valor inválido -> verifica rechazo con 'invalid_value'.
 * 4. Cliente A cambia el estilo a 'directa' -> ack exitoso.
 * 5. Cliente B recibe evento 'ai-settings-changed' y mensaje 'chat-message' con role 'system'.
 *
 * Uso:
 *   npx tsx src/scripts/cu23-socket-smoke.ts
 *   o
 *   npm run smoke:cu23
 */

import { io, Socket } from "socket.io-client";

const SERVER_URL =
  process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
const DIAGRAM_ID = process.env.DIAGRAM_ID || `smoke-diag-cu23-${Date.now()}`;
const SESSION_ID_A = process.env.SESSION_ID_A || "smoke-session-a";
const SESSION_ID_B = process.env.SESSION_ID_B || "smoke-session-b";

console.log("==================================================");
console.log("=== CU23 Socket Smoke Test — Configuración de Codia ===");
console.log(`Servidor    : ${SERVER_URL}`);
console.log(`Diagrama    : ${DIAGRAM_ID}`);
console.log(`Sesión A    : ${SESSION_ID_A}`);
console.log(`Sesión B    : ${SESSION_ID_B}`);
console.log("==================================================\n");

let clientA: Socket;
let clientB: Socket;

const safetyTimeout = setTimeout(() => {
  console.error("\n[Timeout] El smoke test no completó en 20 segundos.");
  cleanup(1);
}, 20000);

function cleanup(exitCode: number = 0) {
  clearTimeout(safetyTimeout);
  if (clientA) clientA.disconnect();
  if (clientB) clientB.disconnect();
  process.exit(exitCode);
}

async function runSmokeTest() {
  // Conectar cliente A y B
  clientA = io(SERVER_URL, { transports: ["websocket"], autoConnect: true });
  clientB = io(SERVER_URL, { transports: ["websocket"], autoConnect: true });

  await Promise.all([
    new Promise<void>((resolve) => clientA.on("connect", () => resolve())),
    new Promise<void>((resolve) => clientB.on("connect", () => resolve())),
  ]);

  console.log(`[Cliente A] Conectado (socket ${clientA.id})`);
  console.log(`[Cliente B] Conectado (socket ${clientB.id})`);

  // Paso 1: Cliente A intenta cambiar configuración sin haber hecho chat-join
  console.log("\n[Paso 1] Probando ai-settings-update sin chat-join previo...");
  const preJoinRes: any = await new Promise((resolve) => {
    clientA.emit(
      "ai-settings-update",
      { diagramId: DIAGRAM_ID, mode: "advise", style: "directa" },
      (res: any) => resolve(res)
    );
  });

  if (preJoinRes?.ok === false && preJoinRes?.error === "not_joined") {
    console.log("  -> OK: Rechazado correctamente con error 'not_joined'");
  } else {
    console.error("  -> FALLO: Se esperaba 'not_joined', recibido:", preJoinRes);
    cleanup(1);
  }

  // Paso 2: Unir ambos clientes a la sala del diagrama y al chat
  console.log("\n[Paso 2] Uniendo clientes A y B a la sala y al chat...");
  clientA.emit("join-room", DIAGRAM_ID);
  clientB.emit("join-room", DIAGRAM_ID);

  const joinARes: any = await new Promise((resolve) => {
    clientA.emit(
      "chat-join",
      { diagramId: DIAGRAM_ID, sessionId: SESSION_ID_A },
      (res: any) => resolve(res)
    );
  });
  console.log(`[Cliente A] chat-join ack:`, joinARes);

  const joinBRes: any = await new Promise((resolve) => {
    clientB.emit(
      "chat-join",
      { diagramId: DIAGRAM_ID, sessionId: SESSION_ID_B },
      (res: any) => resolve(res)
    );
  });
  console.log(`[Cliente B] chat-join ack:`, joinBRes);

  if (!joinARes?.ok || !joinBRes?.ok) {
    console.error("  -> FALLO en chat-join de alguno de los clientes");
    cleanup(1);
  }

  // Paso 3: Cliente A envía un valor inválido
  console.log("\n[Paso 3] Probando valor inválido (mode='invalido')...");
  const invalidRes: any = await new Promise((resolve) => {
    clientA.emit(
      "ai-settings-update",
      { diagramId: DIAGRAM_ID, mode: "invalido", style: "directa" },
      (res: any) => resolve(res)
    );
  });

  if (invalidRes?.ok === false && invalidRes?.error === "invalid_value") {
    console.log("  -> OK: Rechazado correctamente con error 'invalid_value'");
  } else {
    console.error("  -> FALLO: Se esperaba 'invalid_value', recibido:", invalidRes);
    cleanup(1);
  }

  // Paso 4: Preparar escucha en Cliente B para los eventos de difusión
  console.log("\n[Paso 4] Cliente A actualiza estilo a 'directa'...");

  let receivedChangedEvent: any = null;
  let receivedSystemMessage: any = null;

  clientB.on("ai-settings-changed", (evt: any) => {
    console.log("[Cliente B] Evento 'ai-settings-changed' recibido:", evt);
    receivedChangedEvent = evt;
  });

  clientB.on("chat-message", (msg: any) => {
    if (msg.role === "system") {
      console.log("[Cliente B] Mensaje 'system' recibido:", msg.text);
      receivedSystemMessage = msg;
    }
  });

  const updateRes: any = await new Promise((resolve) => {
    clientA.emit(
      "ai-settings-update",
      { diagramId: DIAGRAM_ID, mode: "apply", style: "directa" },
      (res: any) => resolve(res)
    );
  });

  console.log("[Cliente A] Ack de ai-settings-update:", updateRes);
  if (!updateRes?.ok || updateRes?.settings?.style !== "directa") {
    console.error("  -> FALLO: Ack no confirmó el nuevo estilo 'directa'");
    cleanup(1);
  }

  // Esperar recepción en B
  await new Promise((r) => setTimeout(r, 1000));

  if (!receivedChangedEvent) {
    console.error("  -> FALLO: Cliente B no recibió 'ai-settings-changed'");
    cleanup(1);
  }

  if (!receivedSystemMessage) {
    console.error("  -> FALLO: Cliente B no recibió mensaje de sistema en chat");
    cleanup(1);
  }

  console.log("\n==================================================");
  console.log("=== SMOKE TEST CU23 COMPLETADO CON ÉXITO ===");
  console.log("==================================================");
  cleanup(0);
}

runSmokeTest().catch((err) => {
  console.error("Error fatal en smoke test:", err);
  cleanup(1);
});
