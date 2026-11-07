import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  parseMention,
  ensureAddressedByName,
  trimToLastSentence,
  AI_DISPLAY_NAME,
  AI_MENTION_ALIASES,
} from "./aiChatHelpers";

describe("CU19: aiChatHelpers", () => {
  describe("parseMention", () => {
    test("mención al inicio: detecta y extrae la pregunta", () => {
      const res = parseMention("@ia ¿cómo se relacionan Cliente y Pedido?");
      assert.equal(res.mentioned, true);
      assert.equal(res.question, "¿cómo se relacionan Cliente y Pedido?");
    });

    test("mención al medio: detecta y extrae la pregunta", () => {
      const res = parseMention("hola @ia puedes revisar el diagrama?");
      assert.equal(res.mentioned, true);
      assert.equal(res.question, "hola puedes revisar el diagrama?");
    });

    test("mención al final: detecta y extrae la pregunta", () => {
      const res = parseMention("explica esta clase @ia");
      assert.equal(res.mentioned, true);
      assert.equal(res.question, "explica esta clase");
    });

    test("mayúsculas mixtas: detecta @IA, @Ia, @iA", () => {
      const res1 = parseMention("@IA qué atributos faltan?");
      assert.equal(res1.mentioned, true);
      assert.equal(res1.question, "qué atributos faltan?");

      const res2 = parseMention("hola @Ia resume el diagrama");
      assert.equal(res2.mentioned, true);
      assert.equal(res2.question, "hola resume el diagrama");

      const res3 = parseMention("atento @iA");
      assert.equal(res3.mentioned, true);
      assert.equal(res3.question, "atento");
    });

    test("'@ia' a secas: devuelve mentioned true y question vacía", () => {
      const res1 = parseMention("@ia");
      assert.equal(res1.mentioned, true);
      assert.equal(res1.question, "");

      const res2 = parseMention("   @IA   ");
      assert.equal(res2.mentioned, true);
      assert.equal(res2.question, "");
    });

    test("'@iab' NO cuenta como mención", () => {
      const res = parseMention("@iab qué opinas?");
      assert.equal(res.mentioned, false);
      assert.equal(res.question, "@iab qué opinas?");
    });

    test("correo electrónico 'correo@ia.com' NO cuenta como mención", () => {
      const res = parseMention("mi correo es correo@ia.com para avisos");
      assert.equal(res.mentioned, false);
      assert.equal(res.question, "mi correo es correo@ia.com para avisos");
    });

    test("sin mención: devuelve mentioned false", () => {
      const res = parseMention("Hola a todos en el equipo, cómo van?");
      assert.equal(res.mentioned, false);
      assert.equal(res.question, "Hola a todos en el equipo, cómo van?");
    });

    test("múltiples espacios son colapsados", () => {
      const res = parseMention("  hola    @ia    revisa   esto   ");
      assert.equal(res.mentioned, true);
      assert.equal(res.question, "hola revisa esto");
    });

    test("constantes de identidad de IA exportadas correctamente", () => {
      assert.equal(AI_DISPLAY_NAME, "Codia");
      assert.deepEqual(AI_MENTION_ALIASES, ["ia", "codia"]);
    });

    test("menciones con alias '@codia', '@Codia' y '@ia' activan a la IA", () => {
      const res1 = parseMention("@codia ¿cómo relaciono estas clases?");
      assert.equal(res1.mentioned, true);
      assert.equal(res1.question, "¿cómo relaciono estas clases?");

      const res2 = parseMention("hola @Codia ¿cuántas clases hay?");
      assert.equal(res2.mentioned, true);
      assert.equal(res2.question, "hola ¿cuántas clases hay?");

      const res3 = parseMention("@ia qué opinas de este modelo?");
      assert.equal(res3.mentioned, true);
      assert.equal(res3.question, "qué opinas de este modelo?");

      const res4 = parseMention("@codia");
      assert.equal(res4.mentioned, true);
      assert.equal(res4.question, "");

      const res5 = parseMention("   @CODIA   ");
      assert.equal(res5.mentioned, true);
      assert.equal(res5.question, "");
    });

    test("'@codiax' NO cuenta como mención", () => {
      const res = parseMention("@codiax qué opinas?");
      assert.equal(res.mentioned, false);
      assert.equal(res.question, "@codiax qué opinas?");
    });

    test("correo 'contacto@codia.com' NO cuenta como mención", () => {
      const res = parseMention("escríbeme a contacto@codia.com para coordinar");
      assert.equal(res.mentioned, false);
      assert.equal(res.question, "escríbeme a contacto@codia.com para coordinar");
    });
  });

  describe("ensureAddressedByName", () => {
    test("nombre ya presente en los primeros 40 caracteres: devuelve la respuesta igual", () => {
      const original = "Hola Davico, veo dos clases en el diagrama.";
      const res = ensureAddressedByName(original, "Davico");
      assert.equal(res, original);
    });

    test("nombre ya presente en mayúsculas/minúsculas diferentes: devuelve la respuesta igual", () => {
      const original = "davico, las clases están correctamente asociadas.";
      const res = ensureAddressedByName(original, "Davico");
      assert.equal(res, original);

      const original2 = "DAVICO: el diagrama tiene 3 clases.";
      const res2 = ensureAddressedByName(original2, "davico");
      assert.equal(res2, original2);
    });

    test("nombre ausente en los primeros 40 caracteres: antepone '{name}, ' y pasa a minúscula la primera letra", () => {
      const original = "El diagrama contiene las clases Cliente y Pedido con asociación 1 a N.";
      const res = ensureAddressedByName(original, "Davico");
      assert.equal(res, "Davico, el diagrama contiene las clases Cliente y Pedido con asociación 1 a N.");
    });

    test("nombre presente después del carácter 40: antepone '{name}, ' y pasa a minúscula la primera letra", () => {
      const original = "Esta es una descripción larga del modelo y más adelante mencionamos a Davico.";
      const res = ensureAddressedByName(original, "Davico");
      assert.equal(res, "Davico, esta es una descripción larga del modelo y más adelante mencionamos a Davico.");
    });

    test("casos requeridos: 'Para asociar' -> 'Ana, para asociar' y 'Ana, hola' queda igual", () => {
      assert.equal(
        ensureAddressedByName("Para asociar", "Ana"),
        "Ana, para asociar"
      );
      assert.equal(
        ensureAddressedByName("Ana, hola", "Ana"),
        "Ana, hola"
      );
    });

    test("sigla o nombre en mayúsculas (segunda letra mayúscula como 'UML', 'SQL'): conserva mayúscula inicial", () => {
      assert.equal(
        ensureAddressedByName("UML es el estándar de modelado", "Ana"),
        "Ana, UML es el estándar de modelado"
      );
      assert.equal(
        ensureAddressedByName("SQL es para consultas relacionales", "Ana"),
        "Ana, SQL es para consultas relacionales"
      );
      assert.equal(
        ensureAddressedByName("DTO para transferencia", "Luis"),
        "Luis, DTO para transferencia"
      );
    });

    test("caracteres especiales antes de la letra: pasa a minúscula la primera letra", () => {
      assert.equal(
        ensureAddressedByName("¿Para qué sirve la herencia?", "Ana"),
        "Ana, ¿para qué sirve la herencia?"
      );
    });

    test("nombre vacío o solo espacios: devuelve la respuesta sin cambios", () => {
      const original = "Veo las clases en el modelo.";
      assert.equal(ensureAddressedByName(original, ""), original);
      assert.equal(ensureAddressedByName(original, "   "), original);
    });
  });

  describe("trimToLastSentence", () => {
    test("texto que termina en punto: lo devuelve intacto", () => {
      const text = "El diagrama contiene dos clases.";
      assert.equal(trimToLastSentence(text), text);
    });

    test("texto que termina en signo de exclamación: lo devuelve intacto", () => {
      const text = "¡Excelente diseño!";
      assert.equal(trimToLastSentence(text), text);
    });

    test("texto que termina en signo de interrogación: lo devuelve intacto", () => {
      const text = "¿Falta algún atributo?";
      assert.equal(trimToLastSentence(text), text);
    });

    test("texto que termina en paréntesis de cierre: lo devuelve intacto", () => {
      const text = "Asociación directa (1 a N)";
      assert.equal(trimToLastSentence(text), text);
    });

    test("texto que termina en comilla angular de cierre: lo devuelve intacto", () => {
      const text = "El patrón utilizado es «Singleton»";
      assert.equal(trimToLastSentence(text), text);
    });

    test("texto que termina en comilla doble: lo devuelve intacto", () => {
      const text = 'Clase nombrada "Pedido"';
      assert.equal(trimToLastSentence(text), text);
    });

    test("texto cortado a mitad de oración: recorta hasta el último signo de fin de oración", () => {
      const text = "Primera oración completa. Segunda oración que quedó cor";
      assert.equal(trimToLastSentence(text), "Primera oración completa.");
    });

    test("texto cortado con múltiples signos: recorta hasta el último signo válido", () => {
      const text = "¡Bienvenido! ¿Tienes dudas? Te explico lo siguie";
      assert.equal(trimToLastSentence(text), "¡Bienvenido! ¿Tienes dudas?");
    });

    test("texto sin ningún signo de fin de oración: lo devuelve igual", () => {
      const text = "Texto sin puntuacion alguna";
      assert.equal(trimToLastSentence(text), text);
    });

    test("cadena vacía o solo espacios: devuelve vacío", () => {
      assert.equal(trimToLastSentence(""), "");
      assert.equal(trimToLastSentence("   "), "");
    });
  });
});

