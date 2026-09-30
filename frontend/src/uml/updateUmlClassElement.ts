import { getFontString, FONT_FAMILY } from "@excalidraw/common";
import {
  newElementWith,
  computeBoundTextPosition,
  measureText,
} from "@excalidraw/element";
import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  ExcalidrawTextElementWithContainer,
} from "@excalidraw/element/types";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { buildUmlClassLabel } from "./types";
import type { UmlClassData } from "./types";

/**
 * Actualiza un elemento de clase UML existente y su texto vinculado en la escena.
 *
 * - Regenera el texto con buildUmlClassLabel(newData).
 * - Redimensiona el contenedor si el nuevo texto requiere más espacio.
 * - Actualiza customData en el contenedor con newData (plano, sin anidar).
 * - Recalcula la posición centrada del texto con computeBoundTextPosition.
 * - Sustituye ambos elementos en la escena por id sin duplicar ni perder su posición.
 * - Llama a excalidrawAPI.updateScene con CaptureUpdateAction.IMMEDIATELY.
 */
export function updateUmlClassElement(
  container: ExcalidrawElement,
  textElement: ExcalidrawElement | null | undefined,
  newData: UmlClassData,
  excalidrawAPI: ExcalidrawImperativeAPI,
): void {
  const labelText = buildUmlClassLabel(newData);
  const lines = labelText.split("\n");
  const lineCount = lines.length;
  const maxLineLength = Math.max(...lines.map((l) => l.length), 10);

  // Redimensionar el contenedor si el texto nuevo no entra
  const minWidth = maxLineLength * 9 + 40;
  const minHeight = lineCount * 22 + 40;
  const nextWidth = Math.max(container.width, minWidth);
  const nextHeight = Math.max(container.height, minHeight);

  // 1. Actualizar contenedor con nuevas dimensiones y nuevo customData
  const updatedContainer = newElementWith(container, {
    width: nextWidth,
    height: nextHeight,
    customData: newData,
  });

  const allElements = excalidrawAPI.getSceneElements();

  // Si no se pasó textElement explícito, buscarlo por boundElements del contenedor
  let targetTextElement = textElement;
  if (!targetTextElement && container.boundElements) {
    const boundTextBinding = container.boundElements.find(
      (b) => b.type === "text",
    );
    if (boundTextBinding) {
      targetTextElement = allElements.find(
        (el) => el.id === boundTextBinding.id,
      );
    }
  }

  if (!targetTextElement) {
    throw new Error(
      `[updateUmlClassElement] Bound text element not found for UML class container "${container.id}".`,
    );
  }

  if (targetTextElement.type !== "text") {
    throw new Error(
      `[updateUmlClassElement] Element with id "${targetTextElement.id}" was expected to be of type "text", but found "${targetTextElement.type}".`,
    );
  }

  const textEl = targetTextElement as ExcalidrawTextElement;
  const targetFontFamily = FONT_FAMILY["Liberation Sans"];
  const fontString = getFontString({
    fontSize: textEl.fontSize,
    fontFamily: targetFontFamily,
  });
  const metrics = measureText(
    labelText,
    fontString,
    textEl.lineHeight,
  );

  // 2. Actualizar texto con el nuevo label, nueva fuente y sus dimensiones recalculadas
  const updatedText = newElementWith(textEl, {
    text: labelText,
    originalText: labelText,
    fontFamily: targetFontFamily,
    width: metrics.width,
    height: metrics.height,
  });

  // 3. Recalcular la posición centrada del texto respecto al contenedor actualizado
  const elementsMap = new Map<string, ExcalidrawElement>([
    [updatedContainer.id, updatedContainer],
    [updatedText.id, updatedText],
  ]);

  const coords = computeBoundTextPosition(
    updatedContainer,
    updatedText as ExcalidrawTextElementWithContainer,
    elementsMap,
  );

  const finalUpdatedText = newElementWith(updatedText, {
    x: coords.x,
    y: coords.y,
  });

  // 4. Sustituir en el array de la escena por id (sin duplicar y preservando z-index)
  const nextElements = allElements.map((el) => {
    if (el.id === updatedContainer.id) {
      return updatedContainer;
    }
    if (finalUpdatedText && el.id === finalUpdatedText.id) {
      return finalUpdatedText;
    }
    return el;
  });

  excalidrawAPI.updateScene({
    elements: nextElements,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
}
