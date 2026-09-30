import React from "react";
import "./AiChat.scss";

export interface AiChatButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export const AiChatButton: React.FC<AiChatButtonProps> = ({
  isOpen,
  onClick,
}) => {
  return (
    <button
      type="button"
      className={`ai-chat-button ${isOpen ? "is-open" : ""}`}
      onClick={onClick}
      aria-label={isOpen ? "Cerrar asistente de IA" : "Abrir asistente de IA"}
      title={isOpen ? "Cerrar asistente IA" : "Asistente IA - Editar diagrama con texto"}
    >
      {isOpen ? (
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
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          {/* Sparkles / Magic Stars Icon */}
          <path d="M12 2L13.8 7.2L19 9L13.8 10.8L12 16L10.2 10.8L5 9L10.2 7.2L12 2Z" />
          <path d="M19 15L20 18L23 19L20 20L19 23L18 20L15 19L18 18L19 15Z" />
          <path d="M5 16L5.8 18.2L8 19L5.8 19.8L5 22L4.2 19.8L2 19L4.2 18.2L5 16Z" />
        </svg>
      )}
    </button>
  );
};
