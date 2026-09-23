import dotenv from "dotenv";
import path from "path";

// Cargar variables de entorno desde el archivo .env del backend
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

import { pool, query } from "../db";
import { extractUmlModel } from "./extractModel";
import { generateEntityClass } from "./generateEntity";

async function run() {
  try {
    console.log("[testGenerateEntity] Consultando el diagrama más reciente en la base de datos...");

    const result = await query(
      `SELECT id, name, data, updated_at, created_at
       FROM diagrams
       ORDER BY updated_at DESC NULLS LAST, created_at DESC
       LIMIT 1;`
    );

    if (!result.rows || result.rows.length === 0) {
      console.warn("[testGenerateEntity] No se encontraron registros en la tabla 'diagrams'.");
      return;
    }

    const diagram = result.rows[0];
    console.log(
      `[testGenerateEntity] Diagrama obtenido: id=${diagram.id}, nombre="${diagram.name}"`
    );

    const model = extractUmlModel(diagram.data);
    console.log(`[testGenerateEntity] Total de clases extraídas: ${model.classes.length}`);
    console.log(`[testGenerateEntity] Total de relaciones extraídas: ${model.relations.length}`);

    for (const umlClass of model.classes) {
      console.log(`\n================ ENTIDAD JAVA GENERADA: ${umlClass.className} ================`);
      const javaCode = generateEntityClass(umlClass, model.classes, model.relations);
      console.log(javaCode);
      console.log("==============================================================================\n");
    }
  } catch (error) {
    console.error("[testGenerateEntity] Error durante la ejecución de la prueba:", error);
  } finally {
    await pool.end();
  }
}

run();
