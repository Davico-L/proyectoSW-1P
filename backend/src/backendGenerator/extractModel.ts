import { UmlClass, UmlModel, UmlRelation, UmlRelationType } from "./types";

/**
 * Extrae un modelo UML limpio (clases y relaciones) a partir de los datos
 * de una escena de Excalidraw (formato almacenado en la columna `data` de `diagrams`).
 *
 * @param diagramData Objeto o JSON completo de la escena de Excalidraw
 * @returns UmlModel con las clases y relaciones identificadas
 */
export function extractUmlModel(diagramData: any): UmlModel {
  if (!diagramData) {
    return { classes: [], relations: [] };
  }

  let parsedData = diagramData;
  if (typeof diagramData === "string") {
    try {
      parsedData = JSON.parse(diagramData);
    } catch {
      return { classes: [], relations: [] };
    }
  }

  if (!parsedData || typeof parsedData !== "object") {
    return { classes: [], relations: [] };
  }

  const elements: any[] = Array.isArray(parsedData)
    ? parsedData
    : Array.isArray(parsedData.elements)
    ? parsedData.elements
    : [];

  if (!elements || elements.length === 0) {
    return { classes: [], relations: [] };
  }

  const classes: UmlClass[] = [];
  const relations: UmlRelation[] = [];

  for (const el of elements) {
    if (!el || el.isDeleted) {
      continue;
    }

    const customData = el.customData;
    if (!customData || typeof customData !== "object") {
      continue;
    }

    if (customData.type === "umlClass") {
      const attributes = Array.isArray(customData.attributes)
        ? customData.attributes.map((attr: any) => ({
            name: typeof attr?.name === "string" ? attr.name : "",
            type: typeof attr?.type === "string" ? attr.type : "String",
            visibility:
              typeof attr?.visibility === "string" ? attr.visibility : "public",
          }))
        : [];

      const methods = Array.isArray(customData.methods)
        ? customData.methods.map((method: any) => ({
            name: typeof method?.name === "string" ? method.name : "",
            returnType:
              typeof method?.returnType === "string"
                ? method.returnType
                : "void",
            visibility:
              typeof method?.visibility === "string"
                ? method.visibility
                : "public",
          }))
        : [];

      classes.push({
        id: String(el.id ?? ""),
        className:
          typeof customData.className === "string"
            ? customData.className.trim()
            : "",
        attributes,
        methods,
      });
    } else if (customData.type === "umlRelation") {
      const sourceClassId =
        customData.sourceClassId ||
        el.startBinding?.elementId ||
        "";
      const targetClassId =
        customData.targetClassId ||
        el.endBinding?.elementId ||
        "";

      const validRelationTypes: UmlRelationType[] = [
        "association",
        "inheritance",
        "composition",
        "aggregation",
        "manyToMany",
      ];

      const relationType: UmlRelationType = validRelationTypes.includes(
        customData.relationType
      )
        ? customData.relationType
        : "association";

      relations.push({
        relationType,
        sourceClassId: String(sourceClassId),
        targetClassId: String(targetClassId),
        multiplicitySource:
          typeof customData.multiplicitySource === "string"
            ? customData.multiplicitySource
            : "",
        multiplicityTarget:
          typeof customData.multiplicityTarget === "string"
            ? customData.multiplicityTarget
            : "",
      });
    }
  }

  return { classes, relations };
}
