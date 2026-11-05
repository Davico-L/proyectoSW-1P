import { ModelProvider, ProviderId } from "./types";
import { GroqProvider, groqProvider } from "./groqProvider";
import { GeminiProvider, geminiProvider } from "./geminiProvider";
import { LocalProvider, localProvider } from "./localProvider";

export * from "./types";
export * from "./groqProvider";
export * from "./geminiProvider";
export * from "./localProvider";
export * from "./providerManager";

const providers: Map<ProviderId, ModelProvider> = new Map<ProviderId, ModelProvider>([
  ["groq", groqProvider],
  ["gemini", geminiProvider],
  ["local", localProvider],
]);

export function registerProvider(provider: ModelProvider): void {
  providers.set(provider.id, provider);
}

export function getProvider(id: ProviderId | string): ModelProvider | undefined {
  if (!id) return undefined;
  const normalized = id.toLowerCase().trim() as ProviderId;
  return providers.get(normalized);
}
