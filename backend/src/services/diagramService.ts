import { randomUUID } from "crypto";
import { pool } from "../db";

export interface Diagram {
  id: string;
  session_id: string;
  name: string;
  data: any;
  created_at: string;
  updated_at: string;
}

// Respaldo en memoria por si se requiere fallback
const inMemoryDiagrams = new Map<string, Diagram>();

export const createDiagram = async (
  sessionId: string,
  name: string,
  data: any
): Promise<Diagram> => {
  const id = randomUUID();
  const now = new Date().toISOString();

  const queryText = `
    INSERT INTO diagrams (id, session_id, name, data, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, session_id, name, data, created_at, updated_at
  `;

  try {
    const result = await pool.query(queryText, [
      id,
      sessionId,
      name.trim(),
      JSON.stringify(data),
      now,
      now,
    ]);

    const row = result.rows[0];
    const diagram: Diagram = {
      id: row.id,
      session_id: row.session_id,
      name: row.name,
      data: typeof row.data === "string" ? JSON.parse(row.data) : row.data,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
    };
    inMemoryDiagrams.set(diagram.id, diagram);
    return diagram;
  } catch (dbError: any) {
    console.error("[diagramService] Error al insertar diagrama en Postgres:", dbError?.message || dbError);
    throw dbError;
  }
};

export const getDiagramById = async (id: string): Promise<Diagram | null> => {
  const queryText = `
    SELECT id, session_id, name, data, created_at, updated_at
    FROM diagrams
    WHERE id = $1
    LIMIT 1
  `;

  try {
    const result = await pool.query(queryText, [id]);
    if (result.rows.length === 0) {
      return inMemoryDiagrams.get(id) || null;
    }
    const row = result.rows[0];
    const diagram: Diagram = {
      id: row.id,
      session_id: row.session_id,
      name: row.name,
      data: typeof row.data === "string" ? JSON.parse(row.data) : row.data,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
    };
    inMemoryDiagrams.set(diagram.id, diagram);
    return diagram;
  } catch (dbError: any) {
    console.warn("[diagramService] Error consultando diagrama en Postgres:", dbError?.message);
    return inMemoryDiagrams.get(id) || null;
  }
};

export const updateDiagram = async (
  id: string,
  data: any,
  name?: string
): Promise<Diagram | null> => {
  const now = new Date().toISOString();

  let queryText = "";
  let params: any[] = [];

  if (name !== undefined && typeof name === "string") {
    queryText = `
      UPDATE diagrams
      SET data = $1, name = $2, updated_at = $3
      WHERE id = $4
      RETURNING id, session_id, name, data, created_at, updated_at
    `;
    params = [JSON.stringify(data), name.trim(), now, id];
  } else {
    queryText = `
      UPDATE diagrams
      SET data = $1, updated_at = $2
      WHERE id = $3
      RETURNING id, session_id, name, data, created_at, updated_at
    `;
    params = [JSON.stringify(data), now, id];
  }

  try {
    const result = await pool.query(queryText, params);
    if (result.rows.length === 0) {
      return null;
    }
    const row = result.rows[0];
    const diagram: Diagram = {
      id: row.id,
      session_id: row.session_id,
      name: row.name,
      data: typeof row.data === "string" ? JSON.parse(row.data) : row.data,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
    };
    inMemoryDiagrams.set(diagram.id, diagram);
    return diagram;
  } catch (dbError: any) {
    console.error("[diagramService] Error al actualizar diagrama en Postgres:", dbError?.message || dbError);
    throw dbError;
  }
};

export const listDiagramsBySession = async (sessionId: string): Promise<Diagram[]> => {
  const queryText = `
    SELECT id, session_id, name, data, created_at, updated_at
    FROM diagrams
    WHERE session_id = $1
    ORDER BY updated_at DESC
  `;

  try {
    const result = await pool.query(queryText, [sessionId]);
    return result.rows.map((row) => ({
      id: row.id,
      session_id: row.session_id,
      name: row.name,
      data: typeof row.data === "string" ? JSON.parse(row.data) : row.data,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
    }));
  } catch (dbError: any) {
    console.warn("[diagramService] Error listando diagramas por sesión:", dbError?.message);
    return Array.from(inMemoryDiagrams.values()).filter((d) => d.session_id === sessionId);
  }
};
