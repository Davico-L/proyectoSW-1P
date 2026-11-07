/**
 * Manejador y utilidades puras para el procesamiento de operaciones de IA en el cliente (CU20 Fase 3).
 */

/**
 * Conjunto acotado en memoria con política de desalojo FIFO.
 * Utilizado para registrar los messageIds de operaciones ya procesadas y prevenir duplicación.
 */
export class BoundedSet<T> {
  private set = new Set<T>();
  private queue: T[] = [];

  constructor(private maxSize: number = 100) {}

  has(value: T): boolean {
    return this.set.has(value);
  }

  add(value: T): void {
    if (this.set.has(value)) {
      return;
    }
    if (this.queue.length >= this.maxSize) {
      const oldest = this.queue.shift();
      if (oldest !== undefined) {
        this.set.delete(oldest);
      }
    }
    this.set.add(value);
    this.queue.push(value);
  }

  clear(): void {
    this.set.clear();
    this.queue = [];
  }

  get size(): number {
    return this.set.size;
  }
}

export interface AiOperationsValidationInput {
  payload: any;
  activeDiagramId: string | null;
  hasExcalidrawApi: boolean;
  isAlreadyProcessed: boolean;
}

export interface AiOperationsValidationResult {
  canApply: boolean;
  ack?: { applied: number; failed: number };
  reason?:
    | "already_processed"
    | "diagram_mismatch"
    | "no_api"
    | "invalid_operations"
    | "invalid_payload";
}

/**
 * Evalúa las condiciones para procesar un evento 'ai-operations'.
 * - Si ya se procesó el messageId: responde { applied: 0, failed: 0 } sin aplicar nada.
 * - Si el diagramId no coincide, o no hay excalidrawAPI, o operations no es arreglo:
 *   responde { applied: 0, failed: operations.length (o 0) } sin aplicar.
 * - En caso normal: canApply: true.
 */
export function validateAiOperations({
  payload,
  activeDiagramId,
  hasExcalidrawApi,
  isAlreadyProcessed,
}: AiOperationsValidationInput): AiOperationsValidationResult {
  if (isAlreadyProcessed) {
    return {
      canApply: false,
      ack: { applied: 0, failed: 0 },
      reason: "already_processed",
    };
  }

  if (!payload || typeof payload !== "object") {
    return {
      canApply: false,
      ack: { applied: 0, failed: 0 },
      reason: "invalid_payload",
    };
  }

  const operationsCount = Array.isArray(payload.operations)
    ? payload.operations.length
    : 0;

  if (
    !payload.diagramId ||
    !activeDiagramId ||
    payload.diagramId !== activeDiagramId
  ) {
    return {
      canApply: false,
      ack: { applied: 0, failed: operationsCount },
      reason: "diagram_mismatch",
    };
  }

  if (!hasExcalidrawApi) {
    return {
      canApply: false,
      ack: { applied: 0, failed: operationsCount },
      reason: "no_api",
    };
  }

  if (!Array.isArray(payload.operations)) {
    return {
      canApply: false,
      ack: { applied: 0, failed: 0 },
      reason: "invalid_operations",
    };
  }

  return { canApply: true };
}

/**
 * Calcula la cantidad de operaciones aplicadas y fallidas a partir de los resultados de applyAiOperations.
 * Se considera 'applied' todo resultado cuyo status no sea "skipped", y 'failed' el resto hasta el total de operaciones.
 */
export function calculateOperationCounts(
  results: Array<{ status: "applied" | "skipped" }>,
  totalOperations: number
): { applied: number; failed: number } {
  let applied = 0;
  for (const r of results) {
    if (r && r.status !== "skipped") {
      applied++;
    }
  }
  const failed = Math.max(0, totalOperations - applied);
  return { applied, failed };
}

/**
 * Regex para detectar @ia o @codia como palabra completa:
 * - Precedido de inicio de texto, espacio o signo de apertura (¿, ¡, (, [, ", '): (?<=^|[\s¿¡"'(])
 * - Mención: @(?:ia|codia) (case insensitive)
 * - Seguido de espacio, fin de texto o signo de puntuación: (?=[\s\p{P}]|$)
 */
const CODIA_MENTION_REGEX = /(?<=^|[\s¿¡"'(])@(?:ia|codia)(?=[\s\p{P}]|$)/giu;

/**
 * Detecta si un texto contiene mención a Codia o IA (@codia / @ia, case-insensitive).
 */
export function hasCodiaMention(text: string): boolean {
  if (!text || typeof text !== "string") {
    return false;
  }
  const regex = new RegExp(CODIA_MENTION_REGEX.source, CODIA_MENTION_REGEX.flags);
  return regex.test(text);
}

/**
 * Ejecuta una función de guardado con tiempo límite.
 * Si la función tarda más del timeout indicado, la promesa se resuelve sin bloquear el flujo.
 */
export async function saveDiagramWithTimeout(
  saveFn: () => Promise<void>,
  timeoutMs: number
): Promise<boolean> {
  const effectiveTimeout = Math.max(1, timeoutMs);
  let timer: NodeJS.Timeout | null = null;
  try {
    await Promise.race([
      saveFn(),
      new Promise<void>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Save timeout")), effectiveTimeout);
      }),
    ]);
    return true;
  } catch (err) {
    console.warn("[TeamChat] Error o timeout al guardar diagrama:", err);
    return false;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
