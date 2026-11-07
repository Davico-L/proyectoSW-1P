import { GoogleGenAI } from "@google/genai";
import {
  ModelProvider,
  ProviderId,
  ChatReplyOptions,
  checkTruncatedResponse,
} from "./types";
import { editDiagramByInstruction } from "../../services/gemini";

const GEMINI_CHAT_MODEL = "gemini-3.6-flash";
const DEFAULT_MAX_TOKENS = 400;

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

  async chatReply(
    systemPrompt: string,
    userContent: string,
    options?: ChatReplyOptions
  ): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY no está configurada en el entorno.");
    }

    const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: GEMINI_CHAT_MODEL,
      contents: [
        { role: "user", parts: [{ text: userContent }] },
      ],
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: maxTokens,
        thinkingConfig: {
          thinkingBudget: 0,
        },
        httpOptions: { timeout: 20000 },
      },
    });

    const candidate = response?.candidates?.[0];
    const finishReason = candidate?.finishReason;
    const text = (response?.text ?? "").trim();

    if (!text) {
      throw new Error("INVALID_AI_RESPONSE");
    }

    const isLimitCut = finishReason === "MAX_TOKENS";
    checkTruncatedResponse(text, isLimitCut);

    return text;
  }
}

export const geminiProvider = new GeminiProvider();
