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

/**
 * Error lanzado cuando la sesión no existe en el backend (respuesta 404).
 * Distinto de errores de red o 5xx, que indican indisponibilidad temporal.
 */
export class SessionExpiredError extends Error {
  constructor() {
    super("La sesión ha expirado. Por favor, inicia sesión nuevamente.");
    this.name = "SessionExpiredError";
  }
}

/** Borra las claves de sesión del localStorage y emite el evento "session-invalid". */
const invalidateSession = (): void => {
  try {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    localStorage.removeItem(ACTIVE_USERNAME_KEY);
    localStorage.removeItem(ACTIVE_DIAGRAM_KEY);
  } catch {
    // ignore storage errors
  }
  window.dispatchEvent(new CustomEvent("session-invalid"));
};

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

export type DiagramSummary = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  elementCount: number;
};

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
 * Verifica que la sesión almacenada en localStorage existe en el backend.
 * - Sin active_session_id, o respuesta 404: invalida la sesión y lanza SessionExpiredError.
 * - Fallo de red o respuesta 5xx: lanza error normal sin borrar nada (backend no disponible).
 */
export const getOrCreateSessionId = async (): Promise<string> => {
  let sessionId: string | null = null;
  try {
    sessionId = localStorage.getItem(ACTIVE_SESSION_KEY);
  } catch {}

  if (!sessionId) {
    invalidateSession();
    throw new SessionExpiredError();
  }

  try {
    const res = await fetch(`${BACKEND_URL}/session/${sessionId}`);
    if (res.ok) {
      return sessionId;
    }
    if (res.status === 404) {
      invalidateSession();
      throw new SessionExpiredError();
    }
    // 5xx u otro error: backend no disponible, no es sesión inválida
    throw new Error(`[backendSync] Error al verificar sesión (${res.status})`);
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      throw err;
    }
    // Error de red (fetch rechazado): no borrar nada, propagar como error normal
    throw err;
  }
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
      } else if (res.status === 404) {
        // La sesión ya no existe en el backend según POST /diagrams
        invalidateSession();
      } else {
        console.error(
          `[backendSync] Fallo al crear diagrama con POST /diagrams (${res.status})`,
        );
      }
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        // Sesión inválida ya notificada con el evento; sin ruido en consola.
        return;
      }
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

/**
 * Reinicia el estado interno de sincronización y cancela cualquier temporizador pendiente.
 */
export const resetBackendSyncState = (): void => {
  debouncedSaveDiagramToBackend.cancel();
  pendingUpdate = null;
  isCreatingDiagram = false;
};

/**
 * Crea un nuevo diagrama vacío en el backend para la sesión activa.
 * No activa el ID del diagrama.
 */
export const createEmptyDiagram = async (
  name: string,
): Promise<{ id: string; name: string }> => {
  const sessionId = await getOrCreateSessionId();

  const res = await fetch(`${BACKEND_URL}/diagrams`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      name: name.trim() || "Mi Diagrama",
      data: {
        elements: [],
        appState: {},
        files: {},
      },
    }),
  });

  if (res.status === 404) {
    invalidateSession();
    throw new SessionExpiredError();
  }

  if (!res.ok) {
    let errorDetail = "";
    try {
      const errorJson = await res.json();
      errorDetail = errorJson.error || errorJson.message || "";
    } catch {}
    throw new Error(
      `Error al crear el diagrama (${res.status}): ${
        errorDetail || "fallo en el servidor"
      }`,
    );
  }

  const created: BackendDiagram = await res.json();
  return { id: created.id, name: created.name };
};

/**
 * Obtiene la lista de resúmenes de diagramas del usuario actual.
 */
export const fetchUserDiagrams = async (): Promise<DiagramSummary[]> => {
  const sessionId = await getOrCreateSessionId();

  const res = await fetch(
    `${BACKEND_URL}/diagrams?session_id=${encodeURIComponent(sessionId)}`,
  );

  if (res.status === 404) {
    invalidateSession();
    throw new SessionExpiredError();
  }

  if (!res.ok) {
    let errorDetail = "";
    try {
      const errorJson = await res.json();
      errorDetail = errorJson.error || errorJson.message || "";
    } catch {}
    throw new Error(
      `Error al consultar diagramas (${res.status}): ${
        errorDetail || "fallo en el servidor"
      }`,
    );
  }

  const diagrams: BackendDiagram[] = await res.json();
  return diagrams.map((diagram) => {
    const rawElements = Array.isArray(diagram.data?.elements)
      ? diagram.data.elements
      : [];
    const elementCount = rawElements.filter(
      (el) => el && el.isDeleted !== true,
    ).length;

    return {
      id: diagram.id,
      name: diagram.name,
      created_at: diagram.created_at,
      updated_at: diagram.updated_at,
      elementCount,
    };
  });
};

