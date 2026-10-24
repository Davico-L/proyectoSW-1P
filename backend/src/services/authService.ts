/**
 * authService.ts
 *
 * Lógica de negocio para registro y login de usuarios con contraseña.
 * Todas las búsquedas de username se realizan con lower() (case-insensitive).
 * NUNCA se registran ni retornan password ni password_hash en logs o respuestas.
 */

import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { pool } from "../db";

const BCRYPT_COST = 10;

export interface AuthResult {
  session_id: string;
  username: string;
  claimed?: true;
}

/**
 * Registra un nuevo usuario en sessions con contraseña.
 *
 * @throws { code: "EMPTY_USERNAME" }   si username queda vacío tras trim.
 * @throws { code: "SHORT_PASSWORD" }   si password tiene menos de 6 caracteres.
 * @throws { code: "USERNAME_TAKEN" }   si ya existe un username igual (case-insensitive).
 */
export const registerUser = async (
  rawUsername: string | undefined | null,
  rawPassword: string | undefined | null
): Promise<AuthResult> => {
  // Validar username
  const username =
    typeof rawUsername === "string" ? rawUsername.trim() : "";
  if (username.length === 0) {
    throw Object.assign(new Error("El nombre de usuario no puede estar vacío."), {
      code: "EMPTY_USERNAME",
    });
  }

  // Validar password
  const password =
    typeof rawPassword === "string" ? rawPassword : "";
  if (password.length < 6) {
    throw Object.assign(
      new Error("La contraseña debe tener al menos 6 caracteres."),
      { code: "SHORT_PASSWORD" }
    );
  }

  // Verificar unicidad (case-insensitive) ANTES de hashear.
  const existing = await pool.query(
    "SELECT id FROM sessions WHERE lower(username) = lower($1) LIMIT 1",
    [username]
  );
  if (existing.rows.length > 0) {
    throw Object.assign(
      new Error("El nombre de usuario ya está en uso."),
      { code: "USERNAME_TAKEN" }
    );
  }

  // Hashear la contraseña.
  const password_hash = await bcrypt.hash(password, BCRYPT_COST);

  const sessionId = randomUUID();
  const now = new Date().toISOString();

  try {
    const result = await pool.query(
      `INSERT INTO sessions (id, username, created_at, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username`,
      [sessionId, username, now, password_hash]
    );
    const row = result.rows[0];
    return { session_id: row.id, username: row.username };
  } catch (err: any) {
    if (err?.code === "23505") {
      // Colisión por condición de carrera entre la verificación y el INSERT.
      throw Object.assign(
        new Error("El nombre de usuario ya está en uso."),
        { code: "USERNAME_TAKEN" }
      );
    }
    throw err;
  }
};

/**
 * Autentica a un usuario existente.
 * Si la cuenta existe pero password_hash es NULL (cuenta antigua), intenta reclamarla:
 *   - password < 6 chars → lanza SHORT_PASSWORD (400).
 *   - password ≥ 6 chars → intenta UPDATE atómico WHERE password_hash IS NULL.
 *     · UPDATE afectó 1 fila → hash guardado, responde con { ..., claimed: true }.
 *     · UPDATE afectó 0 filas (carrera) → relee y verifica como login normal.
 *
 * @throws { code: "MISSING_FIELDS" }      si falta username o password.
 * @throws { code: "SHORT_PASSWORD" }      si cuenta sin hash y password < 6 chars.
 * @throws { code: "INVALID_CREDENTIALS" } en cualquier fallo de autenticación.
 */
export const loginUser = async (
  rawUsername: string | undefined | null,
  rawPassword: string | undefined | null
): Promise<AuthResult> => {
  // Validar presencia de campos
  if (
    typeof rawUsername !== "string" ||
    rawUsername.trim().length === 0 ||
    typeof rawPassword !== "string" ||
    rawPassword.length === 0
  ) {
    throw Object.assign(
      new Error("Se requieren username y password."),
      { code: "MISSING_FIELDS" }
    );
  }

  const username = rawUsername.trim();

  // Buscar la cuenta (case-insensitive). Seleccionamos password_hash internamente
  // pero NO lo exponemos en la respuesta ni en logs.
  const result = await pool.query(
    `SELECT id, username, password_hash
     FROM sessions
     WHERE lower(username) = lower($1)
     LIMIT 1`,
    [username]
  );

  const INVALID = Object.assign(
    new Error("Credenciales incorrectas."),
    { code: "INVALID_CREDENTIALS" }
  );

  if (result.rows.length === 0) {
    throw INVALID;
  }

  const row = result.rows[0];

  // --- Reclamo de cuenta antigua (password_hash IS NULL) ---
  if (row.password_hash === null) {
    // La contraseña enviada debe cumplir el mínimo antes de guardarla.
    if (rawPassword.length < 6) {
      throw Object.assign(
        new Error("La contraseña debe tener al menos 6 caracteres."),
        { code: "SHORT_PASSWORD" }
      );
    }

    // Hash calculado pero nunca registrado en logs.
    const newHash = await bcrypt.hash(rawPassword, BCRYPT_COST);

    // Escritura atómica: solo actualiza si la columna sigue siendo NULL.
    const updateResult = await pool.query(
      "UPDATE sessions SET password_hash = $1 WHERE id = $2 AND password_hash IS NULL",
      [newHash, row.id]
    );

    if ((updateResult.rowCount ?? 0) === 1) {
      // Reclamo exitoso.
      return { session_id: row.id, username: row.username, claimed: true };
    }

    // Carrera: otro proceso ya asignó un hash. Releer y verificar normalmente.
    const reread = await pool.query(
      "SELECT password_hash FROM sessions WHERE id = $1 LIMIT 1",
      [row.id]
    );
    if (reread.rows.length === 0 || reread.rows[0].password_hash === null) {
      throw INVALID;
    }
    const matchAfterRace = await bcrypt.compare(rawPassword, reread.rows[0].password_hash);
    if (!matchAfterRace) {
      throw INVALID;
    }
    return { session_id: row.id, username: row.username };
  }

  // --- Login normal: cuenta ya tiene hash ---
  const match = await bcrypt.compare(rawPassword, row.password_hash);
  if (!match) {
    throw INVALID;
  }

  return { session_id: row.id, username: row.username };
};
