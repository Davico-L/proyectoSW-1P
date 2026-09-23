import { getFontString } from "@excalidraw/common";
import {
  newElementWith,
  newTextElement,
  computeBoundTextPosition,
  measureText,
  DEFAULT_BOUND_TEXT_LABEL_POSITION,
} from "@excalidraw/element";
import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  ExcalidrawTextElementWithContainer,
} from "@excalidraw/element/types";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { Multiplicity, UmlRelationData } from "./types";

/**
 * Actualiza una relación UML (flecha) y su texto vinculado con las multiplicidades especificadas.
 *
 * - Arma el texto en formato `${multiplicitySource} — ${multiplicityTarget}`.
 * - Si no existe texto previo (`existingLabelText === null`), crea el elemento de texto vinculado
 *   con `newTextElement` (labelPosition: 0.5), registra el binding en la flecha y calcula su posición.
 * - Si ya existe texto, sigue la secuencia:
 *   measureText → newElementWith (dimensiones y texto) → computeBoundTextPosition → newElementWith (coordenadas).
 * - Actualiza el customData de la flecha preservando relationType.
 * - Actualiza la escena con `CaptureUpdateAction.IMMEDIATELY`.
 */
export function updateUmlRelationElement(
  arrow: ExcalidrawElement,
  existingLabelText: ExcalidrawElement | null,
  multiplicitySource: string,
  multiplicityTarget: string,
  excalidrawAPI: ExcalidrawImperativeAPI,
): void {
  const newText = `${multiplicitySource} — ${multiplicityTarget}`;
  const allElements = excalidrawAPI.getSceneElements();

  const updatedCustomData: UmlRelationData = {
    ...(arrow.customData as UmlRelationData),
    type: "umlRelation",
    multiplicitySource: multiplicitySource as Multiplicity,
    multiplicityTarget: multiplicityTarget as Multiplicity,
  };

  if (!existingLabelText) {
    // 1. Caso: Crear el texto vinculado desde cero
    const baseText = newTextElement({
      text: newText,
      x: arrow.x,
      y: arrow.y,
      containerId: arrow.id,
      textAlign: "center",
      verticalAlign: "middle",
      autoResize: true,
      labelPosition: DEFAULT_BOUND_TEXT_LABEL_POSITION,
      fontSize: 16,
      fontFamily: 1,
      strokeColor: "#1e1e1e",
    });

    const elementsMap = new Map<string, ExcalidrawElement>([
      [arrow.id, arrow],
      [baseText.id, baseText],
    ]);

    const coords = computeBoundTextPosition(
      arrow,
      baseText as ExcalidrawTextElementWithContainer,
      elementsMap,
    );

    const newTextEl = newElementWith(baseText, {
      x: coords.x,
      y: coords.y,
    });

    const existingBoundElements = (arrow.boundElements || []).filter(
      (b) => b.type !== "text",
    );

    const updatedArrow = newElementWith(arrow, {
      boundElements: [
        ...existingBoundElements,
        { id: newTextEl.id, type: "text" as const },
      ],
      customData: updatedCustomData,
    });

    // Sustituir la flecha y agregar el nuevo texto en la escena
    const arrowIndex = allElements.findIndex((el) => el.id === arrow.id);
    const nextElements: ExcalidrawElement[] = [...allElements];
    if (arrowIndex !== -1) {
      nextElements[arrowIndex] = updatedArrow;
      nextElements.splice(arrowIndex + 1, 0, newTextEl);
    } else {
      nextElements.push(updatedArrow, newTextEl);
    }

    excalidrawAPI.updateScene({
      elements: nextElements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  } else {
    // 2. Caso: Actualizar el texto existente
    const textEl = existingLabelText as ExcalidrawTextElement;

    // Medir dimensiones del nuevo texto antes de actualizar
    const metrics = measureText(
      newText,
      getFontString(textEl),
      textEl.lineHeight,
    );

    const updatedText = newElementWith(textEl, {
      text: newText,
      originalText: newText,
      width: metrics.width,
      height: metrics.height,
    });

    const updatedArrow = newElementWith(arrow, {
      customData: updatedCustomData,
    });

    const elementsMap = new Map<string, ExcalidrawElement>([
      [updatedArrow.id, updatedArrow],
      [updatedText.id, updatedText],
    ]);

    const coords = computeBoundTextPosition(
      updatedArrow,
      updatedText as ExcalidrawTextElementWithContainer,
      elementsMap,
    );

    const finalUpdatedText = newElementWith(updatedText, {
      x: coords.x,
      y: coords.y,
    });

    // Sustituir ambos elementos en la escena por id sin duplicar
    const nextElements: ExcalidrawElement[] = allElements.map((el) => {
      if (el.id === updatedArrow.id) {
        return updatedArrow;
      }
      if (el.id === finalUpdatedText.id) {
        return finalUpdatedText;
      }
      return el;
    });

    excalidrawAPI.updateScene({
      elements: nextElements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }
}
