import { describe, it, expect } from "vitest";
import React from "react";
import { parseAiTextSegments, renderAiFormattedText } from "./aiTextFormatter";

describe("aiTextFormatter", () => {
  // Caso 1: Bloque de código con lenguaje y sin lenguaje
  it("Caso 1: reconoce bloques de código cercados con ```", () => {
    const inputWithLang = "```typescript\nconst total: number = 42;\n```";
    expect(parseAiTextSegments(inputWithLang)).toEqual([
      {
        type: "code-block",
        language: "typescript",
        code: "const total: number = 42;",
      },
    ]);

    const inputWithoutLang = "```\nprint('hola mundo')\n```";
    expect(parseAiTextSegments(inputWithoutLang)).toEqual([
      {
        type: "code-block",
        language: undefined,
        code: "print('hola mundo')",
      },
    ]);
  });

  // Caso 2: Código en línea con `...`
  it("Caso 2: reconoce código en línea delimitado por comillas invertidas simples", () => {
    const input = "Usa la función `calcularTotal()` para obtener el resultado.";
    expect(parseAiTextSegments(input)).toEqual([
      {
        type: "text",
        content: "Usa la función ",
      },
      {
        type: "inline-code",
        code: "calcularTotal()",
      },
      {
        type: "text",
        content: " para obtener el resultado.",
      },
    ]);
  });

  // Caso 3: Negrita con **...**
  it("Caso 3: reconoce texto en negrita delimitado por **", () => {
    const input = "La clase **Cliente** representa al usuario final.";
    expect(parseAiTextSegments(input)).toEqual([
      {
        type: "text",
        content: "La clase ",
      },
      {
        type: "bold",
        text: "Cliente",
      },
      {
        type: "text",
        content: " representa al usuario final.",
      },
    ]);
  });

  // Caso 4: Texto sin formato
  it("Caso 4: preserva texto sin formato con saltos de línea intactos", () => {
    const input = "Hola equipo.\n¿Cómo están?\nTodo listo para la reunión.";
    expect(parseAiTextSegments(input)).toEqual([
      {
        type: "text",
        content: input,
      },
    ]);
  });

  // Caso 5: Bloque de código sin cerrar
  it("Caso 5: trata bloques de código sin cerrar como texto plano", () => {
    const input = "```typescript\nconst a = 1;";
    expect(parseAiTextSegments(input)).toEqual([
      {
        type: "text",
        content: "```typescript\nconst a = 1;",
      },
    ]);

    const inputWithPrecedingText =
      "Aquí inicia un código:\n```python\ndef run():\n  pass";
    expect(parseAiTextSegments(inputWithPrecedingText)).toEqual([
      {
        type: "text",
        content: "Aquí inicia un código:\n```python\ndef run():\n  pass",
      },
    ]);
  });

  // Caso 6: HTML como texto (sin inyección ni etiquetas DOM)
  it("Caso 6: mantiene cadenas con HTML como texto plano", () => {
    const input = "<script>alert('xss')</script> y <b>etiqueta falsa</b>";
    expect(parseAiTextSegments(input)).toEqual([
      {
        type: "text",
        content: input,
      },
    ]);
  });

  // Caso 7: Mezcla de varios elementos en un mismo texto
  it("Caso 7: procesa una combinación de texto, negrita, código en línea y bloques de código", () => {
    const input =
      "Revisa la clase **Usuario** y el método `getId()`. Aquí un ejemplo:\n```ts\nuser.getId();\n```\n¿Te parece bien?";
    expect(parseAiTextSegments(input)).toEqual([
      {
        type: "text",
        content: "Revisa la clase ",
      },
      {
        type: "bold",
        text: "Usuario",
      },
      {
        type: "text",
        content: " y el método ",
      },
      {
        type: "inline-code",
        code: "getId()",
      },
      {
        type: "text",
        content: ". Aquí un ejemplo:\n",
      },
      {
        type: "code-block",
        language: "ts",
        code: "user.getId();",
      },
      {
        type: "text",
        content: "\n¿Te parece bien?",
      },
    ]);
  });

  // Caso 8: Asteriscos sueltos
  it("Caso 8: trata asteriscos sueltos, operaciones matemáticas y ** sin cerrar como texto plano", () => {
    const input =
      "El cálculo es 2 * 3 = 6, y *este texto no es negrita*, y **tampoco este incompleto.";
    expect(parseAiTextSegments(input)).toEqual([
      {
        type: "text",
        content: input,
      },
    ]);

    const doubleAsteriskIncomplete = "Solo abrí **sin cerrar";
    expect(parseAiTextSegments(doubleAsteriskIncomplete)).toEqual([
      {
        type: "text",
        content: doubleAsteriskIncomplete,
      },
    ]);
  });

  // Casos adicionales de robustez
  it("maneja texto vacío o valores no string", () => {
    expect(parseAiTextSegments("")).toEqual([]);
    expect(parseAiTextSegments(null as unknown as string)).toEqual([]);
    expect(parseAiTextSegments(undefined as unknown as string)).toEqual([]);
  });

  it("renderAiFormattedText genera elementos React con las clases CSS esperadas", () => {
    const input =
      "Texto **negrita** y `codigo` con:\n```sql\nSELECT * FROM users;\n```";
    const rendered = renderAiFormattedText(input);

    expect(Array.isArray(rendered)).toBe(true);
    const elements = rendered as React.ReactElement[];
    expect(elements.length).toBe(6);

    // Fragmento 1: texto
    expect(elements[0].props.children).toBe("Texto ");
    // Fragmento 2: strong
    expect(elements[1].type).toBe("strong");
    expect(elements[1].props.className).toBe("team-chat-bold");
    expect(elements[1].props.children).toBe("negrita");
    // Fragmento 3: texto
    expect(elements[2].props.children).toBe(" y ");
    // Fragmento 4: code
    expect(elements[3].type).toBe("code");
    expect(elements[3].props.className).toBe("team-chat-inline-code");
    expect(elements[3].props.children).toBe("codigo");
    // Fragmento 5: texto
    expect(elements[4].props.children).toBe(" con:\n");
    // Fragmento 6: pre
    expect(elements[5].type).toBe("pre");
    expect(elements[5].props.className).toBe("team-chat-code-block");
    expect(elements[5].props["data-language"]).toBe("sql");
    const codeChild = elements[5].props.children;
    expect(codeChild.type).toBe("code");
    expect(codeChild.props.className).toBe("team-chat-code-content");
    expect(codeChild.props.children).toBe("SELECT * FROM users;");
  });

  it("renderAiFormattedText retorna null si el texto está vacío", () => {
    expect(renderAiFormattedText("")).toBeNull();
  });
});
