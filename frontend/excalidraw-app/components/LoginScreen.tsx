import React, { useState } from "react";
import {
  BACKEND_URL,
  ACTIVE_SESSION_KEY,
  ACTIVE_USERNAME_KEY,
} from "../data/backendSync";
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
    if (loading) {
      return;
    }

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
          errorBody.error ||
            `Error al crear la sesión (Status: ${response.status})`,
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
        err.message?.includes("Failed to fetch") ||
          err.message?.includes("NetworkError")
          ? `No se pudo conectar con el servidor backend (${BACKEND_URL}). Asegúrate de que el backend esté iniciado.`
          : err.message || "Ocurrió un error inesperado al iniciar sesión.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen-container">
      <main className="login-card" role="main">
        <header className="login-header">
          <div className="login-brand" aria-label="ClassDrawSW">
            <svg
              className="login-brand-icon"
              viewBox="0 0 36 36"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect
                x="3"
                y="3"
                width="30"
                height="30"
                rx="6"
                stroke="currentColor"
                strokeWidth="2.5"
                fill="none"
              />
              <line
                x1="3"
                y1="12"
                x2="33"
                y2="12"
                stroke="currentColor"
                strokeWidth="2"
              />
              <line
                x1="8"
                y1="19"
                x2="19"
                y2="19"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <line
                x1="8"
                y1="25"
                x2="25"
                y2="25"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
            <h1 className="login-title">
              ClassDraw<span className="login-brand-badge">SW</span>
            </h1>
          </div>
          <p className="login-subtitle">
            Diseña diagramas de clases de forma colaborativa, con ayuda de IA.
          </p>
        </header>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="username-input" className="form-label">
              Nombre de usuario
            </label>
            <input
              id="username-input"
              type="text"
              className="login-input"
              placeholder="Ej. Ana Gómez (opcional)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoFocus
              autoComplete="nickname"
              aria-describedby="username-helper"
            />
            <p id="username-helper" className="helper-text">
              Si lo dejas vacío, se te asignará un nombre de invitado.
            </p>
          </div>

          <div
            className="error-container"
            aria-live="polite"
            aria-atomic="true"
          >
            {errorMessage && (
              <div className="error-alert" role="alert">
                <svg
                  className="error-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="submit-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" aria-hidden="true" />
                <span>Entrando...</span>
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
                  aria-hidden="true"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
};
