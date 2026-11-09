/**
 * Script de prueba manual de Socket.IO para CU21 (Revisión de Diagrama en Chat).
 *
 * Conecta por Socket.IO, envía "@Codia revisa el diagrama" a un diagrama de prueba
 * y muestra por consola la respuesta de Codia, el destinatario y el tiempo de respuesta.
 *
 * Uso:
 *   npx tsx src/scripts/cu21-socket-smoke.ts
 *   o
 *   npm run smoke:cu21
 */

import { io, Socket } from "socket.io-client";

const SERVER_URL =
  process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
const DIAGRAM_ID = process.env.DIAGRAM_ID || "smoke-diagram-test";
const SESSION_ID = process.env.SESSION_ID || "smoke-session-test";

console.log("==================================================");
console.log("=== CU21 Socket Smoke Test — Revisión de Diagrama ===");
console.log(`Servidor  : ${SERVER_URL}`);
console.log(`Diagrama  : ${DIAGRAM_ID}`);
console.log(`Sesión    : ${SESSION_ID}`);
console.log("==================================================\n");

let sendTimestamp: number = 0;

const socket: Socket = io(SERVER_URL, {
  transports: ["websocket"],
  autoConnect: true,
});

// Timeout de seguridad: 30 segundos
const safetyTimeout = setTimeout(() => {
  console.error("\n[Timeout] No se recibió respuesta de Codia tras 30 segundos.");
  socket.disconnect();
  process.exit(1);
}, 30000);

socket.on("connect", () => {
  console.log(`[Cliente] Conectado al servidor con socket ID: ${socket.id}`);

  // 1. Unirse a la sala del diagrama
  socket.emit("join-room", DIAGRAM_ID);

  // 2. Unirse al chat
  socket.emit(
    "chat-join",
    { diagramId: DIAGRAM_ID, sessionId: SESSION_ID },
    (res: { ok: boolean; error?: string }) => {
      console.log(`[Cliente] Respuesta de chat-join:`, res);

      if (!res || !res.ok) {
        console.error(`[Cliente] Falló chat-join:`, res?.error);
        clearTimeout(safetyTimeout);
        socket.disconnect();
        process.exit(1);
      }

      // 3. Enviar mensaje de revisión a Codia
      const messageText = "@Codia revisa el diagrama";
      console.log(`[Cliente] Enviando mensaje de revisión: "${messageText}"`);
      sendTimestamp = Date.now();

      socket.emit(
        "chat-message",
        { diagramId: DIAGRAM_ID, text: messageText },
        (msgRes: { ok: boolean; error?: string }) => {
          console.log(`[Cliente] Ack de chat-message:`, msgRes);
        }
      );
    }
  );
});

// Escuchar estados de Codia (thinking / idle)
socket.on(
  "ai-status",
  (status: { diagramId: string; state: string; askerName: string }) => {
    console.log(
      `[Evento ai-status] Estado: ${status.state} | Usuario: ${status.askerName}`
    );
  }
);

// Escuchar mensajes entrantes en el chat
socket.on("chat-message", (msg: any) => {
  if (msg.role === "ai") {
    const elapsedMs = sendTimestamp > 0 ? Date.now() - sendTimestamp : 0;
    clearTimeout(safetyTimeout);

    console.log("\n==================================================");
    console.log("=== RESPUESTA DE CODIA RECIBIDA (CU21) ===");
    console.log("==================================================");
    console.log(`Autor        : ${msg.authorName} (${msg.role})`);
    console.log(`Destinatario : ${msg.addressedTo || "no especificado"}`);
    console.log(`Tiempo       : ${elapsedMs} ms`);
    console.log(`Kind         : ${msg.kind || "no especificado"}`);
    console.log("Texto de revisión:\n");
    console.log(msg.text);
    console.log("==================================================\n");

    console.log("✓ Smoke test CU21 finalizado exitosamente.");
    setTimeout(() => {
      socket.disconnect();
      process.exit(0);
    }, 500);
  }
});

socket.on("connect_error", (err) => {
  clearTimeout(safetyTimeout);
  console.error(`[Cliente] Error de conexión: ${err.message}`);
  process.exit(1);
});

socket.on("disconnect", (reason) => {
  console.log(`[Cliente] Desconectado: ${reason}`);
});
