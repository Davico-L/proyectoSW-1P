import { UmlModel, UmlClass } from "./types";
import { toPascalCase, toSnakeCase, toCamelCase } from "./generateEntity";

/**
 * Obtiene el valor de ejemplo para un atributo según su tipo UML original.
 */
function getExampleValueForUmlType(type: string): any {
  const normalized = (type || "").trim();

  switch (normalized) {
    case "String":
      return "texto de ejemplo";
    case "Integer":
    case "Long":
      return 1;
    case "Boolean":
      return true;
    case "Double":
      return 1.5;
    case "Date":
      return "2024-01-01";
    default:
      // Manejo flexible por si viniera en minúsculas
      const lower = normalized.toLowerCase();
      if (lower === "string") return "texto de ejemplo";
      if (lower === "integer" || lower === "int" || lower === "long") return 1;
      if (lower === "boolean" || lower === "bool") return true;
      if (lower === "double" || lower === "float") return 1.5;
      if (lower === "date") return "2024-01-01";
      return "texto de ejemplo";
  }
}

/**
 * Construye el cuerpo JSON de ejemplo para las operaciones Crear y Actualizar.
 * Se arma con todos los atributos de umlClass EXCEPTO el primero (id autogenerado).
 * Si no tiene atributos además del primero, devuelve "{}".
 */
function buildExampleBody(umlClass: UmlClass): string {
  const attributes = umlClass.attributes || [];
  if (attributes.length <= 1) {
    return "{}";
  }

  const exampleObj: Record<string, any> = {};
  for (let i = 1; i < attributes.length; i++) {
    const attr = attributes[i];
    const rawName = attr.name ? attr.name.trim() : `attr${i}`;
    const key = toCamelCase(rawName) || rawName;
    exampleObj[key] = getExampleValueForUmlType(attr.type);
  }

  return JSON.stringify(exampleObj, null, 2);
}

/**
 * Genera una colección de Postman en formato v2.1 para el modelo UML dado.
 *
 * @param model Modelo UML con las clases del diagrama
 * @returns Cadena JSON formateada con la colección de Postman v2.1
 */
export function generatePostmanCollection(model: UmlModel): string {
  const validClasses = (model?.classes || []).filter(
    (c) => c.className && c.className.trim() !== ""
  );

  const items = validClasses.map((umlClass) => {
    const className = toPascalCase(umlClass.className) || "Entity";
    const tableName = toSnakeCase(umlClass.className) || "entity";
    const plural = `${tableName}s`;
    const exampleBody = buildExampleBody(umlClass);

    return {
      name: className,
      item: [
        {
          name: "Listar todos",
          request: {
            method: "GET",
            url: `{{baseUrl}}/api/${plural}`,
          },
        },
        {
          name: "Obtener por ID",
          request: {
            method: "GET",
            url: `{{baseUrl}}/api/${plural}/1`,
          },
        },
        {
          name: "Crear",
          request: {
            method: "POST",
            url: `{{baseUrl}}/api/${plural}`,
            header: [
              {
                key: "Content-Type",
                value: "application/json",
              },
            ],
            body: {
              mode: "raw",
              raw: exampleBody,
            },
          },
        },
        {
          name: "Actualizar",
          request: {
            method: "PUT",
            url: `{{baseUrl}}/api/${plural}/1`,
            header: [
              {
                key: "Content-Type",
                value: "application/json",
              },
            ],
            body: {
              mode: "raw",
              raw: exampleBody,
            },
          },
        },
        {
          name: "Eliminar",
          request: {
            method: "DELETE",
            url: `{{baseUrl}}/api/${plural}/1`,
          },
        },
      ],
    };
  });

  const collection = {
    info: {
      name: "Generated Backend API",
      schema:
        "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    variable: [
      {
        key: "baseUrl",
        value: "http://localhost:8081",
      },
    ],
    item: items,
  };

  return JSON.stringify(collection, null, 2);
}
