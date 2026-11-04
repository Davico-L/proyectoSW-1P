import { ModelProvider, ProviderId } from "./types";
import { editDiagramByInstructionGroq } from "../../services/groq";

export class GroqProvider implements ModelProvider {
  readonly id: ProviderId = "groq";
  readonly label: string = "Groq";

  isConfigured(): boolean {
    return Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== "");
  }

  async editDiagramByInstruction(
    currentModel: { classes: any[]; relations: any[] },
    instruction: string
  ): Promise<{ operations: any[] }> {
    return editDiagramByInstructionGroq(currentModel, instruction);
  }
}

export const groqProvider = new GroqProvider();
