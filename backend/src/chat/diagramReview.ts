import {
  UmlAttribute,
  UmlClass,
  UmlModel,
  UmlRelation,
} from "../backendGenerator/types";

export interface Finding {
  code: string;
  severity: "importante" | "recomendado";
  classNames: string[];
  message: string;
  fix: string;
}

/**
 * Normaliza un texto removiendo espacios iniciales/finales, convirtiendo a minúsculas
 * y eliminando tildes y marcas diacríticas.
 */
function normalizeText(text: string): string {
  return (text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Determina si el nombre de un atributo parece un identificador primario:
 * igual a "id" o que empiece con "id" o "cod" tras normalizar.
 */
function looksLikeId(attrName: string): boolean {
  const norm = normalizeText(attrName);
  return norm === "id" || norm.startsWith("id") || norm.startsWith("cod");
}

/**
 * Determina si una clase es hija de otra en una relación de herencia
 * (convención: sourceClassId = hija, targetClassId = padre).
 */
function isChildClass(classId: string, relations: UmlRelation[]): boolean {
  return relations.some(
    (r) => r.relationType === "inheritance" && r.sourceClassId === classId
  );
}

/**
 * Determina si dos nombres de clase forman un par singular/plural en español.
 */
function areSingularPluralPair(nameA: string, nameB: string): boolean {
  const normA = normalizeText(nameA);
  const normB = normalizeText(nameB);
  if (!normA || !normB || normA === normB) return false;

  const [shortStr, longStr] =
    normA.length <= normB.length ? [normA, normB] : [normB, normA];

  // Plural regular con 's' (e.g. cliente -> clientes, usuario -> usuarios)
  if (shortStr + "s" === longStr) return true;

  // Plural con 'es' (e.g. orden -> ordenes, rol -> roles, ciudad -> ciudades)
  if (shortStr + "es" === longStr) return true;

  // Plural con cambio de 'z' a 'ces' (e.g. lapiz -> lapices, pez -> peces)
  if (shortStr.endsWith("z") && shortStr.slice(0, -1) + "ces" === longStr) {
    return true;
  }

  return false;
}

/**
 * Detecta problemas en la jerarquía de herencia: clases hijas con más de un padre
 * y ciclos de herencia.
 */
function detectInheritanceProblems(
  classes: UmlClass[],
  relations: UmlRelation[]
): { multiParentClassNames: string[]; cycleClassNames: string[] } {
  const inhRels = relations.filter((r) => r.relationType === "inheritance");
  const classMap = new Map<string, string>();
  for (const c of classes) {
    classMap.set(c.id, c.className);
  }

  // 1. Clases con múltiples padres
  const parentsByChild = new Map<string, Set<string>>();
  for (const r of inhRels) {
    if (!r.sourceClassId || !r.targetClassId) continue;
    const parents = parentsByChild.get(r.sourceClassId) ?? new Set<string>();
    parents.add(r.targetClassId);
    parentsByChild.set(r.sourceClassId, parents);
  }

  const multiParentClassNames: string[] = [];
  for (const [childId, parents] of parentsByChild.entries()) {
    if (parents.size > 1) {
      multiParentClassNames.push(classMap.get(childId) || childId);
    }
  }

  // 2. Ciclos de herencia (DFS)
  const adj = new Map<string, string[]>();
  const selfLoops = new Set<string>();
  for (const r of inhRels) {
    if (!r.sourceClassId || !r.targetClassId) continue;
    if (r.sourceClassId === r.targetClassId) {
      selfLoops.add(r.sourceClassId);
    }
    const list = adj.get(r.sourceClassId) ?? [];
    list.push(r.targetClassId);
    adj.set(r.sourceClassId, list);
  }

  const cycleNodeIds = new Set<string>(selfLoops);
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(node: string, path: string[]) {
    visited.add(node);
    inStack.add(node);
    path.push(node);

    const neighbors = adj.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, path);
      } else if (inStack.has(neighbor)) {
        const idx = path.indexOf(neighbor);
        if (idx >= 0) {
          for (let i = idx; i < path.length; i++) {
            cycleNodeIds.add(path[i]);
          }
        } else {
          cycleNodeIds.add(neighbor);
          cycleNodeIds.add(node);
        }
      }
    }

    inStack.delete(node);
    path.pop();
  }

  for (const node of adj.keys()) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  const cycleClassNames = Array.from(cycleNodeIds).map(
    (id) => classMap.get(id) || id
  );

  return { multiParentClassNames, cycleClassNames };
}

// ==========================================
// Reglas de Revisión (R1 - R10)
// ==========================================

/**
 * R1 (recomendado): clase sin atributos y que NO es hija de otra.
 */
function checkR1(classes: UmlClass[], relations: UmlRelation[]): Finding | null {
  const affected: string[] = [];

  for (const c of classes) {
    if (isChildClass(c.id, relations)) continue;

    const hasNoAttrs = !c.attributes || c.attributes.length === 0;
    if (hasNoAttrs) {
      affected.push(c.className || c.id);
    }
  }

  const uniqueClasses = Array.from(new Set(affected));
  if (uniqueClasses.length === 0) return null;

  const fix =
    uniqueClasses.length === 1
      ? `@Codia agrega el atributo id a ${uniqueClasses[0]}`
      : "Edita cada clase para agregar sus atributos correspondientes haciendo doble clic en el lienzo o usando el chat para cada una.";

  const message =
    uniqueClasses.length === 1
      ? `La clase ${uniqueClasses[0]} no tiene atributos definidos y no es hija de otra clase.`
      : `Las clases ${uniqueClasses.join(", ")} no tienen atributos definidos y no son hijas de otra clase.`;

  return {
    code: "R1",
    severity: "recomendado",
    classNames: uniqueClasses,
    message,
    fix,
  };
}

/**
 * R2 (importante): clase NO hija, con al menos 1 atributo, cuyo primer atributo no parece identificador.
 */
function checkR2(classes: UmlClass[], relations: UmlRelation[]): Finding | null {
  const affected: string[] = [];

  for (const c of classes) {
    if (isChildClass(c.id, relations)) continue;
    if (!c.attributes || c.attributes.length === 0) continue;

    const firstAttr = c.attributes[0];
    const firstAttrName = firstAttr?.name || "";
    if (!looksLikeId(firstAttrName)) {
      affected.push(c.className || c.id);
    }
  }

  const uniqueClasses = Array.from(new Set(affected));
  if (uniqueClasses.length === 0) return null;

  const message =
    uniqueClasses.length === 1
      ? `El backend generado toma el primer atributo como clave primaria. En la clase ${uniqueClasses[0]}, el primer atributo no parece ser un identificador.`
      : `El backend generado toma el primer atributo como clave primaria. En las clases ${uniqueClasses.join(", ")}, el primer atributo no parece ser un identificador.`;

  return {
    code: "R2",
    severity: "importante",
    classNames: uniqueClasses,
    message,
    fix: "Haz doble clic sobre la clase en el lienzo y pon el identificador como primer atributo.",
  };
}

/**
 * R3 (recomendado): clase aislada (sin ninguna relación), solo si hay al menos 2 clases.
 */
function checkR3(classes: UmlClass[], relations: UmlRelation[]): Finding | null {
  if (classes.length < 2) return null;

  const connectedIds = new Set<string>();
  for (const r of relations) {
    if (r.sourceClassId) connectedIds.add(r.sourceClassId);
    if (r.targetClassId) connectedIds.add(r.targetClassId);
  }

  const affected: string[] = [];
  for (const c of classes) {
    if (!connectedIds.has(c.id)) {
      affected.push(c.className || c.id);
    }
  }

  const uniqueClasses = Array.from(new Set(affected));
  if (uniqueClasses.length === 0) return null;

  const message =
    uniqueClasses.length === 1
      ? `La clase ${uniqueClasses[0]} está aislada y no tiene ninguna relación con otras clases del diagrama.`
      : `Las clases ${uniqueClasses.join(", ")} están aisladas y no tienen ninguna relación con otras clases del diagrama.`;

  return {
    code: "R3",
    severity: "recomendado",
    classNames: uniqueClasses,
    message,
    fix: "Conecta las clases aisladas con otras entidades del modelo mediante relaciones según las reglas de negocio.",
  };
}

/**
 * R4 (recomendado): relación (que no sea herencia) con alguna multiplicidad vacía.
 */
function checkR4(classes: UmlClass[], relations: UmlRelation[]): Finding | null {
  const classMap = new Map<string, string>();
  for (const c of classes) {
    classMap.set(c.id, c.className);
  }

  const affectedClassNames: string[] = [];

  for (const rel of relations) {
    if (rel.relationType === "inheritance") continue;

    const multSrc =
      typeof rel.multiplicitySource === "string"
        ? rel.multiplicitySource.trim()
        : "";
    const multTgt =
      typeof rel.multiplicityTarget === "string"
        ? rel.multiplicityTarget.trim()
        : "";

    if (multSrc === "" || multTgt === "") {
      const nameSrc = classMap.get(rel.sourceClassId) || rel.sourceClassId;
      const nameTgt = classMap.get(rel.targetClassId) || rel.targetClassId;
      if (nameSrc) affectedClassNames.push(nameSrc);
      if (nameTgt) affectedClassNames.push(nameTgt);
    }
  }

  const uniqueClasses = Array.from(new Set(affectedClassNames));
  if (uniqueClasses.length === 0) return null;

  return {
    code: "R4",
    severity: "recomendado",
    classNames: uniqueClasses,
    message: `Se encontraron relaciones sin multiplicidad definida en uno o ambos extremos entre las clases: ${uniqueClasses.join(", ")}.`,
    fix: "Define las multiplicidades en ambos extremos de cada relación para especificar la cardinalidad correspondiente.",
  };
}

/**
 * R5 (recomendado): relación manyToMany, o con "*" en ambos extremos, sin clase intermedia.
 */
function checkR5(classes: UmlClass[], relations: UmlRelation[]): Finding | null {
  const classMap = new Map<string, UmlClass>();
  for (const c of classes) {
    classMap.set(c.id, c);
  }

  const affectedClassNames: string[] = [];
  const suggestedClassNames: string[] = [];

  for (const rel of relations) {
    if (rel.relationType === "inheritance") continue;

    const isMtoN =
      rel.relationType === "manyToMany" ||
      (typeof rel.multiplicitySource === "string" &&
        rel.multiplicitySource.includes("*") &&
        typeof rel.multiplicityTarget === "string" &&
        rel.multiplicityTarget.includes("*"));

    if (!isMtoN) continue;

    const classA = classMap.get(rel.sourceClassId);
    const classB = classMap.get(rel.targetClassId);
    if (!classA || !classB) continue;

    // Verificar si existe una clase intermedia C conectada a A y a B
    const hasIntermediate = classes.some((other) => {
      if (other.id === classA.id || other.id === classB.id) return false;
      const connectedToA = relations.some(
        (r) =>
          (r.sourceClassId === other.id && r.targetClassId === classA.id) ||
          (r.targetClassId === other.id && r.sourceClassId === classA.id)
      );
      const connectedToB = relations.some(
        (r) =>
          (r.sourceClassId === other.id && r.targetClassId === classB.id) ||
          (r.targetClassId === other.id && r.sourceClassId === classB.id)
      );
      return connectedToA && connectedToB;
    });

    if (!hasIntermediate) {
      affectedClassNames.push(classA.className, classB.className);
      const cleanA = classA.className.replace(/\s+/g, "");
      const cleanB = classB.className.replace(/\s+/g, "");
      suggestedClassNames.push(`${cleanA}${cleanB}`);
    }
  }

  const uniqueClasses = Array.from(new Set(affectedClassNames));
  if (uniqueClasses.length === 0) return null;

  const fixCmd =
    suggestedClassNames.length > 0
      ? `@Codia crea la clase ${suggestedClassNames[0]}`
      : "@Codia crea una clase intermedia";

  return {
    code: "R5",
    severity: "recomendado",
    classNames: uniqueClasses,
    message: `Se detectaron relaciones de muchos a muchos directas sin clase intermedia entre: ${uniqueClasses.join(", ")}.`,
    fix: fixCmd,
  };
}

/**
 * R6 (importante / recomendado):
 * - importante: nombres de clase duplicados ignorando mayúsculas y tildes.
 * - recomendado: pares singular/plural (Cliente y Clientes).
 */
function checkR6(classes: UmlClass[]): Finding | null {
  // 1. Nombres duplicados (importante)
  const nameGroups = new Map<string, string[]>();
  for (const c of classes) {
    const norm = normalizeText(c.className || "");
    if (!norm) continue;
    const group = nameGroups.get(norm) ?? [];
    group.push(c.className);
    nameGroups.set(norm, group);
  }

  const duplicateClassNames: string[] = [];
  for (const group of nameGroups.values()) {
    if (group.length > 1) {
      duplicateClassNames.push(...group);
    }
  }

  const uniqueDuplicates = Array.from(new Set(duplicateClassNames));
  if (uniqueDuplicates.length > 0) {
    return {
      code: "R6",
      severity: "importante",
      classNames: uniqueDuplicates,
      message: `Se encontraron nombres de clase duplicados ignorando mayúsculas y tildes: ${uniqueDuplicates.join(", ")}.`,
      fix: "Modifica el nombre de las clases duplicadas en el lienzo para que cada una tenga un nombre único.",
    };
  }

  // 2. Pares singular/plural (recomendado)
  const singularPluralNames: string[] = [];
  for (let i = 0; i < classes.length; i++) {
    for (let j = i + 1; j < classes.length; j++) {
      const nameA = classes[i].className;
      const nameB = classes[j].className;
      if (areSingularPluralPair(nameA, nameB)) {
        singularPluralNames.push(nameA, nameB);
      }
    }
  }

  const uniqueSingularPlural = Array.from(new Set(singularPluralNames));
  if (uniqueSingularPlural.length > 0) {
    return {
      code: "R6",
      severity: "recomendado",
      classNames: uniqueSingularPlural,
      message: `Se encontraron clases con nombres en singular y plural (${uniqueSingularPlural.join(", ")}). Se recomienda mantener una convención uniforme en singular.`,
      fix: "Revisa si ambas clases representan la misma entidad y conserva una sola clase con nombre en singular.",
    };
  }

  return null;
}

/**
 * R7 (importante): atributos repetidos dentro de una clase (ignorando mayúsculas y tildes).
 */
function checkR7(classes: UmlClass[]): Finding | null {
  const affected: string[] = [];

  for (const c of classes) {
    if (!c.attributes || c.attributes.length < 2) continue;
    const seen = new Set<string>();
    let hasDup = false;
    for (const attr of c.attributes) {
      const norm = normalizeText(attr?.name || "");
      if (!norm) continue;
      if (seen.has(norm)) {
        hasDup = true;
        break;
      }
      seen.add(norm);
    }
    if (hasDup) {
      affected.push(c.className || c.id);
    }
  }

  const uniqueClasses = Array.from(new Set(affected));
  if (uniqueClasses.length === 0) return null;

  return {
    code: "R7",
    severity: "importante",
    classNames: uniqueClasses,
    message: `Se encontraron atributos repetidos dentro de la misma clase (ignorando mayúsculas y tildes) en: ${uniqueClasses.join(", ")}.`,
    fix: "Haz doble clic sobre cada clase afectada en el lienzo para revisar y corregir los atributos repetidos.",
  };
}

/**
 * R8 (recomendado): nombres de clase que no empiezan con mayúscula o llevan espacios, en una sola Finding.
 */
function checkR8(classes: UmlClass[]): Finding | null {
  const affected: string[] = [];

  for (const c of classes) {
    const rawName = c.className || "";
    const trimmed = rawName.trim();
    if (!trimmed) {
      affected.push(rawName || "SinNombre");
      continue;
    }

    const startsWithUpper = /^[A-ZÁÉÍÓÚÑ]/.test(trimmed);
    const hasSpaces = /\s/.test(trimmed);

    if (!startsWithUpper || hasSpaces) {
      affected.push(rawName);
    }
  }

  const uniqueClasses = Array.from(new Set(affected));
  if (uniqueClasses.length === 0) return null;

  return {
    code: "R8",
    severity: "recomendado",
    classNames: uniqueClasses,
    message: `Los siguientes nombres de clase no inician con mayúscula o contienen espacios: ${uniqueClasses.join(", ")}.`,
    fix: "Haz doble clic sobre cada clase afectada en el lienzo para ajustar su nombre al formato PascalCase sin espacios.",
  };
}

/**
 * R9 (importante): una clase hija con más de un padre, o ciclos de herencia.
 */
function checkR9(classes: UmlClass[], relations: UmlRelation[]): Finding | null {
  const { multiParentClassNames, cycleClassNames } = detectInheritanceProblems(
    classes,
    relations
  );

  const combined = Array.from(
    new Set([...multiParentClassNames, ...cycleClassNames])
  );
  if (combined.length === 0) return null;

  return {
    code: "R9",
    severity: "importante",
    classNames: combined,
    message: `Se detectaron clases hijas con más de un padre o ciclos en la jerarquía de herencia en: ${combined.join(", ")}.`,
    fix: "Ajusta las relaciones de herencia en la pizarra para que cada clase tenga como máximo un padre y no existan ciclos.",
  };
}

/**
 * R10 (recomendado): relaciones duplicadas entre el mismo par de clases y del mismo tipo.
 */
function checkR10(classes: UmlClass[], relations: UmlRelation[]): Finding | null {
  const classMap = new Map<string, string>();
  for (const c of classes) {
    classMap.set(c.id, c.className);
  }

  const affectedClassNames: string[] = [];

  for (let i = 0; i < relations.length; i++) {
    for (let j = i + 1; j < relations.length; j++) {
      const r1 = relations[i];
      const r2 = relations[j];

      if (r1.relationType !== r2.relationType) continue;

      const samePair =
        (r1.sourceClassId === r2.sourceClassId &&
          r1.targetClassId === r2.targetClassId) ||
        (r1.sourceClassId === r2.targetClassId &&
          r1.targetClassId === r2.sourceClassId);

      if (samePair && r1.sourceClassId && r1.targetClassId) {
        const nameA = classMap.get(r1.sourceClassId) || r1.sourceClassId;
        const nameB = classMap.get(r1.targetClassId) || r1.targetClassId;
        affectedClassNames.push(nameA, nameB);
      }
    }
  }

  const uniqueClasses = Array.from(new Set(affectedClassNames));
  if (uniqueClasses.length === 0) return null;

  return {
    code: "R10",
    severity: "recomendado",
    classNames: uniqueClasses,
    message: `Existen relaciones redundantes del mismo tipo entre las clases: ${uniqueClasses.join(", ")}.`,
    fix: "Elimina las relaciones duplicadas en la pizarra para conservar una sola relación del mismo tipo entre cada par de clases.",
  };
}

// ==========================================
// Función Principal
// ==========================================

/**
 * Revisa el modelo UML calculando observaciones y sugerencias de mejora
 * a partir de 10 reglas del servidor.
 *
 * @param model Modelo UML a evaluar.
 * @returns Hasta 6 observaciones ordenadas con "importante" primero, o [] si no hay hallazgos o el modelo está vacío.
 */
export function reviewModel(model: UmlModel): Finding[] {
  if (
    !model ||
    !Array.isArray(model.classes) ||
    model.classes.length === 0
  ) {
    return [];
  }

  const classes = model.classes;
  const relations = Array.isArray(model.relations) ? model.relations : [];

  const rawFindings: (Finding | null)[] = [
    checkR1(classes, relations),
    checkR2(classes, relations),
    checkR3(classes, relations),
    checkR4(classes, relations),
    checkR5(classes, relations),
    checkR6(classes),
    checkR7(classes),
    checkR8(classes),
    checkR9(classes, relations),
    checkR10(classes, relations),
  ];

  const findings = rawFindings.filter((f): f is Finding => f !== null);

  if (findings.length === 0) {
    return [];
  }

  // Ordenar: primero las de severidad "importante", luego "recomendado"
  findings.sort((a, b) => {
    if (a.severity === b.severity) return 0;
    return a.severity === "importante" ? -1 : 1;
  });

  // Salida acotada a máximo 6 hallazgos
  return findings.slice(0, 6);
}

// ==========================================
// Formateadores de Revisión (CU21 Fase 1B)
// ==========================================

/**
 * Límite máximo de caracteres por mensaje de chat según la base de datos (chatRepository)
 * y el servidor de sockets (socket.ts).
 */
export const MAX_CHAT_MESSAGE_LENGTH = 2000;

/**
 * Formatea una lista de observaciones para ser inyectada en el prompt de la IA.
 * Lista numerada en texto plano, sin markdown.
 *
 * Formato por observación:
 * "1. [importante] Clases: A, B. <message> Frase sugerida: <fix>"
 * Si la fix no es una frase para el chat (no empieza con "@Codia"), usa "Qué hacer: <fix>".
 */
export function formatFindingsForPrompt(findings: Finding[]): string {
  if (!Array.isArray(findings) || findings.length === 0) {
    return "";
  }

  return findings
    .map((f, idx) => {
      const num = idx + 1;
      const classesStr =
        Array.isArray(f.classNames) && f.classNames.length > 0
          ? f.classNames.join(", ")
          : "Ninguna";
      const cleanMsg = (f.message || "").trim().replace(/\.*$/, "") + ".";
      const fix = (f.fix || "").trim();
      const isChatPhrase = fix.startsWith("@Codia");
      const actionLabel = isChatPhrase ? "Frase sugerida:" : "Qué hacer:";

      return `${num}. [${f.severity}] Clases: ${classesStr}. ${cleanMsg} ${actionLabel} ${fix}`;
    })
    .join("\n");
}

/**
 * Mensaje fallback que se publica en el chat cuando ningún proveedor de IA responde.
 * Texto plano, sin markdown, dirigido por nombre y acotado al límite de 2000 caracteres del chat.
 */
export function formatFindingsFallback(
  findings: Finding[],
  askerName: string
): string {
  if (!Array.isArray(findings) || findings.length === 0) {
    return formatNoFindingsMessage(askerName);
  }

  const cleanAsker = (askerName || "").trim();
  const count = findings.length;
  const obsWord = count === 1 ? "1 observación" : `${count} observaciones`;
  const header = cleanAsker
    ? `${cleanAsker}, revisé el diagrama y encontré ${obsWord}:`
    : `Revisé el diagrama y encontré ${obsWord}:`;

  const items = findings.map((f, idx) => {
    const num = idx + 1;
    const cleanMsg = (f.message || "").trim().replace(/\.*$/, "") + ".";
    const fix = (f.fix || "").trim();
    const isChat = fix.startsWith("@Codia");
    const actionLabel = isChat ? "Frase sugerida:" : "Qué hacer:";
    return `${num}. [${f.severity}] ${cleanMsg} ${actionLabel} ${fix}`;
  });

  const footer =
    "Si quieres que aplique algún cambio, pídemelo en el chat mencionando a @Codia o ajusta los elementos en la pizarra.";

  let result = `${header}\n\n${items.join("\n")}\n\n${footer}`;

  if (result.length > MAX_CHAT_MESSAGE_LENGTH) {
    result = result.slice(0, MAX_CHAT_MESSAGE_LENGTH - 3).trimEnd() + "...";
  }

  return result;
}

/**
 * Mensaje breve cuando la revisión del modelo no arrojó observaciones.
 * Dirigido por nombre, tono cercano, sin saludo ni presentación, sin markdown.
 */
export function formatNoFindingsMessage(askerName: string): string {
  const cleanAsker = (askerName || "").trim();
  if (cleanAsker) {
    return `${cleanAsker}, revisé el diagrama y no encontré problemas de estructura.`;
  }
  return "Revisé el diagrama y no encontré problemas de estructura.";
}

/**
 * Mensaje cuando el diagrama está vacío.
 * Dirigido por nombre, tono cercano, sin markdown.
 */
export function formatEmptyDiagramMessage(askerName: string): string {
  const cleanAsker = (askerName || "").trim();
  if (cleanAsker) {
    return `${cleanAsker}, el diagrama está vacío y no hay elementos para revisar.`;
  }
  return "El diagrama está vacío y no hay elementos para revisar.";
}

