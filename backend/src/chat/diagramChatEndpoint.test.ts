import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import { AddressInfo } from "net";
import { app } from "../app";
import { pool } from "../db";
import { getMongoDb, closeMongoConnection } from "../db/mongo";
import {
  saveMessage,
  CHAT_COLLECTION_NAME,
} from "./chatRepository";

describe("GET /diagrams/:id/chat - Endpoint de historial de chat", () => {
  let server: http.Server;
  let baseUrl: string;
  const testSessionId = "session-chat-endpoint-123";
  const testUsername = "UsuarioTest";
  const testDiagramId = "diagram-chat-endpoint-456";
  const testDiagramIds = [testDiagramId];
  let originalPoolQuery: any;

  before(async () => {
    // Interceptar consultas a la tabla sessions y diagrams para tests independientes de Postgres
    originalPoolQuery = pool.query;
    (pool as any).query = async (text: any, params?: any[]) => {
      const queryStr = typeof text === "string" ? text : text?.text || "";

      // Simular getSession
      if (queryStr.includes("FROM sessions") && queryStr.includes("WHERE id = $1")) {
        if (params?.[0] === testSessionId) {
          return {
            rows: [
              {
                id: testSessionId,
                username: testUsername,
                created_at: new Date().toISOString(),
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }

      // Simular getDiagramById
      if (queryStr.includes("FROM diagrams") && queryStr.includes("WHERE id = $1")) {
        if (params?.[0] === testDiagramId) {
          return {
            rows: [
              {
                id: testDiagramId,
                session_id: testSessionId,
                name: "Diagrama de Prueba",
                data: { elements: [] },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }

      return { rows: [], rowCount: 0 };
    };

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://localhost:${port}`;

    // Poblar algunos mensajes de prueba en MongoDB para testDiagramId
    await saveMessage({
      diagramId: testDiagramId,
      authorSessionId: testSessionId,
      authorName: testUsername,
      role: "user",
      text: "Mensaje histórico 1",
    });
    await new Promise((r) => setTimeout(r, 10));
    await saveMessage({
      diagramId: testDiagramId,
      authorSessionId: testSessionId,
      authorName: testUsername,
      role: "user",
      text: "Mensaje histórico 2",
    });
    await new Promise((r) => setTimeout(r, 10));
    await saveMessage({
      diagramId: testDiagramId,
      authorSessionId: testSessionId,
      authorName: testUsername,
      role: "user",
      text: "Mensaje histórico 3",
    });
  });

  after(async () => {
    try {
      if (originalPoolQuery) {
        (pool as any).query = originalPoolQuery;
      }
      // Limpiar documentos de prueba en MongoDB
      const db = await getMongoDb();
      if (db) {
        await db.collection(CHAT_COLLECTION_NAME).deleteMany({
          diagramId: { $in: testDiagramIds },
        });
      }
    } catch {
      // Ignorar errores en limpieza
    } finally {
      if (server) {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
      await closeMongoConnection();
    }
  });

  test("1. Sin encabezado x-session-id responde 401", async () => {
    const res = await fetch(`${baseUrl}/diagrams/${testDiagramId}/chat`);
    assert.equal(res.status, 401);
    const body = (await res.json()) as any;
    assert.equal(body.error, "No autenticado");
  });

  test("2. Con sesión inexistente en x-session-id responde 401", async () => {
    const res = await fetch(`${baseUrl}/diagrams/${testDiagramId}/chat`, {
      headers: {
        "x-session-id": "sesion-invalida-000",
      },
    });
    assert.equal(res.status, 401);
    const body = (await res.json()) as any;
    assert.equal(body.error, "No autenticado");
  });

  test("3. Con diagrama inexistente responde 404", async () => {
    const res = await fetch(`${baseUrl}/diagrams/diagrama-fantasma-999/chat`, {
      headers: {
        "x-session-id": testSessionId,
      },
    });
    assert.equal(res.status, 404);
    const body = (await res.json()) as any;
    assert.equal(body.error, "Diagrama no encontrado.");
  });

  test("4. Con limit inválido (no entero positivo) responde 400", async () => {
    // limit = 0
    let res = await fetch(`${baseUrl}/diagrams/${testDiagramId}/chat?limit=0`, {
      headers: { "x-session-id": testSessionId },
    });
    assert.equal(res.status, 400);

    // limit = negativo
    res = await fetch(`${baseUrl}/diagrams/${testDiagramId}/chat?limit=-5`, {
      headers: { "x-session-id": testSessionId },
    });
    assert.equal(res.status, 400);

    // limit = string alfanumérico
    res = await fetch(`${baseUrl}/diagrams/${testDiagramId}/chat?limit=abc`, {
      headers: { "x-session-id": testSessionId },
    });
    assert.equal(res.status, 400);

    // limit = decimal
    res = await fetch(`${baseUrl}/diagrams/${testDiagramId}/chat?limit=3.14`, {
      headers: { "x-session-id": testSessionId },
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as any;
    assert.match(body.error, /entero positivo/i);
  });

  test("5. Con sesión válida y diagrama válido responde 200 con mensajes en orden cronológico", async () => {
    const res = await fetch(`${baseUrl}/diagrams/${testDiagramId}/chat`, {
      headers: { "x-session-id": testSessionId },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.ok(Array.isArray(body.messages));
    assert.equal(body.messages.length, 3);
    assert.equal(body.messages[0].text, "Mensaje histórico 1");
    assert.equal(body.messages[1].text, "Mensaje histórico 2");
    assert.equal(body.messages[2].text, "Mensaje histórico 3");

    // Formato idéntico al evento chat-message (sin authorSessionId)
    const msg = body.messages[0];
    assert.ok(msg.id, "Debe tener id string");
    assert.equal(msg.diagramId, testDiagramId);
    assert.equal(msg.authorName, testUsername);
    assert.equal(msg.role, "user");
    assert.ok(msg.createdAt, "Debe tener createdAt");

    // authorSessionId es credencial y NO debe exponerse en el historial
    assert.equal(msg.authorSessionId, undefined);
    assert.ok(!("authorSessionId" in msg), "authorSessionId no debe estar presente en el mensaje");
  });

  test("6. Con limit=2 responde los últimos 2 mensajes en orden cronológico", async () => {
    const res = await fetch(`${baseUrl}/diagrams/${testDiagramId}/chat?limit=2`, {
      headers: { "x-session-id": testSessionId },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.messages.length, 2);
    // Deben ser los 2 últimos: Mensaje 2 y Mensaje 3
    assert.equal(body.messages[0].text, "Mensaje histórico 2");
    assert.equal(body.messages[1].text, "Mensaje histórico 3");
  });
});
