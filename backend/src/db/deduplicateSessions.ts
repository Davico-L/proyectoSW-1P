/**
 * deduplicateSessions.ts
 *
 * Script que detecta y resuelve nombres de sesión duplicados ignorando mayúsculas.
 *
 * Modo por defecto (simulación):  tsx src/db/deduplicateSessions.ts
 * Modo aplicación real:           tsx src/db/deduplicateSessions.ts --apply
 *
 * Regla: en cada grupo de nombres con el mismo lower(username), la fila con
 * created_at más antiguo conserva su nombre; las demás se renombran a
 * "<nombre> (n)" con el primer n libre (comparando sin mayúsculas).
 * NUNCA se borran filas ni se toca la tabla diagrams.
 */

import { pool } from "./index";

/** Devuelve el primer sufijo libre para baseName ignorando mayúsculas. */
const nextFreeSuffix = (baseLower: string, takenLower: Set<string>): number => {
  let n = 2;
  while (takenLower.has(`${baseLower} (${n})`)) {
    n++;
  }
  return n;
};

const run = async (apply: boolean): Promise<void> => {
  const client = await pool.connect();
  try {
    // 1. Obtener todos los grupos con más de 1 fila al comparar sin mayúsculas.
    const groupsResult = await client.query<{ lower_username: string }>(`
      SELECT lower(username) AS lower_username
      FROM sessions
      GROUP BY lower(username)
      HAVING count(*) > 1
      ORDER BY lower(username)
    `);

    if (groupsResult.rows.length === 0) {
      console.log("[Dedup] No se encontraron duplicados. No hay nada que hacer.");
      return;
    }

    console.log(
      `[Dedup] Grupos con duplicados (case-insensitive): ${groupsResult.rows.length}`
    );
    if (!apply) {
      console.log("[Dedup] MODO SIMULACIÓN — ningún cambio será aplicado.\n");
    } else {
      console.log("[Dedup] MODO APPLY — los cambios se escribirán en la base.\n");
    }

    // 2. Para cada grupo, ordenar por created_at ASC y renombrar los duplicados.
    let totalRenames = 0;
    const renames: Array<{ id: string; from: string; to: string }> = [];

    for (const groupRow of groupsResult.rows) {
      const lowerGroup = groupRow.lower_username;

      // Traer todas las filas del grupo ordenadas por antigüedad.
      const rowsResult = await client.query<{
        id: string;
        username: string;
        created_at: string;
      }>(
        `SELECT id, username, created_at
         FROM sessions
         WHERE lower(username) = $1
         ORDER BY created_at ASC`,
        [lowerGroup]
      );

      const rows = rowsResult.rows;
      // La primera fila (más antigua) conserva su nombre.
      // Construimos el conjunto de nombres ya tomados en minúsculas.
      const takenLower = new Set<string>();

      // Pre-cargar también los nombres que existen fuera del grupo
      // para que los sufijos no colisionen con otras filas de la tabla.
      const outerResult = await client.query<{ username: string }>(
        `SELECT username FROM sessions WHERE lower(username) != $1`,
        [lowerGroup]
      );
      for (const r of outerResult.rows) {
        takenLower.add(r.username.toLowerCase());
      }

      // Procesar el grupo: el primero (más antiguo) es el "ganador".
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (i === 0) {
          // El más antiguo conserva su nombre original.
          takenLower.add(row.username.toLowerCase());
          continue;
        }

        // Necesita sufijo.
        const baseLower = lowerGroup; // base canónica en minúsculas
        const n = nextFreeSuffix(baseLower, takenLower);
        // El nuevo nombre usa la misma capitalización que el nombre original del grupo
        // (tomada del ganador: rows[0].username).
        const newUsername = `${rows[0].username} (${n})`;

        takenLower.add(newUsername.toLowerCase());
        renames.push({ id: row.id, from: row.username, to: newUsername });
        totalRenames++;
      }
    }

    // 3. Imprimir el plan.
    console.log(`id                                   | nombre actual         -> nombre nuevo`);
    console.log(`-------------------------------------|-----------------------|-----------------------`);
    for (const r of renames) {
      console.log(`${r.id} | ${r.from.padEnd(21)} -> ${r.to}`);
    }
    console.log(`\nTotal de renombrados: ${totalRenames}`);

    if (!apply) {
      console.log("\n[Dedup] Simulación completada. Para aplicar ejecutá: tsx src/db/deduplicateSessions.ts --apply");
      return;
    }

    // 4. Aplicar los renombrados dentro de una transacción.
    await client.query("BEGIN");
    try {
      for (const r of renames) {
        await client.query(
          "UPDATE sessions SET username = $1 WHERE id = $2",
          [r.to, r.id]
        );
      }
      await client.query("COMMIT");
      console.log("\n[Dedup] Cambios aplicados correctamente.");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }

    // 5. Verificar que ya no quedan duplicados antes de intentar crear el índice.
    const remaining = await client.query(`
      SELECT lower(username) AS lower_username, count(*)
      FROM sessions
      GROUP BY lower(username)
      HAVING count(*) > 1
    `);

    if (remaining.rows.length > 0) {
      console.error(
        "\n[Dedup] ERROR: Aún quedan duplicados. NO se creará el índice único."
      );
      console.error(remaining.rows);
      process.exit(1);
    }

    // 6. Crear el índice único sobre lower(username).
    console.log("\n[Dedup] Creando índice único idx_sessions_username_lower...");
    await client.query(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_username_lower ON sessions (lower(username))"
    );
    console.log("[Dedup] Índice creado correctamente.");
  } finally {
    client.release();
  }
};

const apply = process.argv.includes("--apply");

run(apply)
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("[Dedup] Fallo inesperado:", err);
    process.exit(1);
  });
