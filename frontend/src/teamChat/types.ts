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
