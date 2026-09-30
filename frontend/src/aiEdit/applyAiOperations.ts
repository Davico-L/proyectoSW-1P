import {
  newElementWith,
  fixBindingsAfterDeletion,
  isArrowElement,
} from "@excalidraw/element";
import type {
  ExcalidrawElement,
  ExcalidrawArrowElement,
} from "@excalidraw/element/types";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { createUmlClassElement } from "../uml/createUmlClassElement";
import { updateUmlClassElement } from "../uml/updateUmlClassElement";
import { createUmlRelationElement } from "../uml/createUmlRelationElement";
import { updateUmlRelationElement } from "../uml/updateUmlRelationElement";
import type {
  UmlClassData,
  UmlRelationData,
  RelationType,
  Multiplicity,
} from "../uml/types";

export interface OperationResult {
  action: string;
  description: string;
  status: "applied" | "skipped";
  reason?: string;
  className?: string;
  sourceClassName?: string;
  targetClassName?: string;
}

export interface ApplyAiOperationsResult {
  applied: number;
  results: OperationResult[];
}

/**
 * Busca una flecha de relación UML conectada entre dos clases por sus IDs.
 * Revisa tanto customData como startBinding y endBinding.
 */
function findRelationArrow(
  elements: readonly ExcalidrawElement[],
  sourceClassId: string,
  targetClassId: string,
): ExcalidrawElement | undefined {
  return elements.find((el) => {
    if (el.isDeleted || !isArrowElement(el)) return false;
    if (el.customData?.type !== "umlRelation") return false;

    const arrow = el as ExcalidrawArrowElement;
    const sId = el.customData?.sourceClassId || arrow.startBinding?.elementId;
    const tId = el.customData?.targetClassId || arrow.endBinding?.elementId;

    return (
      (sId === sourceClassId && tId === targetClassId) ||
      (sId === targetClassId && tId === sourceClassId)
    );
  });
}

/**
 * Aplica en el lienzo de Excalidraw una lista de operaciones UML validadas
 * y resueltas por el backend (con IDs ya resueltos).
 *
 * @param validOperations Lista de operaciones con classId / sourceClassId / targetClassId
 * @param excalidrawAPI API imperativa de Excalidraw para interactuar con la escena
 * @returns { applied, results }
 */
export function applyAiOperations(
  validOperations: any[],
  excalidrawAPI: ExcalidrawImperativeAPI,
): ApplyAiOperationsResult {
  const results: OperationResult[] = [];
  let appliedCount = 0;
  let createdClassOffset = 0;

  if (!Array.isArray(validOperations) || validOperations.length === 0) {
    return { applied: 0, results: [] };
  }

  for (const operation of validOperations) {
    if (!operation || typeof operation !== "object" || !operation.action) {
      continue;
    }

    switch (operation.action) {
      case "createClass": {
        const data: UmlClassData = {
          type: "umlClass",
          className: operation.className,
          attributes: operation.attributes ?? [],
          methods: operation.methods ?? [],
        };

        const appState = excalidrawAPI.getAppState();
        const offset = createdClassOffset * 15;
        createdClassOffset += 1;

        const centerX =
          (appState.width / 2 - (appState.offsetLeft || 0)) /
            appState.zoom.value -
          appState.scrollX +
          offset;
        const centerY =
          (appState.height / 2 - (appState.offsetTop || 0)) /
            appState.zoom.value -
          appState.scrollY +
          offset;

        const { container, text } = createUmlClassElement(data, {
          x: centerX,
          y: centerY,
        });

        excalidrawAPI.updateScene({
          elements: [...excalidrawAPI.getSceneElements(), container, text],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        appliedCount += 1;
        results.push({
          action: "createClass",
          className: operation.className,
          description: `Clase ${operation.className} agregada`,
          status: "applied",
        });
        break;
      }

      case "updateClass": {
        const allElements = excalidrawAPI.getSceneElements();
        const container = allElements.find(
          (el) =>
            !el.isDeleted &&
            el.id === operation.classId &&
            el.customData?.type === "umlClass",
        );

        if (!container) {
          results.push({
            action: "updateClass",
            className: operation.className,
            description: `Clase '${operation.className}'`,
            status: "skipped",
            reason: "elemento no encontrado en el lienzo",
          });
          break;
        }

        const boundTextBinding = container.boundElements?.find(
          (b) => b.type === "text",
        );
        const textElement = boundTextBinding
          ? allElements.find(
              (el) => !el.isDeleted && el.id === boundTextBinding.id,
            ) || null
          : null;

        const currentData = container.customData as UmlClassData;
        const newData: UmlClassData = {
          type: "umlClass",
          className:
            operation.newClassName ??
            operation.className ??
            currentData.className,
          attributes:
            operation.attributes !== undefined
              ? operation.attributes
              : currentData.attributes,
          methods:
            operation.methods !== undefined
              ? operation.methods
              : currentData.methods,
        };

        updateUmlClassElement(container, textElement, newData, excalidrawAPI);

        appliedCount += 1;
        results.push({
          action: "updateClass",
          className: newData.className,
          description: `Clase ${newData.className} actualizada`,
          status: "applied",
        });
        break;
      }

      case "deleteClass": {
        const allElements = excalidrawAPI.getSceneElements();
        const targetClass = allElements.find(
          (el) =>
            !el.isDeleted &&
            el.id === operation.classId &&
            el.customData?.type === "umlClass",
        );

        if (!targetClass) {
          results.push({
            action: "deleteClass",
            className: operation.className,
            description: `Clase '${operation.className}'`,
            status: "skipped",
            reason: "elemento no encontrado en el lienzo",
          });
          break;
        }

        const elementsToDeleteIds = new Set<string>();
        elementsToDeleteIds.add(targetClass.id);

        // Texto vinculado de la clase
        if (targetClass.boundElements) {
          for (const bound of targetClass.boundElements) {
            if (bound.type === "text") {
              elementsToDeleteIds.add(bound.id);
            }
            if (bound.type === "arrow") {
              elementsToDeleteIds.add(bound.id);
            }
          }
        }

        // Flechas en la escena conectadas a la clase
        for (const el of allElements) {
          if (!el.isDeleted && isArrowElement(el)) {
            const startId = el.startBinding?.elementId;
            const endId = el.endBinding?.elementId;
            if (startId === targetClass.id || endId === targetClass.id) {
              elementsToDeleteIds.add(el.id);
            }
          }
        }

        // Textos vinculados de las flechas a eliminar
        for (const el of allElements) {
          if (
            !el.isDeleted &&
            elementsToDeleteIds.has(el.id) &&
            el.boundElements
          ) {
            for (const bound of el.boundElements) {
              if (bound.type === "text") {
                elementsToDeleteIds.add(bound.id);
              }
            }
          }
        }

        // Marcar elementos eliminados
        const nextElements = allElements.map((el) => {
          if (elementsToDeleteIds.has(el.id)) {
            return newElementWith(el as ExcalidrawElement, { isDeleted: true });
          }
          return el;
        });

        fixBindingsAfterDeletion(
          nextElements,
          nextElements.filter((el) => el.isDeleted),
        );

        excalidrawAPI.updateScene({
          elements: nextElements,
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        appliedCount += 1;
        results.push({
          action: "deleteClass",
          className: operation.className,
          description: `Clase ${operation.className || targetClass.customData?.className || ""} eliminada`,
          status: "applied",
        });
        break;
      }

      case "createRelation": {
        const allElements = excalidrawAPI.getSceneElements();
        const source = allElements.find(
          (el) => !el.isDeleted && el.id === operation.sourceClassId,
        );
        const target = allElements.find(
          (el) => !el.isDeleted && el.id === operation.targetClassId,
        );

        if (!source || !target) {
          results.push({
            action: "createRelation",
            sourceClassName: operation.sourceClassName,
            targetClassName: operation.targetClassName,
            description: `Relación ${operation.sourceClassName || "origen"}-${operation.targetClassName || "destino"}`,
            status: "skipped",
            reason: "elemento no encontrado en el lienzo",
          });
          break;
        }

        const relationType: RelationType = operation.relationType || "association";
        const arrow = createUmlRelationElement(
          source,
          target,
          relationType,
          excalidrawAPI,
        );

        if (operation.multiplicitySource || operation.multiplicityTarget) {
          updateUmlRelationElement(
            arrow,
            null,
            operation.multiplicitySource ?? "1",
            operation.multiplicityTarget ?? "1",
            excalidrawAPI,
          );
        }

        appliedCount += 1;
        results.push({
          action: "createRelation",
          sourceClassName: operation.sourceClassName,
          targetClassName: operation.targetClassName,
          description: `Relación ${operation.sourceClassName || source.customData?.className}-${operation.targetClassName || target.customData?.className} creada`,
          status: "applied",
        });
        break;
      }

      case "updateRelation": {
        const allElements = excalidrawAPI.getSceneElements();
        const arrow = findRelationArrow(
          allElements,
          operation.sourceClassId,
          operation.targetClassId,
        );

        if (!arrow) {
          results.push({
            action: "updateRelation",
            sourceClassName: operation.sourceClassName,
            targetClassName: operation.targetClassName,
            description: `Relación ${operation.sourceClassName || "origen"}-${operation.targetClassName || "destino"}`,
            status: "skipped",
            reason: "elemento no encontrado en el lienzo",
          });
          break;
        }

        const currentRelationType = arrow.customData?.relationType;
        const isTypeChanged =
          operation.relationType &&
          operation.relationType !== currentRelationType;

        if (isTypeChanged) {
          // Eliminar flecha previa y su texto vinculado
          const elementsToDeleteIds = new Set<string>();
          elementsToDeleteIds.add(arrow.id);
          if (arrow.boundElements) {
            for (const b of arrow.boundElements) {
              if (b.type === "text") {
                elementsToDeleteIds.add(b.id);
              }
            }
          }

          const nextElements = allElements.map((el) => {
            if (elementsToDeleteIds.has(el.id)) {
              return newElementWith(el as ExcalidrawElement, { isDeleted: true });
            }
            return el;
          });

          fixBindingsAfterDeletion(
            nextElements,
            nextElements.filter((el) => el.isDeleted),
          );

          excalidrawAPI.updateScene({
            elements: nextElements,
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
          });

          // Recrear flecha con el nuevo relationType
          const refreshedElements = excalidrawAPI.getSceneElements();
          const source = refreshedElements.find(
            (el) => !el.isDeleted && el.id === operation.sourceClassId,
          );
          const target = refreshedElements.find(
            (el) => !el.isDeleted && el.id === operation.targetClassId,
          );

          if (!source || !target) {
            results.push({
              action: "updateRelation",
              sourceClassName: operation.sourceClassName,
              targetClassName: operation.targetClassName,
              description: `Relación ${operation.sourceClassName}-${operation.targetClassName}`,
              status: "skipped",
              reason: "elemento no encontrado en el lienzo",
            });
            break;
          }

          const newArrow = createUmlRelationElement(
            source,
            target,
            operation.relationType,
            excalidrawAPI,
          );

          const multSource =
            operation.multiplicitySource ??
            arrow.customData?.multiplicitySource;
          const multTarget =
            operation.multiplicityTarget ??
            arrow.customData?.multiplicityTarget;

          if (multSource || multTarget) {
            updateUmlRelationElement(
              newArrow,
              null,
              multSource ?? "1",
              multTarget ?? "1",
              excalidrawAPI,
            );
          }
        } else {
          // El tipo no cambió: actualizar texto de multiplicidades sobre la flecha existente
          const boundTextBinding = arrow.boundElements?.find(
            (b) => b.type === "text",
          );
          const existingLabelText = boundTextBinding
            ? allElements.find(
                (el) => !el.isDeleted && el.id === boundTextBinding.id,
              ) || null
            : null;

          const currentData = arrow.customData as UmlRelationData;
          const multSource =
            operation.multiplicitySource ??
            currentData?.multiplicitySource ??
            "1";
          const multTarget =
            operation.multiplicityTarget ??
            currentData?.multiplicityTarget ??
            "1";

          updateUmlRelationElement(
            arrow,
            existingLabelText,
            multSource,
            multTarget,
            excalidrawAPI,
          );
        }

        appliedCount += 1;
        const typeDesc = operation.relationType
          ? ` a ${operation.relationType}`
          : "";
        results.push({
          action: "updateRelation",
          sourceClassName: operation.sourceClassName,
          targetClassName: operation.targetClassName,
          description: `Relación ${operation.sourceClassName}-${operation.targetClassName} actualizada${typeDesc}`,
          status: "applied",
        });
        break;
      }

      case "deleteRelation": {
        const allElements = excalidrawAPI.getSceneElements();
        const arrow = findRelationArrow(
          allElements,
          operation.sourceClassId,
          operation.targetClassId,
        );

        if (!arrow) {
          results.push({
            action: "deleteRelation",
            sourceClassName: operation.sourceClassName,
            targetClassName: operation.targetClassName,
            description: `Relación ${operation.sourceClassName || "origen"}-${operation.targetClassName || "destino"}`,
            status: "skipped",
            reason: "elemento no encontrado en el lienzo",
          });
          break;
        }

        const elementsToDeleteIds = new Set<string>();
        elementsToDeleteIds.add(arrow.id);
        if (arrow.boundElements) {
          for (const b of arrow.boundElements) {
            if (b.type === "text") {
              elementsToDeleteIds.add(b.id);
            }
          }
        }

        const nextElements = allElements.map((el) => {
          if (elementsToDeleteIds.has(el.id)) {
            return newElementWith(el as ExcalidrawElement, { isDeleted: true });
          }
          return el;
        });

        fixBindingsAfterDeletion(
          nextElements,
          nextElements.filter((el) => el.isDeleted),
        );

        excalidrawAPI.updateScene({
          elements: nextElements,
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        appliedCount += 1;
        results.push({
          action: "deleteRelation",
          sourceClassName: operation.sourceClassName,
          targetClassName: operation.targetClassName,
          description: `Relación ${operation.sourceClassName}-${operation.targetClassName} eliminada`,
          status: "applied",
        });
        break;
      }

      default: {
        break;
      }
    }
  }

  return { applied: appliedCount, results };
}
