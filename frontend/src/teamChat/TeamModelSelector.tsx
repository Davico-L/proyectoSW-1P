import React, { useState, useEffect, useRef, useCallback } from "react";
import { ACTIVE_SESSION_KEY, BACKEND_URL } from "../../excalidraw-app/data/backendSync";
import type { AiProviderInfo, ProviderId } from "./types";
import "./TeamChat.scss";

export interface TeamModelSelectorProps {
  backendUrl?: string;
}

export const TeamModelSelector: React.FC<TeamModelSelectorProps> = ({
  backendUrl = BACKEND_URL,
}) => {
  const [providers, setProviders] = useState<AiProviderInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const fetchProviders = useCallback(
    async (refresh = false) => {
      let sessionId = "";
      try {
        sessionId = localStorage.getItem(ACTIVE_SESSION_KEY) || "";
      } catch {
        // Ignorar fallos de localStorage
      }

      if (!sessionId) {
        window.dispatchEvent(new CustomEvent("session-invalid"));
        return;
      }

      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const url = `${backendUrl}/ai/providers${refresh ? "?refresh=1" : ""}`;
        const res = await fetch(url, {
          headers: {
            "x-session-id": sessionId,
          },
        });

        if (res.status === 401) {
          window.dispatchEvent(new CustomEvent("session-invalid"));
          return;
        }

        if (!res.ok) {
          setError("No se pudo cargar el estado de los modelos.");
          return;
        }

        const data = (await res.json()) as AiProviderInfo[];
        if (Array.isArray(data)) {
          setProviders(data);
        }
      } catch (err) {
        setError("Error de conexión al consultar modelos.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [backendUrl]
  );

  // Cargar estado inicial de proveedores al montar el componente (abrir el panel)
  useEffect(() => {
    fetchProviders(false);
  }, [fetchProviders]);

  // Cerrar el dropdown al hacer clic fuera
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
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

  const handleSelect = async (providerId: ProviderId) => {
    if (isUpdating) {
      return;
    }

    let sessionId = "";
    try {
      sessionId = localStorage.getItem(ACTIVE_SESSION_KEY) || "";
    } catch {
      // Ignorar fallos de localStorage
    }

    if (!sessionId) {
      window.dispatchEvent(new CustomEvent("session-invalid"));
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const res = await fetch(`${backendUrl}/ai/providers/active`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
        },
        body: JSON.stringify({ id: providerId }),
      });

      if (res.status === 401) {
        window.dispatchEvent(new CustomEvent("session-invalid"));
        return;
      }

      if (res.ok) {
        const data = (await res.json()) as { ok: boolean; active: ProviderId };
        const activeId = data.active;
        setProviders((prev) =>
          prev.map((p) => ({
            ...p,
            active: p.id === activeId,
          }))
        );
        setError(null);
        setIsOpen(false);
      } else {
        const data = await res.json().catch(() => null);
        const errorMsg =
          data?.message || "No se pudo cambiar el modelo activo.";
        setError(errorMsg);
      }
    } catch (err) {
      setError("Error de conexión al actualizar el modelo.");
    } finally {
      setIsUpdating(false);
    }
  };

  const activeProvider = providers.find((p) => p.active);

  const getShortName = (p?: AiProviderInfo): string => {
    if (!p) return "Modelo IA";
    if (p.id === "local") return "Local";
    if (p.id === "groq") return "Groq";
    if (p.id === "gemini") return "Gemini";
    return p.label || "Modelo";
  };

  return (
    <div className="team-model-selector-container" ref={containerRef}>
      {/* Botón disparador y botón de refresco */}
      <div className="team-model-trigger-group">
        <button
          type="button"
          className={`team-model-trigger-btn ${isOpen ? "is-open" : ""}`}
          onClick={() => setIsOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          title={`Modelo activo del equipo: ${
            activeProvider?.label || "Cargando…"
          } (${activeProvider?.available ? "Disponible" : "No disponible"})`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="team-model-icon"
          >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          <span className="team-model-trigger-label">
            {isLoading && providers.length === 0
              ? "Cargando…"
              : getShortName(activeProvider)}
          </span>
          <span
            className={`team-model-dot ${
              activeProvider?.available ? "is-available" : "is-unavailable"
            }`}
          />
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`team-model-chevron ${isOpen ? "is-rotated" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        <button
          type="button"
          className="team-model-refresh-btn"
          onClick={() => fetchProviders(true)}
          disabled={isRefreshing || isLoading}
          aria-label="Actualizar disponibilidad de modelos (?refresh=1)"
          title="Actualizar disponibilidad de modelos (?refresh=1)"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`team-model-refresh-icon ${
              isRefreshing ? "is-spinning" : ""
            }`}
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      {/* Menú desplegable */}
      {isOpen && (
        <div
          className="team-model-dropdown"
          role="listbox"
          aria-label="Lista de modelos de IA"
        >
          <div className="team-model-dropdown-header">
            <span className="team-model-dropdown-title">
              Modelo activo del equipo
            </span>
            <span className="team-model-dropdown-subtitle">
              Global para todos los miembros de la sala
            </span>
          </div>

          {error && (
            <div className="team-model-error-banner" role="alert">
              <span>{error}</span>
              <button
                type="button"
                className="team-model-error-dismiss"
                onClick={() => setError(null)}
                aria-label="Cerrar advertencia"
              >
                &times;
              </button>
            </div>
          )}

          <div className="team-model-options-list">
            {providers.map((p) => {
              const isSelected = p.active;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`team-model-option ${
                    isSelected ? "is-selected" : ""
                  }`}
                  onClick={() => handleSelect(p.id)}
                  disabled={isUpdating}
                  role="option"
                  aria-selected={isSelected}
                  title={`Seleccionar ${p.label}`}
                >
                  <div className="team-model-option-indicator">
                    {isSelected ? (
                      <span className="team-model-radio is-checked" />
                    ) : (
                      <span className="team-model-radio" />
                    )}
                  </div>

                  <div className="team-model-option-content">
                    <span className="team-model-option-label">{p.label}</span>
                    {p.model && (
                      <span className="team-model-option-model">{p.model}</span>
                    )}
                  </div>

                  <div
                    className={`team-model-option-status ${
                      p.available ? "is-available" : "is-unavailable"
                    }`}
                  >
                    <span className="status-dot" />
                    <span className="status-text">
                      {p.available ? "Disponible" : "No disponible"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
