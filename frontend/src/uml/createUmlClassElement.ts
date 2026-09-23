import {
  newElement,
  newTextElement,
  computeBoundTextPosition,
} from "@excalidraw/element";
import type {
  ExcalidrawElement,
  ExcalidrawTextElementWithContainer,
} from "@excalidraw/element/types";
import { buildUmlClassLabel } from "./types";
import type { UmlClassData } from "./types";

/**
 * Crea un elemento contenedor (rectángulo) con datos UML y su texto vinculado.
 * Sigue el patrón bidireccional de Excalidraw: boundElements + containerId + computeBoundTextPosition.
 *
 * @param data Datos estructurados de la clase UML
 * @param center Posición central en coordenadas de escena { x, y }
 * @returns { container, text } Los dos elementos listos para ser agregados a la escena
 */
export function createUmlClassElement(
  data: UmlClassData,
  center: { x: number; y: number },
): { container: ExcalidrawElement; text: ExcalidrawElement } {
  const labelText = buildUmlClassLabel(data);

  // Calcular dimensiones basadas en la cantidad y longitud de líneas
  const lines = labelText.split("\n");
  const lineCount = lines.length;
  const maxLineLength = Math.max(...lines.map((l) => l.length), 10);

  const width = Math.max(220, maxLineLength * 9 + 40);
  const height = Math.max(140, lineCount * 22 + 40);

  const x = center.x - width / 2;
  const y = center.y - height / 2;

  // 1. Crear el rectángulo contenedor
  const baseContainer = newElement({
    type: "rectangle",
    x,
    y,
    width,
    height,
    strokeColor: "#1e1e1e",
    backgroundColor: "#ffffff",
    fillStyle: "solid",
    strokeWidth: 2,
    roughness: 1,
    roundness: { type: 3 },
    customData: data,
  });

  // 2. Crear el texto vinculado
  const baseText = newTextElement({
    text: labelText,
    x: baseContainer.x,
    y: baseContainer.y,
    containerId: baseContainer.id,
    textAlign: "center",
    verticalAlign: "middle",
    autoResize: true,
    fontSize: 16,
    fontFamily: 1,
  });

  // 3. Calcular la posición inicial del texto
  const elementsMap = new Map<string, ExcalidrawElement>([
    [baseContainer.id, baseContainer],
    [baseText.id, baseText],
  ]);

  const coords = computeBoundTextPosition(
    baseContainer,
    baseText as ExcalidrawTextElementWithContainer,
    elementsMap,
  );

  // 4. Crear las versiones finales sin modificar propiedades readonly
  const text = {
    ...baseText,
    x: coords.x,
    y: coords.y,
  };

  const container = {
    ...baseContainer,
    boundElements: [{ type: "text" as const, id: text.id }],
  };

  return { container, text };
}