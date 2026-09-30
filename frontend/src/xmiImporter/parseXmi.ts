export interface UmlAttribute {
  name: string;
  type: "String" | "Integer" | "Long" | "Boolean" | "Double" | "Date";
  visibility: "public" | "private" | "protected";
}

export interface UmlMethod {
  name: string;
  returnType: "String" | "Integer" | "Long" | "Boolean" | "Double" | "Date" | "void";
  visibility: "public" | "private" | "protected";
}

export interface UmlClass {
  id: string;
  className: string;
  attributes: UmlAttribute[];
  methods: UmlMethod[];
}

export type UmlRelationType =
  | "association"
  | "inheritance"
  | "composition"
  | "aggregation"
  | "manyToMany";

export interface UmlRelation {
  relationType: UmlRelationType;
  sourceClassId: string;
  targetClassId: string;
  multiplicitySource: string;
  multiplicityTarget: string;
}

export interface UmlModel {
  classes: UmlClass[];
  relations: UmlRelation[];
}

export interface ParseXmiStats {
  classes: number;
  relations: number;
  ignoredElements: number;
  discardedRelations: number;
}

export interface ParseXmiResult {
  model: UmlModel;
  stats: ParseXmiStats;
}

const ERROR_MESSAGE = "El archivo no es un XMI válido o no contiene clases";

/**
 * Normaliza la visibilidad UML ("public", "private", "protected") con fallback a "public".
 */
function parseVisibility(vis: string | null | undefined): "public" | "private" | "protected" {
  if (vis === "private" || vis === "protected" || vis === "public") {
    return vis;
  }
  return "public";
}

/**
 * Resuelve el tipo UML a uno de los tipos soportados por la aplicación.
 */
function resolveUmlType(
  elem: Element,
  dataTypeMap: Map<string, string>,
  isOperationReturn: boolean = false
): "String" | "Integer" | "Long" | "Boolean" | "Double" | "Date" | "void" {
  let typeStr = "";

  // 1. Buscar elemento hijo <type>
  const typeChild = Array.from(elem.children).find((c) => c.localName === "type");
  if (typeChild) {
    const href = typeChild.getAttribute("href") || "";
    const idref = typeChild.getAttribute("xmi:idref") || typeChild.getAttribute("idref") || "";
    const name = typeChild.getAttribute("name") || "";
    const xmiType = typeChild.getAttribute("xmi:type") || typeChild.getAttribute("type") || "";

    if (href) {
      const hashIndex = href.indexOf("#");
      typeStr = hashIndex !== -1 ? href.slice(hashIndex + 1) : href;
    } else if (idref) {
      typeStr = dataTypeMap.get(idref) || idref;
    } else if (name) {
      typeStr = name;
    } else if (xmiType && xmiType !== "uml:PrimitiveType") {
      typeStr = xmiType;
    }
  }

  // 2. Si no hay <type> hijo, revisar atributo type en el elemento
  if (!typeStr) {
    const typeAttr = elem.getAttribute("type");
    if (typeAttr) {
      if (typeAttr.includes("#")) {
        typeStr = typeAttr.split("#")[1];
      } else {
        typeStr = dataTypeMap.get(typeAttr) || typeAttr;
      }
    }
  }

  if (!typeStr) {
    return isOperationReturn ? "void" : "String";
  }

  const normalized = typeStr.trim().toLowerCase();

  if (
    normalized.endsWith("integer") ||
    normalized.endsWith("int") ||
    normalized.endsWith("unlimitednatural")
  ) {
    return "Integer";
  }
  if (normalized.endsWith("string")) {
    return "String";
  }
  if (normalized.endsWith("boolean") || normalized.endsWith("bool")) {
    return "Boolean";
  }
  if (
    normalized.endsWith("real") ||
    normalized.endsWith("double") ||
    normalized.endsWith("float")
  ) {
    return "Double";
  }
  if (normalized.endsWith("long") || normalized === "dt_long") {
    return "Long";
  }
  if (normalized.endsWith("date") || normalized === "dt_date") {
    return "Date";
  }
  if (normalized === "void") {
    return "void";
  }

  return isOperationReturn ? "void" : "String";
}

/**
 * Resuelve la multiplicidad textual de un extremo ("1", "0..1", "0..*", "1..*", "*").
 */
function parseEndMultiplicity(endElem: Element): string {
  const lowerElem = Array.from(endElem.children).find((c) => c.localName === "lowerValue");
  const upperElem = Array.from(endElem.children).find((c) => c.localName === "upperValue");

  if (!lowerElem && !upperElem) {
    // Si faltan ambos nodos, es "1"
    return "1";
  }

  const lower = lowerElem ? lowerElem.getAttribute("value") ?? "0" : "1";
  const upper = upperElem ? upperElem.getAttribute("value") ?? "1" : "1";

  const isUpperUnlimited =
    upper === "-1" ||
    upper === "*" ||
    (upperElem?.getAttribute("xmi:type") === "uml:LiteralUnlimitedNatural" && upper === "-1");

  if (isUpperUnlimited) {
    if (lower === "0") {
      return "0..*";
    }
    if (lower === "1") {
      return "1..*";
    }
    return "*";
  }

  if (lower === "0" && upper === "1") {
    return "0..1";
  }
  if (lower === "1" && upper === "1") {
    return "1";
  }
  if (lower === upper) {
    return lower;
  }

  return `${lower}..${upper}`;
}

/**
 * Obtiene el ID de clase asociado a un extremo de asociación.
 */
function getEndClassId(endElem: Element, allClassIds: Set<string>): string | null {
  // 1. Si el extremo está dentro de una uml:Class (caso Enterprise Architect ownedAttribute),
  // y su atributo type/idref apunta a la OTRA clase, o es propiedad de esta clase:
  // Verificamos si tiene un <type xmi:idref="..."> o type="..." que apunte a una clase conocida:
  const typeChild = Array.from(endElem.children).find((c) => c.localName === "type");
  if (typeChild) {
    const idref = typeChild.getAttribute("xmi:idref") || typeChild.getAttribute("idref");
    if (idref && allClassIds.has(idref)) return idref;
    const href = typeChild.getAttribute("href");
    if (href && href.includes("#")) {
      const fragment = href.split("#")[1];
      if (allClassIds.has(fragment)) return fragment;
    }
  }
  const typeAttr = endElem.getAttribute("type");
  if (typeAttr && allClassIds.has(typeAttr)) return typeAttr;

  // 2. Si no tiene type apuntando a una clase, verificar si es un ownedAttribute dentro de una clase
  let curr: Element | null = endElem.parentElement;
  while (curr) {
    const xmiType = curr.getAttribute("xmi:type") || curr.getAttribute("type");
    const localName = curr.localName;
    if (xmiType === "uml:Class" || (localName === "Class" && !xmiType)) {
      const clsId = curr.getAttribute("xmi:id") || curr.getAttribute("id");
      if (clsId && allClassIds.has(clsId)) {
        return clsId;
      }
    }
    curr = curr.parentElement;
  }

  // 3. Fallback: idref en typeChild sin verificar allClassIds (para que se pueda descartar como huérfano)
  if (typeChild) {
    const idref = typeChild.getAttribute("xmi:idref") || typeChild.getAttribute("idref");
    if (idref) return idref;
  }
  if (typeAttr) return typeAttr;

  return null;
}

/**
 * Determina el tipo de packagedElement.
 */
function getPackagedElementType(elem: Element): string {
  const xmiType = elem.getAttribute("xmi:type") || elem.getAttribute("type");
  if (xmiType) return xmiType;
  return `uml:${elem.localName}`;
}

/**
 * Parsea un documento XML en formato XMI 2.1 e importa el UmlModel y estadísticas.
 */
export function parseXmi(xmlText: string): ParseXmiResult {
  if (!xmlText || typeof xmlText !== "string" || !xmlText.trim()) {
    throw new Error(ERROR_MESSAGE);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");

  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    throw new Error(ERROR_MESSAGE);
  }

  const root = doc.documentElement;
  if (!root) {
    throw new Error(ERROR_MESSAGE);
  }

  // Validar que sea un archivo XML XMI o UML
  const rootName = root.localName.toLowerCase();
  const isXmiRoot =
    rootName === "xmi" ||
    rootName === "model" ||
    root.hasAttribute("xmi:version") ||
    root.hasAttribute("xmlns:xmi") ||
    root.getElementsByTagName("uml:Model").length > 0 ||
    Array.from(root.getElementsByTagName("*")).some((el) => el.localName === "Model");

  if (!isXmiRoot) {
    throw new Error(ERROR_MESSAGE);
  }

  // Localizar contenedor Model
  let modelElem: Element | null = null;
  if (root.localName === "Model") {
    modelElem = root;
  } else {
    modelElem =
      Array.from(root.children).find((c) => c.localName === "Model") ||
      doc.querySelector("Model, uml\\:Model") ||
      root;
  }

  const stats: ParseXmiStats = {
    classes: 0,
    relations: 0,
    ignoredElements: 0,
    discardedRelations: 0,
  };

  const dataTypeMap = new Map<string, string>();
  const classElements: Element[] = [];
  const associationElements: Element[] = [];

  // Contenedores a inspeccionar: modelElem y paquetes de primer nivel
  const firstLevelContainers: Element[] = [modelElem];

  // Explorar hijos directos de modelElem
  for (const child of Array.from(modelElem.children)) {
    if (child.localName === "packagedElement" || child.localName === "Package") {
      const type = getPackagedElementType(child);
      if (type === "uml:Package") {
        firstLevelContainers.push(child);
      }
    }
  }

  // Procesar elementos en los contenedores
  const processedElementIds = new Set<string>();

  for (const container of firstLevelContainers) {
    const isModelRootContainer = container === modelElem;

    for (const child of Array.from(container.children)) {
      const elemId = child.getAttribute("xmi:id") || child.getAttribute("id") || "";
      if (elemId && processedElementIds.has(elemId)) {
        continue;
      }

      // Ignorar xmi:Extension y xmi:Documentation en silencio
      if (
        child.localName === "Extension" ||
        child.localName === "Documentation" ||
        child.tagName.startsWith("xmi:Extension") ||
        child.tagName.startsWith("xmi:Documentation")
      ) {
        continue;
      }

      const pType = getPackagedElementType(child);

      if (pType === "uml:Package") {
        if (!isModelRootContainer) {
          // Paquete anidado de nivel > 1: ignorado
          stats.ignoredElements++;
        }
        // Si es primer nivel dentro de Model, ya se agregó a firstLevelContainers
        continue;
      }

      if (elemId) {
        processedElementIds.add(elemId);
      }

      if (pType === "uml:Class") {
        classElements.push(child);
      } else if (pType === "uml:Association") {
        associationElements.push(child);
      } else if (pType === "uml:DataType") {
        const dtName = child.getAttribute("name") || "";
        if (elemId && dtName) {
          dataTypeMap.set(elemId, dtName);
        }
      } else if (
        pType === "uml:Interface" ||
        pType === "uml:Enumeration" ||
        child.localName === "packagedElement"
      ) {
        stats.ignoredElements++;
      }
    }
  }

  if (classElements.length === 0) {
    throw new Error(ERROR_MESSAGE);
  }

  // Recolectar IDs de memberEnd referenciados por asociaciones
  const assocMemberEndIds = new Set<string>();
  for (const assoc of associationElements) {
    for (const child of Array.from(assoc.children)) {
      if (child.localName === "memberEnd") {
        const idref = child.getAttribute("xmi:idref") || child.getAttribute("idref");
        if (idref) assocMemberEndIds.add(idref);
      }
    }
  }

  // Mapear todas las propiedades disponibles (ownedEnd en asociaciones y ownedAttribute en clases)
  const allPropertyElementsById = new Map<string, Element>();
  const allPropertyElements: Element[] = [];

  for (const clsElem of classElements) {
    for (const child of Array.from(clsElem.children)) {
      if (child.localName === "ownedAttribute") {
        const pId = child.getAttribute("xmi:id") || child.getAttribute("id");
        if (pId) allPropertyElementsById.set(pId, child);
        allPropertyElements.push(child);
      }
    }
  }

  for (const assocElem of associationElements) {
    for (const child of Array.from(assocElem.children)) {
      if (child.localName === "ownedEnd") {
        const pId = child.getAttribute("xmi:id") || child.getAttribute("id");
        if (pId) allPropertyElementsById.set(pId, child);
        allPropertyElements.push(child);
      }
    }
  }

  // Extraer clases válidas
  const validClassIds = new Set<string>();
  const classes: UmlClass[] = [];

  for (const clsElem of classElements) {
    const classId = clsElem.getAttribute("xmi:id") || clsElem.getAttribute("id") || "";
    const className = clsElem.getAttribute("name") || "";
    validClassIds.add(classId);

    const attributes: UmlAttribute[] = [];
    const methods: UmlMethod[] = [];

    for (const child of Array.from(clsElem.children)) {
      if (child.localName === "ownedAttribute") {
        const attrId = child.getAttribute("xmi:id") || child.getAttribute("id") || "";
        const isAssocEnd = child.hasAttribute("association") || assocMemberEndIds.has(attrId);

        if (!isAssocEnd) {
          attributes.push({
            name: child.getAttribute("name") || "",
            type: resolveUmlType(child, dataTypeMap, false) as UmlAttribute["type"],
            visibility: parseVisibility(child.getAttribute("visibility")),
          });
        }
      } else if (child.localName === "ownedOperation") {
        const opName = child.getAttribute("name") || "";
        const opVis = parseVisibility(child.getAttribute("visibility"));

        // Buscar parámetro de retorno
        const returnParam = Array.from(child.children).find(
          (c) =>
            c.localName === "ownedParameter" &&
            (c.getAttribute("direction") === "return" || c.getAttribute("name") === "return")
        );

        let returnType: UmlMethod["returnType"] = "void";
        if (returnParam) {
          returnType = resolveUmlType(returnParam, dataTypeMap, true) as UmlMethod["returnType"];
        }
        if (returnType === "void") {
          returnType = resolveUmlType(child, dataTypeMap, true) as UmlMethod["returnType"];
        }

        methods.push({
          name: opName,
          visibility: opVis,
          returnType,
        });
      }
    }

    classes.push({
      id: classId,
      className,
      attributes,
      methods,
    });
  }

  const relations: UmlRelation[] = [];

  // Extraer Generalizaciones (Herencia)
  for (const clsElem of classElements) {
    const childClassId = clsElem.getAttribute("xmi:id") || clsElem.getAttribute("id") || "";

    for (const child of Array.from(clsElem.children)) {
      if (child.localName === "generalization") {
        let parentClassId = child.getAttribute("general") || "";
        if (!parentClassId) {
          const genChild = Array.from(child.children).find((c) => c.localName === "general");
          if (genChild) {
            parentClassId =
              genChild.getAttribute("xmi:idref") || genChild.getAttribute("idref") || "";
          }
        }

        if (!parentClassId || !validClassIds.has(parentClassId) || !validClassIds.has(childClassId)) {
          stats.discardedRelations++;
        } else {
          relations.push({
            relationType: "inheritance",
            sourceClassId: childClassId,
            targetClassId: parentClassId,
            multiplicitySource: "1",
            multiplicityTarget: "1",
          });
        }
      }
    }
  }

  // Extraer Asociaciones
  for (const assocElem of associationElements) {
    let end1: Element | null = null;
    let end2: Element | null = null;

    // 1. Por memberEnd
    const memberEndRefs = Array.from(assocElem.children)
      .filter((c) => c.localName === "memberEnd")
      .map((c) => c.getAttribute("xmi:idref") || c.getAttribute("idref"))
      .filter((id): id is string => Boolean(id));

    if (memberEndRefs.length >= 2) {
      end1 = allPropertyElementsById.get(memberEndRefs[0]) || null;
      end2 = allPropertyElementsById.get(memberEndRefs[1]) || null;
    }

    // 2. Por ownedEnd directamente en assocElem
    const ownedEnds = Array.from(assocElem.children).filter((c) => c.localName === "ownedEnd");
    if (!end1 && ownedEnds.length > 0) end1 = ownedEnds[0];
    if (!end2 && ownedEnds.length > 1) end2 = ownedEnds[1];

    // 3. Por ownedAttribute con atributo association
    if (!end1 || !end2) {
      const assocId = assocElem.getAttribute("xmi:id") || assocElem.getAttribute("id");
      if (assocId) {
        const referencingProps = allPropertyElements.filter(
          (p) => p.getAttribute("association") === assocId
        );
        if (!end1 && referencingProps.length > 0) end1 = referencingProps[0];
        if (!end2 && referencingProps.length > 1) end2 = referencingProps[1];
      }
    }

    if (!end1 || !end2) {
      stats.discardedRelations++;
      continue;
    }

    // Si los extremos son ownedAttribute dentro de clases, sus clases dueñas son esas clases.
    // De lo contrario, sus tipos referencian las clases.
    let srcClassId = getEndClassId(end1, validClassIds);
    let dstClassId = getEndClassId(end2, validClassIds);

    // En caso de que ambos extremos apunten a lo mismo o sean ownedAttributes cruzados:
    // Si end1 está en ClassA y su type apunta a ClassB, y end2 está en ClassB y apunta a ClassA:
    const end1ParentClass = end1.closest(
      "packagedElement[xmi\\:type='uml:Class'], packagedElement[type='uml:Class'], packagedElement"
    );
    const end2ParentClass = end2.closest(
      "packagedElement[xmi\\:type='uml:Class'], packagedElement[type='uml:Class'], packagedElement"
    );
    const p1Id =
      end1ParentClass?.getAttribute("xmi:id") || end1ParentClass?.getAttribute("id");
    const p2Id =
      end2ParentClass?.getAttribute("xmi:id") || end2ParentClass?.getAttribute("id");

    if (p1Id && p2Id && validClassIds.has(p1Id) && validClassIds.has(p2Id) && p1Id !== p2Id) {
      srcClassId = p1Id;
      dstClassId = p2Id;
    }

    if (!srcClassId || !dstClassId || !validClassIds.has(srcClassId) || !validClassIds.has(dstClassId)) {
      stats.discardedRelations++;
      continue;
    }

    const agg1 = end1.getAttribute("aggregation") || "none";
    const agg2 = end2.getAttribute("aggregation") || "none";
    const mult1 = parseEndMultiplicity(end1);
    const mult2 = parseEndMultiplicity(end2);

    let relationType: UmlRelationType = "association";
    let finalSourceId = srcClassId;
    let finalTargetId = dstClassId;
    let finalMultSource = mult1;
    let finalMultTarget = mult2;

    if (agg2 === "composite") {
      relationType = "composition";
      finalSourceId = srcClassId;
      finalTargetId = dstClassId;
      finalMultSource = mult1;
      finalMultTarget = mult2;
    } else if (agg1 === "composite") {
      relationType = "composition";
      finalSourceId = dstClassId;
      finalTargetId = srcClassId;
      finalMultSource = mult2;
      finalMultTarget = mult1;
    } else if (agg2 === "shared") {
      relationType = "aggregation";
      finalSourceId = srcClassId;
      finalTargetId = dstClassId;
      finalMultSource = mult1;
      finalMultTarget = mult2;
    } else if (agg1 === "shared") {
      relationType = "aggregation";
      finalSourceId = dstClassId;
      finalTargetId = srcClassId;
      finalMultSource = mult2;
      finalMultTarget = mult1;
    } else {
      // Ni composición ni agregación: verificar si es Muchos a Muchos por multiplicidad
      const isManyToMany = mult1.includes("*") && mult2.includes("*");
      if (isManyToMany) {
        relationType = "manyToMany";
      } else {
        relationType = "association";
      }
      finalSourceId = srcClassId;
      finalTargetId = dstClassId;
      finalMultSource = mult1;
      finalMultTarget = mult2;
    }

    relations.push({
      relationType,
      sourceClassId: finalSourceId,
      targetClassId: finalTargetId,
      multiplicitySource: finalMultSource,
      multiplicityTarget: finalMultTarget,
    });
  }

  stats.classes = classes.length;
  stats.relations = relations.length;

  return {
    model: {
      classes,
      relations,
    },
    stats,
  };
}
