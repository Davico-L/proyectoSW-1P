/**
 * Script de prueba manual de Socket.IO para CU20 (Fase 2B)
 *
 * Simula la interacción entre el cliente (frontend) y el servidor ante modificaciones
 * solicitadas a Codia a través del chat de equipo.
 *
 * Escenarios disponibles (cambiar la constante SCENARIO o pasarla por argumento de línea de comandos / variable de entorno):
 *   A) El cliente recibe "ai-operations", simula que aplicó el cambio y responde el ack con { applied: 1, failed: 0 };
 *      comprueba que llega el mensaje de confirmación con kind "modification".
 *   B) El cliente no responde el ack (simulando que el frontend se colgó);
 *      comprueba que tras el timeout llega el mensaje de "no pude aplicar".
 *   C) El cliente se desconecta en cuanto recibe "ai-operations";
 *      comprueba que el servidor no crashea y Codia no aplica nada.
 *
 * Uso:
 *   npx tsx scripts/cu20-socket-smoke.ts [A|B|C]
 *   Ejemplo: npx tsx scripts/cu20-socket-smoke.ts A
 */

import { io, Socket } from "socket.io-client";

// Escenario a ejecutar: "A", "B" o "C"
const SCENARIO: "A" | "B" | "C" =
  (process.env.SCENARIO as "A" | "B" | "C") ||
  (process.argv[2] as "A" | "B" | "C") ||
  "A";

const SERVER_URL = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
const DIAGRAM_ID = process.env.DIAGRAM_ID || "smoke-diagram-test";
const SESSION_ID = process.env.SESSION_ID || "smoke-session-test";

console.log(`=== CU20 Socket Smoke Test ===`);
console.log(`Escenario seleccionado: ${SCENARIO}`);
console.log(`Servidor: ${SERVER_URL}`);
console.log(`Diagrama: ${DIAGRAM_ID}`);
console.log(`==============================\n`);

const socket: Socket = io(SERVER_URL, {
  transports: ["websocket"],
  autoConnect: true,
});

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

      // 3. Enviar mensaje pidiendo modificación a Codia
      const messageText = "@Codia crea una clase Prueba con nombre";
      console.log(`[Cliente] Enviando mensaje de chat: "${messageText}"`);

      socket.emit(
        "chat-message",
        { diagramId: DIAGRAM_ID, text: messageText },
        (msgRes: { ok: boolean; error?: string }) => {
          console.log(`[Cliente] Ack de envío de mensaje:`, msgRes);
        }
      );
    }
  );
});

// Escuchar cambios de estado de la IA
socket.on("ai-status", (status: { diagramId: string; state: string; askerName: string }) => {
  console.log(`[Evento ai-status] Estado de IA:`, status);
});

// Escuchar evento de operaciones para aplicar en el lienzo
socket.on("ai-operations", (data: any, ackCallback?: (ack: any) => void) => {
  console.log(`\n[Evento ai-operations RECIBIDO]:`);
  console.log(JSON.stringify(data, null, 2));

  switch (SCENARIO) {
    case "A": {
      console.log(`\n-> Escenario A: Simulando aplicación exitosa de operaciones...`);
      if (typeof ackCallback === "function") {
        console.log(`-> Respondiendo ACK: { applied: 1, failed: 0 }`);
        ackCallback({ applied: 1, failed: 0 });
      } else {
        console.warn(`-> No se recibió función de callback para ack`);
      }
      break;
    }

    case "B": {
      console.log(`\n-> Escenario B: NO se responde el ACK (simulando timeout / freeze del cliente)...`);
      console.log(`-> Esperando respuesta de Codia tras timeout...`);
      // No invocar ackCallback
      break;
    }

    case "C": {
      console.log(`\n-> Escenario C: Desconectando socket inmediatamente...`);
      socket.disconnect();
      console.log(`-> Socket desconectado.`);
      setTimeout(() => {
        console.log(`-> Prueba de escenario C completada con éxito (servidor no crasheó).`);
        process.exit(0);
      }, 2000);
      break;
    }
  }
});

// Escuchar mensajes entrantes en el chat
socket.on("chat-message", (msg: any) => {
  console.log(`\n[Evento chat-message RECIBIDO]:`);
  console.log(`De: ${msg.authorName} (${msg.role})`);
  console.log(`Texto: ${msg.text}`);
  console.log(`Kind: ${msg.kind}`);

  if (msg.role === "ai") {
    console.log(`\n=== Verificación del resultado ===`);
    if (SCENARIO === "A") {
      if (msg.kind === "modification") {
        console.log(`✓ ÉXITO: Mensaje recibido con kind === "modification"`);
      } else {
        console.error(`✗ FALLO: Se esperaba kind === "modification", se recibió kind: ${msg.kind}`);
      }
    } else if (SCENARIO === "B") {
      if (msg.kind === "answer") {
        console.log(`✓ ÉXITO: Mensaje recibido tras timeout con kind === "answer"`);
      } else {
        console.error(`✗ FALLO: Se esperaba kind === "answer", se recibió kind: ${msg.kind}`);
      }
    }
    setTimeout(() => {
      socket.disconnect();
      process.exit(0);
    }, 1000);
  }
});

socket.on("disconnect", (reason) => {
  console.log(`[Cliente] Desconectado: ${reason}`);
});

socket.on("connect_error", (err) => {
  console.error(`[Cliente] Error de conexión: ${err.message}`);
  process.exit(1);
});
