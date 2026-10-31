import { UmlModel } from "../backendGenerator/types";

export interface SchemaField {
  nombre: string;
  tipo: "texto" | "numero" | "ref" | "otro";
  destino?: string;
}

export interface SchemaClass {
  nombre: string;
  campos: SchemaField[];
}

export interface MobileSchema {
  clases: SchemaClass[];
}

/**
 * Mapea el tipo de atributo UML al tipo soportado en esquema.json:
 * - String -> texto
 * - number / int / float / double -> numero
 * - los demás -> otro
 */
export function mapAttributeType(rawType: string): "texto" | "numero" | "otro" {
  const t = (rawType || "").trim().toLowerCase();
  if (t === "string" || t === "text" || t === "str") {
    return "texto";
  }
  if (
    t === "number" ||
    t === "int" ||
    t === "integer" ||
    t === "float" ||
    t === "double" ||
    t === "long" ||
    t === "short" ||
    t === "byte" ||
    t === "decimal"
  ) {
    return "numero";
  }
  return "otro";
}

/**
 * Convierte un UmlModel extraído de extractUmlModel al formato esquema.json de la app móvil.
 *
 * Reglas:
 * 1. Clases válidas con sus campos.
 * 2. Tipos de datos: String -> texto, number/int/float -> numero, otros -> otro.
 * 3. Relaciones asociación, composición y agregación (* en origen, 1 en destino) crean
 *    un campo `ref` en la clase origen con el nombre de la clase destino en minúsculas
 *    y destino el nombre de la clase destino.
 * 4. Herencia y manyToMany se ignoran, al igual que relaciones * a *.
 * 5. Los campos `ref` van primero en la lista de campos de cada clase.
 */
export function convertUmlModelToSchema(model: UmlModel): MobileSchema {
  if (!model || !model.classes || !Array.isArray(model.classes)) {
    return { clases: [] };
  }

  const validClasses = model.classes.filter(
    (c) => c && typeof c.className === "string" && c.className.trim() !== ""
  );

  const relations = Array.isArray(model.relations) ? model.relations : [];

  const clasesResult: SchemaClass[] = [];

  for (const umlClass of validClasses) {
    const className = umlClass.className.trim();
    const refFields: SchemaField[] = [];

    // Buscar relaciones donde esta clase sea el origen (source)
    for (const rel of relations) {
      if (!rel || rel.sourceClassId !== umlClass.id) {
        continue;
      }

      // Herencia y manyToMany se ignoran
      if (
        rel.relationType === "inheritance" ||
        rel.relationType === "manyToMany"
      ) {
        continue;
      }

      // Solo asociación, composición y agregación
      if (
        rel.relationType !== "association" &&
        rel.relationType !== "composition" &&
        rel.relationType !== "aggregation"
      ) {
        continue;
      }

      const multSource = (rel.multiplicitySource || "").trim();
      const multTarget = (rel.multiplicityTarget || "").trim();

      const sourceHasMany = multSource.includes("*");
      const targetHasMany = multTarget.includes("*");

      // Si es relación * a * o si el destino tiene *, se ignora
      if (!sourceHasMany || targetHasMany) {
        continue;
      }

      // Origen * y destino 1 (o valor único no-many)
      const targetClass = validClasses.find((c) => c.id === rel.targetClassId);
      if (!targetClass || !targetClass.className) {
        continue;
      }

      const targetClassName = targetClass.className.trim();
      const refFieldName = targetClassName.toLowerCase();

      // Evitar duplicados de ref con el mismo nombre
      if (!refFields.some((f) => f.nombre === refFieldName)) {
        refFields.push({
          nombre: refFieldName,
          tipo: "ref",
          destino: targetClassName,
        });
      }
    }

    // Procesar atributos de la clase
    const attrFields: SchemaField[] = [];
    const attributes = Array.isArray(umlClass.attributes)
      ? umlClass.attributes
      : [];

    for (const attr of attributes) {
      if (!attr || typeof attr.name !== "string") {
        continue;
      }
      const attrName = attr.name.trim();
      if (!attrName) {
        continue;
      }

      // Omitir del esquema todo atributo cuyo nombre en minúsculas sea exactamente "id"
      if (attrName.toLowerCase() === "id") {
        continue;
      }

      const tipo = mapAttributeType(attr.type);
      attrFields.push({
        nombre: attrName,
        tipo,
      });
    }

    // Los campos ref van primero
    clasesResult.push({
      nombre: className,
      campos: [...refFields, ...attrFields],
    });
  }

  return { clases: clasesResult };
}
