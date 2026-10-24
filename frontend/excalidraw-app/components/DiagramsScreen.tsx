import React, { useState, useEffect, useCallback } from "react";
import {
  createEmptyDiagram,
  fetchUserDiagrams,
  DiagramSummary,
  SessionExpiredError,
} from "../data/backendSync";
import "./DiagramsScreen.scss";

export interface DiagramsScreenProps {
  username: string;
  onOpenDiagram: (diagramId: string) => void;
  onLogout: () => void;
}

export const DiagramsScreen: React.FC<DiagramsScreenProps> = ({
  username,
  onOpenDiagram,
  onLogout,
}) => {
  // Estado para creación de nuevo diagrama
  const [newDiagramName, setNewDiagramName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Estado para listado de diagramas
  const [diagrams, setDiagrams] = useState<DiagramSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const loadDiagrams = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const data = await fetchUserDiagrams();
      setDiagrams(data);
    } catch (err: any) {
      if (err instanceof SessionExpiredError) {
        return;
      }
      setListError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al cargar tus diagramas.",
      );
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadDiagrams();
  }, [loadDiagrams]);

  const handleCreateDiagram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) {
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const created = await createEmptyDiagram(newDiagramName);
      onOpenDiagram(created.id);
    } catch (err: any) {
      if (err instanceof SessionExpiredError) {
        return;
      }
      setCreateError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al crear el diagrama.",
      );
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime())
        ? dateStr
        : date.toLocaleString("es-BO");
    } catch {
      return dateStr;
    }
  };

  const formatElementCount = (count: number) => {
    return count === 1 ? "1 elemento" : `${count} elementos`;
  };

  return (
    <div className="diagrams-screen-container">
      <main className="diagrams-card" role="main">
        {/* Encabezado */}
        <header className="diagrams-header">
          <div className="diagrams-user-meta">
            <div className="diagrams-brand" aria-label="ClassDrawSW">
              <svg
                className="diagrams-brand-icon"
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
              </svg>
              <h1 className="diagrams-greeting">Hola, {username}</h1>
            </div>
            <p className="diagrams-subtitle">
              Gestiona tus diagramas de clases UML o crea uno nuevo
            </p>
          </div>
          <button
            type="button"
            className="diagrams-logout-btn"
            onClick={onLogout}
            title="Cerrar sesión"
          >
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
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Cerrar sesión</span>
          </button>
        </header>

        {/* Sección: Crear diagrama */}
        <section className="diagrams-section create-section">
          <h2 className="section-title">Crear diagrama</h2>
          <form className="create-diagram-form" onSubmit={handleCreateDiagram}>
            <div className="form-row">
              <input
                type="text"
                className="diagrams-input"
                placeholder="Nombre del diagrama (opcional)"
                value={newDiagramName}
                onChange={(e) => setNewDiagramName(e.target.value)}
                disabled={creating}
              />
              <button
                type="submit"
                className="create-btn"
                disabled={creating}
              >
                {creating ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    <span>Creando...</span>
                  </>
                ) : (
                  <span>Crear diagrama</span>
                )}
              </button>
            </div>
            {createError && (
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
                <span>{createError}</span>
              </div>
            )}
          </form>
        </section>

        {/* Sección: Mis diagramas */}
        <section className="diagrams-section list-section">
          <h2 className="section-title">Mis diagramas</h2>

          {loadingList ? (
            <div className="loading-state">
              <span className="spinner" aria-hidden="true" />
              <span>Cargando...</span>
            </div>
          ) : listError ? (
            <div className="error-state">
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
                <span>{listError}</span>
              </div>
              <button
                type="button"
                className="retry-btn"
                onClick={loadDiagrams}
              >
                Reintentar
              </button>
            </div>
          ) : diagrams.length === 0 ? (
            <div className="empty-state">
              <p>Aún no tienes diagramas. Crea el primero.</p>
            </div>
          ) : (
            <ul className="diagrams-list" role="list">
              {diagrams.map((diag) => (
                <li key={diag.id} className="diagram-item">
                  <div className="diagram-item-info">
                    <span className="diagram-name" title={diag.name}>
                      {diag.name || "Mi Diagrama"}
                    </span>
                    <div className="diagram-item-meta">
                      <span>
                        Última modificación: {formatDate(diag.updated_at)}
                      </span>
                      <span className="meta-separator">•</span>
                      <span>{formatElementCount(diag.elementCount)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="open-btn"
                    onClick={() => onOpenDiagram(diag.id)}
                  >
                    Abrir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
};
