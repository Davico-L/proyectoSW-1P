import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { getDiagramById } from "./services/diagramService";
import { getSession, sessionExists } from "./services/sessionService";
import {
  saveMessage,
  listMessages,
  toPublicChatMessage,
  ChatValidationError,
  ChatUnavailableError,
} from "./chat/chatRepository";
import {
  createAiChatService,
  AiBusyError,
  AiUnavailableError,
} from "./chat/aiChatService";
import {
  parseMention,
  AI_DISPLAY_NAME,
  AI_MENTION_ALIASES,
} from "./chat/aiChatHelpers";
import { chatWithFallback } from "./ai/providers/providerManager";
import { extractUmlModel } from "./backendGenerator/extractModel";

const defaultAiChatService = createAiChatService({
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
    const res = await chatWithFallback(sysPrompt, userContent, options);
    return res.text;
  },
});

export const initSocket = (
  server: HttpServer,
  customAiChatService?: ReturnType<typeof createAiChatService>
): Server => {
  const aiChatService = customAiChatService || defaultAiChatService;
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
          // Mitigación de suplantación: si el nombre de usuario normalizado es "ia" o "codia", asignar "{nombre} (usuario)"
          const rawUsername = session.username || "";
          const trimmedUsername = rawUsername.trim();
          const normalizedUser = trimmedUsername.toLowerCase();
          let resolvedAuthorName = rawUsername;

          if (normalizedUser === "ia" || normalizedUser === "codia") {
            const baseName = normalizedUser === "ia" ? "IA" : AI_DISPLAY_NAME;
            resolvedAuthorName = `${baseName} (usuario)`;
          }

          socket.data.diagramId = diagramId;
          socket.data.sessionId = sessionId;
          socket.data.authorName = resolvedAuthorName;

          console.log(
            `[Socket] Socket ${socket.id} unido al chat del diagrama ${diagramId} como '${resolvedAuthorName}'`
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

          // 6. CU19: Si el mensaje tiene role "user" y contiene mención @ia, procesar respuesta IA en segundo plano
          if (savedDoc.role === "user") {
            const mention = parseMention(trimmedText);
            if (mention.mentioned) {
              (async () => {
                const targetDiagramId = diagramId;
                const triggerMessageId = savedDoc.id;
                const asker = authorName;

                try {
                  // a) emitir a la sala "ai-status" con { diagramId, state: "thinking", askerName }
                  io.to(targetDiagramId).emit("ai-status", {
                    diagramId: targetDiagramId,
                    state: "thinking",
                    askerName: asker,
                  });

                  // b) llamar a answerInRoom
                  const result = await aiChatService.answerInRoom({
                    diagramId: targetDiagramId,
                    askerName: asker,
                    askerMessageId: triggerMessageId,
                    question: mention.question,
                  });

                  // c) guardar la respuesta con saveMessage con role "ai", authorName AI_DISPLAY_NAME, replyTo y addressedTo, y emitirla como "chat-message"
                  const aiDoc = await saveMessage({
                    diagramId: targetDiagramId,
                    authorSessionId: "ai",
                    authorName: AI_DISPLAY_NAME,
                    role: "ai",
                    text: result.message,
                    replyTo: triggerMessageId,
                    addressedTo: asker,
                  });

                  io.to(targetDiagramId).emit(
                    "chat-message",
                    toPublicChatMessage(aiDoc)
                  );
                } catch (err: any) {
                  if (err instanceof AiUnavailableError) {
                    try {
                      const errorMsg = `${asker}, no pude responder en este momento debido a un problema con los servicios de IA. Por favor, reintenta tu consulta.`;
                      const errDoc = await saveMessage({
                        diagramId: targetDiagramId,
                        authorSessionId: "ai",
                        authorName: AI_DISPLAY_NAME,
                        role: "ai",
                        text: errorMsg,
                        replyTo: triggerMessageId,
                        addressedTo: asker,
                      });
                      io.to(targetDiagramId).emit(
                        "chat-message",
                        toPublicChatMessage(errDoc)
                      );
                    } catch (saveErr) {
                      console.error(
                        "[Socket AI] Error al guardar mensaje de error AiUnavailable:",
                        saveErr
                      );
                    }
                  } else if (err instanceof AiBusyError) {
                    try {
                      const busyMsg = `${asker}, estoy atendiendo otras consultas del equipo en este momento. Por favor, reintenta en un momento.`;
                      const busyDoc = await saveMessage({
                        diagramId: targetDiagramId,
                        authorSessionId: "ai",
                        authorName: AI_DISPLAY_NAME,
                        role: "ai",
                        text: busyMsg,
                        replyTo: triggerMessageId,
                        addressedTo: asker,
                      });
                      io.to(targetDiagramId).emit(
                        "chat-message",
                        toPublicChatMessage(busyDoc)
                      );
                    } catch (saveErr) {
                      console.error(
                        "[Socket AI] Error al guardar mensaje de error AiBusy:",
                        saveErr
                      );
                    }
                  } else {
                    console.error(
                      "[Socket AI] Error inesperado en procesamiento de IA:",
                      err?.message || err
                    );
                  }
                } finally {
                  // d) en un finally, emitir "ai-status" con { diagramId, state: "idle", askerName }
                  io.to(targetDiagramId).emit("ai-status", {
                    diagramId: targetDiagramId,
                    state: "idle",
                    askerName: asker,
                  });
                }
              })().catch((unhandledErr) => {
                console.error(
                  "[Socket AI] Error no controlado en worker asíncrono de IA:",
                  unhandledErr
                );
              });
            }
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
