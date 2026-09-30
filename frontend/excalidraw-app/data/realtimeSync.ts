import { io } from "socket.io-client";
import { debounce } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { Socket } from "socket.io-client";

import { getActiveDiagramId } from "./backendSync";

const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string) || "http://localhost:4000";

export interface DiagramElementsPayload {
  elements: readonly ExcalidrawElement[];
}

/**
 * Instancia de socket.io-client conectada a la misma URL del backend
 */
export const socket: Socket = io(BACKEND_URL, {
  transports: ["websocket", "polling"],
  autoConnect: true,
});

let currentRoomId: string | null = null;

/**
 * Emite 'join-diagram' para unirse a la sala del diagrama indicado
 */
export const joinDiagramRoom = (diagramId: string): void => {
  if (!diagramId) {
    return;
  }
  if (currentRoomId === diagramId) {
    return;
  }
  if (currentRoomId) {
    socket.emit("leave-diagram", { diagramId: currentRoomId });
  }
  socket.emit("join-diagram", { diagramId });
  currentRoomId = diagramId;
};

/**
 * Abandona la sala activa actual si existe y resetea currentRoomId a null
 */
export const leaveDiagramRoom = (): void => {
  if (currentRoomId) {
    socket.emit("leave-diagram", { diagramId: currentRoomId });
    currentRoomId = null;
  }
};

/**
 * Re-unión automática a la sala tras conexión o reconexión de Socket.IO
 */
socket.on("connect", () => {
  const diagramId = getActiveDiagramId();
  if (diagramId) {
    joinDiagramRoom(diagramId);
  }
});

/**
 * Emite 'diagram-update' con únicamente los elementos del lienzo
 */
export const emitDiagramUpdate = (
  diagramId: string,
  payload: { elements: readonly ExcalidrawElement[] },
): void => {
  if (!diagramId) {
    return;
  }
  socket.emit("diagram-update", { diagramId, elements: payload.elements });
};

/**
 * Suscribe a eventos 'diagram-update' enviados por otros clientes de la sala.
 * Entrega exclusivamente elements al callback.
 * Retorna función para desuscribirse.
 */
export const onRemoteUpdate = (
  callback: (elements: readonly ExcalidrawElement[]) => void,
): (() => void) => {
  const handler = (payload: any) => {
    const elements =
      payload?.elements || (Array.isArray(payload) ? payload : []);
    callback(elements);
  };
  socket.on("diagram-update", handler);
  return () => {
    socket.off("diagram-update", handler);
  };
};

/**
 * Suscribe al evento 'diagram-state' emitido por el backend al unirse a la sala.
 * Entrega exclusivamente elements al callback.
 * Retorna función para desuscribirse.
 */
export const onDiagramState = (
  callback: (elements: readonly ExcalidrawElement[]) => void,
): (() => void) => {
  const handler = (payload: any) => {
    const elements =
      payload?.elements ||
      payload?.data?.elements ||
      (Array.isArray(payload) ? payload : []);
    callback(elements);
  };
  socket.on("diagram-state", handler);
  return () => {
    socket.off("diagram-state", handler);
  };
};

/**
 * Emite 'diagram-update' con debounce de 300 ms
 */
export const debouncedEmitDiagramUpdate = debounce(
  (diagramId: string, elements: readonly ExcalidrawElement[]) => {
    emitDiagramUpdate(diagramId, { elements });
  },
  300,
);

