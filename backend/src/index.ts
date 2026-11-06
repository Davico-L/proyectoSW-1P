import http from "http";
import dotenv from "dotenv";
import { app } from "./app";
import { pool, checkDbConnection } from "./db";
import { runMigrations } from "./db/migrate";
import { checkMongoConnection, closeMongoConnection } from "./db/mongo";
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

  // Verificación no bloqueante de MongoDB Atlas (CU18 - Chat del equipo)
  checkMongoConnection()
    .then((mongoStatus) => {
      if (mongoStatus.connected) {
        console.log(`[MongoDB] Conexión exitosa a MongoDB Atlas (${mongoStatus.latencyMs}ms)`);
      } else {
        console.warn(
          `[MongoDB] Aviso: MongoDB Atlas no está disponible (${mongoStatus.message}). El chat de equipo quedará deshabilitado, pero el resto de la aplicación continuará funcionando normalmente.`
        );
      }
    })
    .catch((err) => {
      console.warn(
        `[MongoDB] Error al intentar conectar con MongoDB: ${err?.message || err}. El servidor continuará funcionando con Postgres y Socket.IO.`
      );
    });
});

// Cierre ordenado
const handleShutdown = async (signal: string) => {
  console.log(`\n[Server] Recibida señal ${signal}. Cerrando servidor y conexiones...`);
  server.close(async () => {
    try {
      await pool.end();
      console.log("[Database] Pool de PostgreSQL cerrado correctamente.");
    } catch (err) {
      console.error("[Database] Error al cerrar pool de PostgreSQL:", err);
    }

    try {
      await closeMongoConnection();
      console.log("[MongoDB] Conexión a MongoDB cerrada correctamente.");
    } catch (mongoErr) {
      console.error("[MongoDB] Error al cerrar conexión a MongoDB:", mongoErr);
    }

    process.exit(0);
  });
};

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
