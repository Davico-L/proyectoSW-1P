/**
 * Mapea los tipos UML permitidos en el diseñador (CU2) a sus tipos equivalentes en Java.
 *
 * Mapeos:
 *  - String   -> String
 *  - Integer  -> Integer
 *  - Long     -> Long
 *  - Boolean  -> Boolean
 *  - Double   -> Double
 *  - Date     -> LocalDate
 *  - Cualquier otro valor -> String (default)
 *
 * @param umlType Tipo de dato proveniente del modelo UML
 * @returns Nombre del tipo de dato compatible con Java
 */
export function mapUmlTypeToJava(umlType: string): string {
  if (!umlType || typeof umlType !== "string") {
    return "String";
  }

  const normalized = umlType.trim();

  switch (normalized) {
    case "String":
      return "String";
    case "Integer":
      return "Integer";
    case "Long":
      return "Long";
    case "Boolean":
      return "Boolean";
    case "Double":
      return "Double";
    case "Date":
      return "LocalDate";
    default:
      return "String";
  }
}
