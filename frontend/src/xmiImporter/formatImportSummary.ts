import type { ParseXmiStats } from "./parseXmi";

/**
 * Genera el texto resumen legible tras una importación XMI exitosa (CU11 paso 8).
 *
 * Ejemplos:
 * - "5 clases y 6 relaciones importadas; 2 elementos no soportados fueron ignorados"
 * - "1 clase y 1 relación importadas; 1 elemento no soportado fue ignorado; 1 relación descartada por referenciar una clase inexistente"
 * - "6 clases y 5 relaciones importadas"
 */
export function formatImportSummary(stats: ParseXmiStats): string {
  const classText = stats.classes === 1 ? "1 clase" : `${stats.classes} clases`;
  const relText =
    stats.relations === 1 ? "1 relación" : `${stats.relations} relaciones`;

  let summary = `${classText} y ${relText} importadas`;

  if (stats.ignoredElements > 0) {
    const ignoredText =
      stats.ignoredElements === 1
        ? "1 elemento no soportado fue ignorado"
        : `${stats.ignoredElements} elementos no soportados fueron ignorados`;
    summary += `; ${ignoredText}`;
  }

  if (stats.discardedRelations > 0) {
    const discardedText =
      stats.discardedRelations === 1
        ? "1 relación descartada por referenciar una clase inexistente"
        : `${stats.discardedRelations} relaciones descartadas por referenciar una clase inexistente`;
    summary += `; ${discardedText}`;
  }

  return summary;
}
