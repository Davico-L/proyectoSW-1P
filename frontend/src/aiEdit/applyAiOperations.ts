import {
  newElementWith,
  fixBindingsAfterDeletion,
  isArrowElement,
  syncInvalidIndices,
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
  UmlAttribute,
  UmlMethod,
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
 * Busca un elemento de clase UML en la escena.
 * Primero intenta por id exacto (si existe y no es un id provisional 'pending:...').
 * Si no lo encuentra por id, busca por nombre de clase (case-insensitive) en customData.className.
 */
function findClassElement(
  elements: readonly ExcalidrawElement[],
  classId?: string,
  className?: string,
): ExcalidrawElement | undefined {
  if (classId && !classId.startsWith("pending:")) {
    const byId = elements.find(
      (el) =>
        !el.isDeleted &&
        el.id === classId &&
        el.customData?.type === "umlClass",
    );
    if (byId) return byId;
  }

  if (className && typeof className === "string" && className.trim() !== "") {
    const normalizedName = className.trim().toLowerCase();
    return elements.find(
      (el) =>
        !el.isDeleted &&
        el.customData?.type === "umlClass" &&
        typeof el.customData?.className === "string" &&
        el.customData.className.trim().toLowerCase() === normalizedName,
    );
  }

  return undefined;
}

/**
 * Fusiona los atributos existentes de una clase con los atributos entrantes (delta).
 * - La correspondencia se realiza por nombre normalizado (trim y toLowerCase).
 * - Si el atributo existe, actualiza únicamente las propiedades proporcionadas y válidas (type, visibility).
 * - Si no existe, agrega el nuevo atributo al final conservando el orden de los existentes.
 * - Si incomingAttributes es null, undefined, un arreglo vacío o no es un arreglo, conserva los elementos existentes.
 * - No muta directamente los arreglos ni los objetos originales de currentAttributes.
 * - No convierte valores null en arreglos vacíos ni sobrescribe propiedades existentes con null o undefined.
 * - No duplica atributos al repetir una actualización.
 * - NOTA: La fusión por nombre no permite distinguir automáticamente un renombrado de una adición
 *   (un atributo renombrado se agregará como uno nuevo y el anterior se conservará, al no existir una operación de renombrado de atributo).
 */
export function mergeAttributes(
  currentAttributes: UmlAttribute[] | undefined,
  incomingAttributes: any[] | null | undefined,
): UmlAttribute[] {
  const base: UmlAttribute[] = Array.isArray(currentAttributes)
    ? currentAttributes.map((a) => ({ ...a }))
    : [];

  if (!Array.isArray(incomingAttributes) || incomingAttributes.length === 0) {
    return base;
  }

  const result = [...base];

  for (const incoming of incomingAttributes) {
    if (
      !incoming ||
      typeof incoming !== "object" ||
      typeof incoming.name !== "string"
    ) {
      continue;
    }
    const trimmedName = incoming.name.trim();
    const normalizedName = trimmedName.toLowerCase();
    if (!normalizedName) {
      continue;
    }

    const existingIndex = result.findIndex(
      (a) => a.name && a.name.trim().toLowerCase() === normalizedName,
    );

    if (existingIndex >= 0) {
      const existing = result[existingIndex];
      const updatedType =
        incoming.type !== undefined &&
        incoming.type !== null &&
        typeof incoming.type === "string" &&
        incoming.type.trim() !== ""
          ? incoming.type
          : existing.type;
      const updatedVisibility =
        incoming.visibility !== undefined &&
        incoming.visibility !== null &&
        typeof incoming.visibility === "string" &&
        incoming.visibility.trim() !== ""
          ? incoming.visibility
          : existing.visibility;

      result[existingIndex] = {
        name: existing.name,
        type: updatedType,
        visibility: updatedVisibility,
      };
    } else {
      result.push({
        name: trimmedName,
        type:
          incoming.type !== undefined &&
          incoming.type !== null &&
          typeof incoming.type === "string" &&
          incoming.type.trim() !== ""
            ? incoming.type
            : "String",
        visibility:
          incoming.visibility !== undefined &&
          incoming.visibility !== null &&
          typeof incoming.visibility === "string" &&
          incoming.visibility.trim() !== ""
            ? incoming.visibility
            : "private",
      });
    }
  }

  return result;
}

/**
 * Fusiona los métodos existentes de una clase con los métodos entrantes (delta).
 * - La correspondencia se realiza por nombre normalizado (trim y toLowerCase).
 * - Si el método existe, actualiza únicamente las propiedades proporcionadas y válidas (returnType, visibility).
 * - Si no existe, agrega el nuevo método al final conservando el orden de los existentes.
 * - Si incomingMethods es null, undefined, un arreglo vacío o no es un arreglo, conserva los elementos existentes.
 * - No muta directamente los arreglos ni los objetos originales de currentMethods.
 * - No convierte valores null en arreglos vacíos ni sobrescribe propiedades existentes con null o undefined.
 * - No duplica métodos al repetir una actualización.
 * - NOTA: La fusión por nombre no permite distinguir automáticamente un renombrado de una adición.
 */
export function mergeMethods(
  currentMethods: UmlMethod[] | undefined,
  incomingMethods: any[] | null | undefined,
): UmlMethod[] {
  const base: UmlMethod[] = Array.isArray(currentMethods)
    ? currentMethods.map((m) => ({ ...m }))
    : [];

  if (!Array.isArray(incomingMethods) || incomingMethods.length === 0) {
    return base;
  }

  const result = [...base];

  for (const incoming of incomingMethods) {
    if (
      !incoming ||
      typeof incoming !== "object" ||
      typeof incoming.name !== "string"
    ) {
      continue;
    }
    const trimmedName = incoming.name.trim();
    const normalizedName = trimmedName.toLowerCase();
    if (!normalizedName) {
      continue;
    }

    const existingIndex = result.findIndex(
      (m) => m.name && m.name.trim().toLowerCase() === normalizedName,
    );

    if (existingIndex >= 0) {
      const existing = result[existingIndex];
      const updatedReturnType =
        incoming.returnType !== undefined &&
        incoming.returnType !== null &&
        typeof incoming.returnType === "string" &&
        incoming.returnType.trim() !== ""
          ? incoming.returnType
          : existing.returnType;
      const updatedVisibility =
        incoming.visibility !== undefined &&
        incoming.visibility !== null &&
        typeof incoming.visibility === "string" &&
        incoming.visibility.trim() !== ""
          ? incoming.visibility
          : existing.visibility;

      result[existingIndex] = {
        name: existing.name,
        returnType: updatedReturnType,
        visibility: updatedVisibility,
      };
    } else {
      result.push({
        name: trimmedName,
        returnType:
          incoming.returnType !== undefined &&
          incoming.returnType !== null &&
          typeof incoming.returnType === "string" &&
          incoming.returnType.trim() !== ""
            ? incoming.returnType
            : "void",
        visibility:
          incoming.visibility !== undefined &&
          incoming.visibility !== null &&
          typeof incoming.visibility === "string" &&
          incoming.visibility.trim() !== ""
            ? incoming.visibility
            : "public",
      });
    }
  }

  return result;
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
          elements: syncInvalidIndices([
            ...excalidrawAPI.getSceneElements(),
            container,
            text,
          ]),
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
        const container = findClassElement(
          allElements,
          operation.classId,
          operation.className,
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
        const currentAttributes = Array.isArray(currentData?.attributes)
          ? currentData.attributes
          : [];
        const currentMethods = Array.isArray(currentData?.methods)
          ? currentData.methods
          : [];

        const newClassName =
          typeof operation.newClassName === "string" &&
          operation.newClassName.trim() !== ""
            ? operation.newClassName.trim()
            : operation.className ?? currentData.className;

        const newData: UmlClassData = {
          type: "umlClass",
          className: newClassName,
          attributes: mergeAttributes(currentAttributes, operation.attributes),
          methods: mergeMethods(currentMethods, operation.methods),
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
        const targetClass = findClassElement(
          allElements,
          operation.classId,
          operation.className,
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
        const source = findClassElement(
          allElements,
          operation.sourceClassId,
          operation.sourceClassName,
        );
        const target = findClassElement(
          allElements,
          operation.targetClassId,
          operation.targetClassName,
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
        const source = findClassElement(
          allElements,
          operation.sourceClassId,
          operation.sourceClassName,
        );
        const target = findClassElement(
          allElements,
          operation.targetClassId,
          operation.targetClassName,
        );

        if (!source || !target) {
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

        const arrow = findRelationArrow(
          allElements,
          source.id,
          target.id,
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
          const refreshedSource = findClassElement(
            refreshedElements,
            operation.sourceClassId,
            operation.sourceClassName,
          );
          const refreshedTarget = findClassElement(
            refreshedElements,
            operation.targetClassId,
            operation.targetClassName,
          );

          if (!refreshedSource || !refreshedTarget) {
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
            refreshedSource,
            refreshedTarget,
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
        const source = findClassElement(
          allElements,
          operation.sourceClassId,
          operation.sourceClassName,
        );
        const target = findClassElement(
          allElements,
          operation.targetClassId,
          operation.targetClassName,
        );

        if (!source || !target) {
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

        const arrow = findRelationArrow(
          allElements,
          source.id,
          target.id,
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
