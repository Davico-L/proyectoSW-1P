import {
  newElementWith,
  measureText,
  computeBoundTextPosition,
} from "@excalidraw/element";
import { getFontString } from "@excalidraw/common";
import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  ExcalidrawTextElementWithContainer,
} from "@excalidraw/element/types";
import { buildUmlClassLabel } from "./types";
import type { UmlClassData } from "./types";

/**
 * Normaliza las clases UML cargadas desde datos guardados o remotos:
 * 1. Garantiza esquinas cuadradas (roundness: null).
 * 2. Si el texto vinculado contiene caracteres antiguos "─", regenera el texto con
 *    buildUmlClassLabel(element.customData) (insertando renglones vacíos para el renderizado
 *    de borde a borde) y fuerza la actualización de versión del contenedor para invalidar
 *    su caché de dibujo.
 *
 * Mantiene la misma referencia para todos los elementos que no requieren cambios.
 */
export function normalizeUmlClassCorners<T extends ExcalidrawElement>(
  elements: readonly T[],
): T[] {
  if (!elements || elements.length === 0) {
    return (elements as T[]) || [];
  }

  const updatedElementsMap = new Map<string, T>();
  let hasChanges = false;

  const elementsById = new Map<string, T>();
  for (const el of elements) {
    elementsById.set(el.id, el);
  }

  for (const el of elements) {
    if (el.customData?.type === "umlClass") {
      let containerNeedsUpdate = el.roundness !== null;

      // Buscar texto vinculado
      const boundTextBinding = el.boundElements?.find((b) => b.type === "text");
      if (boundTextBinding) {
        const boundText = elementsById.get(boundTextBinding.id) as
          | ExcalidrawTextElement
          | undefined;

        if (
          boundText &&
          boundText.type === "text" &&
          boundText.text.includes("─")
        ) {
          const newLabel = buildUmlClassLabel(el.customData as UmlClassData);
          const fontString = getFontString({
            fontSize: boundText.fontSize,
            fontFamily: boundText.fontFamily,
          });
          const metrics = measureText(
            newLabel,
            fontString,
            boundText.lineHeight,
          );

          // Contenedor actualizado con force=true para garantizar nuevo version y versionNonce
          const targetContainer =
            updatedElementsMap.get(el.id) ||
            (newElementWith(
              el,
              { roundness: null } as any,
              true,
            ) as unknown as T);

          const updatedText = newElementWith(boundText, {
            text: newLabel,
            originalText: newLabel,
            width: metrics.width,
            height: metrics.height,
          });

          const elementsMap = new Map<string, ExcalidrawElement>([
            [targetContainer.id, targetContainer],
            [updatedText.id, updatedText],
          ]);

          const coords = computeBoundTextPosition(
            targetContainer,
            updatedText as ExcalidrawTextElementWithContainer,
            elementsMap,
          );

          const finalUpdatedText = newElementWith(updatedText, {
            x: coords.x,
            y: coords.y,
          }) as unknown as T;

          updatedElementsMap.set(boundText.id, finalUpdatedText);
          updatedElementsMap.set(el.id, targetContainer);
          containerNeedsUpdate = false;
          hasChanges = true;
        }
      }

      if (containerNeedsUpdate) {
        const updatedContainer = newElementWith(
          el,
          { roundness: null } as any,
          true,
        ) as unknown as T;
        updatedElementsMap.set(el.id, updatedContainer);
        hasChanges = true;
      }
    }
  }

  if (!hasChanges) {
    return elements as T[];
  }

  return elements.map((el) => updatedElementsMap.get(el.id) || el);
}
