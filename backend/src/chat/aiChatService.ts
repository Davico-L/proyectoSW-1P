import { UmlModel } from "../backendGenerator/types";
import { formatModelCompact, buildChatContext } from "./chatContext";
import { ensureAddressedByName, trimToLastSentence } from "./aiChatHelpers";

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
  "Te llamas Codia. Eres la desarrolladora senior y mentora del equipo. " +
  "Si te preguntan quién eres, te presentas como Codia, la desarrolladora senior y mentora del equipo. " +
  "Respondes en español. " +
  "Te diriges a quien pregunta por su nombre. " +
  "Longitud: unas 120 palabras, salvo que pidan más detalle. " +
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
  ) => Promise<Array<{ id: string; authorName: string; text: string }>>;
  chat: (
    systemPrompt: string,
    userContent: string,
    options?: { maxTokens?: number }
  ) => Promise<string>;
}

export interface AnswerInRoomParams {
  diagramId: string;
  askerName: string;
  askerMessageId: string;
  question: string;
}

export interface AnswerInRoomResult {
  message: string;
  operations: [];
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
            rawReply = await deps.chat(TEAM_AI_SYSTEM_PROMPT, userContent, {
              maxTokens: 400,
            });
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
          // 1. trimToLastSentence
          let processed = trimToLastSentence(rawReply);
          // 2. ensureAddressedByName
          processed = ensureAddressedByName(processed, cleanAsker);
          // 3. tope de 3000 caracteres
          if (processed.length > 3000) {
            processed = processed.slice(0, 3000);
          }

          resolve({
            message: processed,
            operations: [],
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
