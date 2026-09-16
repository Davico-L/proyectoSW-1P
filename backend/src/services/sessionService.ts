import { randomUUID } from "crypto";
import { pool } from "../db";

export interface Session {
  sessionId: string;
  username: string;
  createdAt: string;
}

// Almacén ligero en memoria para caché y fallback
const sessions = new Map<string, Session>();

export const createSession = async (username: string): Promise<Session> => {
  const session: Session = {
    sessionId: randomUUID(),
    username: username.trim(),
    createdAt: new Date().toISOString(),
  };

  sessions.set(session.sessionId, session);

  try {
    await pool.query(
      "INSERT INTO sessions (id, username, created_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING",
      [session.sessionId, session.username, session.createdAt]
    );
  } catch (error: any) {
    console.warn("[sessionService] No se pudo guardar sesión en Postgres (continuando en memoria):", error?.message);
  }

  return session;
};

export const getSession = async (sessionId: string): Promise<Session | undefined> => {
  // 1. Revisar caché en memoria
  if (sessions.has(sessionId)) {
    return sessions.get(sessionId);
  }

  // 2. Revisar base de datos
  try {
    const result = await pool.query(
      "SELECT id, username, created_at FROM sessions WHERE id = $1 LIMIT 1",
      [sessionId]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      const session: Session = {
        sessionId: row.id,
        username: row.username,
        createdAt: new Date(row.created_at).toISOString(),
      };
      sessions.set(session.sessionId, session);
      return session;
    }
  } catch (error: any) {
    console.warn("[sessionService] Error al consultar sesión en Postgres:", error?.message);
  }

  return undefined;
};

export const sessionExists = async (sessionId: string): Promise<boolean> => {
  if (!sessionId || typeof sessionId !== "string") {
    return false;
  }

  // Si está en memoria, nos aseguramos de que exista en la BD para respetar llaves foráneas
  if (sessions.has(sessionId)) {
    const cached = sessions.get(sessionId)!;
    try {
      await pool.query(
        "INSERT INTO sessions (id, username, created_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING",
        [cached.sessionId, cached.username, cached.createdAt]
      );
    } catch {
      // Ignorar error si la BD no está disponible
    }
    return true;
  }

  // Consultar en Postgres
  try {
    const result = await pool.query(
      "SELECT 1 FROM sessions WHERE id = $1 LIMIT 1",
      [sessionId]
    );
    return (result.rowCount ?? 0) > 0;
  } catch (error: any) {
    console.warn("[sessionService] Error al verificar existencia de sesión en Postgres:", error?.message);
    return false;
  }
};

export const getAllSessions = (): Session[] => {
  return Array.from(sessions.values());
};
