export const AI_DISPLAY_NAME = "Codia";

export interface PublicProposalData {
  id: string;
  status: "pending" | "approved" | "rejected" | "expired" | string;
  summary: string[];
  requestedBy: string;
  decidedBy?: string;
  decidedAt?: string | Date;
}

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
  proposal?: PublicProposalData;
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
