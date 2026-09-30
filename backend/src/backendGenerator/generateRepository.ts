import { UmlClass, UmlRelation } from "./types";
import { toPascalCase, resolveIdJavaType } from "./generateEntity";

/**
 * Genera la interfaz de repositorio Spring Data JPA para una clase UML.
 *
 * @param umlClass Clase UML
 * @param allClasses Colección de todas las clases del modelo
 * @param relations Colección de todas las relaciones del modelo
 * @returns Código fuente de la interfaz Java Repository
 */
export function generateRepositoryInterface(
  umlClass: UmlClass,
  allClasses: UmlClass[] = [],
  relations: UmlRelation[] = []
): string {
  const className = toPascalCase(umlClass.className) || "Entity";
  const idType = resolveIdJavaType(umlClass, allClasses, relations);

  const importLines: string[] = [
    `import com.example.generatedbackend.entity.${className};`,
    "import org.springframework.data.jpa.repository.JpaRepository;",
    "import org.springframework.stereotype.Repository;",
  ];

  if (idType === "LocalDate") {
    importLines.push("import java.time.LocalDate;");
  }

  return [
    "package com.example.generatedbackend.repository;",
    "",
    ...importLines,
    "",
    "@Repository",
    `public interface ${className}Repository extends JpaRepository<${className}, ${idType}> {`,
    "}",
    "",
  ].join("\n");
}
