import { UmlModel, UmlClass, UmlAttribute, UmlMethod, UmlRelation } from "../backendGenerator/types";
import { classifyUmlType } from "./xmiTypeMapping";
import { renderGeneralization, renderAssociation } from "./generateXmiRelations";

/**
 * Escapa caracteres especiales de XML (&, <, >, ", ') en un string.
 */
export function escapeXml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Mapea la visibilidad UML a los valores válidos: public, private, protected, package.
 * Si el valor no es reconocido o está vacío, retorna 'public' por defecto.
 */
export function mapVisibility(visibility?: string): string {
  if (!visibility || typeof visibility !== "string") {
    return "public";
  }

  const clean = visibility.trim().toLowerCase();
  switch (clean) {
    case "public":
    case "+":
      return "public";
    case "private":
    case "-":
      return "private";
    case "protected":
    case "#":
      return "protected";
    case "package":
    case "~":
      return "package";
    default:
      return "public";
  }
}

/**
 * Genera la etiqueta <type> anidada para un tipo UML dado.
 */
function renderTypeElement(umlType: string, indent: string): string {
  const classified = classifyUmlType(umlType);

  if (classified.kind === "custom") {
    const dtId = `dt_${classified.name.toLowerCase()}`;
    return `${indent}<type xmi:idref="${dtId}"/>`;
  }

  return `${indent}<type xmi:type="uml:PrimitiveType" href="http://schema.omg.org/spec/UML/2.1/uml.xml#${classified.name}"/>`;
}

/**
 * Determina si el tipo de retorno corresponde a void (case-insensitive).
 */
function isVoidReturnType(returnType?: string): boolean {
  if (!returnType || typeof returnType !== "string") {
    return false;
  }
  return returnType.trim().toLowerCase() === "void";
}

/**
 * Genera un documento XMI 2.1 completo como string a partir de un UmlModel.
 * Serializa clases, atributos y operaciones (sin relaciones).
 *
 * @param model Modelo UML conteniendo clases y métodos
 * @returns Documento XML / XMI 2.1 completo en formato string
 */
export function generateXmiDocument(model: UmlModel): string {
  const classes = model?.classes || [];
  const relations = model?.relations || [];
  const classIds = new Set(classes.map((cls) => cls.id));

  // Agrupar relaciones de herencia válidas por clase source (Regla 1 y Regla 4)
  const generalizationsBySource = new Map<string, UmlRelation[]>();
  for (const rel of relations) {
    if (rel.relationType === "inheritance") {
      if (classIds.has(rel.sourceClassId) && classIds.has(rel.targetClassId)) {
        const list = generalizationsBySource.get(rel.sourceClassId) || [];
        list.push(rel);
        generalizationsBySource.set(rel.sourceClassId, list);
      }
    }
  }

  const customTypesUsed = new Set<string>();

  // Rastrear tipos custom (Long, Date) usados en atributos y retornos de métodos
  for (const cls of classes) {
    for (const attr of cls.attributes || []) {
      const classified = classifyUmlType(attr.type);
      if (classified.kind === "custom") {
        customTypesUsed.add(classified.name);
      }
    }

    for (const method of cls.methods || []) {
      if (!isVoidReturnType(method.returnType)) {
        const classified = classifyUmlType(method.returnType);
        if (classified.kind === "custom") {
          customTypesUsed.add(classified.name);
        }
      }
    }
  }

  const lines: string[] = [];

  // Encabezado XML y raíz XMI
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<xmi:XMI xmlns:xmi="http://schema.omg.org/spec/XMI/2.1" xmi:version="2.1" xmlns:uml="http://schema.omg.org/spec/UML/2.1">`);
  lines.push(`  <uml:Model xmi:type="uml:Model" name="EA_Model" visibility="public">`);
  lines.push(`    <packagedElement xmi:type="uml:Package" xmi:id="pkg_diagrama" name="Diagrama" visibility="public">`);

  // Serialización de clases
  for (const cls of classes) {
    const classId = `cls_${escapeXml(cls.id)}`;
    const className = escapeXml(cls.className);

    lines.push(`      <packagedElement xmi:type="uml:Class" xmi:id="${classId}" name="${className}" visibility="public">`);

    // Generalizaciones (Herencia - Regla 1)
    const classGeneralizations = generalizationsBySource.get(cls.id) || [];
    for (const genRel of classGeneralizations) {
      lines.push(renderGeneralization(genRel, "        "));
    }

    // Atributos
    for (const attr of cls.attributes || []) {
      const attrName = escapeXml(attr.name);
      const visibility = mapVisibility(attr.visibility);

      lines.push(`        <ownedAttribute xmi:type="uml:Property" name="${attrName}" visibility="${visibility}">`);
      lines.push(renderTypeElement(attr.type, "          "));
      lines.push(`          <lowerValue xmi:type="uml:LiteralInteger" value="1"/>`);
      lines.push(`          <upperValue xmi:type="uml:LiteralUnlimitedNatural" value="1"/>`);
      lines.push(`        </ownedAttribute>`);
    }

    // Operaciones / Métodos
    for (const method of cls.methods || []) {
      const methodName = escapeXml(method.name);
      const visibility = mapVisibility(method.visibility);

      if (isVoidReturnType(method.returnType)) {
        lines.push(`        <ownedOperation name="${methodName}" visibility="${visibility}">`);
        lines.push(`          <ownedParameter name="return" direction="return"/>`);
        lines.push(`        </ownedOperation>`);
      } else {
        const classified = classifyUmlType(method.returnType);
        if (classified.kind === "custom") {
          const dtId = `dt_${classified.name.toLowerCase()}`;
          lines.push(`        <ownedOperation name="${methodName}" visibility="${visibility}" type="${dtId}">`);
          lines.push(`          <ownedParameter name="return" type="${dtId}" direction="return"/>`);
          lines.push(`        </ownedOperation>`);
        } else {
          lines.push(`        <ownedOperation name="${methodName}" visibility="${visibility}">`);
          lines.push(renderTypeElement(method.returnType, "          "));
          lines.push(`          <ownedParameter name="return" direction="return">`);
          lines.push(renderTypeElement(method.returnType, "            "));
          lines.push(`          </ownedParameter>`);
          lines.push(`        </ownedOperation>`);
        }
      }
    }

    lines.push(`      </packagedElement>`);
  }

  // Serialización de relaciones (asociación, agregación, composición, manyToMany - Reglas 2 y 3)
  const seenAssocIds = new Set<string>();
  for (const rel of relations) {
    if (rel.relationType === "inheritance") {
      // Ya procesada como generalization dentro de la clase source
      continue;
    }

    // Regla 4: omitir relación colgante si source o target no existen
    if (!classIds.has(rel.sourceClassId) || !classIds.has(rel.targetClassId)) {
      continue;
    }

    lines.push(...renderAssociation(rel, seenAssocIds));
  }

  // Declaración de tipos de datos custom usados (ej. Long, Date)
  const sortedCustomTypes = Array.from(customTypesUsed).sort();
  for (const customTypeName of sortedCustomTypes) {
    const dtId = `dt_${customTypeName.toLowerCase()}`;
    const dtName = escapeXml(customTypeName);
    lines.push(`      <packagedElement xmi:type="uml:DataType" xmi:id="${dtId}" name="${dtName}" visibility="public"/>`);
  }

  // Cierre de estructuras contenedoras
  lines.push(`    </packagedElement>`);
  lines.push(`  </uml:Model>`);
  lines.push(`</xmi:XMI>`);

  return lines.join("\n");
}
