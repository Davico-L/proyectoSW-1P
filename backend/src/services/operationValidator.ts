import { UmlClass } from "../backendGenerator/types";

export interface ValidationResult {
  validOperations: any[];
  warnings: string[];
}

function findClassByName(
  classes: UmlClass[],
  name?: string
): UmlClass | undefined {
  if (!name || typeof name !== "string") return undefined;
  const normalized = name.trim().toLowerCase();
  return classes.find(
    (c) => c.className && c.className.trim().toLowerCase() === normalized
  );
}

/**
 * Valida y resuelve los IDs internos de las operaciones generadas por la IA
 * contra las clases existentes en el modelo UML.
 *
 * @param operations Lista de operaciones estructuradas devueltas por la IA
 * @param classes Lista de clases UML existentes extraídas del diagrama
 * @returns Objeto con validOperations (con IDs resueltos) y warnings para las descartadas
 */
export function validateAndResolveOperations(
  operations: any[],
  classes: UmlClass[]
): ValidationResult {
  const validOperations: any[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(operations)) {
    return { validOperations, warnings };
  }

  for (const op of operations) {
    if (!op || typeof op !== "object" || !op.action) {
      continue;
    }

    switch (op.action) {
      case "createClass": {
        validOperations.push({ ...op });
        break;
      }

      case "updateClass":
      case "deleteClass": {
        const found = findClassByName(classes, op.className);
        if (found) {
          validOperations.push({
            ...op,
            classId: found.id,
          });
        } else {
          warnings.push(`No encontré la clase '${op.className}'`);
        }
        break;
      }

      case "createRelation":
      case "updateRelation":
      case "deleteRelation": {
        const sourceClass = findClassByName(classes, op.sourceClassName);
        const targetClass = findClassByName(classes, op.targetClassName);

        let isValid = true;
        if (!sourceClass) {
          warnings.push(`No encontré la clase '${op.sourceClassName}'`);
          isValid = false;
        }
        if (!targetClass) {
          warnings.push(`No encontré la clase '${op.targetClassName}'`);
          isValid = false;
        }

        if (isValid && sourceClass && targetClass) {
          validOperations.push({
            ...op,
            sourceClassId: sourceClass.id,
            targetClassId: targetClass.id,
          });
        }
        break;
      }

      default: {
        break;
      }
    }
  }

  return { validOperations, warnings };
}
