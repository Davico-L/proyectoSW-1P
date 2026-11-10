import { RoomStyle } from "./roomSettingsRepository";

export const DIRECTA_STYLE_FRAGMENT =
  "Ajuste de estilo y longitud (prioritario sobre instrucciones anteriores de longitud): responde de forma directa y concisa, hasta unas 60 palabras, sin ejemplos salvo que se pidan explícitamente.";

export const DETALLADA_STYLE_FRAGMENT =
  "Ajuste de estilo y longitud (prioritario sobre instrucciones anteriores de longitud): responde de forma detallada y explicativa, con una longitud de hasta unas 180 palabras, profundizando en los fundamentos de la solución y sus implicaciones en el diagrama.";

/**
 * Devuelve el prompt de sistema base enriquecido con la directiva de estilo correspondiente:
 * - "directa": hasta unas 60 palabras, sin ejemplos salvo que se pidan.
 * - "mentora": unas 120 palabras con ejemplo (comportamiento actual; devuelve el prompt base sin cambios).
 * - "detallada": hasta unas 180 palabras.
 *
 * No modifica las constantes originales de prompt base.
 */
export function buildSystemPrompt(
  basePrompt: string,
  style?: RoomStyle | string
): string {
  if (!style || style === "mentora") {
    return basePrompt;
  }

  if (style === "directa") {
    const separator = basePrompt && !basePrompt.endsWith(" ") ? " " : "";
    return `${basePrompt}${separator}${DIRECTA_STYLE_FRAGMENT}`;
  }

  if (style === "detallada") {
    const separator = basePrompt && !basePrompt.endsWith(" ") ? " " : "";
    return `${basePrompt}${separator}${DETALLADA_STYLE_FRAGMENT}`;
  }

  return basePrompt;
}
