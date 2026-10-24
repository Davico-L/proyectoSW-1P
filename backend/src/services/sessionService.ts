import { randomUUID } from "crypto";
import { pool } from "../db";

export interface Session {
  sessionId: string;
  username: string;
  createdAt: string;
}

/**
 * Genera un nombre de invitado con 4 dígitos aleatorios (ej: Invitado-4821).
 */
const generateGuestUsername = (): string => {
  const digits = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `Invitado-${digits}`;
};

/**
 * Escapa caracteres comodín de SQL LIKE (%, _)
 */
const escapeForLike = (value: string): string => {
  return value.replace(/([%_\\])/g, "\\$1");
};

/**
 * Resuelve un nombre único en la tabla sessions ignorando mayúsculas (case-insensitive).
 * Utiliza lower() para comparar, de modo que no viole el índice único
 * idx_sessions_username_lower. Genera sufijos "Juan (2)", "Juan (3)", etc.
 */
const resolveUniqueUsername = async (baseName: string): Promise<string> => {
  const escapedBase = escapeForLike(baseName.toLowerCase());
  const pattern = `${escapedBase} (%)`;

  // Comparamos en minúsculas tanto el nombre base como los sufijos con patrón LIKE.
  const result = await pool.query(
    "SELECT username FROM sessions WHERE lower(username) = lower($1) OR lower(username) LIKE $2 ESCAPE '\\'",
    [baseName, pattern]
  );

  if (result.rows.length === 0) {
    return baseName;
  }

  // Normalizar a minúsculas para comparar sin importar capitalización.
  const existingNamesLower = new Set<string>(
    result.rows.map((row: any) => (row.username as string).toLowerCase())
  );

  // Si el nombre base no existe aún (case-insensitive), se puede usar directamente.
  if (!existingNamesLower.has(baseName.toLowerCase())) {
    return baseName;
  }

  // Si ya existe, buscar el siguiente sufijo numérico disponible: (2), (3), ...
  let counter = 2;
  while (existingNamesLower.has(`${baseName.toLowerCase()} (${counter})`)) {
    counter++;
  }

  return `${baseName} (${counter})`;
};

/**
 * Crea una nueva sesión en Postgres directamente.
 * - Si username viene vacío, asigna "Invitado-XXXX" (4 dígitos aleatorios).
 * - Si el nombre ya existe en la tabla sessions, agrega sufijo numérico ("Nombre (2)", etc.).
 * - Si falla Postgres, propaga el error para que la ruta responda HTTP 500 sin fallback silencioso.
 */
export const createSession = async (username?: string | null): Promise<Session> => {
  const trimmed = typeof username === "string" ? username.trim() : "";
  const baseName = trimmed.length > 0 ? trimmed : generateGuestUsername();

  const finalUsername = await resolveUniqueUsername(baseName);
  const sessionId = randomUUID();
  const now = new Date().toISOString();

  const queryText = `
    INSERT INTO sessions (id, username, created_at)
    VALUES ($1, $2, $3)
    RETURNING id, username, created_at
  `;

  // Intento principal de INSERT. Si el índice único rechaza por colisión de
  // carrera (error 23505), reintentamos con el siguiente sufijo disponible.
  let result;
  try {
    result = await pool.query(queryText, [sessionId, finalUsername, now]);
  } catch (err: any) {
    if (err?.code === "23505") {
      // Colisión de unicidad (condición de carrera). Obtenemos un sufijo nuevo.
      const retryUsername = await resolveUniqueUsername(baseName);
      result = await pool.query(queryText, [sessionId, retryUsername, now]);
    } else {
      throw err;
    }
  }
  const row = result.rows[0];

  return {
    sessionId: row.id,
    username: row.username,
    createdAt: new Date(row.created_at).toISOString(),
  };
};

/**
 * Obtiene una sesión directamente de Postgres.
 * Sin caché en memoria. Retorna null si no existe.
 */
export const getSession = async (sessionId: string): Promise<Session | null> => {
  if (!sessionId || typeof sessionId !== "string") {
    return null;
  }

  const queryText = `
    SELECT id, username, created_at
    FROM sessions
    WHERE id = $1
    LIMIT 1
  `;

  const result = await pool.query(queryText, [sessionId]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    sessionId: row.id,
    username: row.username,
    createdAt: new Date(row.created_at).toISOString(),
  };
};

/**
 * Verifica si una sesión existe consultando directamente a Postgres.
 */
export const sessionExists = async (sessionId: string): Promise<boolean> => {
  if (!sessionId || typeof sessionId !== "string") {
    return false;
  }

  const result = await pool.query("SELECT 1 FROM sessions WHERE id = $1 LIMIT 1", [
    sessionId,
  ]);
  return (result.rowCount ?? 0) > 0;
};

/**
 * Lista todas las sesiones directamente desde Postgres.
 */
export const getAllSessions = async (): Promise<Session[]> => {
  const result = await pool.query(
    "SELECT id, username, created_at FROM sessions ORDER BY created_at DESC"
  );
  return result.rows.map((row: any) => ({
    sessionId: row.id,
    username: row.username,
    createdAt: new Date(row.created_at).toISOString(),
  }));
};
