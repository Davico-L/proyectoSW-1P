import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { socket as globalSocket } from "../../excalidraw-app/data/realtimeSync";
import { ACTIVE_SESSION_KEY } from "../../excalidraw-app/data/backendSync";
import "./TeamChat.scss";

export type RoomMode = "apply" | "advise";
export type RoomStyle = "directa" | "mentora" | "detallada";

export interface RoomSettings {
  mode: RoomMode;
  style: RoomStyle;
}

export interface TeamRoomSettingsSelectorProps {
  diagramId?: string | null;
  isConnected: boolean;
  isJoined: boolean;
  socketInstance?: any;
}

interface DropdownPosition {
  top: number;
  left: number;
  maxHeight: number;
}

export const TeamRoomSettingsSelector: React.FC<TeamRoomSettingsSelectorProps> = ({
  diagramId,
  isConnected,
  isJoined,
  socketInstance,
}) => {
  const activeSocket = socketInstance || globalSocket;

  const [mode, setMode] = useState<RoomMode>("apply");
  const [style, setStyle] = useState<RoomStyle>("mentora");
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<DropdownPosition | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 1. Estado inicial: obtener settings a través del ack de chat-join
  useEffect(() => {
    if (!isConnected || !isJoined || !diagramId) {
      return;
    }

    let sessionId = "";
    try {
      sessionId = localStorage.getItem(ACTIVE_SESSION_KEY) || "";
    } catch {
      // Ignorar fallos de localStorage
    }

    activeSocket.emit(
      "chat-join",
      { diagramId, sessionId },
      (res: { ok: boolean; settings?: { mode?: RoomMode; style?: RoomStyle } }) => {
        if (res?.ok && res.settings) {
          if (res.settings.mode === "apply" || res.settings.mode === "advise") {
            setMode(res.settings.mode);
          }
          if (
            res.settings.style === "directa" ||
            res.settings.style === "mentora" ||
            res.settings.style === "detallada"
          ) {
            setStyle(res.settings.style);
          }
        }
      }
    );
  }, [isConnected, isJoined, diagramId, activeSocket]);

  // 3. Escuchar "ai-settings-changed" para sincronización entre clientes de la sala
  useEffect(() => {
    const handleSettingsChanged = (data: {
      diagramId?: string;
      mode?: RoomMode;
      style?: RoomStyle;
      updatedBy?: string;
    }) => {
      if (!data || data.diagramId !== diagramId) {
        return;
      }
      if (data.mode === "apply" || data.mode === "advise") {
        setMode(data.mode);
      }
      if (
        data.style === "directa" ||
        data.style === "mentora" ||
        data.style === "detallada"
      ) {
        setStyle(data.style);
      }
    };

    activeSocket.on("ai-settings-changed", handleSettingsChanged);
    return () => {
      activeSocket.off("ai-settings-changed", handleSettingsChanged);
    };
  }, [diagramId, activeSocket]);

  // Cálculo robusto de posición dentro de los límites del viewport y del panel de chat
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) {
      return;
    }

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const chatPanel = buttonRef.current.closest(".team-chat-panel");
    const chatRect = chatPanel ? chatPanel.getBoundingClientRect() : null;

    const DROPDOWN_WIDTH = 240;
    const MARGIN = 8;
    const GAP = 6;

    const viewportWidth =
      window.innerWidth || document.documentElement.clientWidth || 360;
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight || 480;

    // Posición horizontal inicial alineada a la derecha del botón
    let left = buttonRect.right - DROPDOWN_WIDTH;

    // Límites horizontales basados en el panel de chat (si existe) y el viewport
    const minLeft = chatRect
      ? Math.max(MARGIN, chatRect.left + MARGIN)
      : MARGIN;
    const maxLeft = chatRect
      ? Math.min(
          viewportWidth - DROPDOWN_WIDTH - MARGIN,
          chatRect.right - DROPDOWN_WIDTH - MARGIN
        )
      : viewportWidth - DROPDOWN_WIDTH - MARGIN;

    if (maxLeft >= minLeft) {
      left = Math.max(minLeft, Math.min(left, maxLeft));
    } else {
      left = minLeft;
    }

    // Posición vertical por defecto debajo del botón
    let top = buttonRect.bottom + GAP;

    const maxBottom = chatRect
      ? Math.min(viewportHeight - MARGIN, chatRect.bottom - MARGIN)
      : viewportHeight - MARGIN;

    let availableHeight = maxBottom - top;

    // Si el espacio hacia abajo es muy ajustado (<160px) y hay más espacio arriba, abrir hacia arriba
    const minTop = chatRect
      ? Math.max(MARGIN, chatRect.top + MARGIN)
      : MARGIN;
    const spaceAbove = buttonRect.top - GAP - minTop;

    if (availableHeight < 160 && spaceAbove > availableHeight) {
      const estimatedHeight = Math.min(320, spaceAbove);
      top = Math.max(minTop, buttonRect.top - GAP - estimatedHeight);
      availableHeight = buttonRect.top - GAP - top;
    }

    const maxHeight = Math.max(120, Math.floor(availableHeight));

    setPosition({
      top: Math.round(top),
      left: Math.round(left),
      maxHeight,
    });
  }, []);

  // Recalcular posición al abrir y al redimensionar o hacer scroll
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePosition();

    const handleResize = () => updatePosition();
    const handleScroll = () => updatePosition();

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen, updatePosition]);

  // Cerrar al hacer clic fuera o presionar Escape (compatible con React Portal)
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Al elegir una opción emite "ai-settings-update"
  const updateSettings = (targetMode: RoomMode, targetStyle: RoomStyle) => {
    if (!diagramId || isUpdating) {
      return;
    }

    setIsUpdating(true);
    setError(null);

    activeSocket.emit(
      "ai-settings-update",
      { diagramId, mode: targetMode, style: targetStyle },
      (res: {
        ok: boolean;
        settings?: { mode: RoomMode; style: RoomStyle };
        error?: string;
      }) => {
        setIsUpdating(false);
        if (res?.ok) {
          if (res.settings) {
            setMode(res.settings.mode);
            setStyle(res.settings.style);
          } else {
            setMode(targetMode);
            setStyle(targetStyle);
          }
          setError(null);
        } else {
          setError("No se pudo guardar la configuración");
          if (res?.error === "invalid_session") {
            window.dispatchEvent(new CustomEvent("session-invalid"));
          }
        }
      }
    );
  };

  const handleModeSelect = (newMode: RoomMode) => {
    if (newMode === mode) {
      return;
    }
    updateSettings(newMode, style);
  };

  const handleStyleSelect = (newStyle: RoomStyle) => {
    if (newStyle === style) {
      return;
    }
    updateSettings(mode, newStyle);
  };

  const handleTriggerClick = () => {
    if (isOpen) {
      setIsOpen(false);
    } else {
      updatePosition();
      setIsOpen(true);
    }
  };

  const isButtonDisabled = !isConnected || !isJoined || !diagramId;

  // Detección de tema oscuro
  const isDark = Boolean(
    buttonRef.current?.closest(".theme--dark, [data-theme='dark']") ||
      (typeof document !== "undefined" &&
        (document.body.classList.contains("theme--dark") ||
          document.documentElement.classList.contains("theme--dark") ||
          document.documentElement.getAttribute("data-theme") === "dark"))
  );

  return (
    <div className="team-room-settings-container">
      {/* Botón de engranaje (tooltip "Codia") */}
      <button
        ref={buttonRef}
        type="button"
        className={`team-room-settings-trigger-btn ${isOpen ? "is-open" : ""}`}
        onClick={handleTriggerClick}
        disabled={isButtonDisabled}
        title="Codia"
        aria-label="Codia"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="team-room-settings-gear-icon"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {/* Panel chico desplegable renderizado con React Portal para no ser recortado por overflow: hidden */}
      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={dropdownRef}
            className={`team-room-settings-dropdown ${
              isDark ? "theme--dark" : ""
            }`}
            role="dialog"
            aria-label="Configuración de Codia"
            style={{
              position: "fixed",
              top: position ? `${position.top}px` : undefined,
              left: position ? `${position.left}px` : undefined,
              maxHeight: position ? `${position.maxHeight}px` : undefined,
            }}
          >
            <div className="team-room-settings-header">
              <span className="team-room-settings-title">
                Configuración de Codia
              </span>
              <span className="team-room-settings-subtitle">
                Ajustes para este diagrama
              </span>
            </div>

            {error && (
              <div className="team-room-settings-error-banner" role="alert">
                <span>{error}</span>
                <button
                  type="button"
                  className="team-room-settings-error-dismiss"
                  onClick={() => setError(null)}
                  aria-label="Cerrar advertencia"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Grupo Modo */}
            <div
              className="team-room-settings-group"
              role="radiogroup"
              aria-label="Modo"
            >
              <span className="team-room-settings-group-label">Modo</span>
              <div className="team-room-settings-options-list">
                <button
                  type="button"
                  className={`team-room-settings-option ${
                    mode === "apply" ? "is-selected" : ""
                  }`}
                  onClick={() => handleModeSelect("apply")}
                  disabled={isUpdating}
                  role="radio"
                  aria-checked={mode === "apply"}
                  title="Aplica los cambios"
                >
                  <div className="team-room-settings-option-indicator">
                    <span
                      className={`team-room-settings-radio ${
                        mode === "apply" ? "is-checked" : ""
                      }`}
                    />
                  </div>
                  <div className="team-room-settings-option-content">
                    <span className="team-room-settings-option-label">
                      Aplica los cambios
                    </span>
                    <span className="team-room-settings-option-sub">
                      Modifica el diagrama
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`team-room-settings-option ${
                    mode === "advise" ? "is-selected" : ""
                  }`}
                  onClick={() => handleModeSelect("advise")}
                  disabled={isUpdating}
                  role="radio"
                  aria-checked={mode === "advise"}
                  title="Solo asesora"
                >
                  <div className="team-room-settings-option-indicator">
                    <span
                      className={`team-room-settings-radio ${
                        mode === "advise" ? "is-checked" : ""
                      }`}
                    />
                  </div>
                  <div className="team-room-settings-option-content">
                    <span className="team-room-settings-option-label">
                      Solo asesora
                    </span>
                    <span className="team-room-settings-option-sub">
                      Propone sin aplicar
                    </span>
                  </div>
                </button>
              </div>
            </div>

            <div className="team-room-settings-divider" />

            {/* Grupo Estilo */}
            <div
              className="team-room-settings-group"
              role="radiogroup"
              aria-label="Estilo"
            >
              <span className="team-room-settings-group-label">Estilo</span>
              <div className="team-room-settings-options-list">
                <button
                  type="button"
                  className={`team-room-settings-option ${
                    style === "directa" ? "is-selected" : ""
                  }`}
                  onClick={() => handleStyleSelect("directa")}
                  disabled={isUpdating}
                  role="radio"
                  aria-checked={style === "directa"}
                  title="Directa"
                >
                  <div className="team-room-settings-option-indicator">
                    <span
                      className={`team-room-settings-radio ${
                        style === "directa" ? "is-checked" : ""
                      }`}
                    />
                  </div>
                  <div className="team-room-settings-option-content">
                    <span className="team-room-settings-option-label">
                      Directa
                    </span>
                    <span className="team-room-settings-option-sub">
                      ~60 palabras
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`team-room-settings-option ${
                    style === "mentora" ? "is-selected" : ""
                  }`}
                  onClick={() => handleStyleSelect("mentora")}
                  disabled={isUpdating}
                  role="radio"
                  aria-checked={style === "mentora"}
                  title="Mentora"
                >
                  <div className="team-room-settings-option-indicator">
                    <span
                      className={`team-room-settings-radio ${
                        style === "mentora" ? "is-checked" : ""
                      }`}
                    />
                  </div>
                  <div className="team-room-settings-option-content">
                    <span className="team-room-settings-option-label">
                      Mentora
                    </span>
                    <span className="team-room-settings-option-sub">
                      ~120 palabras con ejemplo
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`team-room-settings-option ${
                    style === "detallada" ? "is-selected" : ""
                  }`}
                  onClick={() => handleStyleSelect("detallada")}
                  disabled={isUpdating}
                  role="radio"
                  aria-checked={style === "detallada"}
                  title="Detallada"
                >
                  <div className="team-room-settings-option-indicator">
                    <span
                      className={`team-room-settings-radio ${
                        style === "detallada" ? "is-checked" : ""
                      }`}
                    />
                  </div>
                  <div className="team-room-settings-option-content">
                    <span className="team-room-settings-option-label">
                      Detallada
                    </span>
                    <span className="team-room-settings-option-sub">
                      ~180 palabras
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
