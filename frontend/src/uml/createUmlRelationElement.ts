import { newArrowElement, newElementWith } from "@excalidraw/element";
import type {
  ExcalidrawElement,
  FixedPointBinding,
} from "@excalidraw/element/types";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { pointFrom } from "@excalidraw/math";
import type { RelationType, UmlRelationData } from "./types";

/**
 * Obtiene las puntas de flecha nativas correspondientes al tipo de relación UML.
 * - inheritance → endArrowhead: "triangle_outline"
 * - composition → startArrowhead: "diamond"
 * - aggregation → startArrowhead: "diamond_outline"
 * - association → endArrowhead: "arrow"
 */
function getArrowheads(relationType: RelationType): {
  startArrowhead: "diamond" | "diamond_outline" | null;
  endArrowhead: "triangle_outline" | "arrow" | null;
} {
  switch (relationType) {
    case "inheritance":
      return { startArrowhead: null, endArrowhead: "triangle_outline" };
    case "composition":
      return { startArrowhead: "diamond", endArrowhead: null };
    case "aggregation":
      return { startArrowhead: "diamond_outline", endArrowhead: null };
    case "association":
    default:
      return { startArrowhead: null, endArrowhead: "arrow" };
  }
}

/**
 * Determina el punto de conexión y el fixedPoint en el borde de un elemento rectangular,
 * según el vector de dirección hacia el otro elemento y las dimensiones del rectángulo.
 *
 * Convención fixedPoint de Excalidraw:
 * - Borde derecho:   [1, 0.5]
 * - Borde izquierdo: [0, 0.5]
 * - Borde inferior:  [0.5, 1]
 * - Borde superior:  [0.5, 0]
 */
function getEdgeConnection(
  element: ExcalidrawElement,
  dirX: number,
  dirY: number,
): {
  point: { x: number; y: number };
  fixedPoint: FixedPointBinding["fixedPoint"];
} {
  const halfW = (element.width || 1) / 2;
  const halfH = (element.height || 1) / 2;

  // Comparar la pendiente del vector contra la relación de aspecto del rectángulo
  if (Math.abs(dirX) * halfH >= Math.abs(dirY) * halfW) {
    // Conexión horizontal (derecha o izquierda)
    if (dirX >= 0) {
      return {
        point: { x: element.x + element.width, y: element.y + halfH },
        fixedPoint: [1, 0.5],
      };
    } else {
      return {
        point: { x: element.x, y: element.y + halfH },
        fixedPoint: [0, 0.5],
      };
    }
  } else {
    // Conexión vertical (inferior o superior)
    if (dirY >= 0) {
      return {
        point: { x: element.x + halfW, y: element.y + element.height },
        fixedPoint: [0.5, 1],
      };
    } else {
      return {
        point: { x: element.x + halfW, y: element.y },
        fixedPoint: [0.5, 0],
      };
    }
  }
}

/**
 * Crea un elemento de relación UML (flecha con binding) entre dos clases UML existentes.
 *
 * @param source Elemento rectángulo de la clase origen
 * @param target Elemento rectángulo de la clase destino
 * @param relationType Tipo de relación UML ("association" | "inheritance" | "composition" | "aggregation")
 * @param excalidrawAPI API imperativa de Excalidraw para actualizar la escena
 * @returns El elemento flecha creado
 */
export function createUmlRelationElement(
  source: ExcalidrawElement,
  target: ExcalidrawElement,
  relationType: RelationType,
  excalidrawAPI: ExcalidrawImperativeAPI,
): ExcalidrawElement {
  // 1. Calcular centros y vector de dirección relativo entre source y target
  const sourceCenterX = source.x + source.width / 2;
  const sourceCenterY = source.y + source.height / 2;
  const targetCenterX = target.x + target.width / 2;
  const targetCenterY = target.y + target.height / 2;

  const dx = targetCenterX - sourceCenterX;
  const dy = targetCenterY - sourceCenterY;

  // Calcular puntos exactos en los bordes correspondientes y sus fixedPoints
  const sourceConn = getEdgeConnection(source, dx, dy);
  const targetConn = getEdgeConnection(target, -dx, -dy);

  const startX = sourceConn.point.x;
  const startY = sourceConn.point.y;
  const endX = targetConn.point.x;
  const endY = targetConn.point.y;

  const arrowheads = getArrowheads(relationType);

  const customData: UmlRelationData = {
    type: "umlRelation",
    relationType,
    multiplicitySource: undefined,
    multiplicityTarget: undefined,
  };

  // 2. Crear la flecha base con newArrowElement naciendo directamente en los bordes
  const baseArrow = newArrowElement({
    type: "arrow",
    x: startX,
    y: startY,
    points: [pointFrom(0, 0), pointFrom(endX - startX, endY - startY)],
    strokeColor: "#1e1e1e",
    strokeWidth: 2,
    startArrowhead: arrowheads.startArrowhead,
    endArrowhead: arrowheads.endArrowhead,
    customData,
  });

  // Aplicar startBinding y endBinding orbit hacia los bordes respectivos
  const startBinding: FixedPointBinding = {
    elementId: source.id,
    fixedPoint: sourceConn.fixedPoint,
    mode: "orbit",
  };

  const endBinding: FixedPointBinding = {
    elementId: target.id,
    fixedPoint: targetConn.fixedPoint,
    mode: "orbit",
  };

  const arrow = newElementWith(baseArrow, {
    startBinding,
    endBinding,
  });

  // 3. Actualizar boundElements de source y target registrando la flecha
  const updatedSource = newElementWith(source, {
    boundElements: [
      ...(source.boundElements || []).filter((b) => b.id !== arrow.id),
      { id: arrow.id, type: "arrow" as const },
    ],
  });

  const updatedTarget = newElementWith(target, {
    boundElements: [
      ...(target.boundElements || []).filter((b) => b.id !== arrow.id),
      { id: arrow.id, type: "arrow" as const },
    ],
  });

  // 4. Actualizar la escena con los 3 elementos (reemplazando source y target in-place y agregando la flecha)
  const allElements = excalidrawAPI.getSceneElements();
  const nextElements = allElements.map((el) => {
    if (el.id === updatedSource.id) {
      return updatedSource;
    }
    if (el.id === updatedTarget.id) {
      return updatedTarget;
    }
    return el;
  });

  excalidrawAPI.updateScene({
    elements: [...nextElements, arrow],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });

  return arrow;
}
