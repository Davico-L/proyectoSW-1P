import { test, describe, after, before } from "node:test";
import assert from "node:assert/strict";
import {
  saveMessage,
  listMessages,
  toPublicChatMessage,
  getMessageById,
  claimProposal,
  settleProposal,
  ChatValidationError,
  ChatUnavailableError,
  CHAT_COLLECTION_NAME,
} from "./chatRepository";
import { AI_DISPLAY_NAME } from "./aiChatHelpers";
import { createProposal } from "./proposalHelpers";
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

  test("9. saveMessage con role 'ai' exige authorSessionId 'ai' y rechaza cualquier otro", async () => {
    const diagId = createDiagramId("ai-role-check");

    // Rechaza si authorSessionId no es "ai"
    await assert.rejects(
      async () => {
        await saveMessage({
          diagramId: diagId,
          authorSessionId: "session-user-impersonator",
          authorName: "IA",
          role: "ai",
          text: "Mensaje suplantado",
        });
      },
      (err: any) => {
        assert.ok(err instanceof ChatValidationError);
        assert.match(err.message, /requieren authorSessionId 'ai'/i);
        return true;
      }
    );

    // Permite si authorSessionId es exactamente "ai"
    const validAiDoc = await saveMessage({
      diagramId: diagId,
      authorSessionId: "ai",
      authorName: AI_DISPLAY_NAME,
      role: "ai",
      text: "Mensaje legítimo de IA",
    });

    assert.equal(validAiDoc.role, "ai");
    assert.equal(validAiDoc.authorSessionId, "ai");
    assert.equal(validAiDoc.authorName, AI_DISPLAY_NAME);
  });

  describe("10. CU22 - Gestión y ciclo de vida de propuestas en chatRepository", () => {
    test("10.1 getMessageById devuelve el documento completo (con operations) o null ante id inválido o inexistente", async () => {
      const diagId = createDiagramId("get-msg-by-id");

      const saved = await saveMessage({
        diagramId: diagId,
        authorSessionId: "ai",
        authorName: AI_DISPLAY_NAME,
        role: "ai",
        text: "Mensaje con propuesta y operaciones",
        proposal: createProposal({
          summary: ["Crear clase Factura"],
          requestedBy: "Ana",
        }),
        operations: [{ action: "addClass", name: "Factura" }],
      });

      // Búsqueda exitosa
      const retrieved = await getMessageById(diagId, saved.id);
      assert.ok(retrieved);
      assert.equal(retrieved.id, saved.id);
      assert.equal(retrieved.diagramId, diagId);
      assert.equal(retrieved.text, "Mensaje con propuesta y operaciones");
      assert.deepEqual(retrieved.operations, [{ action: "addClass", name: "Factura" }]);
      assert.equal(retrieved.proposal.status, "pending");

      // Búsqueda con id inexistente
      const nonExistent = await getMessageById(diagId, "507f1f77bcf86cd799439011");
      assert.equal(nonExistent, null);

      // Búsqueda con id inválido
      const invalidId = await getMessageById(diagId, "id-invalido-no-hex");
      assert.equal(invalidId, null);

      const emptyId = await getMessageById(diagId, "   ");
      assert.equal(emptyId, null);

      // Búsqueda en otro diagrama
      const wrongDiagram = await getMessageById("otro-diagrama", saved.id);
      assert.equal(wrongDiagram, null);
    });

    test("10.2 Reclamo exitoso: pone status 'applying', applyingAt, y devuelve message con operations", async () => {
      const diagId = createDiagramId("claim-success");

      const saved = await saveMessage({
        diagramId: diagId,
        authorSessionId: "ai",
        authorName: AI_DISPLAY_NAME,
        role: "ai",
        text: "Propuesta para reclamar",
        proposal: createProposal({
          summary: ["Crear clase Factura", "Agregar atributo monto"],
          requestedBy: "Carlos",
        }),
        operations: [
          { action: "addClass", name: "Factura" },
          { action: "addAttribute", className: "Factura", name: "monto" },
        ],
      });

      const res = await claimProposal(diagId, saved.id, "Carlos");

      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.message.id, saved.id);
        assert.equal(res.message.proposal.status, "applying");
        assert.ok(res.message.proposal.applyingAt instanceof Date);
        assert.deepEqual(res.message.operations, [
          { action: "addClass", name: "Factura" },
          { action: "addAttribute", className: "Factura", name: "monto" },
        ]);
      }
    });

    test("10.3 Doble reclamo inmediato: el segundo falla con reason 'already_decided' y proposal pública vigente", async () => {
      const diagId = createDiagramId("double-claim");

      const saved = await saveMessage({
        diagramId: diagId,
        authorSessionId: "ai",
        authorName: AI_DISPLAY_NAME,
        role: "ai",
        text: "Propuesta para doble reclamo",
        proposal: createProposal({
          summary: ["Crear clase Producto"],
          requestedBy: "Ana",
        }),
      });

      // Primer reclamo
      const res1 = await claimProposal(diagId, saved.id, "Carlos");
      assert.equal(res1.ok, true);

      // Segundo reclamo concurrente o inmediato
      const res2 = await claimProposal(diagId, saved.id, "Beatriz");
      assert.equal(res2.ok, false);
      if (!res2.ok) {
        assert.equal(res2.reason, "already_decided");
        assert.ok(res2.proposal);
        // La versión pública vigente de "applying" se muestra como "pending"
        assert.equal(res2.proposal.status, "pending");
        assert.deepEqual(res2.proposal.summary, ["Crear clase Producto"]);
      }
    });

    test("10.4 Reclamo tras 60 segundos de applying (timeout/desconexión previa)", async () => {
      const diagId = createDiagramId("claim-timeout-60s");

      const saved = await saveMessage({
        diagramId: diagId,
        authorSessionId: "ai",
        authorName: AI_DISPLAY_NAME,
        role: "ai",
        text: "Propuesta con aplicando expirado",
        proposal: createProposal({
          summary: ["Crear clase Pago"],
          requestedBy: "Elena",
        }),
      });

      // Simulamos que el reclamo previo ocurrió hace 70 segundos
      const db = await getMongoDb();
      assert.ok(db);
      const seventySecondsAgo = new Date(Date.now() - 70 * 1000);
      const { ObjectId } = await import("mongodb");
      await db.collection(CHAT_COLLECTION_NAME).updateOne(
        { _id: new ObjectId(saved.id) },
        {
          $set: {
            "proposal.status": "applying",
            "proposal.applyingAt": seventySecondsAgo,
          },
        }
      );

      // Nuevo reclamo por otro integrante
      const res = await claimProposal(diagId, saved.id, "Laura");
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.message.proposal.status, "applying");
        assert.ok(
          res.message.proposal.applyingAt.getTime() > Date.now() - 5000,
          "applyingAt debe ser reciente"
        );
      }
    });

    test("10.5 settleProposal liquida cada resultado (approved, rejected, expired)", async () => {
      const diagId = createDiagramId("settle-outcomes");

      // A) Liquidación con "approved"
      const msgApproved = await saveMessage({
        diagramId: diagId,
        authorSessionId: "ai",
        authorName: AI_DISPLAY_NAME,
        role: "ai",
        text: "Para aprobar",
        proposal: createProposal({ summary: ["Aprobar cambio"], requestedBy: "Ana" }),
      });
      await claimProposal(diagId, msgApproved.id, "Ana");

      const settledApproved = await settleProposal(
        diagId,
        msgApproved.id,
        "approved",
        "Carlos"
      );
      assert.ok(settledApproved);
      assert.equal(settledApproved.proposal.status, "approved");
      assert.equal(settledApproved.proposal.decidedBy, "Carlos");
      assert.ok(settledApproved.proposal.decidedAt instanceof Date);
      assert.equal(settledApproved.proposal.applyingAt, undefined);

      // Re-intento de liquidar ya no actúa porque no está en "applying"
      const secondSettle = await settleProposal(diagId, msgApproved.id, "approved");
      assert.equal(secondSettle, null);

      // B) Liquidación con "rejected"
      const msgRejected = await saveMessage({
        diagramId: diagId,
        authorSessionId: "ai",
        authorName: AI_DISPLAY_NAME,
        role: "ai",
        text: "Para rechazar",
        proposal: createProposal({ summary: ["Rechazar cambio"], requestedBy: "Beto" }),
      });
      await claimProposal(diagId, msgRejected.id, "Beto");

      const settledRejected = await settleProposal(
        diagId,
        msgRejected.id,
        "rejected",
        "Diego"
      );
      assert.ok(settledRejected);
      assert.equal(settledRejected.proposal.status, "rejected");
      assert.equal(settledRejected.proposal.decidedBy, "Diego");
      assert.ok(settledRejected.proposal.decidedAt instanceof Date);

      // C) Liquidación con "expired"
      const msgExpired = await saveMessage({
        diagramId: diagId,
        authorSessionId: "ai",
        authorName: AI_DISPLAY_NAME,
        role: "ai",
        text: "Para expirar",
        proposal: createProposal({ summary: ["Expirar cambio"], requestedBy: "Elena" }),
      });
      await claimProposal(diagId, msgExpired.id, "Elena");

      const settledExpired = await settleProposal(
        diagId,
        msgExpired.id,
        "expired"
      );
      assert.ok(settledExpired);
      assert.equal(settledExpired.proposal.status, "expired");
      assert.ok(settledExpired.proposal.decidedAt instanceof Date);
    });

    test("10.6 settleProposal con 'pending' retira applyingAt y permite volver a reclamar", async () => {
      const diagId = createDiagramId("settle-revert-pending");

      const saved = await saveMessage({
        diagramId: diagId,
        authorSessionId: "ai",
        authorName: AI_DISPLAY_NAME,
        role: "ai",
        text: "Propuesta para revertir a pending",
        proposal: createProposal({ summary: ["Cambio pendiente"], requestedBy: "Ana" }),
      });

      // 1. Reclamo inicial
      const claim1 = await claimProposal(diagId, saved.id, "Ana");
      assert.equal(claim1.ok, true);

      // 2. Reversión a pending (p. ej. error en cliente antes de aplicar)
      const reverted = await settleProposal(diagId, saved.id, "pending");
      assert.ok(reverted);
      assert.equal(reverted.proposal.status, "pending");
      assert.equal(reverted.proposal.applyingAt, undefined);

      // 3. Se puede volver a reclamar con éxito
      const claim2 = await claimProposal(diagId, saved.id, "Carlos");
      assert.equal(claim2.ok, true);
      if (claim2.ok) {
        assert.equal(claim2.message.proposal.status, "applying");
      }
    });

    test("10.7 claimProposal y settleProposal ante id inexistente o inválido", async () => {
      const diagId = createDiagramId("not-found-checks");

      // claimProposal
      const claimInvalid = await claimProposal(diagId, "id-invalido", "Tester");
      assert.equal(claimInvalid.ok, false);
      if (!claimInvalid.ok) assert.equal(claimInvalid.reason, "not_found");

      const claimNonExistent = await claimProposal(
        diagId,
        "507f1f77bcf86cd799439011",
        "Tester"
      );
      assert.equal(claimNonExistent.ok, false);
      if (!claimNonExistent.ok) assert.equal(claimNonExistent.reason, "not_found");

      // settleProposal
      const settleInvalid = await settleProposal(diagId, "id-invalido", "approved");
      assert.equal(settleInvalid, null);

      const settleNonExistent = await settleProposal(
        diagId,
        "507f1f77bcf86cd799439011",
        "approved"
      );
      assert.equal(settleNonExistent, null);
    });

    test("10.8 operations nunca sale a los clientes y toPublicChatMessage pasa proposal por toPublicProposal", async () => {
      const diagId = createDiagramId("operations-security-check");

      const saved = await saveMessage({
        diagramId: diagId,
        authorSessionId: "ai",
        authorName: AI_DISPLAY_NAME,
        role: "ai",
        text: "Propuesta de seguridad",
        proposal: createProposal({
          summary: ["Crear clase Secreta"],
          requestedBy: "Admin",
        }),
        operations: [{ action: "addClass", name: "Secreta" }],
        warnings: ["Advertencia interna"],
      });

      // Reclamo -> estado interno applying
      const claimRes = await claimProposal(diagId, saved.id, "Admin");
      assert.equal(claimRes.ok, true);

      if (claimRes.ok) {
        // En el objeto interno message, operations sí existe
        assert.ok(claimRes.message.operations);

        // Al pasar por toPublicChatMessage:
        const publicMessage = toPublicChatMessage(claimRes.message);

        // operations, warnings y authorSessionId NO deben existir
        assert.equal((publicMessage as any).operations, undefined);
        assert.equal((publicMessage as any).warnings, undefined);
        assert.equal((publicMessage as any).authorSessionId, undefined);
        assert.equal("operations" in publicMessage, false);
        assert.equal("warnings" in publicMessage, false);

        // proposal fue procesada con toPublicProposal: 'applying' se ve como 'pending'
        assert.ok(publicMessage.proposal);
        assert.equal(publicMessage.proposal.status, "pending");
        assert.deepEqual(publicMessage.proposal.summary, ["Crear clase Secreta"]);
        assert.equal((publicMessage.proposal as any).operations, undefined);
      }

      // Verificación en listMessages:
      const listed = await listMessages(diagId);
      assert.equal(listed.length, 1);
      assert.equal(listed[0].proposal.status, "applying"); // Interno refleja estado vigente
      // Al sanitizar para la salida pública (como hace el endpoint GET /chat):
      const publicListed = listed.map(toPublicChatMessage);
      assert.equal("operations" in publicListed[0], false);
      assert.equal(publicListed[0].proposal.status, "pending");
    });
  });
});
