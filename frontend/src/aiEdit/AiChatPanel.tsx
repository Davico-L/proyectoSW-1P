import React, { useRef, useEffect } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useAiChat, type Message } from "./useAiChat";
import "./AiChat.scss";

export interface AiChatPanelProps {
  diagramId: string | null;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onClose: () => void;
  backendUrl?: string;
}

export const AiChatPanel: React.FC<AiChatPanelProps> = ({
  diagramId,
  excalidrawAPI,
  onClose,
  backendUrl,
}) => {
  const {
    messages,
    loading,
    inputText,
    setInputText,
    handleSendInstruction,
  } = useAiChat({ diagramId, excalidrawAPI, backendUrl });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll hacia el final cuando se agrega un mensaje o cambia el estado de carga
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Enfocar el textarea al abrir el panel
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendInstruction();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendInstruction();
  };

  return (
    <div className="ai-chat-panel" role="dialog" aria-label="Asistente de edición IA">
      {/* Header */}
      <div className="ai-chat-header">
        <div className="ai-chat-header-title">
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 2L13.8 7.2L19 9L13.8 10.8L12 16L10.2 10.8L5 9L10.2 7.2L12 2Z" />
            <path d="M19 15L20 18L23 19L20 20L19 23L18 20L15 19L18 18L19 15Z" />
            <path d="M5 16L5.8 18.2L8 19L5.8 19.8L5 22L4.2 19.8L2 19L4.2 18.2L5 16Z" />
          </svg>
          <span>Asistente Copilot UML</span>
        </div>
        <button
          type="button"
          className="ai-chat-close-btn"
          onClick={onClose}
          aria-label="Cerrar panel de chat"
          title="Cerrar"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Lista de mensajes */}
      <div className="ai-chat-messages">
        {messages.map((msg: Message) => {
          const isUser = msg.role === "user";
          const variantClass = !isUser && msg.variant ? `variant-${msg.variant}` : "variant-info";

          return (
            <div
              key={msg.id}
              className={`ai-chat-msg ${
                isUser ? "ai-chat-msg--user" : `ai-chat-msg--assistant ${variantClass}`
              }`}
            >
              {msg.text}
            </div>
          );
        })}

        {/* Indicador de carga temporal del asistente */}
        {loading && (
          <div className="ai-chat-msg ai-chat-msg--assistant variant-info">
            <div className="ai-chat-loading-indicator">
              <div className="ai-chat-spinner" />
              <span>Pensando...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input de texto con botón de enviar */}
      <form className="ai-chat-input-area" onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          rows={2}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribí una instrucción (Enter para enviar, Shift+Enter para salto de línea)..."
          disabled={loading}
          aria-label="Instrucción para el asistente"
        />
        <button
          type="submit"
          className="ai-chat-send-btn"
          disabled={loading || !inputText.trim()}
          title="Enviar instrucción"
          aria-label="Enviar"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </div>
  );
};
