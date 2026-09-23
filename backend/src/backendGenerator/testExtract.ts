import dotenv from "dotenv";
import path from "path";

// Asegurar la carga de variables de entorno desde el archivo .env del backend
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

import { pool, query } from "../db";
import { extractUmlModel } from "./extractModel";

async function run() {
  try {
    console.log("[testExtract] Consultando el diagrama más reciente en la base de datos...");

    const result = await query(
      `SELECT id, name, data, updated_at, created_at
       FROM diagrams
       ORDER BY updated_at DESC NULLS LAST, created_at DESC
       LIMIT 1;`
    );

    if (!result.rows || result.rows.length === 0) {
      console.warn("[testExtract] No se encontraron registros en la tabla 'diagrams'.");
      return;
    }

    const diagram = result.rows[0];
    console.log(
      `[testExtract] Diagrama obtenido: id=${diagram.id}, nombre="${diagram.name}", updated_at=${diagram.updated_at}`
    );

    const resultado = extractUmlModel(diagram.data);

    console.log("\n================ RESULTADO extractUmlModel ================");
    console.log(JSON.stringify(resultado, null, 2));
    console.log("===========================================================\n");
  } catch (error) {
    console.error("[testExtract] Error durante la ejecución del test:", error);
  } finally {
    // Cerrar el pool de conexiones para que el script finalice limpiamente
    await pool.end();
  }
}

run();
