import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import {
  getRoomSettings,
  saveRoomSettings,
  isValidMode,
  isValidStyle,
  ROOM_SETTINGS_COLLECTION_NAME,
  DEFAULT_ROOM_SETTINGS,
  RoomMode,
  RoomStyle,
} from "./roomSettingsRepository";
import {
  buildSystemPrompt,
  DIRECTA_STYLE_FRAGMENT,
  DETALLADA_STYLE_FRAGMENT,
} from "./styleFragments";
import { TEAM_AI_SYSTEM_PROMPT } from "./aiChatService";
import { REVIEW_SYSTEM_PROMPT } from "./diagramReviewService";
import {
  getMongoDb,
  closeMongoConnection,
  checkMongoConnection,
} from "../db/mongo";

describe("CU23 - Configuración de Codia por sala y fragmentos de estilo", () => {
  const testDiagramIds: string[] = [];

  const createDiagramId = (suffix: string) => {
    const id = `test-diagram-settings-${suffix}-${Date.now()}-${Math.floor(
      Math.random() * 10000
    )}`;
    testDiagramIds.push(id);
    return id;
  };

  after(async () => {
    try {
      const db = await getMongoDb();
      if (db && testDiagramIds.length > 0) {
        await db.collection(ROOM_SETTINGS_COLLECTION_NAME).deleteMany({
          diagramId: { $in: testDiagramIds },
        });
      }
    } catch {
      // Ignorar errores durante la limpieza de tests
    } finally {
      await closeMongoConnection();
    }
  });

  test("1. Funciones auxiliares isValidMode e isValidStyle validan listas cerradas", () => {
    assert.equal(isValidMode("apply"), true);
    assert.equal(isValidMode("advise"), true);
    assert.equal(isValidMode("invalid"), false);
    assert.equal(isValidMode(""), false);
    assert.equal(isValidMode(null), false);
    assert.equal(isValidMode(undefined), false);

    assert.equal(isValidStyle("directa"), true);
    assert.equal(isValidStyle("mentora"), true);
    assert.equal(isValidStyle("detallada"), true);
    assert.equal(isValidStyle("corta"), false);
    assert.equal(isValidStyle(""), false);
    assert.equal(isValidStyle(null), false);
    assert.equal(isValidStyle(undefined), false);
  });

  test("2. getRoomSettings devuelve valores por defecto ({ mode: 'apply', style: 'mentora' }) ante documento inexistente", async () => {
    const diagId = createDiagramId("non-existent");
    const settings = await getRoomSettings(diagId);

    assert.deepEqual(settings, {
      mode: "apply",
      style: "mentora",
    });
    assert.deepEqual(settings, DEFAULT_ROOM_SETTINGS);
  });

  test("3. saveRoomSettings rechaza con 'invalid_value' ante valores no permitidos o vacíos", async () => {
    const diagId = createDiagramId("invalid-checks");

    // Mode inválido
    await assert.rejects(
      async () => {
        await saveRoomSettings(
          diagId,
          { mode: "invalid_mode" as any, style: "mentora" },
          "Ana"
        );
      },
      (err: any) => {
        assert.equal(err?.message, "invalid_value");
        return true;
      }
    );

    // Style inválido
    await assert.rejects(
      async () => {
        await saveRoomSettings(
          diagId,
          { mode: "apply", style: "desconocido" as any },
          "Ana"
        );
      },
      (err: any) => {
        assert.equal(err?.message, "invalid_value");
        return true;
      }
    );

    // diagramId vacío
    await assert.rejects(
      async () => {
        await saveRoomSettings(
          "   ",
          { mode: "apply", style: "mentora" },
          "Ana"
        );
      },
      (err: any) => {
        assert.equal(err?.message, "invalid_value");
        return true;
      }
    );

    // settings nulo
    await assert.rejects(
      async () => {
        await saveRoomSettings(diagId, null as any, "Ana");
      },
      (err: any) => {
        assert.equal(err?.message, "invalid_value");
        return true;
      }
    );
  });

  test("4. saveRoomSettings realiza upsert idempotente por diagramId", async () => {
    const diagId = createDiagramId("upsert");

    // Primer guardado: advise + directa por Carlos
    const saved1 = await saveRoomSettings(
      diagId,
      { mode: "advise", style: "directa" },
      "Carlos"
    );

    assert.deepEqual(saved1, {
      mode: "advise",
      style: "directa",
      updatedBy: "Carlos",
    });

    const read1 = await getRoomSettings(diagId);
    assert.deepEqual(read1, {
      mode: "advise",
      style: "directa",
    });

    // Segundo guardado sobre el mismo diagramId: apply + detallada por Beatriz
    const saved2 = await saveRoomSettings(
      diagId,
      { mode: "apply", style: "detallada" },
      "Beatriz"
    );

    assert.deepEqual(saved2, {
      mode: "apply",
      style: "detallada",
      updatedBy: "Beatriz",
    });

    const read2 = await getRoomSettings(diagId);
    assert.deepEqual(read2, {
      mode: "apply",
      style: "detallada",
    });

    // Verificar en la colección de Mongo que existe un único documento para ese diagramId
    const db = await getMongoDb();
    assert.ok(db, "Debe haber conexión a Mongo");
    const count = await db
      .collection(ROOM_SETTINGS_COLLECTION_NAME)
      .countDocuments({ diagramId: diagId });
    assert.equal(count, 1, "El upsert debe mantener un único documento por diagramId");
  });

  test("5. Mongo caído: getRoomSettings devuelve defaults sin error, y saveRoomSettings propaga el error", async () => {
    const diagId = createDiagramId("mongo-down");
    const originalUri = process.env.MONGODB_URI;

    try {
      await closeMongoConnection();
      process.env.MONGODB_URI = "";

      // getRoomSettings no lanza error y devuelve defaults
      const settings = await getRoomSettings(diagId);
      assert.deepEqual(settings, {
        mode: "apply",
        style: "mentora",
      });

      // saveRoomSettings debe fallar y propagar el error
      await assert.rejects(
        async () => {
          await saveRoomSettings(
            diagId,
            { mode: "advise", style: "directa" },
            "Tester"
          );
        },
        (err: any) => {
          assert.ok(err instanceof Error);
          return true;
        }
      );
    } finally {
      process.env.MONGODB_URI = originalUri;
      await checkMongoConnection();
    }
  });

  test("6. buildSystemPrompt maneja los tres estilos (mentora = base idéntico)", () => {
    const basePrompt = TEAM_AI_SYSTEM_PROMPT;

    // Estilo mentora: devuelve el prompt base idéntico, sin mutaciones
    const mentoraPrompt = buildSystemPrompt(basePrompt, "mentora");
    assert.equal(mentoraPrompt, basePrompt);

    // Estilo no provisto o indefinido: devuelve el prompt base idéntico
    assert.equal(buildSystemPrompt(basePrompt, undefined), basePrompt);
    assert.equal(buildSystemPrompt(basePrompt, "" as any), basePrompt);

    // Estilo directa: contiene el base más el fragmento con ~60 palabras y sin ejemplos
    const directaPrompt = buildSystemPrompt(basePrompt, "directa");
    assert.ok(directaPrompt.startsWith(basePrompt));
    assert.ok(directaPrompt.includes(DIRECTA_STYLE_FRAGMENT));
    assert.match(directaPrompt, /60 palabras/i);
    assert.match(directaPrompt, /sin ejemplos salvo que se pidan/i);

    // Estilo detallada: contiene el base más el fragmento con ~180 palabras
    const detalladaPrompt = buildSystemPrompt(basePrompt, "detallada");
    assert.ok(detalladaPrompt.startsWith(basePrompt));
    assert.ok(detalladaPrompt.includes(DETALLADA_STYLE_FRAGMENT));
    assert.match(detalladaPrompt, /180 palabras/i);

    // Verifica que también funciona con REVIEW_SYSTEM_PROMPT sin modificarlo
    const baseReview = REVIEW_SYSTEM_PROMPT;
    const reviewMentora = buildSystemPrompt(baseReview, "mentora");
    assert.equal(reviewMentora, baseReview);
    const reviewDirecta = buildSystemPrompt(baseReview, "directa");
    assert.ok(reviewDirecta.startsWith(baseReview));
    assert.ok(reviewDirecta.includes(DIRECTA_STYLE_FRAGMENT));
  });
});
