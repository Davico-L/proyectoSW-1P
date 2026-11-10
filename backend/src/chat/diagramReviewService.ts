/**
 * Servicio CU21: Codia revisa el diagrama con reglas automáticas y sugiere mejoras.
 * CU21 no modifica el diagrama.
 *
 * Dependencias inyectables para permitir pruebas unitarias sin Mongo ni Postgres.
 */

import { UmlModel } from "../backendGenerator/types";
import { extractUmlModel } from "../backendGenerator/extractModel";
import { getDiagramById } from "../services/diagramService";
import {
  reviewModel,
  formatFindingsForPrompt,
  formatFindingsFallback,
  formatNoFindingsMessage,
  formatEmptyDiagramMessage,
  Finding,
  MAX_CHAT_MESSAGE_LENGTH,
} from "./diagramReview";
import { formatModelCompact } from "./chatContext";
import {
  stripGreetingPreamble,
  trimToLastSentence,
  ensureAddressedByName,
} from "./aiChatHelpers";
import { AiUnavailableError } from "./aiChatService";
import { chatWithFallback } from "../ai/providers/providerManager";
import { RoomStyle } from "./roomSettingsRepository";
import { buildSystemPrompt } from "./styleFragments";

// ---------------------------------------------------------------------------
// Prompt de sistema para la revisión (CU21)
// ---------------------------------------------------------------------------

export const REVIEW_SYSTEM_PROMPT =
  "Eres Codia, asistente de diagramas UML del equipo. " +
  "Escribe en texto plano, sin markdown, sin asteriscos ni almohadillas, con un máximo de 150 palabras. " +
  "No saludes ni te presentes; ve directo al contenido. " +
  "Habla ÚNICAMENTE de las observaciones entregadas, ni una más ni una menos. " +
  "Está estrictamente prohibido mencionar tipos de datos, enumeraciones, convenciones, buenas prácticas generales o ejemplos inventados (como multiplicidades de ejemplo). " +
  "No agregues ideas de dominio ni propongas clases que no existan en el diagrama. " +
  "Redacta en párrafos cortos en español natural, SIN usar listas numeradas y SIN copiar etiquetas del formato de entrada como '[importante]', '[recomendado]', 'Clases:', 'Frase sugerida:' o 'Qué hacer:'. " +
  "Comenta las observaciones importantes primero. Si hay más de 4 observaciones, agrupa las de menor importancia en una sola frase. " +
  "Cuando una observación incluya una frase sugerida que empiece con '@Codia', cópiala exactamente tal cual dentro de la redacción. Si no la incluye, explica qué hacer usando únicamente las palabras de la observación, sin inventar pasos. " +
  "Cierre: termina con una sola pregunta corta invitando a actuar, por ejemplo \"¿Quieres que aplique alguna?\"; es solo un ejemplo, no lo copies palabra por palabra si no encaja con tu redacción.";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface ReviewDiagramParams {
  diagramId: string;
  askerName: string;
  style?: RoomStyle;
}

export interface ReviewDiagramResult {
  message: string;
  findings?: Finding[];
}

/**
 * Función de revisión interna que recibe el modelo ya extraído y la función chat.
 * Permite inyección completa en tests.
 */
export type ReviewDiagramFn = (
  params: ReviewDiagramParams & { model: UmlModel | null }
) => Promise<ReviewDiagramResult>;

export interface ReviewDiagramInRoomDeps {
  /**
   * Obtiene el modelo UML a partir del diagramId.
   * Por defecto usa getDiagramById + extractUmlModel.
   */
  getDiagramModel?: (diagramId: string) => Promise<UmlModel | null>;
  /**
   * Función de chat para llamar al modelo de IA.
   * Por defecto usa chatWithFallback.
   */
  chat?: (
    systemPrompt: string,
    userContent: string,
    options?: { maxTokens?: number }
  ) => Promise<string>;
  /**
   * Override completo de la lógica de revisión (usado en tests de aiChatService).
   * Si se provee, `getDiagramModel` y `chat` son ignorados.
   */
  reviewDiagram?: ReviewDiagramFn;
}

// ---------------------------------------------------------------------------
// Implementación por defecto de getDiagramModel
// ---------------------------------------------------------------------------

async function defaultGetDiagramModel(
  diagramId: string
): Promise<UmlModel | null> {
  const diagram = await getDiagramById(diagramId);
  if (!diagram || !diagram.data) return null;
  return extractUmlModel(diagram.data);
}

// ---------------------------------------------------------------------------
// Lógica principal de revisión
// ---------------------------------------------------------------------------

/**
 * Ejecuta la revisión del diagrama para CU21.
 * Retorna { message, findings? } listo para publicar en el chat.
 */
export async function reviewDiagramInRoom(
  params: ReviewDiagramParams,
  deps: ReviewDiagramInRoomDeps = {}
): Promise<ReviewDiagramResult> {
  const cleanAsker = (params.askerName || "").trim();

  // Si hay un override completo de lógica (para tests de aiChatService)
  if (deps.reviewDiagram) {
    // Obtenemos el modelo para pasarlo, o null si falla
    let model: UmlModel | null = null;
    try {
      const getDiag = deps.getDiagramModel ?? defaultGetDiagramModel;
      model = await getDiag(params.diagramId);
    } catch {
      model = null;
    }
    return deps.reviewDiagram({ ...params, model });
  }

  const getDiag = deps.getDiagramModel ?? defaultGetDiagramModel;
  const chatFn =
    deps.chat ??
    (async (s: string, u: string, o?: { maxTokens?: number }) =>
      (await chatWithFallback(s, u, o)).text);

  // 1. Obtener modelo
  let model: UmlModel | null = null;
  model = await getDiag(params.diagramId);

  // 2. Modelo vacío o nulo
  const isEmpty =
    !model ||
    !Array.isArray(model.classes) ||
    model.classes.length === 0;

  if (isEmpty) {
    return { message: formatEmptyDiagramMessage(cleanAsker) };
  }

  // 3. Reglas automáticas
  const findings = reviewModel(model!);

  if (findings.length === 0) {
    return { message: formatNoFindingsMessage(cleanAsker) };
  }

  // 4. Con observaciones → llamar a IA
  const observationsList = formatFindingsForPrompt(findings);
  const modelSummary = formatModelCompact(model);

  const userContent =
    `Hay exactamente ${findings.length} observaciones.\n` +
    `Observaciones detectadas automáticamente:\n${observationsList}\n\n` +
    `Resumen del diagrama:\n${modelSummary}\n\n` +
    `Nombre del integrante que pidió la revisión: ${cleanAsker || "el equipo"}`;

  let rawReply = "";
  try {
    const systemPrompt = buildSystemPrompt(REVIEW_SYSTEM_PROMPT, params.style);
    rawReply = await chatFn(systemPrompt, userContent);
  } catch (err: any) {
    // Todos los proveedores fallaron → fallback de texto plano
    return {
      message: formatFindingsFallback(findings, cleanAsker),
      findings,
    };
  }

  if (!rawReply || typeof rawReply !== "string" || !rawReply.trim()) {
    // Respuesta vacía → fallback
    return {
      message: formatFindingsFallback(findings, cleanAsker),
      findings,
    };
  }

  // 5. Post-procesado (igual que CU19 pero con tope en MAX_CHAT_MESSAGE_LENGTH = 2000)
  let processed = stripGreetingPreamble(rawReply);
  processed = trimToLastSentence(processed);
  processed = ensureAddressedByName(processed, cleanAsker);
  if (processed.length > MAX_CHAT_MESSAGE_LENGTH) {
    processed = processed.slice(0, MAX_CHAT_MESSAGE_LENGTH);
  }

  return { message: processed, findings };
}
