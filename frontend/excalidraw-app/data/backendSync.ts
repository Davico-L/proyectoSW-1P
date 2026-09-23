import { debounce } from "@excalidraw/common";
import { getNonDeletedElements } from "@excalidraw/element";
import { clearAppStateForLocalStorage } from "@excalidraw/excalidraw/appState";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

export const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string) || "http://localhost:4000";

export const ACTIVE_DIAGRAM_KEY = "active_diagram_id";
export const ACTIVE_SESSION_KEY = "active_session_id";
export const ACTIVE_USERNAME_KEY = "active_session_username";

export interface BackendDiagram {
  id: string;
  session_id: string;
  name: string;
  data: {
    elements?: readonly ExcalidrawElement[];
    appState?: Partial<AppState>;
    files?: BinaryFiles;
  };
  created_at: string;
  updated_at: string;
}

/**
 * Obtiene el ID del diagrama activo actual.
 * Prioriza el parámetro en la URL (?diagramId=...) y luego el almacenamiento local.
 */
export const getActiveDiagramId = (): string | null => {
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const urlId = searchParams.get("diagramId");
    if (urlId) {
      return urlId;
    }
    return localStorage.getItem(ACTIVE_DIAGRAM_KEY);
  } catch {
    return null;
  }
};

/**
 * Guarda o limpia el ID del diagrama activo tanto en almacenamiento local como en la URL.
 */
export const setActiveDiagramId = (id: string | null): void => {
  try {
    const url = new URL(window.location.href);
    if (id) {
      localStorage.setItem(ACTIVE_DIAGRAM_KEY, id);
      url.searchParams.set("diagramId", id);
      url.searchParams.delete("id");
      window.history.replaceState({}, "", url.toString());
    } else {
      localStorage.removeItem(ACTIVE_DIAGRAM_KEY);
      url.searchParams.delete("diagramId");
      url.searchParams.delete("id");
      window.history.replaceState({}, "", url.toString());
    }
    window.dispatchEvent(new CustomEvent("activeDiagramIdChanged", { detail: id }));
  } catch (err) {
    console.error(
      "[backendSync] Error actualizando el ID activo del diagrama:",
      err,
    );
  }
};

/**
 * Garantiza la existencia de una sesión en el backend para asociar diagramas.
 */
export const getOrCreateSessionId = async (): Promise<string> => {
  let sessionId: string | null = null;
  try {
    sessionId = localStorage.getItem(ACTIVE_SESSION_KEY);
  } catch {}

  if (sessionId) {
    try {
      const res = await fetch(`${BACKEND_URL}/session/${sessionId}`);
      if (res.ok) {
        return sessionId;
      }
    } catch {
      // Si el backend no responde momentáneamente, continuamos usando el id en caché
      return sessionId;
    }
  }

  // Crear una nueva sesión ligera en el backend
  const res = await fetch(`${BACKEND_URL}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "usuario_web" }),
  });

  if (!res.ok) {
    throw new Error(`Error al crear sesión en backend (Status: ${res.status})`);
  }

  const data = await res.json();
  sessionId = data.sessionId;
  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, sessionId!);
  } catch {}
  return sessionId!;
};

/**
 * Carga un diagrama desde el backend vía GET /diagrams/:id
 */
export const loadDiagramFromBackend = async (
  diagramId: string,
): Promise<BackendDiagram | null> => {
  try {
    const res = await fetch(`${BACKEND_URL}/diagrams/${diagramId}`);
    if (!res.ok) {
      if (res.status === 404) {
        console.warn(
          `[backendSync] Diagrama '${diagramId}' no encontrado en el servidor.`,
        );
      }
      return null;
    }
    const diagram: BackendDiagram = await res.json();
    return diagram;
  } catch (error) {
    console.error(
      "[backendSync] Fallo al cargar diagrama desde el backend:",
      error,
    );
    return null;
  }
};

let isCreatingDiagram = false;
let pendingUpdate: {
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
} | null = null;

/**
 * Guarda o actualiza el diagrama en el backend.
 * Si existe activeDiagramId -> PUT /diagrams/:id
 * Si no existe activeDiagramId -> POST /diagrams (al primer cambio)
 */
export const saveDiagramToBackend = async (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
): Promise<void> => {
  const nonDeletedElements = getNonDeletedElements(elements);
  const cleanState = clearAppStateForLocalStorage(appState);
  const activeId = getActiveDiagramId();

  if (isCreatingDiagram) {
    pendingUpdate = { elements, appState, files };
    return;
  }

  if (activeId) {
    // Diagrama ya existente: PUT /diagrams/:id
    try {
      const res = await fetch(`${BACKEND_URL}/diagrams/${activeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            elements: nonDeletedElements,
            appState: cleanState,
            files: files || {},
          },
        }),
      });

      if (res.status === 404) {
        setActiveDiagramId(null);
        await saveDiagramToBackend(elements, appState, files);
      } else if (!res.ok) {
        console.error(
          `[backendSync] Error actualizando diagrama ${activeId} (${res.status})`,
        );
      }
    } catch (err) {
      console.error(
        "[backendSync] Error de red al enviar PUT /diagrams/:id:",
        err,
      );
    }
  } else {
    // No hay diagramId todavía: crear nuevo con POST /diagrams al primer cambio
    if (nonDeletedElements.length === 0) {
      // Lienzo vacío, no inicializamos aún
      return;
    }

    isCreatingDiagram = true;
    try {
      const sessionId = await getOrCreateSessionId();
      const res = await fetch(`${BACKEND_URL}/diagrams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          name: "Mi Diagrama",
          data: {
            elements: nonDeletedElements,
            appState: cleanState,
            files: files || {},
          },
        }),
      });

      if (res.ok) {
        const created: BackendDiagram = await res.json();
        setActiveDiagramId(created.id);
      } else {
        console.error(
          `[backendSync] Fallo al crear diagrama con POST /diagrams (${res.status})`,
        );
      }
    } catch (err) {
      console.error(
        "[backendSync] Error de red al enviar POST /diagrams:",
        err,
      );
    } finally {
      isCreatingDiagram = false;
      if (pendingUpdate && getActiveDiagramId()) {
        const toSave = pendingUpdate;
        pendingUpdate = null;
        await saveDiagramToBackend(
          toSave.elements,
          toSave.appState,
          toSave.files,
        );
      }
    }
  }
};

/**
 * Versión con debounce para no saturar con cada movimiento del puntero / trazo
 */
export const debouncedSaveDiagramToBackend = debounce(
  (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => {
    saveDiagramToBackend(elements, appState, files);
  },
  600, // 600ms debounce
);
