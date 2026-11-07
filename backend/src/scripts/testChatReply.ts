/**
 * Script manual de prueba de chatReply (CU19).
 *
 * Uso:
 *   npx tsx backend/src/scripts/testChatReply.ts local
 *   npx tsx backend/src/scripts/testChatReply.ts groq
 *   npx tsx backend/src/scripts/testChatReply.ts gemini
 *   npx tsx backend/src/scripts/testChatReply.ts auto
 *
 * "local" requiere LOCAL_AI_URL y LOCAL_AI_MODEL en el entorno, o que haya
 * un proveedor registrado con setLocalConfig.
 * "auto" usa el manager con cadena de respaldo completa.
 */

import dotenv from "dotenv";
dotenv.config();

import { groqProvider } from "../ai/providers/groqProvider";
import { geminiProvider } from "../ai/providers/geminiProvider";
import { localProvider, setLocalConfig } from "../ai/providers/localProvider";
import { chatWithFallback, setActiveProviderId } from "../ai/providers/providerManager";
import type { ProviderId } from "../ai/providers/types";

const SYSTEM = "Eres un mentor de desarrollo. Responde en español en una frase.";
const USER   = "¿Cuánto es 2 + 2?";
const MAX_TOKENS = 400;

async function main(): Promise<void> {
  const arg = (process.argv[2] ?? "auto").toLowerCase().trim();

  // Si se usa "local", intentar configurar desde variables de entorno
  if (arg === "local" || arg === "auto") {
    const localUrl   = process.env.LOCAL_AI_URL?.trim();
    const localModel = process.env.LOCAL_AI_MODEL?.trim();
    if (localUrl && localModel) {
      setLocalConfig({ url: localUrl, model: localModel });
      console.log(`[testChatReply] Proveedor local configurado: ${localUrl} (${localModel})`);
    } else if (arg === "local") {
      console.error(
        "[testChatReply] ERROR: Para 'local' se necesita LOCAL_AI_URL y LOCAL_AI_MODEL en el entorno."
      );
      process.exit(1);
    }
  }

  console.log(`\n[testChatReply] Proveedor: ${arg}`);
  console.log(`[testChatReply] System: "${SYSTEM}"`);
  console.log(`[testChatReply] User  : "${USER}"\n`);

  const start = Date.now();

  try {
    let responseText: string;
    let usedProvider: string;

    if (arg === "auto") {
      const result = await chatWithFallback(SYSTEM, USER, { maxTokens: MAX_TOKENS });
      responseText = result.text;
      usedProvider = result.provider + (result.fallback ? " (fallback)" : "");
    } else if (arg === "groq") {
      if (!groqProvider.isConfigured()) {
        console.error("[testChatReply] ERROR: GROQ_API_KEY no está configurada.");
        process.exit(1);
      }
      responseText = await groqProvider.chatReply(SYSTEM, USER, { maxTokens: MAX_TOKENS });
      usedProvider = "groq";
    } else if (arg === "gemini") {
      if (!geminiProvider.isConfigured()) {
        console.error("[testChatReply] ERROR: GEMINI_API_KEY no está configurada.");
        process.exit(1);
      }
      responseText = await geminiProvider.chatReply(SYSTEM, USER, { maxTokens: MAX_TOKENS });
      usedProvider = "gemini";
    } else if (arg === "local") {
      if (!localProvider.isConfigured()) {
        console.error("[testChatReply] ERROR: Proveedor local no configurado. Revisa LOCAL_AI_URL y LOCAL_AI_MODEL.");
        process.exit(1);
      }
      responseText = await localProvider.chatReply(SYSTEM, USER, { maxTokens: MAX_TOKENS });
      usedProvider = "local";
    } else {
      console.error(`[testChatReply] Proveedor desconocido: '${arg}'. Usa: local, groq, gemini, auto.`);
      process.exit(1);
    }

    const elapsed = Date.now() - start;
    console.log(`✓ Proveedor usado : ${usedProvider}`);
    console.log(`✓ Tiempo          : ${elapsed} ms`);
    console.log(`✓ Respuesta       : ${responseText}`);
  } catch (err: any) {
    const elapsed = Date.now() - start;
    console.error(`✗ Error (${elapsed} ms): ${err?.message || err}`);
    process.exit(1);
  }
}

main();
