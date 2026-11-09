import { UmlModel } from "../backendGenerator/types";
import { formatModelCompact, buildChatContext } from "./chatContext";
import {
  ensureAddressedByName,
  trimToLastSentence,
  stripGreetingPreamble,
} from "./aiChatHelpers";
import { classifyIntent, summarizeOperations } from "./modificationHelpers";
import { requestDiagramEdit } from "./diagramAiEditService";
import { reviewDiagramInRoom, ReviewDiagramInRoomDeps } from "./diagramReviewService";

export class AiBusyError extends Error {
  constructor(
    message = "El asistente de IA está ocupado atendiendo demasiadas consultas. Reintenta en unos instantes."
  ) {
    super(message);
    this.name = "AiBusyError";
    Object.setPrototypeOf(this, AiBusyError.prototype);
  }
}

export class AiUnavailableError extends Error {
  constructor(
    message = "El servicio de IA no está disponible en este momento."
  ) {
    super(message);
    this.name = "AiUnavailableError";
    Object.setPrototypeOf(this, AiUnavailableError.prototype);
  }
}

export const TEAM_AI_SYSTEM_PROMPT =
  "Tu nombre es Codia. Eres la desarrolladora senior y mentora del equipo. " +
  "Respondes en español. " +
  "No saludes (nada de 'Hola' ni '¡Hola!') ni te presentes; empieza directamente con la respuesta. " +
  "No escribas el nombre de quien pregunta: el sistema lo antepone. " +
  "Solo di tu nombre o tu rol si te preguntan explícitamente quién eres. " +
  "Ejemplo de inicio correcto: 'Una clase abstracta es…'. " +
  "Ejemplo incorrecto: 'Hola, Ana. Soy Codia, la desarrolladora senior…'. " +
  "Longitud: máximo unas 120 palabras, sin listas largas, salvo que pidan más detalle. " +
  "Formato: solo texto plano; se permite únicamente **negrita** puntual y `código en línea`; sin encabezados ni tablas; bloques de código con ``` SOLO si la persona pide código explícitamente. " +
  "No uses cursiva con asterisco simple. Para énfasis usa solo **negrita**. " +
  "No asumas lenguaje ni tecnología (no des código Java, SQL ni JPA salvo que lo pidan); responde en términos de UML y del diagrama del equipo. " +
  "En preguntas conceptuales, explica con un ejemplo simple y genérico (por ejemplo Persona con /edad). Usa el diagrama del equipo solo si el concepto encaja de verdad con sus clases; no fuerces el ejemplo. " +
  "Nunca inventes clases, atributos ni relaciones como si ya existieran en el diagrama. Si propones algo nuevo, di claramente que es una sugerencia. " +
  "Si no estás segura de algo, dilo en vez de inventar. " +
  "La conversación reciente es solo contexto; responde únicamente a la pregunta actual, que es la última línea (\"Pregunta de ...\"); no repitas ni continúes respuestas anteriores salvo que la pregunta lo pida; si la pregunta nombra conceptos distintos a los de la conversación anterior, responde sobre los conceptos de la pregunta actual. " +
  "No puedes modificar el diagrama en este caso de uso. " +
  "Al hablar de relaciones UML, habla de la asociación y su multiplicidad; no propongas claves foráneas ni atributos tipo \"productoId\" salvo que la pregunta sea sobre la base de datos. " +
  "Notas de notación UML para evitar errores: un atributo derivado se escribe con una barra inclinada antes del nombre (por ejemplo /edad) y se calcula a partir de otros atributos; la composición se dibuja con rombo relleno en el lado del todo y las partes no existen sin el todo; la agregación se dibuja con rombo vacío y las partes pueden existir solas; las multiplicidades se escriben 1, 0..1, * y 1..*.";

export interface AiChatServiceDeps {
  getDiagramModel: (diagramId: string) => Promise<UmlModel | null>;
  listRecentMessages: (
    diagramId: string,
    limit: number
  ) => Promise<
    Array<{
      id: string;
      authorName: string;
      text: string;
      role?: string;
      addressedTo?: string;
    }>
  >;
  chat: (
    systemPrompt: string,
    userContent: string,
    options?: { maxTokens?: number }
  ) => Promise<string>;
  requestDiagramEdit?: typeof requestDiagramEdit;
  classifyIntent?: typeof classifyIntent;
  reviewDiagram?: ReviewDiagramInRoomDeps["reviewDiagram"];
}

export interface AnswerInRoomParams {
  diagramId: string;
  askerName: string;
  askerMessageId: string;
  question: string;
  onOperations?: (
    operations: any[],
    warnings: string[]
  ) => Promise<{ applied: number; failed: number } | null>;
}

export interface AnswerInRoomResult {
  message: string;
  operations: any[];
  kind?: "answer" | "modification";
  warnings?: string[];
  findings?: any[];
}

export function createAiChatService(deps: AiChatServiceDeps) {
  let isProcessing = false;
  type QueueTask = () => Promise<void>;
  const waitingQueue: QueueTask[] = [];

  async function processNext(): Promise<void> {
    if (waitingQueue.length === 0) {
      isProcessing = false;
      return;
    }

    isProcessing = true;
    const nextTask = waitingQueue.shift()!;
    try {
      await nextTask();
    } finally {
      processNext();
    }
  }

  async function answerInRoom(
    params: AnswerInRoomParams
  ): Promise<AnswerInRoomResult> {
    const cleanAsker = (params.askerName || "").trim() || "Usuario";
    const rawQuestion =
      typeof params.question === "string" ? params.question.trim() : "";

    // 1. Si la pregunta está vacía: NO llama al modelo y responde saludo de ayuda
    if (!rawQuestion) {
      return {
        message: `${cleanAsker}, ¿en qué puedo ayudarte?`,
        operations: [],
        kind: "answer",
      };
    }

    // 2. Comprobar tope de cola (máximo 5 pendientes además de la activa)
    if (waitingQueue.length >= 5) {
      throw new AiBusyError(
        "El asistente de IA está ocupado. Hay demasiadas consultas pendientes."
      );
    }

    return new Promise<AnswerInRoomResult>((resolve, reject) => {
      const executeTask = async () => {
        try {
          const classify = deps.classifyIntent ?? classifyIntent;
          const editDiagram = deps.requestDiagramEdit ?? requestDiagramEdit;

          const hasOnOperations = typeof params.onOperations === "function";
          const intent = classify(rawQuestion);

          if (intent === "modification" && hasOnOperations) {
            const editResult = await editDiagram({
              diagramId: params.diagramId,
              instruction: rawQuestion,
            });

            if (editResult.status === "diagramNotFound") {
              const msg = ensureAddressedByName(
                "no encontré el diagrama especificado.",
                cleanAsker
              );
              resolve({
                message: msg,
                operations: [],
                kind: "answer",
              });
              return;
            }

            if (editResult.status === "tooMany") {
              const baseMsg =
                editResult.message ||
                "el pedido contiene demasiadas operaciones. Por favor, dividilo en cambios más pequeños.";
              const msg = ensureAddressedByName(baseMsg, cleanAsker);
              resolve({
                message: msg,
                operations: [],
                kind: "answer",
              });
              return;
            }

            if (editResult.status === "onlyWarnings") {
              const warningsList = editResult.warnings || [];
              const joined = warningsList.join("; ").trim().replace(/\.+$/, "");
              const baseMsg = `no se aplicaron cambios: ${joined || "se descartaron las operaciones"}.`;
              const msg = ensureAddressedByName(baseMsg, cleanAsker);
              resolve({
                message: msg,
                operations: [],
                warnings: warningsList,
                kind: "answer",
              });
              return;
            }

            if (editResult.status === "ready") {
              const validOps = editResult.validOperations || [];
              const warningsList = editResult.warnings || [];

              const ack = await params.onOperations!(validOps, warningsList);

              if (!ack || ack.applied <= 0) {
                const msg = ensureAddressedByName(
                  "no pude aplicar los cambios al diagrama. Por favor, repite tu pedido.",
                  cleanAsker
                );
                resolve({
                  message: msg,
                  operations: [],
                  warnings: warningsList,
                  kind: "answer",
                });
                return;
              }

              // ack.applied > 0
              let summary = summarizeOperations(validOps, warningsList);
              if (ack.failed > 0) {
                const failedText =
                  ack.failed === 1
                    ? "1 cambio no se pudo aplicar"
                    : `${ack.failed} cambios no se pudieron aplicar`;
                summary = `${summary.replace(/\.$/, "")} (${failedText}).`;
              }

              const finalMsg = ensureAddressedByName(summary, cleanAsker);
              resolve({
                message: finalMsg,
                operations: validOps,
                warnings: warningsList,
                kind: "modification",
              });
              return;
            }

            if (editResult.status === "noChanges") {
              const hasQuestionMark =
                rawQuestion.includes("?") || rawQuestion.includes("¿");

              if (!hasQuestionMark) {
                const baseMsg =
                  "no encontré qué cambiar en el diagrama con ese pedido. Por favor, reformúlalo o sé más específico indicando el nombre de la clase o atributo.";
                const msg = ensureAddressedByName(baseMsg, cleanAsker);
                resolve({
                  message: msg,
                  operations: [],
                  kind: "answer",
                });
                return;
              }

              // Si contiene "?" o "¿", continúa abajo al camino de consulta con chatReply
            }
          }

          // Rama "review" (CU21): Codia revisa el diagrama sin modificarlo
          if (intent === "review") {
            const reviewDeps: ReviewDiagramInRoomDeps = {
              getDiagramModel: deps.getDiagramModel,
              chat: deps.chat,
              reviewDiagram: deps.reviewDiagram,
            };
            const reviewResult = await reviewDiagramInRoom(
              {
                diagramId: params.diagramId,
                askerName: cleanAsker,
              },
              reviewDeps
            );
            resolve({
              message: reviewResult.message,
              operations: [],
              kind: "answer",
              findings: reviewResult.findings,
            });
            return;
          }

          // Camino de consulta (CU19):
          // Obtener modelo y formatearlo
          const umlModel = await deps.getDiagramModel(params.diagramId);
          const modelCompact = formatModelCompact(umlModel);

          // Obtener mensajes recientes excluyendo el mensaje actual
          const recentMessages = await deps.listRecentMessages(
            params.diagramId,
            20
          );
          const filteredMessages = (recentMessages || []).filter(
            (m) => m.id !== params.askerMessageId
          );

          // Construir contexto del chat
          const userContent = buildChatContext({
            modelCompact,
            recentMessages: filteredMessages,
            askerName: cleanAsker,
            question: rawQuestion,
          });

          // Invocar chat
          let rawReply = "";
          try {
            rawReply = await deps.chat(TEAM_AI_SYSTEM_PROMPT, userContent);
          } catch (err: any) {
            throw new AiUnavailableError(
              err?.message || "Error al comunicarse con el proveedor de IA."
            );
          }

          if (!rawReply || typeof rawReply !== "string" || !rawReply.trim()) {
            throw new AiUnavailableError(
              "El servicio de IA devolvió una respuesta vacía."
            );
          }

          // Procesar salida en orden estricto:
          // 0. stripGreetingPreamble (salvo que la pregunta pida explícitamente quién es / cómo se llama / presentarse)
          const isSelfIntroQuestion =
            /(?:qui[eé]n\s+eres|c[oó]mo\s+te\s+llamas|pres[eé]ntate)/i.test(
              rawQuestion
            );

          let processed = rawReply;
          if (!isSelfIntroQuestion) {
            processed = stripGreetingPreamble(processed);
          }

          // 1. trimToLastSentence
          processed = trimToLastSentence(processed);
          // 2. ensureAddressedByName
          processed = ensureAddressedByName(processed, cleanAsker);
          // 3. tope de 3000 caracteres
          if (processed.length > 3000) {
            processed = processed.slice(0, 3000);
          }

          resolve({
            message: processed,
            operations: [],
            kind: "answer",
          });
        } catch (err) {
          reject(err);
        }
      };

      if (!isProcessing) {
        isProcessing = true;
        executeTask().finally(() => {
          processNext();
        });
      } else {
        waitingQueue.push(executeTask);
      }
    });
  }

  return {
    answerInRoom,
  };
}
