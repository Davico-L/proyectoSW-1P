import { getNonDeletedElements } from "@excalidraw/element";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { clearAppStateForLocalStorage } from "@excalidraw/excalidraw/appState";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { parseXmi, ParseXmiStats } from "./parseXmi";
import { computeGridLayout, ClassSize } from "./gridLayout";
import { createUmlClassElement } from "../uml/createUmlClassElement";
import { createUmlRelationElement } from "../uml/createUmlRelationElement";
import { updateUmlRelationElement } from "../uml/updateUmlRelationElement";
import { buildUmlClassLabel, UmlClassData, RelationType } from "../uml/types";

import {
  BACKEND_URL,
  getOrCreateSessionId,
  getActiveDiagramId,
  setActiveDiagramId,
  saveDiagramToBackend,
} from "../../excalidraw-app/data/backendSync";
import { LocalData } from "../../excalidraw-app/data/LocalData";
import { debouncedEmitDiagramUpdate } from "../../excalidraw-app/data/realtimeSync";

export interface ImportXmiOptions {
  diagramName?: string;
}

export interface ImportXmiResult {
  stats: ParseXmiStats;
  diagramId: string;
}

/**
 * Calcula las dimensiones estimadas { width, height } de una clase UML
 * usando la misma fórmula exacta que createUmlClassElement.
 */
export function computeClassDimensions(data: UmlClassData): {
  width: number;
  height: number;
} {
  const labelText = buildUmlClassLabel(data);
  const lines = labelText.split("\n");
  const lineCount = lines.length;
  const maxLineLength = Math.max(...lines.map((l) => l.length), 10);

  const width = Math.max(220, maxLineLength * 9 + 40);
  const height = Math.max(140, lineCount * 22 + 40);

  return { width, height };
}

/**
 * Importa un documento XMI 2.1 al lienzo de Excalidraw, creando un nuevo diagrama en el backend.
 *
 * Pasos:
 * 1. Parsea el XML con parseXmi (si falla, propaga el error sin crear nada).
 * 2. Guarda cualquier cambio pendiente y crea un diagrama NUEVO en el backend con POST /diagrams.
 * 3. Calcula dimensiones y posiciones en cuadrícula sin solapamiento (computeGridLayout).
 * 4. Crea las clases con createUmlClassElement y las agrega a la escena en un solo updateScene.
 * 5. Crea las relaciones con createUmlRelationElement y updateUmlRelationElement (para multiplicidades).
 * 6. Guarda el diagrama con CU4 (saveDiagramToBackend).
 * 7. Retorna estadísticas e ID del nuevo diagrama.
 */
export async function importXmiToCanvas(
  xmlText: string,
  excalidrawAPI: ExcalidrawImperativeAPI,
  options?: ImportXmiOptions
): Promise<ImportXmiResult> {
  // (1) Parsear XMI (deja pasar el error tal cual si falla)
  const { model, stats } = parseXmi(xmlText);

  // (2) Antes de crear B, asegurar el guardado de A si existe y contiene elementos
  const previousDiagramId = getActiveDiagramId();
  const currentElements = excalidrawAPI.getSceneElements();
  const nonDeleted = getNonDeletedElements(currentElements);

  if (previousDiagramId && nonDeleted.length > 0) {
    await saveDiagramToBackend(
      currentElements,
      excalidrawAPI.getAppState(),
      excalidrawAPI.getFiles() || {}
    );
  }

  // Cancelar debounces pendientes de A y pausar autoguardado mientras se construye B en el lienzo
  try {
    debouncedEmitDiagramUpdate.cancel();
    LocalData.cancelSave();
    LocalData.pauseSave("collaboration");
  } catch {
    // Continuar si no están disponibles en el entorno de pruebas
  }

  try {
    // Limpiar el lienzo
    if (typeof excalidrawAPI.resetScene === "function") {
      excalidrawAPI.resetScene();
    } else {
      excalidrawAPI.updateScene({ elements: [] });
    }

    // (3) Calcular dimensiones de cada clase y distribuirlas en la cuadrícula
    const classDataList: { id: string; data: UmlClassData }[] = model.classes.map(
      (cls) => ({
        id: cls.id,
        data: {
          type: "umlClass",
          className: cls.className,
          attributes: cls.attributes,
          methods: cls.methods,
        },
      })
    );

    const sizes: ClassSize[] = classDataList.map(({ id, data }) => {
      const dims = computeClassDimensions(data);
      return { id, width: dims.width, height: dims.height };
    });

    const positions = computeGridLayout(sizes);

    // Crear elementos de clases y mapa UmlClass.id -> contenedor
    const containerMap = new Map<string, ExcalidrawElement>();
    const initialClassElements: ExcalidrawElement[] = [];

    for (const { id, data } of classDataList) {
      const center = positions.get(id) || { x: 200, y: 200 };
      const { container, text } = createUmlClassElement(data, center);
      containerMap.set(id, container);
      initialClassElements.push(container, text);
    }

    // (4) Agregar todas las clases a la escena en una sola actualización
    excalidrawAPI.updateScene({
      elements: initialClassElements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    // (5) Crear y actualizar relaciones
    for (const rel of model.relations) {
      const sourceContainer = containerMap.get(rel.sourceClassId);
      const targetContainer = containerMap.get(rel.targetClassId);

      // Si algún id no está en el mapa, omitir con seguridad
      if (!sourceContainer || !targetContainer) {
        continue;
      }

      const relationType = rel.relationType as RelationType;

      // Crear la relación (agrega la flecha a la escena y vincula los contenedores)
      const arrow = createUmlRelationElement(
        sourceContainer,
        targetContainer,
        relationType,
        excalidrawAPI
      );

      // Si tiene multiplicidades y no es herencia, aplicar etiquetas de multiplicidad
      if (
        relationType !== "inheritance" &&
        (rel.multiplicitySource || rel.multiplicityTarget)
      ) {
        const multSrc = rel.multiplicitySource || "1";
        const multDst = rel.multiplicityTarget || "1";

        updateUmlRelationElement(
          arrow,
          null, // existingLabelText = null para nueva relación
          multSrc,
          multDst,
          excalidrawAPI
        );
      }

      // Refrescar contenedores en containerMap con los elementos actualizados de la escena
      const currentScene = excalidrawAPI.getSceneElements();
      const updatedSource = currentScene.find((el) => el.id === sourceContainer.id);
      const updatedTarget = currentScene.find((el) => el.id === targetContainer.id);
      if (updatedSource) containerMap.set(rel.sourceClassId, updatedSource);
      if (updatedTarget) containerMap.set(rel.targetClassId, updatedTarget);
    }

    // Ajustar la vista al contenido importado si la API lo soporta
    const apiAny = excalidrawAPI as any;
    if (typeof apiAny.scrollToContent === "function") {
      try {
        apiAny.scrollToContent(excalidrawAPI.getSceneElements(), {
          fitToViewport: true,
        });
      } catch {
        // Ignorar si falla opcionalmente
      }
    }

    // Cancelar cualquier emisión o guardado derivado de dibujar B antes de persistir y activar
    try {
      debouncedEmitDiagramUpdate.cancel();
      LocalData.cancelSave();
    } catch {}

    // (6) Crear el nuevo diagrama B en el servidor vía POST con los elementos ya generados
    const sessionId = await getOrCreateSessionId();
    const diagramName = options?.diagramName?.trim() || "Diagrama Importado";
    const finalElements = excalidrawAPI.getSceneElements();
    const nonDeletedFinalElements = getNonDeletedElements(finalElements);

    const createRes = await fetch(`${BACKEND_URL}/diagrams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        name: diagramName,
        data: {
          elements: nonDeletedFinalElements,
          appState: clearAppStateForLocalStorage(excalidrawAPI.getAppState()),
          files: excalidrawAPI.getFiles() || {},
        },
      }),
    });

    if (!createRes.ok) {
      throw new Error(
        `Error al crear el nuevo diagrama en el servidor (status: ${createRes.status})`
      );
    }

    const createdDiagram = await createRes.json();
    const newDiagramId = createdDiagram.id;

    // (7) Activar B: cuando CU3 se una a la room y solicite diagram-state, PostgreSQL ya contendrá los elementos reales
    setActiveDiagramId(newDiagramId);

    // Sincronizar estado completo en backend
    await saveDiagramToBackend(
      excalidrawAPI.getSceneElements(),
      excalidrawAPI.getAppState(),
      excalidrawAPI.getFiles() || {}
    );

    // (8) Devolver estadísticas e ID del nuevo diagrama
    return {
      stats,
      diagramId: newDiagramId,
    };
  } finally {
    try {
      LocalData.resumeSave("collaboration");
    } catch {}
  }
}

// Helper temporal de desarrollo en window para invocar manualmente desde la consola del navegador
if (typeof window !== "undefined" && import.meta.env.DEV) {
  (window as any).__importXmiToCanvas = importXmiToCanvas;
}
