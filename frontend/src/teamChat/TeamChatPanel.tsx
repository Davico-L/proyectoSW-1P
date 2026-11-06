import React, { useRef, useEffect, useState, useMemo } from "react";
import type { PublicChatMessage } from "./types";
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
}) => {
  const [inputText, setInputText] = useState<string>("");
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
  }, [messages]);

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
          <span
            className={`team-chat-status ${connectionStatus.statusClass}`}
            title={`Estado: ${connectionStatus.label}`}
          >
            <span className="status-dot" />
            {connectionStatus.label}
          </span>
        </div>

        {/* Espacio reservado para el futuro selector de modelo de IA */}
        <div
          className="team-chat-header-model-slot"
          id="team-chat-model-selector-slot"
          aria-hidden="true"
        />

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
            const isOwn =
              Boolean(currentUsername) &&
              msg.authorName?.toLowerCase() === currentUsername.toLowerCase();
            const isAi = msg.role === "ai";
            const isSystem = msg.role === "system";

            let msgModifier = "team-chat-msg--other";
            if (isOwn) {
              msgModifier = "team-chat-msg--own";
            } else if (isAi) {
              msgModifier = "team-chat-msg--ai";
            } else if (isSystem) {
              msgModifier = "team-chat-msg--system";
            }

            return (
              <div
                key={msg.id}
                className={`team-chat-msg ${msgModifier}`}
              >
                <div className="team-chat-msg-header">
                  <span className="team-chat-msg-author">
                    {isOwn ? "Tú" : msg.authorName || "Anónimo"}
                  </span>
                  <span className="team-chat-msg-time">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
                <div className="team-chat-msg-body">{msg.text}</div>
              </div>
            );
          })
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
        <div className="team-chat-textarea-wrapper">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              if (error) {
                onClearError();
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje al equipo… (Enter para enviar)"
            rows={2}
            aria-label="Mensaje para el equipo"
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
