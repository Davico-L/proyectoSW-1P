import React from "react";

export type AiTextSegment =
  | { type: "text"; content: string }
  | { type: "code-block"; code: string; language?: string }
  | { type: "inline-code"; code: string }
  | { type: "bold"; text: string };

/**
 * Regex para bloques de código cercados con triple backtick (```).
 * Captura:
 * 1. Identificador opcional de lenguaje (ej. typescript, py, uml, json)
 * 2. Contenido del código
 */
const CODE_BLOCK_REGEX =
  /```([a-zA-Z0-9_+#.-]*)[ \t]*(?:\r?\n)?([\s\S]*?)(?:\r?\n)?```/g;

/**
 * Regex para tokens en línea:
 * - Código en línea: `...` (sin saltos de línea y al menos 1 caracter que no sea backtick)
 * - Negrita: **...** (delimitadores de CommonMark: sin espacio al inicio ni al final, sin saltos de línea y sin **)
 */
const INLINE_CODE_REGEX = /`([^`\r\n]+)`/g;
const BOLD_REGEX = /\*\*(?!\s)((?:(?!\*\*)[^\r\n])+?)(?<!\s)\*\*/g;

/**
 * Fusiona segmentos consecutivos de tipo 'text' y elimina fragmentos vacíos.
 */
function mergeTextSegments(segments: AiTextSegment[]): AiTextSegment[] {
  const merged: AiTextSegment[] = [];
  for (const seg of segments) {
    if (seg.type === "text") {
      if (seg.content === "") continue;
      const last = merged[merged.length - 1];
      if (last && last.type === "text") {
        last.content += seg.content;
      } else {
        merged.push({ ...seg });
      }
    } else {
      merged.push(seg);
    }
  }
  return merged;
}

/**
 * Analiza fragmentos de texto en busca de código en línea (`...`) y negrita (**...**).
 * Si detecta una cerca de bloque de código no cerrada (```), trata todo desde esa cerca
 * como texto plano.
 */
function parseInlineSegments(text: string): AiTextSegment[] {
  if (!text) {
    return [];
  }

  // Si hay una cerca de bloque de código sin cerrar, todo desde esa cerca se trata como texto plano
  const unclosedFenceIndex = text.indexOf("```");
  if (unclosedFenceIndex !== -1) {
    const beforeFence = text.slice(0, unclosedFenceIndex);
    const unclosedFenceText = text.slice(unclosedFenceIndex);
    const result: AiTextSegment[] = [];
    if (beforeFence) {
      result.push(...parseInlineSegments(beforeFence));
    }
    result.push({ type: "text", content: unclosedFenceText });
    return result;
  }

  const segments: AiTextSegment[] = [];
  const inlineCodeRegex = new RegExp(INLINE_CODE_REGEX.source, INLINE_CODE_REGEX.flags);
  const boldRegex = new RegExp(BOLD_REGEX.source, BOLD_REGEX.flags);

  let pos = 0;

  while (pos < text.length) {
    inlineCodeRegex.lastIndex = pos;
    boldRegex.lastIndex = pos;

    const codeMatch = inlineCodeRegex.exec(text);
    const boldMatch = boldRegex.exec(text);

    if (!codeMatch && !boldMatch) {
      segments.push({ type: "text", content: text.slice(pos) });
      break;
    }

    const codeIndex = codeMatch ? codeMatch.index : -1;
    const boldIndex = boldMatch ? boldMatch.index : -1;

    let nextMatch: {
      type: "inline-code" | "bold";
      index: number;
      fullLength: number;
      text: string;
    };

    if (codeIndex !== -1 && (boldIndex === -1 || codeIndex < boldIndex)) {
      nextMatch = {
        type: "inline-code",
        index: codeIndex,
        fullLength: codeMatch![0].length,
        text: codeMatch![1],
      };
    } else {
      nextMatch = {
        type: "bold",
        index: boldIndex,
        fullLength: boldMatch![0].length,
        text: boldMatch![1],
      };
    }

    if (nextMatch.index > pos) {
      segments.push({
        type: "text",
        content: text.slice(pos, nextMatch.index),
      });
    }

    if (nextMatch.type === "inline-code") {
      segments.push({
        type: "inline-code",
        code: nextMatch.text,
      });
    } else {
      segments.push({
        type: "bold",
        text: nextMatch.text,
      });
    }

    pos = nextMatch.index + nextMatch.fullLength;
  }

  return segments;
}

/**
 * Función pura que divide el texto generado por la IA en segmentos estructurados.
 * Soporta ÚNICAMENTE:
 * - Bloques de código cercados con ```lenguaje ... ```
 * - Código en línea con `...`
 * - Negrita con **...**
 * Cualquier otro caracter (HTML, asteriscos sueltos, etc.) o bloque sin cerrar se mantiene como texto plano.
 */
export function parseAiTextSegments(text: string): AiTextSegment[] {
  if (!text || typeof text !== "string") {
    return [];
  }

  const segments: AiTextSegment[] = [];
  const codeBlockRegex = new RegExp(CODE_BLOCK_REGEX.source, CODE_BLOCK_REGEX.flags);
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    const fullMatch = match[0];
    const rawLang = match[1]?.trim();
    const code = match[2];

    // Texto previo al bloque de código
    if (matchIndex > lastIndex) {
      const beforeText = text.slice(lastIndex, matchIndex);
      segments.push(...parseInlineSegments(beforeText));
    }

    segments.push({
      type: "code-block",
      language: rawLang ? rawLang : undefined,
      code,
    });

    lastIndex = matchIndex + fullMatch.length;
  }

  // Texto restante tras el último bloque de código
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    segments.push(...parseInlineSegments(remainingText));
  }

  return mergeTextSegments(segments);
}

/**
 * Renderiza los segmentos formateados como elementos React seguros (sin dangerouslySetInnerHTML).
 * Cualquier HTML escrito por el modelo es escapado como texto plano por React.
 */
export function renderAiFormattedText(text: string): React.ReactNode {
  const segments = parseAiTextSegments(text);
  if (segments.length === 0) {
    return null;
  }

  return segments.map((seg, idx) => {
    switch (seg.type) {
      case "code-block":
        return (
          <pre
            key={idx}
            className="team-chat-code-block"
            data-language={seg.language}
          >
            <code className="team-chat-code-content">{seg.code}</code>
          </pre>
        );
      case "inline-code":
        return (
          <code key={idx} className="team-chat-inline-code">
            {seg.code}
          </code>
        );
      case "bold":
        return (
          <strong key={idx} className="team-chat-bold">
            {seg.text}
          </strong>
        );
      case "text":
      default:
        return <React.Fragment key={idx}>{seg.content}</React.Fragment>;
    }
  });
}
