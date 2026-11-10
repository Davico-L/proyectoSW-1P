import { useState, useEffect, useRef, useCallback } from "react";
import { socket, onDiagramState } from "../../excalidraw-app/data/realtimeSync";
import {
  ACTIVE_SESSION_KEY,
  ACTIVE_USERNAME_KEY,
  BACKEND_URL,
  saveDiagramToBackend,
} from "../../excalidraw-app/data/backendSync";
import { LocalData } from "../../excalidraw-app/data/LocalData";
import { applyAiOperations } from "../aiEdit/applyAiOperations";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { PublicChatMessage } from "./types";
import {
  BoundedSet,
  validateAiOperations,
  calculateOperationCounts,
  hasCodiaMention,
  saveDiagramWithTimeout,
} from "./aiOperationsHandler";

export interface UseTeamChatOptions {
  diagramId: string | null;
  backendUrl?: string;
  excalidrawAPI?: ExcalidrawImperativeAPI | null;
  socketInstance?: any;
}

export const useTeamChat = ({
  diagramId,
  backendUrl = BACKEND_URL,
  excalidrawAPI,
  socketInstance,
}: UseTeamChatOptions) => {
  const activeSocket = socketInstance || socket;

  const [messages, setMessages] = useState<PublicChatMessage[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(
    Boolean(activeSocket?.connected),
  );
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);

  // CU22: Estados de propuestas (por messageId)
  const [busyByMessageId, setBusyByMessageId] = useState<
    Record<string, boolean>
  >({});
  const [errorByMessageId, setErrorByMessageId] = useState<
    Record<string, string | null>
  >({});

  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(
    excalidrawAPI || null,
  );
  excalidrawAPIRef.current = excalidrawAPI || null;

  const processedMessageIdsRef = useRef<BoundedSet<string>>(
    new BoundedSet<string>(100),
  );

  const isOpenRef = useRef<boolean>(isOpen);
  isOpenRef.current = isOpen;

  const currentDiagramIdRef = useRef<string | null>(diagramId);
  currentDiagramIdRef.current = diagramId;

  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const MAX_RETRIES = 5;

  const currentUsername = (() => {
    try {
      return localStorage.getItem(ACTIVE_USERNAME_KEY) || "";
    } catch {
      return "";
    }
  })();

  const clearRetryTimeout = () => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  };

  /**
   * Intenta unirse al chat del diagrama actual mediante el evento 'chat-join'.
   * Si el backend responde 'not_in_room', reintenta hasta 5 veces cada 500 ms.
   */
  const attemptChatJoin = useCallback(() => {
    const activeDiagId = currentDiagramIdRef.current;
    if (!activeDiagId || !activeSocket?.connected) {
      setIsJoined(false);
      return;
    }

    let sessionId = "";
    try {
      sessionId = localStorage.getItem(ACTIVE_SESSION_KEY) || "";
    } catch {
      // Ignorar fallo de localStorage
    }

    if (!sessionId) {
      setIsJoined(false);
      return;
    }

    activeSocket.emit(
      "chat-join",
      { diagramId: activeDiagId, sessionId },
      (res: { ok: boolean; error?: string }) => {
        // Verificar que no hayamos cambiado de diagrama durante la respuesta
        if (currentDiagramIdRef.current !== activeDiagId) {
          return;
        }

        if (res?.ok) {
          setIsJoined(true);
          retryCountRef.current = 0;
          clearRetryTimeout();
        } else if (res?.error === "not_in_room") {
          setIsJoined(false);
          if (retryCountRef.current < MAX_RETRIES) {
            retryCountRef.current += 1;
            clearRetryTimeout();
            retryTimeoutRef.current = setTimeout(() => {
              attemptChatJoin();
            }, 500);
          }
        } else if (res?.error === "invalid_session") {
          setIsJoined(false);
          clearRetryTimeout();
          window.dispatchEvent(new CustomEvent("session-invalid"));
        } else {
          setIsJoined(false);
          clearRetryTimeout();
        }
      }
    );
  }, []);

  /**
   * Consulta el historial de mensajes de chat en MongoDB a través del endpoint HTTP.
   * Fusiona los mensajes con los ya recibidos sin duplicar por id.
   */
  const fetchChatHistory = useCallback(async () => {
    const activeDiagId = currentDiagramIdRef.current;
    if (!activeDiagId) {
      return;
    }

    let sessionId = "";
    try {
      sessionId = localStorage.getItem(ACTIVE_SESSION_KEY) || "";
    } catch {
      // Ignorar
    }

    if (!sessionId) {
      return;
    }

    try {
      const res = await fetch(
        `${backendUrl}/diagrams/${encodeURIComponent(activeDiagId)}/chat?limit=50`,
        {
          headers: {
            "x-session-id": sessionId,
          },
        }
      );

      if (res.status === 401) {
        window.dispatchEvent(new CustomEvent("session-invalid"));
        return;
      }

      if (res.ok) {
        const data = (await res.json()) as { messages?: PublicChatMessage[] };
        const fetchedMessages = data?.messages || [];

        setMessages((prev) => {
          const map = new Map<string, PublicChatMessage>();
          // Mensajes previos que correspondan al diagrama activo
          for (const m of prev) {
            if (m.diagramId === activeDiagId) {
              map.set(m.id, m);
            }
          }
          // Mensajes obtenidos del historial
          for (const m of fetchedMessages) {
            if (m.diagramId === activeDiagId) {
              map.set(m.id, m);
            }
          }

          // Orden cronológico ascendente
          return Array.from(map.values()).sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });
      }
    } catch (err) {
      console.warn("[TeamChat] Error al cargar historial de chat:", err);
    }
  }, [backendUrl]);

  // Manejo de conexión y desconexión de Socket.IO
  useEffect(() => {
    const handleConnect = () => {
      setIsConnected(true);
      retryCountRef.current = 0;
      clearRetryTimeout();
      fetchChatHistory();
      if (currentDiagramIdRef.current) {
        attemptChatJoin();
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      setIsJoined(false);
      clearRetryTimeout();
    };

    activeSocket.on("connect", handleConnect);
    activeSocket.on("disconnect", handleDisconnect);

    // Estado inicial de conexión
    setIsConnected(Boolean(activeSocket?.connected));

    // Al recibir 'diagram-state', el backend acaba de confirmar 'join-diagram' y unió al socket a la sala
    const unsubscribeDiagramState = onDiagramState(() => {
      if (activeSocket?.connected && currentDiagramIdRef.current) {
        attemptChatJoin();
      }
    });

    return () => {
      activeSocket.off("connect", handleConnect);
      activeSocket.off("disconnect", handleDisconnect);
      unsubscribeDiagramState();
      clearRetryTimeout();
    };
  }, [attemptChatJoin, fetchChatHistory, activeSocket]);

  // Manejo de cambio de diagrama: reiniciar mensajes, intentar chat-join y cargar historial
  useEffect(() => {
    setMessages([]);
    setError(null);
    setBusyByMessageId({});
    setErrorByMessageId({});
    clearRetryTimeout();
    retryCountRef.current = 0;

    if (diagramId) {
      if (activeSocket?.connected) {
        attemptChatJoin();
      }
      fetchChatHistory();
    } else {
      setIsJoined(false);
    }

    return () => {
      clearRetryTimeout();
    };
  }, [diagramId, attemptChatJoin, fetchChatHistory, activeSocket]);

  // Escuchar mensajes entrantes en tiempo real mediante el evento 'chat-message'
  useEffect(() => {
    const handleIncomingMessage = (msg: PublicChatMessage) => {
      if (!msg || !msg.diagramId || msg.diagramId !== currentDiagramIdRef.current) {
        // Descartar mensajes de otro diagrama
        return;
      }

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) {
          return prev; // Evitar duplicación por id
        }
        return [...prev, msg];
      });

      // Si el panel está cerrado, aumentar contador de no leídos
      if (!isOpenRef.current) {
        setUnreadCount((count) => count + 1);
      }
    };

    activeSocket.on("chat-message", handleIncomingMessage);

    return () => {
      activeSocket.off("chat-message", handleIncomingMessage);
    };
  }, [activeSocket]);

  // Escuchar el evento 'ai-operations' para aplicar modificaciones de Codia al lienzo (CU20)
  useEffect(() => {
    const handleAiOperations = async (
      payload: any,
      ackCallback?: (ack: { applied: number; failed: number }) => void,
    ) => {
      let ackCalled = false;
      const safeAck = (res: { applied: number; failed: number }) => {
        if (!ackCalled) {
          ackCalled = true;
          if (typeof ackCallback === "function") {
            try {
              ackCallback(res);
            } catch (ackErr) {
              console.warn(
                "[TeamChat] Error al invocar callback de ack para ai-operations:",
                ackErr,
              );
            }
          }
        }
      };

      try {
        const messageId =
          typeof payload?.messageId === "string" ? payload.messageId : "";
        const isProcessed = messageId
          ? processedMessageIdsRef.current.has(messageId)
          : false;
        const api = excalidrawAPIRef.current;

        const validation = validateAiOperations({
          payload,
          activeDiagramId: currentDiagramIdRef.current,
          hasExcalidrawApi: Boolean(api),
          isAlreadyProcessed: isProcessed,
        });

        if (!validation.canApply) {
          safeAck(validation.ack || { applied: 0, failed: 0 });
          return;
        }

        // Marcar messageId como procesado para deduplicar
        if (messageId) {
          processedMessageIdsRef.current.add(messageId);
        }

        const operations = payload.operations;
        const opResult = applyAiOperations(operations, api!);
        const { applied, failed } = calculateOperationCounts(
          opResult?.results || [],
          operations.length,
        );

        // Cancelar guardado diferido y persistir inmediatamente al backend
        LocalData.cancelSave();

        const timeoutMs =
          typeof payload?.timeoutMs === "number" && payload.timeoutMs > 0
            ? payload.timeoutMs
            : 15000;
        const saveTimeout = Math.max(1000, timeoutMs - 3000);

        await saveDiagramWithTimeout(async () => {
          await saveDiagramToBackend(
            api!.getSceneElementsIncludingDeleted(),
            api!.getAppState(),
            api!.getFiles(),
          );
        }, saveTimeout);

        safeAck({ applied, failed });
      } catch (err) {
        console.error(
          "[TeamChat] Error no controlado en listener de ai-operations:",
          err,
        );
        const count = Array.isArray(payload?.operations)
          ? payload.operations.length
          : 0;
        safeAck({ applied: 0, failed: count });
      }
    };

    socket.on("ai-operations", handleAiOperations);

    return () => {
      socket.off("ai-operations", handleAiOperations);
    };
  }, []);

  /**
   * Envía un mensaje de chat al equipo mediante el evento de socket 'chat-message'.
   * Retorna true si fue exitoso (para que el formulario vacíe el texto).
   */
  const sendMessage = useCallback(
    async (text: string): Promise<boolean> => {
      const activeDiagId = currentDiagramIdRef.current;
      if (!activeDiagId) {
        setError("No hay ningún diagrama activo.");
        return false;
      }

      const trimmedText = text.trim();
      if (!trimmedText) {
        setError("El mensaje no puede estar vacío.");
        return false;
      }

      if (trimmedText.length > 2000) {
        setError("El mensaje no puede superar los 2000 caracteres.");
        return false;
      }

      // D8: Si el mensaje menciona a Codia / IA, cancelar guardado diferido y esperar guardado inmediato
      if (hasCodiaMention(trimmedText)) {
        const api = excalidrawAPIRef.current;
        if (api) {
          LocalData.cancelSave();
          try {
            await saveDiagramToBackend(
              api.getSceneElementsIncludingDeleted(),
              api.getAppState(),
              api.getFiles(),
            );
          } catch (saveErr) {
            console.warn(
              "[TeamChat] Error al guardar diagrama antes de enviar mensaje a Codia:",
              saveErr,
            );
          }
        }
      }

      setIsSending(true);
      setError(null);

      return new Promise<boolean>((resolve) => {
        activeSocket.emit(
          "chat-message",
          { diagramId: activeDiagId, text: trimmedText },
          (res: { ok: boolean; error?: string }) => {
            setIsSending(false);

            if (res?.ok) {
              setError(null);
              resolve(true);
              return;
            }

            const errorCode = res?.error || "error";
            switch (errorCode) {
              case "not_joined":
                setError("Reconectando al chat…");
                attemptChatJoin();
                break;
              case "empty":
                setError("El mensaje no puede estar vacío.");
                break;
              case "too_long":
                setError("El mensaje no puede superar los 2000 caracteres.");
                break;
              case "unavailable":
                setError("El chat no está disponible por ahora");
                break;
              case "invalid_session":
                setError("Sesión inválida.");
                window.dispatchEvent(new CustomEvent("session-invalid"));
                break;
              default:
                setError("No se pudo enviar el mensaje. Intente nuevamente.");
                break;
            }

            resolve(false);
          }
        );
      });
    },
    [attemptChatJoin, activeSocket]
  );

  // Escuchar el evento 'proposal-updated' para sincronizar propuestas en tiempo real (CU22)
  useEffect(() => {
    const handleProposalUpdated = (payload: any) => {
      if (
        !payload ||
        !payload.diagramId ||
        payload.diagramId !== currentDiagramIdRef.current ||
        !payload.messageId ||
        !payload.proposal
      ) {
        return;
      }

      const targetId = payload.messageId;

      setMessages((prev) => {
        let found = false;
        const updated = prev.map((m) => {
          if (m.id === targetId) {
            found = true;
            return { ...m, proposal: payload.proposal };
          }
          return m;
        });
        return found ? updated : prev;
      });

      setBusyByMessageId((prev) => {
        if (!prev[targetId]) return prev;
        return { ...prev, [targetId]: false };
      });

      setErrorByMessageId((prev) => {
        if (!prev[targetId]) return prev;
        return { ...prev, [targetId]: null };
      });
    };

    activeSocket.on("proposal-updated", handleProposalUpdated);

    return () => {
      activeSocket.off("proposal-updated", handleProposalUpdated);
    };
  }, [activeSocket]);

  /**
   * Envía la decisión de aprobación o rechazo de una propuesta mediante el evento 'proposal-decision'.
   * Mientras espera, marca el mensaje como ocupado (busy) y gestiona acuse, errores y actualización de estado.
   */
  const decideProposal = useCallback(
    async (
      messageId: string,
      decision: "approve" | "reject"
    ): Promise<void> => {
      const activeDiagId = currentDiagramIdRef.current;
      if (!activeDiagId || !messageId) {
        return;
      }

      setBusyByMessageId((prev) => ({ ...prev, [messageId]: true }));
      setErrorByMessageId((prev) => ({ ...prev, [messageId]: null }));

      const timeoutMs = 20000;
      let timer: NodeJS.Timeout | null = null;
      let finished = false;

      return new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          if (!finished) {
            finished = true;
            setBusyByMessageId((prev) => ({ ...prev, [messageId]: false }));
            setErrorByMessageId((prev) => ({
              ...prev,
              [messageId]: "No se pudo aplicar, intenta de nuevo",
            }));
            resolve();
          }
        }, timeoutMs);

        activeSocket.emit(
          "proposal-decision",
          { diagramId: activeDiagId, proposalId: messageId, decision },
          (res: { ok: boolean; error?: string; proposal?: any }) => {
            if (finished) {
              return;
            }
            finished = true;
            if (timer) {
              clearTimeout(timer);
              timer = null;
            }

            setBusyByMessageId((prev) => ({ ...prev, [messageId]: false }));

            if (res?.proposal) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === messageId ? { ...m, proposal: res.proposal } : m
                )
              );
            }

            if (res?.ok) {
              setErrorByMessageId((prev) => ({ ...prev, [messageId]: null }));
            } else {
              const errorCode = res?.error || "error";
              let errorMsg = "No se pudo procesar la propuesta";
              switch (errorCode) {
                case "already_decided":
                  errorMsg = "Otro integrante ya decidió";
                  break;
                case "stale":
                  errorMsg = "El diagrama cambió, la propuesta caducó";
                  break;
                case "apply_failed":
                  errorMsg = "No se pudo aplicar, intenta de nuevo";
                  break;
                case "not_joined":
                  errorMsg = "No estás unido a la sala";
                  break;
                case "invalid_session":
                  errorMsg = "Sesión inválida";
                  window.dispatchEvent(new CustomEvent("session-invalid"));
                  break;
                case "storage_error":
                  errorMsg = "Error al guardar, intenta de nuevo";
                  break;
                default:
                  errorMsg = "No se pudo procesar la propuesta";
                  break;
              }
              setErrorByMessageId((prev) => ({ ...prev, [messageId]: errorMsg }));
            }

            resolve();
          }
        );
      });
    },
    [activeSocket]
  );

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        // Al abrir, se restablece el contador de no leídos
        setUnreadCount(0);
      }
      return next;
    });
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    isOpen,
    unreadCount,
    isConnected,
    isJoined,
    error,
    isSending,
    currentUsername,
    sendMessage,
    toggleOpen,
    closeChat,
    clearError,
    diagramId,
    // CU22:
    busyByMessageId,
    errorByMessageId,
    decideProposal,
  };
};
