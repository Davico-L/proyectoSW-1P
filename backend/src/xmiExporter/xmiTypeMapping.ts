export type ClassifiedUmlType =
  | { kind: "primitive"; name: string }
  | { kind: "custom"; name: string };

/**
 * Clasifica un tipo de dato UML para su serialización en XMI 2.1.
 *
 * Reglas:
 * - Los primitivos UML 2.1 reales son: Integer, Boolean, Real, String, UnlimitedNatural.
 * - Double mapea a Real ({ kind: "primitive", name: "Real" }).
 * - String, Integer, Boolean mapean directo a primitive con su mismo nombre.
 * - Long y Date son tipos custom ({ kind: "custom", name: umlType }).
 * - Cualquier tipo no reconocido hace fallback a { kind: "primitive", name: "String" }.
 *
 * @param umlType Tipo de dato proveniente del diseñador o modelo UML
 * @returns Clasificación como primitivo o custom para XMI
 */
export function classifyUmlType(umlType: string): ClassifiedUmlType {
  if (!umlType || typeof umlType !== "string") {
    return { kind: "primitive", name: "String" };
  }

  const normalized = umlType.trim();

  if (normalized === "Double") {
    return { kind: "primitive", name: "Real" };
  }

  if (
    normalized === "String" ||
    normalized === "Integer" ||
    normalized === "Boolean" ||
    normalized === "Real" ||
    normalized === "UnlimitedNatural"
  ) {
    return { kind: "primitive", name: normalized };
  }

  if (normalized === "Long" || normalized === "Date") {
    return { kind: "custom", name: normalized };
  }

  // Compatibilidad case-insensitive con nombres estándar
  const lower = normalized.toLowerCase();
  if (lower === "double" || lower === "real") {
    return { kind: "primitive", name: "Real" };
  }
  if (lower === "string") {
    return { kind: "primitive", name: "String" };
  }
  if (lower === "integer") {
    return { kind: "primitive", name: "Integer" };
  }
  if (lower === "boolean") {
    return { kind: "primitive", name: "Boolean" };
  }
  if (lower === "unlimitednatural") {
    return { kind: "primitive", name: "UnlimitedNatural" };
  }
  if (lower === "long") {
    return { kind: "custom", name: "Long" };
  }
  if (lower === "date") {
    return { kind: "custom", name: "Date" };
  }

  // Fallback a String para tipos no reconocidos
  return { kind: "primitive", name: "String" };
}
