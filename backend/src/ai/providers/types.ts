export type ProviderId = "local" | "groq" | "gemini";

export interface ChatReplyOptions {
  maxTokens?: number;
}

export interface ModelProvider {
  readonly id: ProviderId;
  readonly label: string;
  isConfigured(): boolean;
  editDiagramByInstruction(
    currentModel: { classes: any[]; relations: any[] },
    instruction: string
  ): Promise<{ operations: any[] }>;
  /**
   * Genera una respuesta de texto libre (NO JSON estructurado).
   * @param systemPrompt Prompt de sistema.
   * @param userContent  Contenido del mensaje del usuario.
   * @param options      Opciones opcionales: maxTokens (por defecto 400).
   * @returns Texto plano de la respuesta del modelo.
   */
  chatReply(
    systemPrompt: string,
    userContent: string,
    options?: ChatReplyOptions
  ): Promise<string>;
}

/**
 * Signos estándar de cierre de oración: punto, exclamación, interrogación, paréntesis de cierre, comilla latina o comilla doble.
 */
export const SENTENCE_CLOSING_PUNCTUATION = /[.!?\)»"]/;

/**
 * Política común ante corte por límite de tokens en chatReply:
 * Si el proveedor cortó por límite (MAX_TOKENS en Gemini, length en Groq/Local):
 * - Si el texto recibido tiene menos de 200 caracteres O no contiene ningún signo de cierre de oración,
 *   lanza un error controlado con código TRUNCATED_RESPONSE para que chatWithFallback pase al siguiente proveedor.
 * - Si el texto es más largo (>= 200 chars) y sí tiene signos de cierre, no lanza error y se conserva.
 */
export function checkTruncatedResponse(text: string, isLimitCut: boolean): void {
  if (!isLimitCut) {
    return;
  }

  if (text.length < 200 || !SENTENCE_CLOSING_PUNCTUATION.test(text)) {
    const error = new Error("TRUNCATED_RESPONSE");
    (error as any).code = "TRUNCATED_RESPONSE";
    throw error;
  }
}

