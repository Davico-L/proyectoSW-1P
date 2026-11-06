export interface PublicChatMessage {
  id: string;
  diagramId: string;
  authorName: string;
  role: string;
  text: string;
  createdAt: string | Date;
  mentions?: string[];
  proposal?: any;
}

export type ProviderId = "local" | "groq" | "gemini";

export interface AiProviderInfo {
  id: ProviderId;
  label: string;
  available: boolean;
  active: boolean;
  model: string | null;
}
