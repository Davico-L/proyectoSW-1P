export interface MessageSegment {
  text: string;
  isMention: boolean;
}

/**
 * Regex para detectar @ia o @codia como palabra completa:
 * - Precedido de inicio de texto o espacio: (?<=^|\s)
 * - Mención: @(?:ia|codia) (case insensitive)
 * - Seguido de espacio, fin de texto o signo de puntuación: (?=[\s\p{P}]|$)
 */
const MENTION_REGEX = /(?<=^|\s)@(?:ia|codia)(?=[\s\p{P}]|$)/giu;

/**
 * Divide el texto de un mensaje en fragmentos distinguiendo las menciones a la IA
 * (@ia o @codia, case-insensitive, como palabra completa) del texto normal.
 * Función pura segura para renderizar en React sin dangerouslySetInnerHTML.
 */
export function formatMessageSegments(text: string): MessageSegment[] {
  if (!text) {
    return [];
  }

  const segments: MessageSegment[] = [];
  let lastIndex = 0;

  // Creamos una nueva RegExp para resetear lastIndex de forma aislada
  const regex = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index;
    const matchText = match[0];

    if (matchIndex > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, matchIndex),
        isMention: false,
      });
    }

    segments.push({
      text: matchText,
      isMention: true,
    });

    lastIndex = matchIndex + matchText.length;
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      isMention: false,
    });
  }

  return segments;
}

export interface MentionSuggestionMatch {
  word: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Evalúa si la palabra que se está escribiendo actualmente bajo la posición del cursor
 * comienza con "@" y es un prefijo incompleto de "@Codia" o "@ia" (case-insensitive).
 *
 * Ejemplos que coinciden: "@", "@c", "@co", "@cod", "@codi", "@C", "@i", "@I".
 * Ejemplos que NO coinciden:
 * - Ya completa: "@codia", "@ia", "@Codia"
 * - No empieza con @: "hola", "correo@c"
 * - Otro prefijo: "@xyz", "@iab", "@codiax"
 */
export function getMentionSuggestionMatch(
  text: string,
  cursorPos: number
): MentionSuggestionMatch | null {
  if (typeof text !== "string" || cursorPos < 1 || cursorPos > text.length) {
    return null;
  }

  // Tomamos el fragmento de texto hasta el cursor
  const textBeforeCursor = text.slice(0, cursorPos);

  // Buscamos el inicio de la palabra actual (delimitado por espacio, salto de línea o tabulador)
  const lastDelimiterIndex = Math.max(
    textBeforeCursor.lastIndexOf(" "),
    textBeforeCursor.lastIndexOf("\n"),
    textBeforeCursor.lastIndexOf("\t")
  );

  const wordStart = lastDelimiterIndex === -1 ? 0 : lastDelimiterIndex + 1;
  const currentWord = textBeforeCursor.slice(wordStart);

  if (!currentWord.startsWith("@")) {
    return null;
  }

  const lower = currentWord.toLowerCase();

  // Prefijo incompleto de @codia o @ia
  const isCodiaPrefix = "@codia".startsWith(lower) && lower !== "@codia";
  const isIaPrefix = "@ia".startsWith(lower) && lower !== "@ia";

  if (isCodiaPrefix || isIaPrefix) {
    return {
      word: currentWord,
      startIndex: wordStart,
      endIndex: cursorPos,
    };
  }

  return null;
}
