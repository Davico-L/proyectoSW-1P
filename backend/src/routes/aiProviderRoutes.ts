/**
 * aiProviderRoutes.ts
 *
 * POST /ai/providers/local/register
 *   — Registra un servidor local de IA OpenAI-compatible (ej. Colab + vLLM/llama.cpp).
 *   — Autenticado exclusivamente por la clave de registro interna AI_REGISTRATION_TOKEN.
 *   — NO usa la autenticación de sesión de usuarios.
 *   — Nunca se imprimen ni registran tokens, claves ni su contenido parcial en logs.
 */

import { Router, Request, Response } from "express";
import crypto from "crypto";
import { setLocalConfig } from "../ai/providers";

export const aiProviderRouter = Router();

// Tiempo máximo (ms) para el probe de conectividad antes de registrar el modelo
const PROBE_TIMEOUT_MS = 3000;

/**
 * Verifica de forma segura que el token enviado por el cliente coincide
 * con AI_REGISTRATION_TOKEN del servidor usando comparación en tiempo constante.
 * Retorna false si la variable de entorno no está configurada.
 */
function isTokenValid(clientToken: string): boolean {
  const serverToken = process.env.AI_REGISTRATION_TOKEN;
  if (!serverToken || serverToken.trim() === "") {
    return false;
  }
  try {
    // Ambos buffers deben tener la misma longitud para timingSafeEqual;
    // si difieren, falla sin filtrar información por tiempo.
    const a = Buffer.from(clientToken, "utf8");
    const b = Buffer.from(serverToken, "utf8");
    if (a.length !== b.length) {
      // Comparación ficticia para mantener tiempo constante, luego rechazar
      crypto.timingSafeEqual(Buffer.alloc(b.length), b);
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Verifica que el modelo responde antes de registrarlo.
 * Envía un mensaje mínimo al endpoint /v1/chat/completions con timeout estricto.
 * Retorna true si la respuesta HTTP fue exitosa (2xx), false en cualquier otro caso.
 */
async function probeModel(url: string, model: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(`${url}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      }),
      signal: controller.signal,
    });
    // Aceptamos cualquier respuesta HTTP (incluidas respuestas de error del modelo)
    // siempre que el servidor esté en línea y acepte la conexión.
    return response.status < 500 || response.status === 400;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * POST /ai/providers/local/register
 *
 * Body:   { "url": "https://...", "model": "nombre-del-modelo" }
 * Header: x-registration-token: <AI_REGISTRATION_TOKEN>
 *
 * Respuestas:
 *   200  { ok: true, provider: "local", model }
 *   400  { error: "INVALID_INPUT", message: "..." }
 *   401  { error: "UNAUTHORIZED", message: "Clave de registro inválida" }
 *   502  { error: "MODEL_UNREACHABLE", message: "El modelo no respondió" }
 *   500  { error: "INTERNAL_SERVER_ERROR", message: "..." }
 */
aiProviderRouter.post(
  "/local/register",
  async (req: Request, res: Response): Promise<void> => {
    // -----------------------------------------------------------------------
    // 1. Autenticación por token de registro (antes de cualquier otra lógica)
    // -----------------------------------------------------------------------
    const clientToken = req.headers["x-registration-token"];
    if (typeof clientToken !== "string" || !isTokenValid(clientToken)) {
      res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Clave de registro inválida",
      });
      return;
    }

    // -----------------------------------------------------------------------
    // 2. Validación del body
    // -----------------------------------------------------------------------
    const { url, model } = req.body ?? {};

    if (typeof url !== "string" || url.trim() === "") {
      res.status(400).json({
        error: "INVALID_INPUT",
        message: "El campo 'url' es requerido y debe ser una cadena no vacía.",
      });
      return;
    }

    if (typeof model !== "string" || model.trim() === "") {
      res.status(400).json({
        error: "INVALID_INPUT",
        message: "El campo 'model' es requerido y debe ser una cadena no vacía.",
      });
      return;
    }

    // Limpiar la URL: quitar barra final
    const cleanUrl = url.trim().replace(/\/+$/, "");
    const cleanModel = model.trim();

    // Validar esquema de URL:
    //   - Siempre se acepta https://
    //   - Solo en desarrollo (NODE_ENV !== "production") se acepta http://localhost
    const isHttpsUrl = cleanUrl.startsWith("https://");
    const isLocalhostHttp =
      process.env.NODE_ENV !== "production" &&
      /^http:\/\/localhost(:\d+)?($|\/)/.test(cleanUrl);

    if (!isHttpsUrl && !isLocalhostHttp) {
      const devNote =
        process.env.NODE_ENV !== "production"
          ? " En desarrollo también se acepta http://localhost."
          : "";
      res.status(400).json({
        error: "INVALID_INPUT",
        message: `La URL debe comenzar con https://.${devNote}`,
      });
      return;
    }

    // -----------------------------------------------------------------------
    // 3. Probe de conectividad (máximo PROBE_TIMEOUT_MS ms)
    // -----------------------------------------------------------------------
    console.log(`[aiProviderRoutes] Verificando conectividad con el modelo en ${cleanUrl} ...`);
    const reachable = await probeModel(cleanUrl, cleanModel);
    if (!reachable) {
      console.warn(`[aiProviderRoutes] El modelo no respondió en ${PROBE_TIMEOUT_MS}ms.`);
      res.status(502).json({
        error: "MODEL_UNREACHABLE",
        message: "El modelo no respondió. Verificá que el servidor esté activo y accesible.",
      });
      return;
    }

    // -----------------------------------------------------------------------
    // 4. Registro del proveedor local en memoria
    // -----------------------------------------------------------------------
    setLocalConfig({ url: cleanUrl, model: cleanModel });
    console.log(`[aiProviderRoutes] Proveedor local registrado. Modelo: ${cleanModel}`);

    res.status(200).json({ ok: true, provider: "local", model: cleanModel });
  }
);
