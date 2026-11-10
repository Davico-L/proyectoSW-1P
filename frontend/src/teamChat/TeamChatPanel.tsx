import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { AI_DISPLAY_NAME, type PublicChatMessage } from "./types";
import {
  formatMessageSegments,
  getMentionSuggestionMatch,
} from "./mentionHelper";
import { renderAiFormattedText } from "./aiTextFormatter";
import { TeamModelSelector } from "./TeamModelSelector";
import { TeamRoomSettingsSelector } from "./TeamRoomSettingsSelector";
import { socket } from "../../excalidraw-app/data/realtimeSync";
import { getActiveDiagramId } from "../../excalidraw-app/data/backendSync";
import "./TeamChat.scss";

export interface TeamChatPanelProps {
  messages: PublicChatMessage[];
  isConnected: boolean;
  isJoined: boolean;
  error: string | null;
  isSending: boolean;
  currentUsername: string;
  onSendMessage: (text: string) => Promise<boolean>;
  onClose: () => void;
  onClearError: () => void;
  backendUrl?: string;
  diagramId?: string | null;
  excalidrawAPI?: any;
}

export const TeamChatPanel: React.FC<TeamChatPanelProps> = ({
  messages,
  isConnected,
  isJoined,
  error,
  isSending,
  currentUsername,
  onSendMessage,
  onClose,
  onClearError,
  backendUrl,
  diagramId,
}) => {
  const [inputText, setInputText] = useState<string>("");
  const [cursorPosition, setCursorPosition] = useState<number>(0);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeDiagramId =
    diagramId !== undefined ? diagramId : getActiveDiagramId();

  // Contador de consultas pendientes por askerName
  const [thinkingCounts, setThinkingCounts] = useState<Record<string, number>>({});
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout[]>>(new Map());

  // Limpiar todos los temporizadores y contadores de pensamiento
  const clearAllThinking = useCallback(() => {
    timeoutsRef.current.forEach((timers) => {
      timers.forEach((t) => clearTimeout(t));
    });
    timeoutsRef.current.clear();
    setThinkingCounts({});
  }, []);

  // Reiniciar contadores al cambiar de diagrama
  useEffect(() => {
    clearAllThinking();
  }, [activeDiagramId, clearAllThinking]);

  // Reiniciar contadores al reconectar el socket
  useEffect(() => {
    const handleConnect = () => {
      clearAllThinking();
    };
    socket.on("connect", handleConnect);
    return () => {
      socket.off("connect", handleConnect);
    };
  }, [clearAllThinking]);

  // Escuchar el evento 'ai-status' con limpieza al desmontar
  useEffect(() => {
    const handleAiStatus = (data: {
      diagramId?: string;
      state?: "thinking" | "idle";
      askerName?: string;
    }) => {
      if (!data || !data.diagramId) {
        return;
      }
      // Ignorar eventos de otro diagrama
      if (activeDiagramId && data.diagramId !== activeDiagramId) {
        return;
      }

      const asker = data.askerName?.trim() || "Alguien";

      if (data.state === "thinking") {
        // Temporizador de seguridad de 180 s para limpiar si nunca llega el "idle"
        const timeoutId = setTimeout(() => {
          setThinkingCounts((prev) => {
            const current = prev[asker] || 0;
            if (current <= 1) {
              const next = { ...prev };
              delete next[asker];
              return next;
            }
            return { ...prev, [asker]: current - 1 };
          });

          const list = timeoutsRef.current.get(asker);
          if (list) {
            const idx = list.indexOf(timeoutId);
            if (idx !== -1) {
              list.splice(idx, 1);
            }
          }
        }, 180000);

        const existing = timeoutsRef.current.get(asker) || [];
        timeoutsRef.current.set(asker, [...existing, timeoutId]);

        setThinkingCounts((prev) => ({
          ...prev,
          [asker]: (prev[asker] || 0) + 1,
        }));
      } else if (data.state === "idle") {
        const list = timeoutsRef.current.get(asker);
        if (list && list.length > 0) {
          const t = list.shift();
          if (t) {
            clearTimeout(t);
          }
        }

        setThinkingCounts((prev) => {
          const current = prev[asker] || 0;
          if (current <= 1) {
            const next = { ...prev };
            delete next[asker];
            return next;
          }
          return { ...prev, [asker]: current - 1 };
        });
      }
    };

    socket.on("ai-status", handleAiStatus);
    return () => {
      socket.off("ai-status", handleAiStatus);
      clearAllThinking();
    };
  }, [activeDiagramId, clearAllThinking]);

  // Lista de personas que están esperando respuesta de la IA
  const waitingAskers = useMemo(() => {
    return Object.entries(thinkingCounts)
      .filter(([_, count]) => count > 0)
      .map(([name]) => name);
  }, [thinkingCounts]);

  const isAiThinking = waitingAskers.length > 0;

  // Detección de sugerencia de mención @Codia en la palabra actual
  const suggestionMatch = useMemo(() => {
    return getMentionSuggestionMatch(inputText, cursorPosition);
  }, [inputText, cursorPosition]);

  const handleApplySuggestion = () => {
    if (!suggestionMatch) {
      return;
    }
    const before = inputText.slice(0, suggestionMatch.startIndex);
    const after = inputText.slice(suggestionMatch.endIndex);
    const rest = after.startsWith(" ") ? after.slice(1) : after;
    const replacement = `@${AI_DISPLAY_NAME} `;
    const newText = `${before}${replacement}${rest}`;
    const newCursorPos = before.length + replacement.length;

    setInputText(newText);
    setCursorPosition(newCursorPos);

    if (textareaRef.current) {
      textareaRef.current.focus();
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      });
    }
  };

  const updateCursorPosition = (
    e: React.SyntheticEvent<HTMLTextAreaElement>
  ) => {
    const target = e.currentTarget;
    setCursorPosition(target.selectionStart ?? target.value.length);
  };

  // Determinar texto y clase del indicador de conexión
  const connectionStatus = useMemo(() => {
    if (!isConnected) {
      return { label: "Reconectando…", statusClass: "is-offline" };
    }
    if (!isJoined) {
      return { label: "Conectando…", statusClass: "is-connecting" };
    }
    return { label: "En línea", statusClass: "is-online" };
  }, [isConnected, isJoined]);

  // Manejar el scroll del contenedor de mensajes
  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) {
      return;
    }
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // Si la distancia al fondo es menor a 60px, consideramos que el usuario está al final
    isNearBottomRef.current = distanceFromBottom < 60;
  };

  // Auto-scroll hacia abajo solo si el usuario no ha subido el scroll manualmente
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) {
      return;
    }
    if (isNearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isAiThinking]);

  // Enfoque inicial al abrir el panel
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleSend = async () => {
    const textToSend = inputText;
    if (!textToSend.trim() || textToSend.length > 2000 || isSending) {
      return;
    }

    const success = await onSendMessage(textToSend);
    // Solo vaciar el cuadro de texto si la respuesta fue exitosa
    if (success) {
      setInputText("");
      setCursorPosition(0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (createdAt: string | Date): string => {
    try {
      const d = new Date(createdAt);
      if (isNaN(d.getTime())) {
        return "";
      }
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const isTextEmpty = inputText.trim().length === 0;
  const isTextTooLong = inputText.length > 2000;
  const canSend = !isTextEmpty && !isTextTooLong && !isSending;

  return (
    <div
      className="team-chat-panel"
      role="region"
      aria-label="Panel de chat del equipo"
    >
      {/* Cabecera */}
      <div className="team-chat-header">
        <div className="team-chat-header-top">
          <div className="team-chat-header-title">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="team-chat-header-icon"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>Chat del equipo</span>
          </div>

          <button
            type="button"
            className="team-chat-close-btn"
            onClick={onClose}
            aria-label="Cerrar chat del equipo"
            title="Cerrar chat"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="team-chat-header-sub">
          <span
            className={`team-chat-status ${connectionStatus.statusClass}`}
            title={`Estado: ${connectionStatus.label}`}
          >
            <span className="status-dot" />
            {connectionStatus.label}
          </span>

          {/* Selector de modelo de IA del equipo y ajustes de Codia */}
          <div
            className="team-chat-header-model-slot"
            id="team-chat-model-selector-slot"
          >
            <TeamRoomSettingsSelector
              diagramId={activeDiagramId}
              isConnected={isConnected}
              isJoined={isJoined}
            />
            <TeamModelSelector backendUrl={backendUrl} />
          </div>
        </div>
      </div>

      {/* Lista de mensajes */}
      <div
        className="team-chat-messages"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className="team-chat-empty">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p>No hay mensajes aún en este diagrama.</p>
            <span className="team-chat-empty-hint">
              ¡Comunícate en tiempo real con tu equipo!
            </span>
          </div>
        ) : (
          messages.map((msg) => {
            const isAi = msg.role === "ai";
            const isSystem = msg.role === "system";
            const isOwn =
              !isAi &&
              !isSystem &&
              Boolean(currentUsername) &&
              msg.authorName?.toLowerCase() === currentUsername.toLowerCase();

            let msgModifier = "team-chat-msg--other";
            if (isAi) {
              msgModifier = "team-chat-msg--ai";
            } else if (isOwn) {
              msgModifier = "team-chat-msg--own";
            } else if (isSystem) {
              msgModifier = "team-chat-msg--system";
            }

            return (
              <div
                key={msg.id}
                className={`team-chat-msg ${msgModifier}`}
              >
                <div className="team-chat-msg-header">
                  <div className="team-chat-msg-author-group">
                    <span className="team-chat-msg-author">
                      {isOwn
                        ? "Tú"
                        : isAi
                        ? msg.authorName || AI_DISPLAY_NAME
                        : msg.authorName || "Anónimo"}
                    </span>
                    {isAi && (
                      <span className="team-chat-msg-badge-ai">IA</span>
                    )}
                    {isAi && msg.addressedTo && (
                      <span className="team-chat-msg-addressed">
                        para {msg.addressedTo}
                      </span>
                    )}
                  </div>
                  <span className="team-chat-msg-time">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
                <div className="team-chat-msg-body">
                  {isAi ? (
                    renderAiFormattedText(msg.text)
                  ) : (
                    formatMessageSegments(msg.text).map((segment, idx) =>
                      segment.isMention ? (
                        <strong key={idx} className="team-chat-mention">
                          {segment.text}
                        </strong>
                      ) : (
                        <React.Fragment key={idx}>
                          {segment.text}
                        </React.Fragment>
                      )
                    )
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Indicador de estado: Codia está pensando */}
        {isAiThinking && (
          <div
            className="team-chat-thinking-indicator"
            role="status"
            aria-live="polite"
          >
            <div className="team-chat-thinking-bubble">
              <span className="team-chat-thinking-text">
                <strong className="team-chat-thinking-author">
                  {AI_DISPLAY_NAME}
                </strong>{" "}
                está pensando
              </span>
              <span className="team-chat-thinking-dots" aria-hidden="true">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </span>
              <span className="team-chat-thinking-askers">
                ({waitingAskers.join(", ")})
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Banner de error visible */}
      {error && (
        <div className="team-chat-error-banner" role="alert">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="team-chat-error-text">{error}</span>
          <button
            type="button"
            className="team-chat-error-dismiss"
            onClick={onClearError}
            aria-label="Cerrar advertencia de error"
          >
            &times;
          </button>
        </div>
      )}

      {/* Caja de entrada */}
      <div className="team-chat-input-area">
        {/* Sugerencia de autocompletado para @Codia */}
        {suggestionMatch && (
          <div className="team-chat-suggestion-bar">
            <button
              type="button"
              className="team-chat-suggestion-btn"
              onMouseDown={(e) => {
                // Prevenir que el textarea pierda el foco al hacer clic
                e.preventDefault();
              }}
              onClick={handleApplySuggestion}
              title="Autocompletar @Codia"
            >
              <span className="team-chat-suggestion-highlight">
                @{AI_DISPLAY_NAME}
              </span>
            </button>
          </div>
        )}

        <div className="team-chat-textarea-wrapper">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              setCursorPosition(e.target.selectionStart ?? e.target.value.length);
              if (error) {
                onClearError();
              }
            }}
            onSelect={updateCursorPosition}
            onClick={updateCursorPosition}
            onKeyUp={updateCursorPosition}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje o usa @Codia para consultarle"
            rows={2}
            aria-label="Mensaje para el equipo"
            disabled={isSending}
          />
          <div className="team-chat-input-footer">
            <span
              className={`team-chat-char-counter ${
                isTextTooLong ? "is-limit-exceeded" : ""
              }`}
            >
              {inputText.length}/2000
            </span>
          </div>
        </div>

        <button
          type="button"
          className="team-chat-send-btn"
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Enviar mensaje"
          title={isSending ? "Enviando…" : "Enviar mensaje (Enter)"}
        >
          {isSending ? (
            <span className="team-chat-spinner" />
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};
