export type ProviderId = "local" | "groq" | "gemini";

export interface ModelProvider {
  readonly id: ProviderId;
  readonly label: string;
  isConfigured(): boolean;
  editDiagramByInstruction(
    currentModel: { classes: any[]; relations: any[] },
    instruction: string
  ): Promise<{ operations: any[] }>;
}
