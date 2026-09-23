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

export interface UmlClassData {
  type: "umlClass";
  className: string;
  attributes: UmlAttribute[];
  methods: UmlMethod[];
}

export type RelationType =
  | "association"
  | "inheritance"
  | "composition"
  | "aggregation"
  | "manyToMany";

export type Multiplicity = "1" | "0..1" | "0..*" | "1..*" | "*";

export interface UmlRelationData {
  type: "umlRelation";
  relationType: RelationType;
  multiplicitySource?: Multiplicity;
  multiplicityTarget?: Multiplicity;
}

const SEPARATOR = "──────────────";

const VISIBILITY_SYMBOLS: Record<"public" | "private" | "protected", string> = {
  public: "+",
  private: "-",
  protected: "#",
};

export function buildUmlClassLabel(data: UmlClassData): string {
  const parts: string[] = [data.className];
  const hasAttributes = data.attributes && data.attributes.length > 0;
  const hasMethods = data.methods && data.methods.length > 0;

  if (!hasAttributes && !hasMethods) {
    return data.className;
  }

  if (hasAttributes) {
    parts.push(SEPARATOR);
    for (const attr of data.attributes) {
      const symbol = VISIBILITY_SYMBOLS[attr.visibility] || "+";
      parts.push(`${symbol} ${attr.name}: ${attr.type}`);
    }
  }

  if (hasMethods) {
    parts.push(SEPARATOR);
    for (const method of data.methods) {
      const symbol = VISIBILITY_SYMBOLS[method.visibility] || "+";
      parts.push(`${symbol} ${method.name}(): ${method.returnType}`);
    }
  }

  return parts.join("\n");
}
