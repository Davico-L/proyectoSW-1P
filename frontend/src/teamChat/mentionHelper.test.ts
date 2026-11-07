import { describe, it, expect } from "vitest";
import { formatMessageSegments, getMentionSuggestionMatch } from "./mentionHelper";

describe("formatMessageSegments", () => {
  it("retorna arreglo vacío si el texto está vacío", () => {
    expect(formatMessageSegments("")).toEqual([]);
  });

  it("retorna un único segmento sin mención si no hay menciones", () => {
    const text = "Hola equipo, ¿cómo van con el diagrama?";
    expect(formatMessageSegments(text)).toEqual([
      { text, isMention: false },
    ]);
  });

  it("detecta @ia al inicio del mensaje", () => {
    const text = "@ia ayuda con esta clase";
    expect(formatMessageSegments(text)).toEqual([
      { text: "@ia", isMention: true },
      { text: " ayuda con esta clase", isMention: false },
    ]);
  });

  it("detecta @codia al medio del mensaje", () => {
    const text = "Hola @codia puedes revisar esto";
    expect(formatMessageSegments(text)).toEqual([
      { text: "Hola ", isMention: false },
      { text: "@codia", isMention: true },
      { text: " puedes revisar esto", isMention: false },
    ]);
  });

  it("detecta @ia al final del mensaje con puntuación", () => {
    const text = "¿Qué opinas @ia?";
    expect(formatMessageSegments(text)).toEqual([
      { text: "¿Qué opinas ", isMention: false },
      { text: "@ia", isMention: true },
      { text: "?", isMention: false },
    ]);
  });

  it("es insensible a mayúsculas y minúsculas (@Codia, @CODIA, @IA)", () => {
    const text = "Pregunta para @Codia y luego para @IA.";
    expect(formatMessageSegments(text)).toEqual([
      { text: "Pregunta para ", isMention: false },
      { text: "@Codia", isMention: true },
      { text: " y luego para ", isMention: false },
      { text: "@IA", isMention: true },
      { text: ".", isMention: false },
    ]);
  });

  it("no reconoce menciones como parte de correos electrónicos", () => {
    const text = "Escribe a contacto@codia.com o info@ia.org";
    expect(formatMessageSegments(text)).toEqual([
      { text, isMention: false },
    ]);
  });

  it("no reconoce palabras compuestas que comiencen con el alias (@iab, @codiax)", () => {
    const text = "Revisa @iab y también @codiax por favor";
    expect(formatMessageSegments(text)).toEqual([
      { text, isMention: false },
    ]);
  });

  it("maneja un mensaje que solo contiene la mención", () => {
    expect(formatMessageSegments("@codia")).toEqual([
      { text: "@codia", isMention: true },
    ]);
    expect(formatMessageSegments("@ia")).toEqual([
      { text: "@ia", isMention: true },
    ]);
  });

  it("preserva caracteres especiales y saltos de línea", () => {
    const text = "Hola\n@codia:\n- Punto 1\n- Punto 2";
    expect(formatMessageSegments(text)).toEqual([
      { text: "Hola\n", isMention: false },
      { text: "@codia", isMention: true },
      { text: ":\n- Punto 1\n- Punto 2", isMention: false },
    ]);
  });
});

describe("getMentionSuggestionMatch", () => {
  it("retorna null si el texto está vacío o el cursor es inválido", () => {
    expect(getMentionSuggestionMatch("", 0)).toBeNull();
    expect(getMentionSuggestionMatch("hola", 0)).toBeNull();
    expect(getMentionSuggestionMatch("hola", 10)).toBeNull();
  });

  it("detecta '@' al inicio o tras espacio", () => {
    expect(getMentionSuggestionMatch("@", 1)).toEqual({
      word: "@",
      startIndex: 0,
      endIndex: 1,
    });

    const text = "Hola @";
    expect(getMentionSuggestionMatch(text, 6)).toEqual({
      word: "@",
      startIndex: 5,
      endIndex: 6,
    });
  });

  it("detecta prefijos de @Codia (@c, @co, @cod, @codi, mayúsculas)", () => {
    expect(getMentionSuggestionMatch("@c", 2)).toEqual({
      word: "@c",
      startIndex: 0,
      endIndex: 2,
    });
    expect(getMentionSuggestionMatch("Pregunta @Co", 12)).toEqual({
      word: "@Co",
      startIndex: 9,
      endIndex: 12,
    });
    expect(getMentionSuggestionMatch("@CODI", 5)).toEqual({
      word: "@CODI",
      startIndex: 0,
      endIndex: 5,
    });
  });

  it("detecta prefijo de @ia (@i, @I)", () => {
    expect(getMentionSuggestionMatch("@i", 2)).toEqual({
      word: "@i",
      startIndex: 0,
      endIndex: 2,
    });
    expect(getMentionSuggestionMatch("Hola @I", 7)).toEqual({
      word: "@I",
      startIndex: 5,
      endIndex: 7,
    });
  });

  it("retorna null si la mención ya está completa (@codia, @ia)", () => {
    expect(getMentionSuggestionMatch("@codia", 6)).toBeNull();
    expect(getMentionSuggestionMatch("@ia", 3)).toBeNull();
    expect(getMentionSuggestionMatch("@Codia", 6)).toBeNull();
  });

  it("retorna null si la palabra no empieza con @", () => {
    expect(getMentionSuggestionMatch("hola", 4)).toBeNull();
    expect(getMentionSuggestionMatch("correo@c", 8)).toBeNull();
  });

  it("retorna null si no es prefijo de @codia ni de @ia", () => {
    expect(getMentionSuggestionMatch("@xyz", 4)).toBeNull();
    expect(getMentionSuggestionMatch("@abc", 4)).toBeNull();
    expect(getMentionSuggestionMatch("@iab", 4)).toBeNull();
    expect(getMentionSuggestionMatch("@codiax", 7)).toBeNull();
  });

  it("maneja cursor en medio del texto", () => {
    const text = "Hola @co y gracias";
    // Cursor justo al final de "@co" (índice 8)
    expect(getMentionSuggestionMatch(text, 8)).toEqual({
      word: "@co",
      startIndex: 5,
      endIndex: 8,
    });
  });
});
