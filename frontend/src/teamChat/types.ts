export const AI_DISPLAY_NAME = "Codia";

export interface PublicChatMessage {
  id: string;
  diagramId: string;
  authorName: string;
  role: "user" | "ai" | "system" | string;
  text: string;
  createdAt: string | Date;
  mentions?: string[];
  replyTo?: string;
  addressedTo?: string;
  proposal?: any;
  kind?: string;
}

export type ProviderId = "local" | "groq" | "gemini";

export interface AiProviderInfo {
  id: ProviderId;
  label: string;
  available: boolean;
  active: boolean;
  model: string | null;
}
