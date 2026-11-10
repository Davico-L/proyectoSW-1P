import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { getDiagramById } from "./services/diagramService";
import { getSession, sessionExists } from "./services/sessionService";
import { ObjectId } from "mongodb";
import { getMongoDb } from "./db/mongo";
import {
  saveMessage,
  listMessages,
  toPublicChatMessage,
  claimProposal,
  settleProposal,
  CHAT_COLLECTION_NAME,
  ChatValidationError,
  ChatUnavailableError,
} from "./chat/chatRepository";
import {
  toPublicProposal,
  PublicProposal,
} from "./chat/proposalHelpers";
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
import { validateAndResolveOperations } from "./services/operationValidator";
import {
  getRoomSettings,
  saveRoomSettings,
  isValidMode,
  isValidStyle,
  formatSettingsAnnouncement,
  RoomSettings,
  SavedRoomSettings,
} from "./chat/roomSettingsRepository";

export const CODIA_ACK_TIMEOUT_MS = parseInt(
  process.env.CODIA_ACK_TIMEOUT_MS || "15000",
  10
);

export function getCodiaAckTimeoutMs(): number {
  const envVal = process.env.CODIA_ACK_TIMEOUT_MS;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 15000;
}

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
      role: d.role,
      addressedTo: d.addressedTo,
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
        callback?: (res: { ok: boolean; error?: string; settings?: RoomSettings }) => void
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

          const roomSettings = await getRoomSettings(diagramId);

          if (typeof callback === "function") {
            callback({
              ok: true,
              settings: {
                mode: roomSettings.mode,
                style: roomSettings.style,
              },
            });
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

                  // b) definir callback onOperations usando el socket del autor y llamar a answerInRoom
                  const onOperations = async (
                    operations: any[],
                    warnings: string[]
                  ): Promise<{ applied: number; failed: number } | null> => {
                    if (!socket.connected) {
                      return null;
                    }
                    const timeoutMs = getCodiaAckTimeoutMs();
                    try {
                      const ack = await socket.timeout(timeoutMs).emitWithAck("ai-operations", {
                        messageId: triggerMessageId,
                        diagramId: targetDiagramId,
                        operations,
                        warnings,
                        timeoutMs,
                      });

                      if (
                        ack &&
                        typeof ack === "object" &&
                        typeof (ack as any).applied === "number" &&
                        typeof (ack as any).failed === "number" &&
                        (ack as any).applied >= 0 &&
                        (ack as any).failed >= 0
                      ) {
                        return {
                          applied: (ack as any).applied,
                          failed: (ack as any).failed,
                        };
                      }
                      return null;
                    } catch (_err) {
                      // Timeout, desconexión o fallo en el acknowledgement del cliente
                      return null;
                    }
                  };

                  const result = await aiChatService.answerInRoom({
                    diagramId: targetDiagramId,
                    askerName: asker,
                    askerMessageId: triggerMessageId,
                    question: mention.question,
                    onOperations,
                  });

                  // c) guardar la respuesta con saveMessage con role "ai", authorName AI_DISPLAY_NAME, replyTo, addressedTo, kind, operations y warnings, y emitirla como "chat-message"
                  const aiDoc = await saveMessage({
                    diagramId: targetDiagramId,
                    authorSessionId: "ai",
                    authorName: AI_DISPLAY_NAME,
                    role: "ai",
                    text: result.message,
                    replyTo: triggerMessageId,
                    addressedTo: asker,
                    kind: result.kind,
                    operations: result.operations,
                    warnings: result.warnings,
                    findings: result.findings,
                    proposal: result.proposal,
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

    // Evento ai-settings-update (CU23): actualiza la configuración de modo y estilo de Codia para la sala
    socket.on(
      "ai-settings-update",
      async (
        payload: { diagramId?: string; mode?: any; style?: any },
        callback?: (res: {
          ok: boolean;
          settings?: RoomSettings;
          error?: string;
        }) => void
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

          // 2. Comprobar sesión contra Postgres con sessionExists
          const validSession = await sessionExists(authorSessionId);
          if (!validSession) {
            if (typeof callback === "function") {
              callback({ ok: false, error: "invalid_session" });
            }
            return;
          }

          // 3. Validar contra la lista cerrada
          if (!isValidMode(payload?.mode) || !isValidStyle(payload?.style)) {
            if (typeof callback === "function") {
              callback({ ok: false, error: "invalid_value" });
            }
            return;
          }

          const targetMode = payload.mode;
          const targetStyle = payload.style;

          // 4. Si los valores son iguales a los vigentes: responde ok sin guardar mensaje ni emitir evento
          const current = await getRoomSettings(diagramId);
          const modeChanged = current.mode !== targetMode;
          const styleChanged = current.style !== targetStyle;

          if (!modeChanged && !styleChanged) {
            if (typeof callback === "function") {
              callback({
                ok: true,
                settings: { mode: current.mode, style: current.style },
              });
            }
            return;
          }

          // 5. Guardar en Mongo y mensaje de sistema; si falla, responde storage_error y no emite nada
          let saved: SavedRoomSettings;
          let systemDoc: any;

          try {
            saved = await saveRoomSettings(
              diagramId,
              { mode: targetMode, style: targetStyle },
              authorName
            );

            const announcementText = formatSettingsAnnouncement(
              authorName,
              modeChanged,
              targetMode,
              styleChanged,
              targetStyle
            );

            systemDoc = await saveMessage({
              diagramId,
              authorSessionId: "system",
              authorName: "Sistema",
              role: "system",
              text: announcementText,
            });
          } catch (err: any) {
            if (err?.message === "invalid_value") {
              if (typeof callback === "function") {
                callback({ ok: false, error: "invalid_value" });
              }
              return;
            }
            if (typeof callback === "function") {
              callback({ ok: false, error: "storage_error" });
            }
            return;
          }

          // 6. Si guardó bien: emitir mensaje de sistema y evento ai-settings-changed
          io.to(diagramId).emit(
            "chat-message",
            toPublicChatMessage(systemDoc)
          );

          io.to(diagramId).emit("ai-settings-changed", {
            diagramId,
            mode: saved.mode,
            style: saved.style,
            updatedBy: saved.updatedBy,
          });

          if (typeof callback === "function") {
            callback({
              ok: true,
              settings: {
                mode: saved.mode,
                style: saved.style,
              },
            });
          }
        } catch (err: any) {
          console.error(
            `[Socket] Error inesperado en ai-settings-update (${socket.id}):`,
            err?.message || err
          );
          if (typeof callback === "function") {
            callback({ ok: false, error: "storage_error" });
          }
        }
      }
    );

    // Evento proposal-decision (CU22): aprobación o rechazo de propuestas de Codia
    socket.on(
      "proposal-decision",
      async (
        payload: {
          diagramId?: string;
          proposalId?: string;
          decision?: "approve" | "reject";
        },
        callback?: (res: {
          ok: boolean;
          error?: string;
          proposal?: PublicProposal;
        }) => void
      ) => {
        let hasClaimed = false;
        let diagramId = "";
        let targetMessageId = "";

        try {
          const joinedDiagramId = socket.data?.diagramId;
          const authorSessionId = socket.data?.sessionId;
          const authorName = socket.data?.authorName;

          // 1. Exigir que el socket haya completado chat-join previamente y siga en esa sala
          if (
            !joinedDiagramId ||
            !authorSessionId ||
            !authorName ||
            !socket.rooms.has(joinedDiagramId)
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

          // 3. Validar payload (objeto válido, diagramId coincidente con la sala, proposalId no vacío, decision "approve" | "reject")
          diagramId =
            typeof payload?.diagramId === "string" ? payload.diagramId.trim() : "";
          const proposalId =
            typeof payload?.proposalId === "string" ? payload.proposalId.trim() : "";
          const decision = payload?.decision;

          if (
            !payload ||
            typeof payload !== "object" ||
            !diagramId ||
            diagramId !== joinedDiagramId ||
            !proposalId ||
            (decision !== "approve" && decision !== "reject")
          ) {
            if (typeof callback === "function") {
              callback({ ok: false, error: "not_found" });
            }
            return;
          }

          targetMessageId = proposalId;
          let claimResult = await claimProposal(
            diagramId,
            targetMessageId,
            authorName
          );

          if (!claimResult.ok && claimResult.reason === "not_found") {
            // Si no coincidió por ObjectId, buscar por proposal.id
            const db = await getMongoDb();
            if (db) {
              const found = await db.collection(CHAT_COLLECTION_NAME).findOne({
                diagramId,
                "proposal.id": proposalId,
              });
              if (found) {
                targetMessageId = String(found._id);
                claimResult = await claimProposal(
                  diagramId,
                  targetMessageId,
                  authorName
                );
              }
            }
          }

          if (!claimResult.ok) {
            if (claimResult.reason === "already_decided") {
              if (typeof callback === "function") {
                callback({
                  ok: false,
                  error: "already_decided",
                  proposal: claimResult.proposal,
                });
              }
              return;
            }

            if (typeof callback === "function") {
              callback({ ok: false, error: "not_found" });
            }
            return;
          }

          hasClaimed = true;

          // 4. Rama "reject"
          if (decision === "reject") {
            const settled = await settleProposal(
              diagramId,
              targetMessageId,
              "rejected",
              authorName
            );

            if (!settled || !settled.proposal) {
              if (typeof callback === "function") {
                callback({ ok: false, error: "not_found" });
              }
              return;
            }

            const publicProposal = toPublicProposal(settled.proposal);
            const messageId = settled.id;

            const systemDoc = await saveMessage({
              diagramId,
              authorSessionId: "system",
              authorName: "Sistema",
              role: "system",
              text: `${authorName} rechazó la propuesta de Codia`,
            });

            io.to(diagramId).emit("proposal-updated", {
              diagramId,
              messageId,
              proposal: publicProposal,
            });

            io.to(diagramId).emit(
              "chat-message",
              toPublicChatMessage(systemDoc)
            );

            if (typeof callback === "function") {
              callback({
                ok: true,
                proposal: publicProposal,
              });
            }
            return;
          }

          // 5. Rama "approve"
          // Paso 2: Con diagramId vuelve a validar las operaciones guardadas: getDiagramById, extractUmlModel y validateAndResolveOperations
          const savedOps = Array.isArray(claimResult.message.operations)
            ? claimResult.message.operations
            : [];

          const diagram = await getDiagramById(diagramId);
          let isApplicable = false;
          let validOperations: any[] = [];
          let validationWarnings: string[] = [];

          if (diagram && diagram.data && savedOps.length > 0) {
            const { classes } = extractUmlModel(diagram.data);
            const validationResult = validateAndResolveOperations(
              savedOps,
              classes
            );
            validOperations = validationResult.validOperations;
            validationWarnings = validationResult.warnings;
            // Si alguna operación ya no es aplicable (válidas < guardadas)
            if (validOperations.length === savedOps.length) {
              isApplicable = true;
            }
          }

          // Si el diagrama no existe o alguna operación ya no es aplicable: caduca
          if (!isApplicable) {
            const settled = await settleProposal(
              diagramId,
              targetMessageId,
              "expired"
            );

            const publicProposal = settled?.proposal
              ? toPublicProposal(settled.proposal)
              : undefined;
            const messageId = settled?.id || targetMessageId;

            const systemDoc = await saveMessage({
              diagramId,
              authorSessionId: "system",
              authorName: "Sistema",
              role: "system",
              text: "La propuesta de Codia caducó porque el diagrama cambió. Repite el pedido a Codia.",
            });

            if (publicProposal) {
              io.to(diagramId).emit("proposal-updated", {
                diagramId,
                messageId,
                proposal: publicProposal,
              });
            }

            io.to(diagramId).emit(
              "chat-message",
              toPublicChatMessage(systemDoc)
            );

            if (typeof callback === "function") {
              callback({
                ok: false,
                error: "stale",
                proposal: publicProposal,
              });
            }
            return;
          }

          // Paso 3: Operaciones válidas -> approverSocket.timeout(timeoutMs).emitWithAck("ai-operations", ...)
          const timeoutMs = getCodiaAckTimeoutMs();
          const warnings = Array.isArray(claimResult.message.warnings)
            ? claimResult.message.warnings
            : validationWarnings;

          let ackResult: any = null;
          try {
            if (socket.connected) {
              ackResult = await (socket as any)
                .timeout(timeoutMs)
                .emitWithAck("ai-operations", {
                  messageId: `${targetMessageId}:${Date.now()}`,
                  diagramId,
                  operations: validOperations,
                  warnings,
                  timeoutMs,
                });
            }
          } catch (_ackErr) {
            ackResult = null;
          }

          // Paso 4: Si ack llega con applied > 0
          const isApplied =
            ackResult &&
            typeof ackResult === "object" &&
            typeof ackResult.applied === "number" &&
            ackResult.applied > 0;

          if (isApplied) {
            const settled = await settleProposal(
              diagramId,
              targetMessageId,
              "approved",
              authorName
            );

            const publicProposal = settled?.proposal
              ? toPublicProposal(settled.proposal)
              : undefined;
            const messageId = settled?.id || targetMessageId;

            const systemDoc = await saveMessage({
              diagramId,
              authorSessionId: "system",
              authorName: "Sistema",
              role: "system",
              text: `${authorName} aprobó la propuesta de Codia`,
            });

            if (publicProposal) {
              io.to(diagramId).emit("proposal-updated", {
                diagramId,
                messageId,
                proposal: publicProposal,
              });
            }

            io.to(diagramId).emit(
              "chat-message",
              toPublicChatMessage(systemDoc)
            );

            if (typeof callback === "function") {
              callback({
                ok: true,
                proposal: publicProposal,
              });
            }
            return;
          }

          // Paso 5: Si ack falla, timeout o applied === 0 -> revertir a pending
          const settled = await settleProposal(
            diagramId,
            targetMessageId,
            "pending"
          );

          const publicProposal = settled?.proposal
            ? toPublicProposal(settled.proposal)
            : undefined;

          if (typeof callback === "function") {
            callback({
              ok: false,
              error: "apply_failed",
              proposal: publicProposal,
            });
          }
        } catch (err: any) {
          console.error(
            `[Socket] Error inesperado en proposal-decision (${socket.id}):`,
            err?.message || err
          );
          if (hasClaimed) {
            try {
              await settleProposal(diagramId, targetMessageId, "pending");
            } catch (_revertErr) {
              // Ignorar error secundario al revertir
            }
          }
          if (typeof callback === "function") {
            callback({ ok: false, error: "storage_error" });
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
