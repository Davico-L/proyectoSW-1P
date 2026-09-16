import { pool } from "./index";
import fs from "fs";
import path from "path";

export const runMigrations = async (): Promise<void> => {
  console.log("[Migration] Iniciando migración de base de datos...");
  const client = await pool.connect();
  try {
    const sqlPath = path.join(__dirname, "init.sql");
    const sqlContent = fs.readFileSync(sqlPath, "utf-8");

    // Ejecutar las sentencias SQL de migración
    await client.query(sqlContent);
    console.log("[Migration] Tablas 'sessions' y 'diagrams' verificadas / creadas exitosamente.");
  } catch (error: any) {
    console.error("[Migration] Error ejecutando la migración:", error?.message || error);
    throw error;
  } finally {
    client.release();
  }
};

// Si se ejecuta directamente desde línea de comandos (npm run migrate)
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log("[Migration] Migración finalizada correctamente.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Migration] Fallo en la migración:", err);
      process.exit(1);
    });
}
