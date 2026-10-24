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
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) {
      return;
    }

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setErrorMessage("El nombre de usuario no puede estar vacío.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (isRegisterMode && password !== confirmPassword) {
      setErrorMessage("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const endpoint = isRegisterMode
      ? `${BACKEND_URL}/auth/register`
      : `${BACKEND_URL}/auth/login`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: trimmedUsername,
          password,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Usuario o contraseña incorrectos");
        }
        if (response.status === 409) {
          throw new Error("Ese usuario ya existe");
        }
        const errorBody = await response.json().catch(() => ({}));
        if (response.status === 400 && errorBody.error) {
          throw new Error(errorBody.error);
        }
        throw new Error(
          errorBody.error ||
            `Error al ${isRegisterMode ? "crear la cuenta" : "iniciar sesión"} (Status: ${response.status})`,
        );
      }

      const data: { session_id?: string; sessionId?: string; username: string } =
        await response.json();
      const resolvedSessionId = (data.session_id || data.sessionId) as string;

      // Guardar en localStorage
      try {
        localStorage.setItem(ACTIVE_SESSION_KEY, resolvedSessionId);
        localStorage.setItem(ACTIVE_USERNAME_KEY, data.username);
      } catch (storageErr) {
        console.warn("No se pudo guardar la sesión en localStorage:", storageErr);
      }

      // Notificar éxito para redirigir al lienzo
      onLoginSuccess(resolvedSessionId, data.username);
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

  const toggleMode = () => {
    setIsRegisterMode((prev) => !prev);
    setErrorMessage(null);
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
              placeholder="Ej. Ana Gómez"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoFocus
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password-input" className="form-label">
              Contraseña
            </label>
            <input
              id="password-input"
              type="password"
              className="login-input"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete={isRegisterMode ? "new-password" : "current-password"}
              aria-describedby={!isRegisterMode ? "password-helper" : undefined}
            />
            {!isRegisterMode && (
              <p id="password-helper" className="helper-text">
                Si tu cuenta es anterior y aún no tiene contraseña, la que escribas quedará registrada
              </p>
            )}
          </div>

          {isRegisterMode && (
            <div className="form-group">
              <label htmlFor="confirm-password-input" className="form-label">
                Repetir contraseña
              </label>
              <input
                id="confirm-password-input"
                type="password"
                className="login-input"
                placeholder="Repite la contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
              />
            </div>
          )}

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
                <span>{isRegisterMode ? "Creando cuenta..." : "Iniciando sesión..."}</span>
              </>
            ) : (
              <>
                <span>{isRegisterMode ? "Crear cuenta" : "Iniciar sesión"}</span>
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

          <div className="login-mode-switch">
            <span>
              {isRegisterMode ? "¿Ya tienes una cuenta?" : "¿No tienes una cuenta?"}
            </span>{" "}
            <button
              type="button"
              className="login-mode-btn"
              onClick={toggleMode}
              disabled={loading}
            >
              {isRegisterMode ? "Iniciar sesión" : "Crear cuenta"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};
