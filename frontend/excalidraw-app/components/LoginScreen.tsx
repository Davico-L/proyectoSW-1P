import React, { useState } from "react";
import { BACKEND_URL, ACTIVE_SESSION_KEY, ACTIVE_USERNAME_KEY } from "../data/backendSync";
import "./LoginScreen.scss";

interface LoginScreenProps {
  onLoginSuccess: (sessionId: string, username: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${BACKEND_URL}/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(
          errorBody.error || `Error al crear la sesión (Status: ${response.status})`
        );
      }

      const data: { sessionId: string; username: string; createdAt: string } =
        await response.json();

      // Guardar en localStorage
      try {
        localStorage.setItem(ACTIVE_SESSION_KEY, data.sessionId);
        localStorage.setItem(ACTIVE_USERNAME_KEY, data.username);
      } catch (storageErr) {
        console.warn("No se pudo guardar la sesión en localStorage:", storageErr);
      }

      // Notificar éxito para redirigir al lienzo
      onLoginSuccess(data.sessionId, data.username);
    } catch (err: any) {
      console.error("[LoginScreen] Error de conexión o autenticación:", err);
      setErrorMessage(
        err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError")
          ? `No se pudo conectar con el servidor backend (${BACKEND_URL}). Asegúrate de que el backend esté iniciado.`
          : err.message || "Ocurrió un error inesperado al iniciar sesión."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen-container">
      <div className="login-card">
        <div className="login-header">
          <span className="login-badge">CU15 • Gestión de Sesión</span>
          <div className="login-logo">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6366f1"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
          </div>
          <h1 className="login-title">Iniciar Sesión</h1>
          <p className="login-subtitle">
            Ingresa tu nombre para acceder y colaborar en el lienzo de trabajo.
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username-input">Nombre de usuario</label>
            <input
              id="username-input"
              type="text"
              className="login-input"
              placeholder="Tu nombre (opcional)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoFocus
              autoComplete="off"
            />
            <span className="helper-text">
              Si dejas este campo vacío, se te asignará automáticamente un nombre de invitado (ej. Invitado-1234).
            </span>
          </div>

          {errorMessage && (
            <div className="error-alert">
              <svg
                width="16"
                height="16"
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
              <div>{errorMessage}</div>
            </div>
          )}

          <button
            type="submit"
            className="submit-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" />
                <span>Iniciando sesión...</span>
              </>
            ) : (
              <>
                <span>Entrar</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          Lienzo de Diagramas • PostgreSQL conectado
        </div>
      </div>
    </div>
  );
};
