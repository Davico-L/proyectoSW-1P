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
