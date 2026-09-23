import archiver from "archiver";
import { UmlModel } from "./types";
import { toPascalCase, generateEntityClass } from "./generateEntity";
import { generateRepositoryInterface } from "./generateRepository";
import { generateRestController } from "./generateController";
import {
  generatePomXml,
  generateApplicationProperties,
  generateMainApplicationClass,
} from "./generateProjectFiles";

/**
 * Genera en memoria un archivo ZIP con el proyecto completo Spring Boot generado a partir de un modelo UML.
 *
 * @param model Modelo UML que contiene las clases y relaciones
 * @returns Buffer con el contenido binario del archivo ZIP
 */
export function buildBackendZip(model: UmlModel): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // a. Validación: el modelo debe tener al menos una clase con className no vacío
    if (!model || !model.classes || model.classes.length === 0) {
      return reject(
        new Error("El diagrama debe tener al menos una clase válida para generar el backend")
      );
    }

    // b. Filtrar clases con className vacío o inválido
    const validClasses = model.classes.filter(
      (c) => c.className && c.className.trim() !== ""
    );

    if (validClasses.length === 0) {
      return reject(
        new Error("El diagrama debe tener al menos una clase válida para generar el backend")
      );
    }

    // c. Armar la estructura del archivo ZIP en memoria
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    archive.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    archive.on("error", (err) => {
      reject(err);
    });

    // Archivos base del proyecto
    archive.append(generatePomXml(), { name: "generated-backend/pom.xml" });
    archive.append(generateApplicationProperties(), {
      name: "generated-backend/src/main/resources/application.properties",
    });
    archive.append(generateMainApplicationClass(), {
      name: "generated-backend/src/main/java/com/example/generatedbackend/GeneratedBackendApplication.java",
    });

    // Archivos Java por cada clase del diagrama
    for (const umlClass of validClasses) {
      const pascalName = toPascalCase(umlClass.className) || "Entity";

      // 1. Entidad JPA
      const entityCode = generateEntityClass(
        umlClass,
        model.classes,
        model.relations
      );
      archive.append(entityCode, {
        name: `generated-backend/src/main/java/com/example/generatedbackend/entity/${pascalName}.java`,
      });

      // 2. Interfaz Repository
      const repoCode = generateRepositoryInterface(
        umlClass,
        model.classes,
        model.relations
      );
      archive.append(repoCode, {
        name: `generated-backend/src/main/java/com/example/generatedbackend/repository/${pascalName}Repository.java`,
      });

      // 3. Controlador REST
      const controllerCode = generateRestController(
        umlClass,
        model.classes,
        model.relations
      );
      archive.append(controllerCode, {
        name: `generated-backend/src/main/java/com/example/generatedbackend/controller/${pascalName}Controller.java`,
      });
    }

    // d. Finalizar compresión
    archive.finalize();
  });
}
