import { UmlClass, UmlRelation } from "./types";
import { mapUmlTypeToJava } from "./typeMapping";

/**
 * Convierte un texto a PascalCase (ej: "cliente" -> "Cliente", "orden_compra" -> "OrdenCompra").
 */
export function toPascalCase(str: string): string {
  if (!str) return "";
  const words = str
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

/**
 * Convierte un texto a snake_case (ej: "Cliente" -> "cliente", "OrdenCompra" -> "orden_compra").
 */
export function toSnakeCase(str: string): string {
  if (!str) return "";
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

/**
 * Convierte un texto a camelCase (ej: "fecha_nacimiento" -> "fechaNacimiento").
 */
export function toCamelCase(str: string): string {
  if (!str) return "";
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Obtiene los datos del atributo identificador (primer atributo o 'id' sintético por defecto).
 */
export function getIdAttributeInfo(umlClass: UmlClass): {
  fieldName: string;
  javaType: string;
  setterName: string;
  getterName: string;
} {
  const rawAttributes =
    umlClass.attributes && umlClass.attributes.length > 0
      ? umlClass.attributes
      : [{ name: "id", type: "Long", visibility: "private" }];

  const firstAttr = rawAttributes[0];
  const rawName = firstAttr.name ? firstAttr.name.trim() : "id";
  const fieldName = toCamelCase(rawName) || "id";
  const javaType = mapUmlTypeToJava(firstAttr.type);
  const capitalized = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);

  return {
    fieldName,
    javaType,
    setterName: `set${capitalized}`,
    getterName: `get${capitalized}`,
  };
}

/**
 * Busca la clase raíz en la jerarquía de herencia (subiendo por la cadena si hay varios niveles).
 */
export function findRootInheritanceClass(
  umlClass: UmlClass,
  allClasses: UmlClass[] = [],
  relations: UmlRelation[] = []
): UmlClass {
  let current = umlClass;
  const visited = new Set<string>([current.id]);

  while (true) {
    const inhRel = relations.find(
      (r) => r.relationType === "inheritance" && r.sourceClassId === current.id
    );
    if (!inhRel) {
      break;
    }
    const parent = allClasses.find((c) => c.id === inhRel.targetClassId);
    if (!parent || visited.has(parent.id)) {
      break;
    }
    visited.add(parent.id);
    current = parent;
  }

  return current;
}

/**
 * Resuelve el tipo Java del ID de una entidad, navegando la jerarquía de herencia
 * hacia la clase padre/raíz si es una subclase.
 *
 * @param umlClass Clase UML a evaluar
 * @param allClasses Colección de todas las clases del modelo
 * @param relations Colección de todas las relaciones del modelo
 * @returns Nombre del tipo Java del identificador (ej: "Long", "Integer", "String")
 */
export function resolveIdJavaType(
  umlClass: UmlClass,
  allClasses: UmlClass[] = [],
  relations: UmlRelation[] = []
): string {
  const rootClass = findRootInheritanceClass(umlClass, allClasses, relations);
  if (rootClass.attributes && rootClass.attributes.length > 0) {
    return mapUmlTypeToJava(rootClass.attributes[0].type);
  }
  return "Long";
}

interface RelationFieldInfo {
  fieldName: string;
  fieldType: string;
  fieldLines: string[];
}

/**
 * Genera el código fuente completo de una entidad Java Spring Boot (JPA) a partir de una clase UML
 * y sus relaciones asociadas.
 *
 * @param umlClass Clase UML con nombre y lista de atributos
 * @param allClasses Lista con todas las clases del modelo (para resolver tipos relacionados)
 * @param relations Lista con todas las relaciones del modelo
 * @returns Contenido del archivo Java en formato string
 */
export function generateEntityClass(
  umlClass: UmlClass,
  allClasses: UmlClass[] = [],
  relations: UmlRelation[] = []
): string {
  const className = toPascalCase(umlClass.className) || "Entity";
  const tableName = toSnakeCase(umlClass.className) || "entity";

  // 1. Determinar rol en relaciones de herencia
  const inheritanceAsChild = relations.find(
    (r) => r.relationType === "inheritance" && r.sourceClassId === umlClass.id
  );
  const isChild = !!inheritanceAsChild;
  const parentClass = isChild
    ? allClasses.find((c) => c.id === inheritanceAsChild.targetClassId)
    : undefined;
  const parentClassName = parentClass
    ? toPascalCase(parentClass.className)
    : undefined;

  const isParent = relations.some(
    (r) => r.relationType === "inheritance" && r.targetClassId === umlClass.id
  );

  // 2. Preparar atributos efectivos
  let effectiveAttributes: {
    fieldName: string;
    javaType: string;
    isId: boolean;
  }[] = [];

  if (isChild) {
    // Recopilar los nombres de TODOS los atributos del padre (sin importar mayúsculas/minúsculas)
    const parentAttrNames = new Set<string>();
    if (parentClass && parentClass.attributes) {
      for (const attr of parentClass.attributes) {
        if (attr.name) {
          const raw = attr.name.trim().toLowerCase();
          parentAttrNames.add(raw);
          parentAttrNames.add(toCamelCase(attr.name).toLowerCase());
        }
      }
    }
    // Siempre asegurar que el id esté considerado como heredado
    parentAttrNames.add("id");

    const rawChildAttributes = umlClass.attributes || [];
    effectiveAttributes = rawChildAttributes
      .filter((attr, index) => {
        const rawName = (attr.name || "").trim().toLowerCase();
        const camelName = toCamelCase(attr.name || "").toLowerCase();

        // Excluir el primer atributo si es un identificador heredado
        if (index === 0 && (rawName === "id" || rawName.startsWith("id"))) {
          return false;
        }

        // Excluir cualquier atributo que coincida con alguno del padre
        if (parentAttrNames.has(rawName) || parentAttrNames.has(camelName)) {
          return false;
        }

        return true;
      })
      .map((attr, index) => {
        const rawName = attr.name ? attr.name.trim() : `attr${index}`;
        const fieldName = toCamelCase(rawName) || `attr${index}`;
        const javaType = mapUmlTypeToJava(attr.type);
        return {
          fieldName,
          javaType,
          isId: false, // La clase hija nunca declara @Id
        };
      });
  } else {
    // Si la clase no tiene atributos, se genera un atributo id por defecto
    const rawAttributes =
      umlClass.attributes && umlClass.attributes.length > 0
        ? umlClass.attributes
        : [{ name: "id", type: "Long", visibility: "private" }];

    effectiveAttributes = rawAttributes.map((attr, index) => {
      const rawName = attr.name ? attr.name.trim() : (index === 0 ? "id" : `attr${index}`);
      const fieldName = toCamelCase(rawName) || (index === 0 ? "id" : `attr${index}`);
      const javaType = mapUmlTypeToJava(attr.type);
      return {
        fieldName,
        javaType,
        isId: index === 0,
      };
    });
  }

  // Procesar relaciones JPA (omitiendo inheritance)
  const relationFields: RelationFieldInfo[] = [];
  let hasJsonIgnore = false;
  let hasList = false;

  const thisClassSingular = toCamelCase(className);

  for (const rel of relations) {
    if (rel.relationType === "inheritance") {
      continue;
    }

    const isSource = rel.sourceClassId === umlClass.id;
    const isTarget = rel.targetClassId === umlClass.id;

    if (!isSource && !isTarget) {
      continue;
    }

    const otherClassId = isSource ? rel.targetClassId : rel.sourceClassId;
    const otherClass = allClasses.find((c) => c.id === otherClassId);
    if (!otherClass) {
      continue;
    }

    const otherClassName = toPascalCase(otherClass.className) || "Entity";
    const otherSingular = toCamelCase(otherClassName);
    const otherPlural = `${otherSingular}s`;
    const otherSnake = toSnakeCase(otherClass.className);

    // 1. Normalizar multiplicidades: "" -> "1"
    const multSource = (rel.multiplicitySource || "").trim() || "1";
    const multTarget = (rel.multiplicityTarget || "").trim() || "1";

    const sourceHasMany = multSource.includes("*");
    const targetHasMany = multTarget.includes("*");

    // 2. Si AMBOS contienen "*" (o relationType es 'manyToMany'): tratar como Many-to-Many
    if ((sourceHasMany && targetHasMany) || rel.relationType === "manyToMany") {
      hasList = true;
      const sourceClass = isSource ? umlClass : otherClass;
      const targetClass = isSource ? otherClass : umlClass;

      const sourceTableName = toSnakeCase(sourceClass.className) || "source";
      const targetTableName = toSnakeCase(targetClass.className) || "target";

      const thisPlural = `${thisClassSingular}s`;

      if (isSource) {
        // Lado source: dueño de la tabla intermedia
        relationFields.push({
          fieldName: otherPlural,
          fieldType: `List<${otherClassName}>`,
          fieldLines: [
            "    @ManyToMany",
            "    @JoinTable(",
            `        name = "${sourceTableName}_${targetTableName}",`,
            `        joinColumns = @JoinColumn(name = "${sourceTableName}_id"),`,
            `        inverseJoinColumns = @JoinColumn(name = "${targetTableName}_id")`,
            "    )",
            `    private List<${otherClassName}> ${otherPlural} = new java.util.ArrayList<>();`,
          ],
        });
      } else {
        // Lado target: lado inverso
        hasJsonIgnore = true;
        relationFields.push({
          fieldName: otherPlural,
          fieldType: `List<${otherClassName}>`,
          fieldLines: [
            "    @JsonIgnore",
            `    @ManyToMany(mappedBy = "${thisPlural}")`,
            `    private List<${otherClassName}> ${otherPlural} = new java.util.ArrayList<>();`,
          ],
        });
      }
      continue;
    }

    if (targetHasMany && !sourceHasMany) {
      // 1 a muchos: Source es 'uno', Target es 'muchos'
      if (isSource) {
        // Lado uno
        hasJsonIgnore = true;
        hasList = true;
        let cascadeClause = "";
        if (rel.relationType === "composition") {
          cascadeClause = ", cascade = CascadeType.ALL, orphanRemoval = true";
        } else if (rel.relationType === "aggregation") {
          cascadeClause = ", cascade = {CascadeType.PERSIST, CascadeType.MERGE}";
        }

        relationFields.push({
          fieldName: otherPlural,
          fieldType: `List<${otherClassName}>`,
          fieldLines: [
            "    @JsonIgnore",
            `    @OneToMany(mappedBy = "${thisClassSingular}"${cascadeClause})`,
            `    private List<${otherClassName}> ${otherPlural} = new java.util.ArrayList<>();`,
          ],
        });
      } else {
        // Lado muchos
        relationFields.push({
          fieldName: otherSingular,
          fieldType: otherClassName,
          fieldLines: [
            "    @ManyToOne",
            `    @JoinColumn(name = "${otherSnake}_id")`,
            `    private ${otherClassName} ${otherSingular};`,
          ],
        });
      }
    } else if (sourceHasMany && !targetHasMany) {
      // 1 a muchos: Target es 'uno', Source es 'muchos'
      if (!isSource) {
        // Lado uno
        hasJsonIgnore = true;
        hasList = true;
        let cascadeClause = "";
        if (rel.relationType === "composition") {
          cascadeClause = ", cascade = CascadeType.ALL, orphanRemoval = true";
        } else if (rel.relationType === "aggregation") {
          cascadeClause = ", cascade = {CascadeType.PERSIST, CascadeType.MERGE}";
        }

        relationFields.push({
          fieldName: otherPlural,
          fieldType: `List<${otherClassName}>`,
          fieldLines: [
            "    @JsonIgnore",
            `    @OneToMany(mappedBy = "${thisClassSingular}"${cascadeClause})`,
            `    private List<${otherClassName}> ${otherPlural} = new java.util.ArrayList<>();`,
          ],
        });
      } else {
        // Lado muchos
        relationFields.push({
          fieldName: otherSingular,
          fieldType: otherClassName,
          fieldLines: [
            "    @ManyToOne",
            `    @JoinColumn(name = "${otherSnake}_id")`,
            `    private ${otherClassName} ${otherSingular};`,
          ],
        });
      }
    } else {
      // 1 a 1
      if (isSource) {
        // Lado source (dueño de la relación)
        let cascadeClause = "";
        if (rel.relationType === "composition") {
          cascadeClause = "(cascade = CascadeType.ALL, orphanRemoval = true)";
        } else if (rel.relationType === "aggregation") {
          cascadeClause = "(cascade = {CascadeType.PERSIST, CascadeType.MERGE})";
        }

        relationFields.push({
          fieldName: otherSingular,
          fieldType: otherClassName,
          fieldLines: [
            `    @OneToOne${cascadeClause}`,
            `    @JoinColumn(name = "${otherSnake}_id")`,
            `    private ${otherClassName} ${otherSingular};`,
          ],
        });
      } else {
        // Lado target (lado inverso)
        hasJsonIgnore = true;
        relationFields.push({
          fieldName: otherSingular,
          fieldType: otherClassName,
          fieldLines: [
            "    @JsonIgnore",
            `    @OneToOne(mappedBy = "${thisClassSingular}")`,
            `    private ${otherClassName} ${otherSingular};`,
          ],
        });
      }
    }
  }

  const hasLocalDate = effectiveAttributes.some((a) => a.javaType === "LocalDate");

  // Armar bloque de imports
  const importLines: string[] = [];
  if (hasJsonIgnore) {
    importLines.push("import com.fasterxml.jackson.annotation.JsonIgnore;");
  }
  importLines.push("import jakarta.persistence.*;");
  if (hasLocalDate) {
    importLines.push("import java.time.LocalDate;");
  }
  if (hasList) {
    importLines.push("import java.util.List;");
  }

  // Armar bloque de campos/atributos propios
  const fieldBlocks: string[] = [];
  for (const attr of effectiveAttributes) {
    const lines: string[] = [];
    if (attr.isId) {
      if (attr.javaType === "Integer" || attr.javaType === "Long") {
        lines.push("    @GeneratedValue(strategy = GenerationType.IDENTITY)");
      }
      lines.push("    @Id");
    }
    lines.push(`    private ${attr.javaType} ${attr.fieldName};`);
    fieldBlocks.push(lines.join("\n"));
  }

  // Agregar campos de relación
  for (const relField of relationFields) {
    fieldBlocks.push(relField.fieldLines.join("\n"));
  }

  // Armar bloque de getters y setters de atributos propios
  const methodBlocks: string[] = [];
  for (const attr of effectiveAttributes) {
    const capitalized =
      attr.fieldName.charAt(0).toUpperCase() + attr.fieldName.slice(1);

    const getter = [
      `    public ${attr.javaType} get${capitalized}() {`,
      `        return ${attr.fieldName};`,
      `    }`,
    ].join("\n");

    const setter = [
      `    public void set${capitalized}(${attr.javaType} ${attr.fieldName}) {`,
      `        this.${attr.fieldName} = ${attr.fieldName};`,
      `    }`,
    ].join("\n");

    methodBlocks.push(getter);
    methodBlocks.push(setter);
  }

  // Agregar getters y setters para campos de relación
  for (const relField of relationFields) {
    const capitalized =
      relField.fieldName.charAt(0).toUpperCase() + relField.fieldName.slice(1);

    const getter = [
      `    public ${relField.fieldType} get${capitalized}() {`,
      `        return ${relField.fieldName};`,
      `    }`,
    ].join("\n");

    const setter = [
      `    public void set${capitalized}(${relField.fieldType} ${relField.fieldName}) {`,
      `        this.${relField.fieldName} = ${relField.fieldName};`,
      `    }`,
    ].join("\n");

    methodBlocks.push(getter);
    methodBlocks.push(setter);
  }

  // Armar anotaciones de la clase
  const classAnnotations: string[] = ["@Entity"];

  if (isChild) {
    classAnnotations.push(`@DiscriminatorValue("${className}")`);
  } else {
    classAnnotations.push(`@Table(name = "${tableName}")`);
    if (isParent) {
      classAnnotations.push("@Inheritance(strategy = InheritanceType.SINGLE_TABLE)");
      classAnnotations.push('@DiscriminatorColumn(name = "tipo_entidad")');
    }
  }

  const classDeclaration =
    isChild && parentClassName
      ? `public class ${className} extends ${parentClassName}`
      : `public class ${className}`;

  // Armar cuerpo de la clase
  const bodySections: string[] = [];
  if (fieldBlocks.length > 0) {
    bodySections.push(fieldBlocks.join("\n\n"));
  }
  if (methodBlocks.length > 0) {
    bodySections.push("    // Getters y Setters\n\n" + methodBlocks.join("\n\n"));
  }

  const classLines: string[] = [
    ...classAnnotations,
    `${classDeclaration} {`,
  ];

  if (bodySections.length > 0) {
    classLines.push("");
    classLines.push(bodySections.join("\n\n"));
  }

  classLines.push("}");

  return [
    "package com.example.generatedbackend.entity;",
    "",
    ...importLines,
    "",
    ...classLines,
    "",
  ].join("\n");
}
