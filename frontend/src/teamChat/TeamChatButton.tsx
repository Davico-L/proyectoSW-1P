import React from "react";
import "./TeamChat.scss";

export interface TeamChatButtonProps {
  isOpen: boolean;
  onClick: () => void;
  unreadCount?: number;
}

export const TeamChatButton: React.FC<TeamChatButtonProps> = ({
  isOpen,
  onClick,
  unreadCount = 0,
}) => {
  return (
    <button
      type="button"
      className={`team-chat-button ${isOpen ? "is-open" : ""}`}
      onClick={onClick}
      aria-label={isOpen ? "Cerrar chat del equipo" : "Abrir chat del equipo"}
      title={isOpen ? "Cerrar chat del equipo" : "Chat del equipo - Conversar en tiempo real"}
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
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Team / Users Collaboration Icon */}
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )}

      {!isOpen && unreadCount > 0 && (
        <span className="team-chat-badge" aria-label={`${unreadCount} mensajes no leídos`}>
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
};
