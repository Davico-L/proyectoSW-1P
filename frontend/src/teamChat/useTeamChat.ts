import { useState, useEffect, useRef, useCallback } from "react";
import { socket, onDiagramState } from "../../excalidraw-app/data/realtimeSync";
import {
  ACTIVE_SESSION_KEY,
  ACTIVE_USERNAME_KEY,
  BACKEND_URL,
} from "../../excalidraw-app/data/backendSync";
import type { PublicChatMessage } from "./types";

export interface UseTeamChatOptions {
  diagramId: string | null;
  backendUrl?: string;
}

export const useTeamChat = ({
  diagramId,
  backendUrl = BACKEND_URL,
}: UseTeamChatOptions) => {
  const [messages, setMessages] = useState<PublicChatMessage[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(socket.connected);
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);

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
    if (!activeDiagId || !socket.connected) {
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

    socket.emit(
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

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    // Estado inicial de conexión
    setIsConnected(socket.connected);

    // Al recibir 'diagram-state', el backend acaba de confirmar 'join-diagram' y unió al socket a la sala
    const unsubscribeDiagramState = onDiagramState(() => {
      if (socket.connected && currentDiagramIdRef.current) {
        attemptChatJoin();
      }
    });

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      unsubscribeDiagramState();
      clearRetryTimeout();
    };
  }, [attemptChatJoin, fetchChatHistory]);

  // Manejo de cambio de diagrama: reiniciar mensajes, intentar chat-join y cargar historial
  useEffect(() => {
    setMessages([]);
    setError(null);
    clearRetryTimeout();
    retryCountRef.current = 0;

    if (diagramId) {
      if (socket.connected) {
        attemptChatJoin();
      }
      fetchChatHistory();
    } else {
      setIsJoined(false);
    }

    return () => {
      clearRetryTimeout();
    };
  }, [diagramId, attemptChatJoin, fetchChatHistory]);

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

    socket.on("chat-message", handleIncomingMessage);

    return () => {
      socket.off("chat-message", handleIncomingMessage);
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

      setIsSending(true);
      setError(null);

      return new Promise<boolean>((resolve) => {
        socket.emit(
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
    [attemptChatJoin]
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
  };
};
