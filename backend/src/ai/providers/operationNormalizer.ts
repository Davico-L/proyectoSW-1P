/**
 * Utilidades puras para normalización y conversión de operaciones generadas por IA.
 * Reutilizadas por editWithFallback (providers) y diagramAiEditService (chat).
 */

/**
 * Normaliza un nombre de clase para comparaciones:
 * - Convierte a minúsculas
 * - Elimina tildes y diacríticos (NFD)
 * - Colapsa espacios en blanco y recorta bordes
 */
export function normalizeClassName(name: unknown): string {
  if (typeof name !== "string") {
    return "";
  }
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Convierte operaciones createClass sobre clases ya existentes en updateClass.
 *
 * Cada createClass cuyo className coincida con una clase existente en el diagrama
 * (comparación insensible a mayúsculas, tildes y espacios) se convierte en updateClass
 * con className igual al nombre real de la clase existente, preservando sus atributos y métodos.
 *
 * Excepción: si en el mismo lote hay un deleteClass de esa misma clase ANTES del createClass,
 * se mantiene como createClass.
 *
 * Esta función es completamente idempotente: aplicarla dos veces sobre la misma lista
 * produce exactamente el mismo resultado.
 */
export function convertExistingCreateToUpdate(
  operations: any[],
  existingClasses: Array<{ className?: string }>
): any[] {
  if (!Array.isArray(operations) || operations.length === 0) {
    return Array.isArray(operations) ? operations : [];
  }
  if (!Array.isArray(existingClasses) || existingClasses.length === 0) {
    return operations;
  }

  const existingMap = new Map<string, string>();
  for (const c of existingClasses) {
    if (c && typeof c.className === "string") {
      const norm = normalizeClassName(c.className);
      if (norm && !existingMap.has(norm)) {
        existingMap.set(norm, c.className);
      }
    }
  }

  const deletedSoFar = new Set<string>();
  const result: any[] = [];

  for (const op of operations) {
    if (!op || typeof op !== "object" || !op.action) {
      result.push(op);
      continue;
    }

    if (op.action === "deleteClass" && typeof op.className === "string") {
      const normDelete = normalizeClassName(op.className);
      if (normDelete) {
        deletedSoFar.add(normDelete);
      }
      result.push(op);
      continue;
    }

    if (op.action === "createClass" && typeof op.className === "string") {
      const normCreate = normalizeClassName(op.className);
      const realExistingName = normCreate ? existingMap.get(normCreate) : undefined;

      // Si la clase existe en el diagrama y NO fue eliminada previamente en este lote
      if (realExistingName && !deletedSoFar.has(normCreate)) {
        const convertedOp: any = {
          ...op,
          action: "updateClass",
          className: realExistingName,
        };
        delete convertedOp.newClassName;
        if (op.attributes !== undefined) {
          convertedOp.attributes = op.attributes;
        }
        if (op.methods !== undefined) {
          convertedOp.methods = op.methods;
        }
        result.push(convertedOp);
        continue;
      }
    }

    result.push(op);
  }

  return result;
}
