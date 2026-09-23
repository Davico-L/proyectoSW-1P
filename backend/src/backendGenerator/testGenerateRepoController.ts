import dotenv from "dotenv";
import path from "path";

// Cargar variables de entorno desde el archivo .env del backend
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

import { pool, query } from "../db";
import { extractUmlModel } from "./extractModel";
import { generateRepositoryInterface } from "./generateRepository";
import { generateRestController } from "./generateController";

async function run() {
  try {
    console.log("[testGenerateRepoController] Consultando el diagrama más reciente en la base de datos...");

    const result = await query(
      `SELECT id, name, data, updated_at, created_at
       FROM diagrams
       ORDER BY updated_at DESC NULLS LAST, created_at DESC
       LIMIT 1;`
    );

    if (!result.rows || result.rows.length === 0) {
      console.warn("[testGenerateRepoController] No se encontraron registros en la tabla 'diagrams'.");
      return;
    }

    const diagram = result.rows[0];
    console.log(
      `[testGenerateRepoController] Diagrama obtenido: id=${diagram.id}, nombre="${diagram.name}"`
    );

    const model = extractUmlModel(diagram.data);
    console.log(`[testGenerateRepoController] Total de clases extraídas: ${model.classes.length}`);

    for (const umlClass of model.classes) {
      console.log(`\n================ REPOSITORY JAVA: ${umlClass.className}Repository ================`);
      const repoCode = generateRepositoryInterface(umlClass, model.classes, model.relations);
      console.log(repoCode);

      console.log(`\n================ CONTROLLER JAVA: ${umlClass.className}Controller ================`);
      const controllerCode = generateRestController(umlClass, model.classes, model.relations);
      console.log(controllerCode);
      console.log("==================================================================================\n");
    }
  } catch (error) {
    console.error("[testGenerateRepoController] Error durante la ejecución de la prueba:", error);
  } finally {
    await pool.end();
  }
}

run();
