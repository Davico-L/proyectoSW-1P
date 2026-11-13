import { FONT_FAMILY, getLineHeight } from "@excalidraw/common";
import { getLineHeightInPx } from "@excalidraw/element";
import type { FontFamilyValues } from "@excalidraw/element/types";

export const DEFAULT_UML_FONT_SIZE = 16;
export const DEFAULT_UML_FONT_FAMILY: FontFamilyValues =
  FONT_FAMILY["Liberation Sans"];

/**
 * Devuelve el alto de línea real en píxeles para el tamaño y familia de fuente dados.
 */
export function getUmlLineHeightInPx(
  fontSize: number = DEFAULT_UML_FONT_SIZE,
  fontFamily: FontFamilyValues = DEFAULT_UML_FONT_FAMILY,
): number {
  const lineHeight = getLineHeight(fontFamily);
  return getLineHeightInPx(fontSize, lineHeight);
}

/**
 * Calcula la altura del contenedor de una clase UML:
 * alto del texto (lineCount * lineHeightPx) + un renglón de alto de línea (1 * lineHeightPx).
 * Total: (lineCount + 1) * lineHeightPx.
 *
 * Esto garantiza que el sobrante vertical sea exactamente media línea (0.5 * lineHeightPx)
 * en el borde superior y media línea en el borde inferior, igual a la distancia entre
 * el texto y el centro de cada renglón vacío donde se dibuja cada línea separadora.
 */
export function computeUmlClassHeight(
  lineCount: number,
  fontSize: number = DEFAULT_UML_FONT_SIZE,
  fontFamily: FontFamilyValues = DEFAULT_UML_FONT_FAMILY,
): number {
  const safeLineCount = Math.max(1, lineCount);
  const lineHeightPx = getUmlLineHeightInPx(fontSize, fontFamily);
  return (safeLineCount + 1) * lineHeightPx;
}
