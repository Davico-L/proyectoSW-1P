import { test, describe, after, before } from "node:test";
import assert from "node:assert/strict";
import {
  saveMessage,
  listMessages,
  toPublicChatMessage,
  ChatValidationError,
  ChatUnavailableError,
  CHAT_COLLECTION_NAME,
} from "./chatRepository";
import { getMongoDb, closeMongoConnection, checkMongoConnection } from "../db/mongo";

describe("Repositorio de Mensajes de Chat (chat_messages)", () => {
  const testDiagramIds: string[] = [];

  const createDiagramId = (suffix: string) => {
    const id = `test-diagram-${suffix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    testDiagramIds.push(id);
    return id;
  };

  after(async () => {
    try {
      const db = await getMongoDb();
      if (db && testDiagramIds.length > 0) {
        await db.collection(CHAT_COLLECTION_NAME).deleteMany({
          diagramId: { $in: testDiagramIds },
        });
      }
    } catch {
      // Ignorar errores durante la limpieza de tests
    } finally {
      await closeMongoConnection();
    }
  });

  test("1. Guardar y listar mensaje exitosamente", async () => {
    const diagId = createDiagramId("save-list");

    const saved = await saveMessage({
      diagramId: diagId,
      authorSessionId: "session-abc-123",
      authorName: "Carlos Dev",
      role: "developer",
      text: "   Hola a todos, implementando CU18   ",
      mentions: ["Ana", "Luis"],
      proposal: { type: "add_relation", from: "Usuario", to: "Mensaje" },
    });

    assert.ok(saved.id, "Debe tener un id asignado");
    assert.equal(typeof saved.id, "string");
    assert.equal(saved.diagramId, diagId);
    assert.equal(saved.authorSessionId, "session-abc-123");
    assert.equal(saved.authorName, "Carlos Dev");
    assert.equal(saved.role, "developer");
    assert.equal(saved.text, "Hola a todos, implementando CU18", "Debe recortar espacios");
    assert.deepEqual(saved.mentions, ["Ana", "Luis"]);
    assert.deepEqual(saved.proposal, { type: "add_relation", from: "Usuario", to: "Mensaje" });
    assert.ok(saved.createdAt instanceof Date);

    const listed = await listMessages(diagId);
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, saved.id);
    assert.equal(listed[0].text, "Hola a todos, implementando CU18");
    assert.deepEqual(listed[0].mentions, ["Ana", "Luis"]);
    assert.deepEqual(listed[0].proposal, { type: "add_relation", from: "Usuario", to: "Mensaje" });
  });

  test("2. Orden cronológico ascendente al listar mensajes", async () => {
    const diagId = createDiagramId("order");

    const m1 = await saveMessage({
      diagramId: diagId,
      authorSessionId: "sess-1",
      authorName: "User1",
      role: "developer",
      text: "Mensaje 1",
    });

    // Pequeño delay de 10ms para garantizar orden temporal estricto
    await new Promise((resolve) => setTimeout(resolve, 15));

    const m2 = await saveMessage({
      diagramId: diagId,
      authorSessionId: "sess-2",
      authorName: "User2",
      role: "developer",
      text: "Mensaje 2",
    });

    await new Promise((resolve) => setTimeout(resolve, 15));

    const m3 = await saveMessage({
      diagramId: diagId,
      authorSessionId: "sess-3",
      authorName: "User3",
      role: "developer",
      text: "Mensaje 3",
    });

    const listed = await listMessages(diagId);
    assert.equal(listed.length, 3);
    assert.equal(listed[0].id, m1.id);
    assert.equal(listed[0].text, "Mensaje 1");
    assert.equal(listed[1].id, m2.id);
    assert.equal(listed[1].text, "Mensaje 2");
    assert.equal(listed[2].id, m3.id);
    assert.equal(listed[2].text, "Mensaje 3");

    assert.ok(
      new Date(listed[0].createdAt).getTime() <= new Date(listed[1].createdAt).getTime()
    );
    assert.ok(
      new Date(listed[1].createdAt).getTime() <= new Date(listed[2].createdAt).getTime()
    );
  });

  test("3. Límite de mensajes: por defecto 50 y máximo 100", async () => {
    const diagId = createDiagramId("limits");

    // Insertamos 55 mensajes rápidamente
    const db = await getMongoDb();
    assert.ok(db, "MongoDB debe estar disponible");

    const baseTime = Date.now();
    const batchDocs = Array.from({ length: 55 }, (_, idx) => ({
      diagramId: diagId,
      authorSessionId: `sess-${idx}`,
      authorName: `User-${idx}`,
      role: "developer",
      text: `Msg #${idx + 1}`,
      createdAt: new Date(baseTime + idx * 10),
    }));

    await db.collection(CHAT_COLLECTION_NAME).insertMany(batchDocs as any);

    // Con límite por defecto (50) debe retornar los últimos 50 en orden ascendente (Msg #6 a Msg #55)
    const defaultList = await listMessages(diagId);
    assert.equal(defaultList.length, 50);
    assert.equal(defaultList[0].text, "Msg #6");
    assert.equal(defaultList[49].text, "Msg #55");

    // Solicitando límite explícito de 150, se acota al máximo de 100 (aquí hay 55 en total)
    const cappedList = await listMessages(diagId, 150);
    assert.equal(cappedList.length, 55);

    // Si insertamos otros 55 (total 110), al pedir 150 solo debe devolver 100
    const extraBatch = Array.from({ length: 55 }, (_, idx) => ({
      diagramId: diagId,
      authorSessionId: `sess-extra-${idx}`,
      authorName: `User-extra-${idx}`,
      role: "developer",
      text: `Extra #${idx + 1}`,
      createdAt: new Date(baseTime + 1000 + idx * 10),
    }));
    await db.collection(CHAT_COLLECTION_NAME).insertMany(extraBatch as any);

    const maxList = await listMessages(diagId, 150);
    assert.equal(maxList.length, 100, "Debe limitar al tope máximo de 100");
  });

  test("4. Rechazo controlado de texto vacío o con solo espacios", async () => {
    const diagId = createDiagramId("empty");

    await assert.rejects(
      async () => {
        await saveMessage({
          diagramId: diagId,
          authorSessionId: "s1",
          authorName: "A",
          role: "developer",
          text: "",
        });
      },
      (err: any) => {
        assert.ok(err instanceof ChatValidationError);
        assert.match(err.message, /vacío/i);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await saveMessage({
          diagramId: diagId,
          authorSessionId: "s1",
          authorName: "A",
          role: "developer",
          text: "    \n\t   ",
        });
      },
      (err: any) => {
        assert.ok(err instanceof ChatValidationError);
        assert.match(err.message, /vacío/i);
        return true;
      }
    );
  });

  test("5. Validación estricta de 2000 y 2001 caracteres", async () => {
    const diagId = createDiagramId("char-limits");

    // 2000 caracteres debe guardarse exitosamente
    const text2000 = "x".repeat(2000);
    const saved2000 = await saveMessage({
      diagramId: diagId,
      authorSessionId: "s1",
      authorName: "Autor2000",
      role: "developer",
      text: text2000,
    });
    assert.equal(saved2000.text.length, 2000);

    // 2001 caracteres debe rechazarse con ChatValidationError
    const text2001 = "x".repeat(2001);
    await assert.rejects(
      async () => {
        await saveMessage({
          diagramId: diagId,
          authorSessionId: "s1",
          authorName: "Autor2001",
          role: "developer",
          text: text2001,
        });
      },
      (err: any) => {
        assert.ok(err instanceof ChatValidationError);
        assert.match(err.message, /2000/);
        return true;
      }
    );
  });

  test("6. Dos diagramas distintos sin mezclar mensajes", async () => {
    const diagA = createDiagramId("diagram-A");
    const diagB = createDiagramId("diagram-B");

    await saveMessage({
      diagramId: diagA,
      authorSessionId: "s1",
      authorName: "UserA",
      role: "developer",
      text: "Mensaje para Diagrama A 1",
    });

    await saveMessage({
      diagramId: diagA,
      authorSessionId: "s2",
      authorName: "UserA2",
      role: "developer",
      text: "Mensaje para Diagrama A 2",
    });

    await saveMessage({
      diagramId: diagB,
      authorSessionId: "s3",
      authorName: "UserB",
      role: "developer",
      text: "Mensaje para Diagrama B",
    });

    const messagesA = await listMessages(diagA);
    const messagesB = await listMessages(diagB);

    assert.equal(messagesA.length, 2);
    assert.ok(messagesA.every((m) => m.diagramId === diagA));
    assert.equal(messagesA[0].text, "Mensaje para Diagrama A 1");
    assert.equal(messagesA[1].text, "Mensaje para Diagrama A 2");

    assert.equal(messagesB.length, 1);
    assert.equal(messagesB[0].diagramId, diagB);
    assert.equal(messagesB[0].text, "Mensaje para Diagrama B");
  });

  test("7. Error controlado sin Mongo (ChatUnavailableError)", async () => {
    // Simulamos indisponibilidad cerrando la conexión y alterando la variable MONGODB_URI
    const originalUri = process.env.MONGODB_URI;
    try {
      await closeMongoConnection();
      process.env.MONGODB_URI = "";

      await assert.rejects(
        async () => {
          await saveMessage({
            diagramId: "diag-no-mongo",
            authorSessionId: "s1",
            authorName: "User",
            role: "developer",
            text: "Texto de prueba sin mongo",
          });
        },
        (err: any) => {
          assert.ok(
            err instanceof ChatUnavailableError,
            `Se esperaba ChatUnavailableError pero se recibió ${err?.name || err}`
          );
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await listMessages("diag-no-mongo");
        },
        (err: any) => {
          assert.ok(
            err instanceof ChatUnavailableError,
            `Se esperaba ChatUnavailableError pero se recibió ${err?.name || err}`
          );
          return true;
        }
      );
    } finally {
      process.env.MONGODB_URI = originalUri;
      // Reconectamos para la limpieza posterior si aplica
      await checkMongoConnection();
    }
  });

  test("8. toPublicChatMessage omite estrictamente authorSessionId", () => {
    const internalDoc = {
      id: "msg-12345",
      diagramId: "diag-abc",
      authorSessionId: "session-secret-9999",
      authorName: "Carlos Dev",
      role: "user",
      text: "Mensaje público",
      mentions: ["Ana"],
      proposal: { type: "add_class", name: "User" },
      createdAt: new Date("2026-11-05T12:00:00Z"),
    };

    const publicDoc = toPublicChatMessage(internalDoc);

    assert.equal(publicDoc.id, "msg-12345");
    assert.equal(publicDoc.diagramId, "diag-abc");
    assert.equal(publicDoc.authorName, "Carlos Dev");
    assert.equal(publicDoc.role, "user");
    assert.equal(publicDoc.text, "Mensaje público");
    assert.deepEqual(publicDoc.mentions, ["Ana"]);
    assert.deepEqual(publicDoc.proposal, { type: "add_class", name: "User" });
    assert.deepEqual(publicDoc.createdAt, new Date("2026-11-05T12:00:00Z"));

    // Verificación estricta de seguridad: authorSessionId no debe existir
    assert.equal((publicDoc as any).authorSessionId, undefined);
    assert.ok(!("authorSessionId" in publicDoc), "authorSessionId no debe existir en el objeto público");
    assert.deepEqual(Object.keys(publicDoc).sort(), [
      "authorName",
      "createdAt",
      "diagramId",
      "id",
      "mentions",
      "proposal",
      "role",
      "text",
    ]);
  });
});
