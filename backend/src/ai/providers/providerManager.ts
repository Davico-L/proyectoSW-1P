import { ProviderId } from "./types";
import { groqProvider } from "./groqProvider";
import { geminiProvider } from "./geminiProvider";
import { localProvider, getLocalConfig } from "./localProvider";
import { getProvider } from "./index";

export interface FallbackResult {
  operations: any[];
  provider: ProviderId;
  fallback: boolean;
}

// ---------------------------------------------------------------------------
// 1. Estado en memoria del proveedor activo
// ---------------------------------------------------------------------------

function resolveInitialProvider(): ProviderId {
  const env = (process.env.AI_PROVIDER || "groq").toLowerCase().trim();
  if (env === "gemini" || env === "local") {
    return env;
  }
  return "groq";
}

let activeProviderId: ProviderId = resolveInitialProvider();

export function getActiveProviderId(): ProviderId {
  return activeProviderId;
}

export function setActiveProviderId(id: ProviderId): void {
  activeProviderId = id;
}

// ---------------------------------------------------------------------------
// 2. Health check por proveedor con caché de 30 segundos
// ---------------------------------------------------------------------------

interface HealthCacheEntry {
  available: boolean;
  checkedAt: number;
}

const healthCache = new Map<ProviderId, HealthCacheEntry>();
const HEALTH_CACHE_TTL_MS = 30 * 1000;

export const GROQ_MODEL_NAME = "openai/gpt-oss-20b";
export const GEMINI_MODEL_NAME = "gemini-3.6-flash";

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  available: boolean;
  active: boolean;
  model: string | null;
}

/**
 * Health check:
 * - local: ping mínimo a {url}/v1/chat/completions con 3 s de espera máximo.
 * - groq: groqProvider.isConfigured()
 * - gemini: geminiProvider.isConfigured()
 * El resultado se cachea 30 s por proveedor a menos que se use forceRefresh=true.
 */
export async function checkProviderHealth(
  id: ProviderId,
  forceRefresh = false
): Promise<boolean> {
  const cached = healthCache.get(id);
  const now = Date.now();
  if (!forceRefresh && cached && now - cached.checkedAt < HEALTH_CACHE_TTL_MS) {
    return cached.available;
  }

  let available = false;

  if (id === "local") {
    if (!localProvider.isConfigured()) {
      available = false;
    } else {
      const config = getLocalConfig();
      if (!config || !config.url) {
        available = false;
      } else {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        try {
          const response = await fetch(`${config.url}/v1/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: config.model,
              messages: [{ role: "user", content: "ping" }],
              max_tokens: 1,
            }),
            signal: controller.signal,
          });
          available = response.status < 500 || response.status === 400;
        } catch {
          available = false;
        } finally {
          clearTimeout(timeoutId);
        }
      }
    }
  } else if (id === "groq") {
    available = groqProvider.isConfigured();
  } else if (id === "gemini") {
    available = geminiProvider.isConfigured();
  }

  healthCache.set(id, { available, checkedAt: now });
  return available;
}

export function clearHealthCache(): void {
  healthCache.clear();
}

/**
 * Retorna la lista de proveedores (local, groq, gemini) con su disponibilidad,
 * estado activo y modelo en uso. Nunca incluye la URL del túnel ni claves.
 */
export async function listProviders(forceRefresh = false): Promise<ProviderInfo[]> {
  const order: ProviderId[] = ["local", "groq", "gemini"];
  const currentActive = getActiveProviderId();

  const results: ProviderInfo[] = [];
  for (const id of order) {
    const provider = getProvider(id);
    const available = await checkProviderHealth(id, forceRefresh);
    let model: string | null = null;
    if (id === "local") {
      model = getLocalConfig()?.model ?? null;
    } else if (id === "groq") {
      model = GROQ_MODEL_NAME;
    } else if (id === "gemini") {
      model = GEMINI_MODEL_NAME;
    }

    results.push({
      id,
      label: provider?.label || id,
      available,
      active: id === currentActive,
      model,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// 3. Cadena de respaldo
// ---------------------------------------------------------------------------

function getFallbackChain(active: ProviderId): ProviderId[] {
  const baseOrder: ProviderId[] = ["local", "groq", "gemini"];
  const startIdx = baseOrder.indexOf(active);
  if (startIdx >= 0) {
    return baseOrder.slice(startIdx);
  }
  return baseOrder;
}

function isNetworkOrConnectionError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || "").toLowerCase();
  const code = String(err.code || "").toUpperCase();
  return (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    msg.includes("fetch failed") ||
    msg.includes("connection refused") ||
    msg.includes("network") ||
    msg.includes("econnrefused")
  );
}

// ---------------------------------------------------------------------------
// 4. Invocación con respaldo automático
// ---------------------------------------------------------------------------

export async function editWithFallback(
  currentModel: { classes: any[]; relations: any[] },
  instruction: string
): Promise<FallbackResult> {
  const active = activeProviderId;
  const chain = getFallbackChain(active);

  let lastError: any = null;
  let hadInvalidResponse = false;
  let anyProviderAttempted = false;

  for (const providerId of chain) {
    // gemini solo si isConfigured() y health check ok
    const isHealthy = await checkProviderHealth(providerId);
    if (!isHealthy) {
      console.log(`[AI-FALLBACK] Proveedor '${providerId}' no disponible según health check. Saltando...`);
      continue;
    }

    const provider = getProvider(providerId);
    if (!provider) {
      continue;
    }

    anyProviderAttempted = true;
    const isFallback = providerId !== active;

    let attempt = 0;
    const maxAttempts = 2; // reintenta una vez ante INVALID_AI_RESPONSE o error de conexión

    while (attempt < maxAttempts) {
      attempt++;
      try {
        console.log(`[AI-FALLBACK] Intentando proveedor '${providerId}' (intento ${attempt})...`);
        const result = await provider.editDiagramByInstruction(currentModel, instruction);

        console.log(
          `[AI-FALLBACK] Consulta atendida por '${providerId}' (fallback: ${isFallback ? "SÍ" : "NO"})`
        );

        return {
          operations: result.operations,
          provider: providerId,
          fallback: isFallback,
        };
      } catch (err: any) {
        lastError = err;
        console.warn(
          `[AI-FALLBACK] Error en proveedor '${providerId}' (intento ${attempt}):`,
          err?.message || err
        );

        const isInvalidResponse = err instanceof Error && err.message === "INVALID_AI_RESPONSE";
        if (isInvalidResponse) {
          hadInvalidResponse = true;
        }

        const isTimeout =
          err?.message === "AI_TIMEOUT" ||
          err?.name === "AbortError" ||
          err?.name === "TimeoutError";

        // ante AI_TIMEOUT del local NO reintenta y pasa directo al siguiente
        if (providerId === "local" && isTimeout) {
          console.log(`[AI-FALLBACK] AI_TIMEOUT en local. No se reintenta, pasando al siguiente proveedor...`);
          break;
        }

        const isConnectionError = isNetworkOrConnectionError(err);
        const canRetry = (isInvalidResponse || isConnectionError) && attempt === 1;

        if (canRetry) {
          console.log(
            `[AI-FALLBACK] Reintentando proveedor '${providerId}' tras ${
              isInvalidResponse ? "INVALID_AI_RESPONSE" : "error de conexión"
            }...`
          );
          continue;
        }

        // Si no califica para reintento o ya se usó el reintento, pasar al siguiente proveedor
        break;
      }
    }
  }

  // Si todos fallaron:
  // Si todos fallaron por no estar disponibles (ninguno devolvió INVALID_AI_RESPONSE):
  if (!anyProviderAttempted || !hadInvalidResponse) {
    throw new Error("AI_ALL_PROVIDERS_FAILED");
  }

  // Si falló por formato inválido u otro error específico de interpretación, relanzar el último error
  throw lastError || new Error("AI_ALL_PROVIDERS_FAILED");
}
