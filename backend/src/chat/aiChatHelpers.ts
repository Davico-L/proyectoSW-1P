/**
 * Funciones puras de ayuda para la integración de IA en el chat de equipo (CU19).
 */

export const AI_DISPLAY_NAME = "Codia";
export const AI_MENTION_ALIASES = ["ia", "codia"] as const;

export interface ParseMentionResult {
  mentioned: boolean;
  question: string;
}

/**
 * Detecta menciones a la IA ("@ia" o "@codia") sin distinguir mayúsculas, en cualquier parte del mensaje,
 * solo como palabra completa (al inicio o precedida de espacio, y seguida de espacio,
 * fin de texto o signo de puntuación).
 *
 * Ejemplos que no cuentan: "@iab", "@codiax", "correo@ia.com", "contacto@codia.com".
 * "question" es el texto sin la mención, con espacios colapsados y recortado.
 * "@ia" o "@codia" a secas devuelve { mentioned: true, question: "" }.
 */
export function parseMention(text: string): ParseMentionResult {
  if (typeof text !== "string") {
    return { mentioned: false, question: "" };
  }

  // Regex para detectar @ia o @codia como palabra completa:
  // - Precedido de inicio de texto o espacio: (?<=^|\s)
  // - Mención: @(?:ia|codia) (case insensitive)
  // - Seguido de espacio, fin de texto o signo de puntuación: (?=[\s\p{P}]|$)
  const mentionMatcher = /(?<=^|\s)@(?:ia|codia)(?=[\s\p{P}]|$)/iu;

  if (!mentionMatcher.test(text)) {
    return {
      mentioned: false,
      question: text.replace(/\s+/g, " ").trim(),
    };
  }

  // Eliminar la mención respetando los límites
  const mentionReplacer = /(?<=^|\s)@(?:ia|codia)(?=[\s\p{P}]|$)/giu;
  const question = text
    .replace(mentionReplacer, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    mentioned: true,
    question,
  };
}

/**
 * Pasa a minúscula la primera letra del texto, salvo que la primera palabra sea
 * una sigla o nombre en mayúsculas (por ejemplo "UML", "SQL"), lo cual se detecta
 * si su segunda letra también es mayúscula.
 */
export function lowerFirstIfNotAcronym(text: string): string {
  // Encontrar la primera letra (incluyendo caracteres Unicode acentuados)
  const firstLetterMatch = text.match(/\p{L}/u);
  if (!firstLetterMatch || firstLetterMatch.index === undefined) {
    return text;
  }

  const idx = firstLetterMatch.index;
  const firstChar = text[idx];

  // Buscar la siguiente letra en la misma primera palabra (hasta el primer espacio)
  const restOfWord = text.slice(idx + 1).split(/\s/)[0];
  const secondLetterMatch = restOfWord.match(/\p{L}/u);

  if (secondLetterMatch) {
    const secondChar = secondLetterMatch[0];
    // Si la segunda letra también es mayúscula (ej. "UML", "SQL"), no se modifica
    if (
      secondChar === secondChar.toUpperCase() &&
      secondChar !== secondChar.toLowerCase()
    ) {
      return text;
    }
  }

  return text.slice(0, idx) + firstChar.toLowerCase() + text.slice(idx + 1);
}

/**
 * Asegura que la respuesta nombre al usuario en sus primeros 40 caracteres.
 * - Si en los primeros 40 caracteres de response aparece name (sin distinguir mayúsculas), la devuelve igual.
 * - Si no, antepone "{name}, " a la respuesta.
 * - Cuando anteponga "{nombre}, ", pasa a minúscula la primera letra de la respuesta original,
 *   salvo que la primera palabra sea una sigla o nombre en mayúsculas (ej. "UML", "SQL"),
 *   que se detecta porque su segunda letra también es mayúscula.
 * - Si name está vacío o no es un string válido, devuelve response sin cambios.
 */
export function ensureAddressedByName(response: string, name: string): string {
  if (typeof response !== "string") {
    return "";
  }

  if (typeof name !== "string") {
    return response;
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return response;
  }

  const first40 = response.slice(0, 40).toLowerCase();
  if (first40.includes(trimmedName.toLowerCase())) {
    return response;
  }

  const adjustedResponse = lowerFirstIfNotAcronym(response);
  return `${trimmedName}, ${adjustedResponse}`;
}

/**
 * Si el texto no termina en . ! ? ) » o ", lo recorta hasta el último signo de fin de oración que exista;
 * si no hay ninguno, lo devuelve igual.
 */
export function trimToLastSentence(text: string): string {
  if (typeof text !== "string") {
    return "";
  }

  const trimmed = text.trimEnd();
  if (!trimmed) {
    return "";
  }

  const sentenceEndings = [".", "!", "?", ")", "»", '"'];
  const lastChar = trimmed[trimmed.length - 1];
  if (sentenceEndings.includes(lastChar)) {
    return trimmed;
  }

  let lastIndex = -1;
  for (let i = trimmed.length - 1; i >= 0; i--) {
    if (sentenceEndings.includes(trimmed[i])) {
      lastIndex = i;
      break;
    }
  }

  if (lastIndex === -1) {
    return text;
  }

  return trimmed.slice(0, lastIndex + 1);
}

/**
 * Quita al inicio del texto (hasta dos veces, en cualquier orden):
 * - Un saludo del tipo "Hola…", "¡Hola…!", "Buenas…" hasta su punto o signo de cierre
 *   (. ! ? : \n o fin de texto), con un máximo de 60 caracteres.
 * - Una presentación del tipo "Soy Codia…" o "Me llamo Codia…" hasta su punto o signo de cierre
 *   (. ! ? : \n o fin de texto), con un máximo de 100 caracteres.
 *
 * Si una frase empieza con "Hola" o similar pero supera la longitud de un saludo corto
 * (por ejemplo > 60 caracteres antes de su cierre), se conserva intacta como parte del contenido.
 * Tras el recorte, los espacios iniciales residuales se eliminan sin alterar la primera letra restante.
 */
export function stripGreetingPreamble(text: string): string {
  if (typeof text !== "string" || !text) {
    return text || "";
  }

  let current = text.trimStart();

  // Patrón de saludo corto (<= 60 caracteres hasta el signo de cierre, salto de línea o fin)
  const greetingRegex =
    /^(?:¡\s*)?(?:hola|buenas(?:\s+(?:tardes|días|dias|noches))?)\b[^\n.!?]{0,55}(?:[.!?:]+|\n|$)\s*/iu;

  // Patrón de presentación corta (<= 100 caracteres hasta el signo de cierre, salto de línea o fin)
  const presentationRegex =
    /^(?:soy|me\s+llamo)\s+(?:\*\*)?codia(?:\*\*)?\b[^\n.!?]{0,90}(?:[.!?:]+|\n|$)\s*/iu;

  for (let i = 0; i < 2; i++) {
    const greetingMatch = current.match(greetingRegex);
    if (greetingMatch && greetingMatch[0].length <= 60) {
      current = current.slice(greetingMatch[0].length);
      continue;
    }

    const presentationMatch = current.match(presentationRegex);
    if (presentationMatch && presentationMatch[0].length <= 100) {
      current = current.slice(presentationMatch[0].length);
      continue;
    }

    break;
  }

  return current;
}


