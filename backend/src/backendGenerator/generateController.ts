import { UmlClass, UmlRelation } from "./types";
import {
  toPascalCase,
  toSnakeCase,
  getIdAttributeInfo,
  resolveIdJavaType,
  findRootInheritanceClass,
} from "./generateEntity";

/**
 * Genera el controlador REST Spring Boot completo con operaciones CRUD para una clase UML.
 *
 * @param umlClass Clase UML
 * @param allClasses Colección de todas las clases del modelo
 * @param relations Colección de todas las relaciones del modelo
 * @returns Código fuente del controlador REST Java
 */
export function generateRestController(
  umlClass: UmlClass,
  allClasses: UmlClass[] = [],
  relations: UmlRelation[] = []
): string {
  const className = toPascalCase(umlClass.className) || "Entity";
  const tableName = toSnakeCase(umlClass.className) || "entity";
  const pluralTableName = `${tableName}s`;
  const idType = resolveIdJavaType(umlClass, allClasses, relations);
  const rootClass = findRootInheritanceClass(umlClass, allClasses, relations);
  const idInfo = getIdAttributeInfo(rootClass);

  const importLines: string[] = [
    `import com.example.generatedbackend.entity.${className};`,
    `import com.example.generatedbackend.repository.${className}Repository;`,
    "import org.springframework.beans.factory.annotation.Autowired;",
    "import org.springframework.http.ResponseEntity;",
    "import org.springframework.web.bind.annotation.*;",
    "",
  ];

  if (idType === "LocalDate") {
    importLines.push("import java.time.LocalDate;");
  }

  importLines.push("import java.util.List;");
  importLines.push("import java.util.Optional;");

  return [
    "package com.example.generatedbackend.controller;",
    "",
    ...importLines,
    "",
    "@RestController",
    `@RequestMapping("/api/${pluralTableName}")`,
    `public class ${className}Controller {`,
    "",
    "    @Autowired",
    `    private ${className}Repository repository;`,
    "",
    "    @GetMapping",
    `    public List<${className}> getAll() {`,
    "        return repository.findAll();",
    "    }",
    "",
    '    @GetMapping("/{id}")',
    `    public ResponseEntity<${className}> getById(@PathVariable ${idType} id) {`,
    `        Optional<${className}> result = repository.findById(id);`,
    "        return result.map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());",
    "    }",
    "",
    "    @PostMapping",
    `    public ${className} create(@RequestBody ${className} entity) {`,
    "        return repository.save(entity);",
    "    }",
    "",
    '    @PutMapping("/{id}")',
    `    public ResponseEntity<${className}> update(@PathVariable ${idType} id, @RequestBody ${className} entity) {`,
    "        if (!repository.existsById(id)) {",
    "            return ResponseEntity.notFound().build();",
    "        }",
    `        entity.${idInfo.setterName}(id);`,
    "        return ResponseEntity.ok(repository.save(entity));",
    "    }",
    "",
    '    @DeleteMapping("/{id}")',
    `    public ResponseEntity<Void> delete(@PathVariable ${idType} id) {`,
    "        if (!repository.existsById(id)) {",
    "            return ResponseEntity.notFound().build();",
    "        }",
    "        repository.deleteById(id);",
    "        return ResponseEntity.noContent().build();",
    "    }",
    "}",
    "",
  ].join("\n");
}
