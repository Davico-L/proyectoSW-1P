import { ModelProvider, ProviderId } from "./types";
import { editDiagramByInstruction } from "../../services/gemini";

export class GeminiProvider implements ModelProvider {
  readonly id: ProviderId = "gemini";
  readonly label: string = "Google Gemini";

  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== "");
  }

  async editDiagramByInstruction(
    currentModel: { classes: any[]; relations: any[] },
    instruction: string
  ): Promise<{ operations: any[] }> {
    return editDiagramByInstruction(currentModel, instruction);
  }
}

export const geminiProvider = new GeminiProvider();
