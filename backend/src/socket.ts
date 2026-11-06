import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { getDiagramById } from "./services/diagramService";
import { getSession, sessionExists } from "./services/sessionService";
import {
  saveMessage,
  toPublicChatMessage,
  ChatValidationError,
  ChatUnavailableError,
} from "./chat/chatRepository";

export const initSocket = (server: HttpServer): Server => {
  const allowedOrigins = [
    "http://localhost:3001",
    "http://localhost:3000",
  ];

  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          allowedOrigins.includes(origin) ||
          origin.startsWith("http://localhost:")
        ) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[Socket] Cliente conectado: ${socket.id}`);

    // Evento join-diagram: unirse a la sala del diagrama y enviar estado actual desde Postgres
    socket.on("join-diagram", async (payload: { diagramId: string }) => {
      try {
        const diagramId = payload?.diagramId;
        if (!diagramId || typeof diagramId !== "string") {
          return;
        }

        socket.join(diagramId);
        console.log(`[Socket] Socket ${socket.id} se unió a la sala: ${diagramId}`);

        // Consultar en Postgres usando la misma función de GET /diagrams/:id
        const diagram = await getDiagramById(diagramId);
        if (diagram) {
          // Emitir de vuelta exclusivamente a ese socket solo los elements
          const elements = diagram.data?.elements || [];
          socket.emit("diagram-state", { elements });
        }
      } catch (err: any) {
        console.error(
          `[Socket] Error al procesar join-diagram para ${payload?.diagramId}:`,
          err?.message || err
        );
      }
    });

    // Evento leave-diagram: abandonar la sala del diagrama indicado
    socket.on("leave-diagram", (payload: { diagramId: string }) => {
      const diagramId = payload?.diagramId;
      if (diagramId && typeof diagramId === "string") {
        socket.leave(diagramId);
        console.log(`[Socket] Socket ${socket.id} salió de la sala: ${diagramId}`);
      }
    });

    // Evento diagram-update: reenviar solo elements a todos en la sala EXCEPTO al emisor (sin tocar Postgres)
    socket.on(
      "diagram-update",
      (payload: { diagramId: string; elements?: any; data?: any }) => {
        try {
          const { diagramId } = payload || {};
          if (!diagramId) {
            return;
          }

          const elements =
            payload.elements !== undefined
              ? payload.elements
              : payload.data?.elements || payload.data;

          socket.to(diagramId).emit("diagram-update", { elements });
        } catch (err: any) {
          console.error(
            `[Socket] Error al reenviar diagram-update para ${payload?.diagramId}:`,
            err?.message || err
          );
        }
      }
    );

    // Evento chat-join: vincula la sesión de usuario autenticado al socket dentro de la sala
    socket.on(
      "chat-join",
      async (
        payload: { diagramId?: string; sessionId?: string },
        callback?: (res: { ok: boolean; error?: string }) => void
      ) => {
        try {
          const diagramId =
            typeof payload?.diagramId === "string" ? payload.diagramId.trim() : "";
          const sessionId =
            typeof payload?.sessionId === "string" ? payload.sessionId.trim() : "";

          // 1. Validar que ambos sean strings no vacíos
          if (!diagramId || !sessionId) {
            if (typeof callback === "function") {
              callback({ ok: false, error: "bad_request" });
            }
            return;
          }

          // 2. Comprobar que el socket ya esté en la sala del diagrama (socket.rooms)
          if (!socket.rooms.has(diagramId)) {
            if (typeof callback === "function") {
              callback({ ok: false, error: "not_in_room" });
            }
            return;
          }

          // 3. Consultar la sesión en Postgres con getSession
          const session = await getSession(sessionId);
          if (!session) {
            if (typeof callback === "function") {
              callback({ ok: false, error: "invalid_session" });
            }
            return;
          }

          // 4. Guardar en socket.data el diagramId, sessionId y username verificado
          socket.data.diagramId = diagramId;
          socket.data.sessionId = sessionId;
          socket.data.authorName = session.username;

          console.log(
            `[Socket] Socket ${socket.id} unido al chat del diagrama ${diagramId} como '${session.username}'`
          );

          if (typeof callback === "function") {
            callback({ ok: true });
          }
        } catch (err: any) {
          console.error(
            `[Socket] Error inesperado en chat-join para ${payload?.diagramId}:`,
            err?.message || err
          );
          if (typeof callback === "function") {
            callback({ ok: false, error: "bad_request" });
          }
        }
      }
    );

    // Evento chat-message: persiste y difunde un mensaje de chat a toda la sala
    socket.on(
      "chat-message",
      async (
        payload: { diagramId?: string; text?: string },
        callback?: (res: { ok: boolean; error?: string }) => void
      ) => {
        try {
          const diagramId =
            typeof payload?.diagramId === "string" ? payload.diagramId.trim() : "";
          const joinedDiagramId = socket.data?.diagramId;
          const authorSessionId = socket.data?.sessionId;
          const authorName = socket.data?.authorName;

          // 1. Exigir que haya hecho chat-join para ese mismo diagramId y que siga en la sala
          if (
            !diagramId ||
            !joinedDiagramId ||
            diagramId !== joinedDiagramId ||
            !authorSessionId ||
            !authorName ||
            !socket.rooms.has(diagramId)
          ) {
            if (typeof callback === "function") {
              callback({ ok: false, error: "not_joined" });
            }
            return;
          }

          // 2. Volver a comprobar la sesión contra Postgres con sessionExists
          const validSession = await sessionExists(authorSessionId);
          if (!validSession) {
            if (typeof callback === "function") {
              callback({ ok: false, error: "invalid_session" });
            }
            return;
          }

          // 3. Validar longitud de texto para mapear códigos exactos
          const rawText = typeof payload?.text === "string" ? payload.text : "";
          const trimmedText = rawText.trim();

          if (!trimmedText) {
            if (typeof callback === "function") {
              callback({ ok: false, error: "empty" });
            }
            return;
          }

          if (trimmedText.length > 2000) {
            if (typeof callback === "function") {
              callback({ ok: false, error: "too_long" });
            }
            return;
          }

          // 4. Guardar con saveMessage usando role "user", autor estrictamente desde socket.data
          const savedDoc = await saveMessage({
            diagramId,
            authorSessionId,
            authorName,
            role: "user",
            text: trimmedText,
          });

          // 5. Convertir a formato público sanitizado (sin authorSessionId) y emitir a toda la sala
          const publicMessage = toPublicChatMessage(savedDoc);
          io.to(diagramId).emit("chat-message", publicMessage);

          if (typeof callback === "function") {
            callback({ ok: true });
          }
        } catch (err: any) {
          if (err instanceof ChatValidationError) {
            const trimmed = typeof payload?.text === "string" ? payload.text.trim() : "";
            const errType = trimmed.length > 2000 ? "too_long" : "empty";
            if (typeof callback === "function") {
              callback({ ok: false, error: errType });
            }
            return;
          }

          if (err instanceof ChatUnavailableError) {
            if (typeof callback === "function") {
              callback({ ok: false, error: "unavailable" });
            }
            return;
          }

          console.error(
            `[Socket] Error inesperado en chat-message (${socket.id}):`,
            err?.message || err
          );
          if (typeof callback === "function") {
            callback({ ok: false, error: "unavailable" });
          }
        }
      }
    );

    socket.on("disconnect", (reason) => {
      console.log(`[Socket] Cliente desconectado (${socket.id}): ${reason}`);
    });
  });

  return io;
};
