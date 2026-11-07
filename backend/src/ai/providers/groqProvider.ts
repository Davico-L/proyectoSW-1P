import {
  ModelProvider,
  ProviderId,
  ChatReplyOptions,
  checkTruncatedResponse,
} from "./types";
import { editDiagramByInstructionGroq } from "../../services/groq";

const GROQ_CHAT_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_CHAT_MODEL = "openai/gpt-oss-20b";
const DEFAULT_MAX_TOKENS = 700;

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

  async chatReply(
    systemPrompt: string,
    userContent: string,
    options?: ChatReplyOptions
  ): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY no está configurada en el entorno.");
    }

    const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
    const timeoutMs = parseInt(process.env.GROQ_TIMEOUT_MS || "", 10) || 20000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(GROQ_CHAT_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GROQ_CHAT_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          max_tokens: maxTokens,
          reasoning_effort: "low",
        }),
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      if (controller.signal.aborted) {
        throw new Error("AI_TIMEOUT");
      }
      throw fetchError;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      let errorBody = "";
      try { errorBody = await response.text(); } catch { /* ignorar */ }
      throw new Error(`Groq API error HTTP ${response.status}: ${errorBody || response.statusText}`);
    }

    const data: any = await response.json();
    const choice = data?.choices?.[0];
    const finishReason = choice?.finish_reason;
    const text: string = (choice?.message?.content ?? "").trim();

    if (!text) {
      throw new Error("INVALID_AI_RESPONSE");
    }

    const isLimitCut = finishReason === "length";
    checkTruncatedResponse(text, isLimitCut);

    return text;
  }
}

export const groqProvider = new GroqProvider();
