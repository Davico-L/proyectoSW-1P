import { Pool, PoolConfig } from "pg";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const isCloudPostgres =
  connectionString?.includes("neon.tech") ||
  connectionString?.includes("supabase.co") ||
  connectionString?.includes("supabase.com") ||
  process.env.PGSSL === "true" ||
  connectionString?.includes("sslmode=require");

const poolConfig: PoolConfig = connectionString
  ? {
      connectionString,
      ssl: isCloudPostgres ? { rejectUnauthorized: false } : undefined,
    }
  : {
      host: process.env.PGHOST || "localhost",
      port: Number(process.env.PGPORT) || 5432,
      user: process.env.PGUSER || "postgres",
      password: process.env.PGPASSWORD || "postgres",
      database: process.env.PGDATABASE || "proyectosw",
      ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
    };

export const pool = new Pool(poolConfig);

pool.on("error", (err) => {
  console.error("Error inesperado en el cliente del pool de Postgres:", err);
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  return { ...res, duration };
};

export const checkDbConnection = async (): Promise<{
  connected: boolean;
  message?: string;
  latencyMs?: number;
}> => {
  const start = Date.now();
  try {
    // Timeout breve para no bloquear el endpoint /health si la base de datos no está disponible
    const client = await Promise.race([
      pool.connect(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout al conectar a la base de datos")), 3000)
      ),
    ]);

    try {
      await client.query("SELECT 1");
      return {
        connected: true,
        latencyMs: Date.now() - start,
      };
    } finally {
      client.release();
    }
  } catch (error: any) {
    return {
      connected: false,
      message: error?.message || "Error desconocido de conexión",
      latencyMs: Date.now() - start,
    };
  }
};
