/**
 * Servicio para solicitar la edición de un diagrama UML mediante IA (CU20).
 * Reproduce la lógica pura de ai-edit sin modificar diagramRoutes.ts.
 */

import { getDiagramById } from "../services/diagramService";
import { extractUmlModel } from "../backendGenerator/extractModel";
import { editWithFallback } from "../ai/providers/providerManager";
import { validateAndResolveOperations } from "../services/operationValidator";
import {
  checkOperationLimit,
  detectUnsupportedAttributeRequest,
  convertExistingCreateToUpdate,
} from "./modificationHelpers";
import { ProviderId } from "../ai/providers/types";

export interface DiagramAiEditDeps {
  getDiagramById?: (id: string) => Promise<any>;
  extractUmlModel?: (diagramData: any) => { classes: any[]; relations: any[] };
  editWithFallback?: (
    currentModel: { classes: any[]; relations: any[] },
    instruction: string
  ) => Promise<{ operations: any[]; provider: ProviderId | string; fallback: boolean }>;
  validateAndResolveOperations?: (
    operations: any[],
    classes: any[]
  ) => { validOperations: any[]; warnings: string[] };
  detectUnsupportedAttributeRequest?: typeof detectUnsupportedAttributeRequest;
  convertExistingCreateToUpdate?: typeof convertExistingCreateToUpdate;
}

const defaultDeps: Required<DiagramAiEditDeps> = {
  getDiagramById,
  extractUmlModel,
  editWithFallback,
  validateAndResolveOperations,
  detectUnsupportedAttributeRequest,
  convertExistingCreateToUpdate,
};

export interface RequestDiagramEditParams {
  diagramId: string;
  instruction: string;
}

export type DiagramEditResult =
  | {
      status: "ready";
      validOperations: any[];
      warnings: string[];
      provider: ProviderId | string;
      fallback: boolean;
    }
  | {
      status: "onlyWarnings";
      warnings: string[];
      provider?: ProviderId | string;
      fallback?: boolean;
    }
  | {
      status: "noChanges";
      provider?: ProviderId | string;
      fallback?: boolean;
    }
  | {
      status: "tooMany";
      message?: string;
      count?: number;
    }
  | {
      status: "diagramNotFound";
    };

/**
 * Solicita una edición de diagrama con IA reproduciendo la lógica de ai-edit:
 * 1. Obtiene el diagrama por ID
 * 2. Extrae el modelo UML con extractUmlModel
 * 3. Convierte IDs a nombres en relaciones y arma currentModel
 * 4. Invoca editWithFallback con la instrucción
 * 5. Si result.operations supera MAX_OPERATIONS, devuelve "tooMany" sin validar
 * 6. Valida y resuelve operaciones contra las clases existentes
 * 7. Devuelve el estado correspondiente ("ready", "onlyWarnings", "noChanges", "tooMany", "diagramNotFound")
 *
 * Los errores de proveedores se propagan directamente sin capturarse.
 */
export async function requestDiagramEdit(
  params: RequestDiagramEditParams,
  deps: DiagramAiEditDeps = {}
): Promise<DiagramEditResult> {
  const getDiagram = deps.getDiagramById ?? defaultDeps.getDiagramById;
  const extract = deps.extractUmlModel ?? defaultDeps.extractUmlModel;
  const edit = deps.editWithFallback ?? defaultDeps.editWithFallback;
  const validate =
    deps.validateAndResolveOperations ?? defaultDeps.validateAndResolveOperations;
  const detectUnsupported =
    deps.detectUnsupportedAttributeRequest ??
    defaultDeps.detectUnsupportedAttributeRequest;

  const { diagramId, instruction } = params;

  // 1. Obtener diagrama
  const diagram = await getDiagram(diagramId);
  if (!diagram || !diagram.data) {
    return { status: "diagramNotFound" };
  }

  // 2. Extraer modelo UML
  const { classes, relations } = extract(diagram.data);

  // 3. Conversión de IDs a nombres en relaciones
  const classMap = new Map<string, string>();
  for (const c of classes) {
    classMap.set(c.id, c.className);
  }

  const transformedRelations: any[] = [];
  for (const rel of relations) {
    const sourceClassName = classMap.get(rel.sourceClassId);
    const targetClassName = classMap.get(rel.targetClassId);
    if (sourceClassName && targetClassName) {
      transformedRelations.push({
        relationType: rel.relationType,
        sourceClassName,
        targetClassName,
        multiplicitySource: rel.multiplicitySource,
        multiplicityTarget: rel.multiplicityTarget,
      });
    }
  }

  // 4. Armar currentModel
  const currentModel = {
    classes: classes.map((c) => ({
      className: c.className,
      attributes: c.attributes,
      methods: c.methods,
    })),
    relations: transformedRelations,
  };

  // 5. Verificar si la instrucción pide una operación no soportada sobre atributos/métodos (UC7)
  const unsupportedAction = detectUnsupported(instruction);
  if (unsupportedAction) {
    const warning =
      unsupportedAction === "delete"
        ? "Por ahora no puedo eliminar atributos ni métodos individuales. Puedes quitarlo haciendo doble clic sobre la clase en el lienzo en 'Editar Clase UML'."
        : "Por ahora no puedo renombrar atributos ni métodos individuales. Puedes cambiarle el nombre haciendo doble clic sobre la clase en el lienzo en 'Editar Clase UML'.";
    return {
      status: "onlyWarnings",
      warnings: [warning],
    };
  }

  // 6. Llamada a la IA con respaldo automático (los errores no se capturan, se propagan)
  const result = await edit(currentModel, instruction.trim());

  // 7. Verificar límite de operaciones antes de validar
  const limitCheck = checkOperationLimit(result.operations);
  if (limitCheck.exceeded) {
    return {
      status: "tooMany",
      message: limitCheck.message,
      count: limitCheck.count,
    };
  }

  // 8. Corrección 1: createClass sobre clase existente -> convertir a updateClass antes de validar
  const convertOps =
    deps.convertExistingCreateToUpdate ??
    defaultDeps.convertExistingCreateToUpdate;
  const operationsToValidate = convertOps(result.operations, classes);

  // 9. Validar y resolver operaciones contra las clases existentes
  const { validOperations, warnings } = validate(operationsToValidate, classes);

  if (validOperations.length > 0) {
    return {
      status: "ready",
      validOperations,
      warnings,
      provider: result.provider,
      fallback: result.fallback,
    };
  }

  if (warnings.length > 0) {
    return {
      status: "onlyWarnings",
      warnings,
      provider: result.provider,
      fallback: result.fallback,
    };
  }

  return {
    status: "noChanges",
    provider: result.provider,
    fallback: result.fallback,
  };
}
