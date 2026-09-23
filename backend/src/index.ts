import http from "http";
import dotenv from "dotenv";
import { app } from "./app";
import { pool, checkDbConnection } from "./db";
import { runMigrations } from "./db/migrate";
import { initSocket } from "./socket";

dotenv.config();

const PORT = Number(process.env.PORT) || 4000;

// Envolver la aplicación Express en un servidor HTTP
const server = http.createServer(app);

// Inicializar Socket.io sobre el servidor HTTP
initSocket(server);

server.listen(PORT, async () => {
  console.log(`[Server] Servidor Express corriendo en http://localhost:${PORT}`);

  // Verificación preliminar de la base de datos y ejecución de migraciones
  const dbStatus = await checkDbConnection();
  if (dbStatus.connected) {
    console.log(`[Database] Conexión exitosa a PostgreSQL (${dbStatus.latencyMs}ms)`);
    try {
      await runMigrations();
    } catch (migError) {
      console.error("[Database] Error al verificar/inicializar tablas:", migError);
    }
  } else {
    console.warn(
      `[Database] No se pudo conectar a PostgreSQL: ${dbStatus.message || "Verifique las credenciales en .env"}`
    );
  }
});

// Cierre ordenado
const handleShutdown = async (signal: string) => {
  console.log(`\n[Server] Recibida señal ${signal}. Cerrando servidor y pool de conexiones...`);
  server.close(async () => {
    try {
      await pool.end();
      console.log("[Database] Pool de PostgreSQL cerrado correctamente.");
      process.exit(0);
    } catch (err) {
      console.error("[Database] Error al cerrar pool de PostgreSQL:", err);
      process.exit(1);
    }
  });
};

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
