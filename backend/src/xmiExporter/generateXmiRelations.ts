import { UmlRelation } from "../backendGenerator/types";
import { escapeXml } from "./generateXmi";

export interface MultiplicityBounds {
  lowerValue: number;
  lowerType: "uml:LiteralInteger";
  upperValue: number;
  upperType: "uml:LiteralInteger" | "uml:LiteralUnlimitedNatural";
}

/**
 * Mapea una multiplicidad textual UML a sus límites y tipos XMI 2.1.
 *
 * Mapeo:
 *  - "1" -> lowerValue=1, upperValue=1 (ambos uml:LiteralInteger)
 *  - "0..1" -> lower=0, upper=1 (ambos uml:LiteralInteger)
 *  - "0..*" o "*" -> lower=0 (uml:LiteralInteger), upper=-1 (uml:LiteralUnlimitedNatural)
 *  - "1..*" -> lower=1 (uml:LiteralInteger), upper=-1 (uml:LiteralUnlimitedNatural)
 *  - Cualquier otro valor -> fallback a "1"
 */
export function parseMultiplicity(mult?: string): MultiplicityBounds {
  const normalized = (mult || "").trim();

  switch (normalized) {
    case "0..1":
      return {
        lowerValue: 0,
        lowerType: "uml:LiteralInteger",
        upperValue: 1,
        upperType: "uml:LiteralInteger"
      };
    case "0..*":
    case "*":
      return {
        lowerValue: 0,
        lowerType: "uml:LiteralInteger",
        upperValue: -1,
        upperType: "uml:LiteralUnlimitedNatural"
      };
    case "1..*":
      return {
        lowerValue: 1,
        lowerType: "uml:LiteralInteger",
        upperValue: -1,
        upperType: "uml:LiteralUnlimitedNatural"
      };
    case "1":
    default:
      return {
        lowerValue: 1,
        lowerType: "uml:LiteralInteger",
        upperValue: 1,
        upperType: "uml:LiteralInteger"
      };
  }
}

/**
 * Determina si una relación es Muchos a Muchos (Regla 2).
 * La detección depende EXCLUSIVAMENTE de que multiplicitySource y multiplicityTarget
 * contengan "*".
 */
export function isManyToMany(rel: UmlRelation): boolean {
  const multSource = (rel.multiplicitySource || "").trim() || "1";
  const multTarget = (rel.multiplicityTarget || "").trim() || "1";
  return multSource.includes("*") && multTarget.includes("*");
}

/**
 * Determina el tipo de agregación en el extremo destino (target).
 */
export function getTargetAggregation(rel: UmlRelation): "none" | "shared" | "composite" {
  if (isManyToMany(rel)) {
    return "none";
  }

  if (rel.relationType === "composition") {
    return "composite";
  }

  if (rel.relationType === "aggregation") {
    return "shared";
  }

  return "none";
}

/**
 * Genera el elemento <generalization> para relaciones de tipo herencia (Regla 1).
 */
export function renderGeneralization(rel: UmlRelation, indent: string = "        "): string {
  const sourceId = escapeXml(rel.sourceClassId);
  const targetId = escapeXml(rel.targetClassId);
  return `${indent}<generalization xmi:type="uml:Generalization" xmi:id="gen_${sourceId}_${targetId}" general="cls_${targetId}" isSubstitutable="true"/>`;
}

/**
 * Genera el bloque <packagedElement xmi:type="uml:Association"> para una relación dada (Regla 3).
 */
export function renderAssociation(rel: UmlRelation, seenAssocIds?: Set<string>): string[] {
  const rawAssocId = `assoc_${escapeXml(rel.sourceClassId)}_${escapeXml(rel.targetClassId)}`;
  let assocId = rawAssocId;

  if (seenAssocIds) {
    if (seenAssocIds.has(assocId)) {
      let counter = 2;
      while (seenAssocIds.has(`${rawAssocId}_${counter}`)) {
        counter++;
      }
      assocId = `${rawAssocId}_${counter}`;
    }
    seenAssocIds.add(assocId);
  }

  const srcEndId = `end_${assocId}_src`;
  const dstEndId = `end_${assocId}_dst`;

  const multSource = (rel.multiplicitySource || "").trim() || "1";
  const multTarget = (rel.multiplicityTarget || "").trim() || "1";

  const srcBounds = parseMultiplicity(multSource);
  const dstBounds = parseMultiplicity(multTarget);

  const targetAggregation = getTargetAggregation(rel);

  const lines: string[] = [];
  lines.push(`      <packagedElement xmi:type="uml:Association" xmi:id="${assocId}" visibility="public">`);
  lines.push(`        <memberEnd xmi:idref="${srcEndId}"/>`);
  lines.push(`        <memberEnd xmi:idref="${dstEndId}"/>`);

  // Extremo source: aggregation="none" SIEMPRE
  lines.push(
    `        <ownedEnd xmi:type="uml:Property" xmi:id="${srcEndId}" visibility="public" association="${assocId}" isStatic="false" isReadOnly="false" isDerived="false" isOrdered="false" isDerivedUnion="false" isUnique="true" aggregation="none">`
  );
  lines.push(`          <type xmi:idref="cls_${escapeXml(rel.sourceClassId)}"/>`);
  lines.push(`          <lowerValue xmi:type="${srcBounds.lowerType}" value="${srcBounds.lowerValue}"/>`);
  lines.push(`          <upperValue xmi:type="${srcBounds.upperType}" value="${srcBounds.upperValue}"/>`);
  lines.push(`        </ownedEnd>`);

  // Extremo target: aggregation según relationType y N:M
  lines.push(
    `        <ownedEnd xmi:type="uml:Property" xmi:id="${dstEndId}" visibility="public" association="${assocId}" isStatic="false" isReadOnly="false" isDerived="false" isOrdered="false" isDerivedUnion="false" isUnique="true" aggregation="${targetAggregation}">`
  );
  lines.push(`          <type xmi:idref="cls_${escapeXml(rel.targetClassId)}"/>`);
  lines.push(`          <lowerValue xmi:type="${dstBounds.lowerType}" value="${dstBounds.lowerValue}"/>`);
  lines.push(`          <upperValue xmi:type="${dstBounds.upperType}" value="${dstBounds.upperValue}"/>`);
  lines.push(`        </ownedEnd>`);

  lines.push(`      </packagedElement>`);

  return lines;
}
