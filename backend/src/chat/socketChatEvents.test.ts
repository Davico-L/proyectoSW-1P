import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import http from "http";
import { initSocket } from "../socket";
import { pool } from "../db";
import { getMongoDb, closeMongoConnection } from "../db/mongo";
import { CHAT_COLLECTION_NAME } from "./chatRepository";

describe("Socket.IO Eventos de Chat (chat-join y chat-message)", () => {
  let io: any;
  let server: http.Server;
  const testSessionId = "session-valid-test-123";
  const testUsername = "CarlosDev";
  const testDiagramIds: string[] = [];
  let originalPoolQuery: any;

  const createMockSocket = (id: string) => {
    const emitter = new EventEmitter() as any;
    emitter.id = id;
    emitter.rooms = new Set<string>([id]);
    emitter.data = {};
    emitter.join = (room: string) => {
      emitter.rooms.add(room);
    };
    emitter.leave = (room: string) => {
      emitter.rooms.delete(room);
    };
    return emitter;
  };

  const connectSocket = (id: string) => {
    const socket = createMockSocket(id);
    const handler = io.of("/").listeners("connection")[0];
    handler(socket);
    return socket;
  };

  before(async () => {
    server = http.createServer();
    io = initSocket(server);

    // Interceptar consultas a la tabla sessions para no depender de la BD Postgres en tests unitarios
    originalPoolQuery = pool.query;
    (pool as any).query = async (text: any, params?: any[]) => {
      const queryStr = typeof text === "string" ? text : text?.text || "";
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

      if (queryStr.includes("SELECT 1 FROM sessions WHERE id = $1")) {
        if (params?.[0] === testSessionId) {
          return { rows: [{ "?column?": 1 }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      return { rows: [], rowCount: 0 };
    };
  });

  after(async () => {
    try {
      if (originalPoolQuery) {
        (pool as any).query = originalPoolQuery;
      }
      // Limpiar mensajes de prueba creados en MongoDB
      const db = await getMongoDb();
      if (db && testDiagramIds.length > 0) {
        await db.collection(CHAT_COLLECTION_NAME).deleteMany({
          diagramId: { $in: testDiagramIds },
        });
      }
    } catch {
      // Ignorar errores en limpieza
    } finally {
      if (io) {
        await new Promise<void>((resolve) => io.close(() => resolve()));
      }
      if (server) {
        server.close();
      }
      await closeMongoConnection();
    }
  });

  test("1. chat-join rechaza con bad_request ante parámetros vacíos o inválidos", async () => {
    const socket = connectSocket("sock-1");

    // Sin payload
    await new Promise<void>((resolve) => {
      socket.emit("chat-join", null, (res: any) => {
        assert.equal(res.ok, false);
        assert.equal(res.error, "bad_request");
        resolve();
      });
    });

    // Con diagramId vacío
    await new Promise<void>((resolve) => {
      socket.emit("chat-join", { diagramId: "  ", sessionId: testSessionId }, (res: any) => {
        assert.equal(res.ok, false);
        assert.equal(res.error, "bad_request");
        resolve();
      });
    });

    // Con sessionId vacío
    await new Promise<void>((resolve) => {
      socket.emit("chat-join", { diagramId: "diag-1", sessionId: "" }, (res: any) => {
        assert.equal(res.ok, false);
        assert.equal(res.error, "bad_request");
        resolve();
      });
    });
  });

  test("2. chat-join rechaza con not_in_room si el socket no está en la sala del diagrama", async () => {
    const socket = connectSocket("sock-2");

    const diagId = `diag-${Date.now()}`;
    testDiagramIds.push(diagId);

    // Socket no ha llamado a join-diagram todavía
    await new Promise<void>((resolve) => {
      socket.emit("chat-join", { diagramId: diagId, sessionId: testSessionId }, (res: any) => {
        assert.equal(res.ok, false);
        assert.equal(res.error, "not_in_room");
        resolve();
      });
    });
  });

  test("3. chat-join rechaza con invalid_session si la sesión no existe en Postgres", async () => {
    const socket = connectSocket("sock-3");

    const diagId = `diag-${Date.now()}`;
    testDiagramIds.push(diagId);
    socket.join(diagId); // Está en la sala, pero con sesión inexistente

    await new Promise<void>((resolve) => {
      socket.emit(
        "chat-join",
        { diagramId: diagId, sessionId: "sesion-inexistente-999" },
        (res: any) => {
          assert.equal(res.ok, false);
          assert.equal(res.error, "invalid_session");
          resolve();
        }
      );
    });
  });

  test("4. chat-join exitoso guarda diagramId, sessionId y authorName en socket.data", async () => {
    const socket = connectSocket("sock-4");

    const diagId = `diag-${Date.now()}`;
    testDiagramIds.push(diagId);
    socket.join(diagId);

    await new Promise<void>((resolve) => {
      socket.emit("chat-join", { diagramId: diagId, sessionId: testSessionId }, (res: any) => {
        assert.equal(res.ok, true);
        assert.equal(socket.data.diagramId, diagId);
        assert.equal(socket.data.sessionId, testSessionId);
        assert.equal(socket.data.authorName, testUsername);
        resolve();
      });
    });
  });

  test("5. chat-message rechaza con not_joined si el socket no completó chat-join", async () => {
    const socket = connectSocket("sock-5");

    const diagId = `diag-${Date.now()}`;
    testDiagramIds.push(diagId);
    socket.join(diagId); // En la sala, pero NO hizo chat-join

    await new Promise<void>((resolve) => {
      socket.emit("chat-message", { diagramId: diagId, text: "Hola equipo" }, (res: any) => {
        assert.equal(res.ok, false);
        assert.equal(res.error, "not_joined");
        resolve();
      });
    });
  });

  test("6. chat-message valida texto vacío ('empty') y mayor a 2000 chars ('too_long')", async () => {
    const socket = connectSocket("sock-6");

    const diagId = `diag-${Date.now()}`;
    testDiagramIds.push(diagId);
    socket.join(diagId);

    // Primero unirse
    await new Promise<void>((resolve) => {
      socket.emit("chat-join", { diagramId: diagId, sessionId: testSessionId }, () => resolve());
    });

    // Texto vacío
    await new Promise<void>((resolve) => {
      socket.emit("chat-message", { diagramId: diagId, text: "   " }, (res: any) => {
        assert.equal(res.ok, false);
        assert.equal(res.error, "empty");
        resolve();
      });
    });

    // Texto de 2001 caracteres
    await new Promise<void>((resolve) => {
      socket.emit("chat-message", { diagramId: diagId, text: "a".repeat(2001) }, (res: any) => {
        assert.equal(res.ok, false);
        assert.equal(res.error, "too_long");
        resolve();
      });
    });
  });

  test("7. chat-message guarda mensaje y emite broadcast a toda la sala con autor de socket.data", async () => {
    const socket = connectSocket("sock-7");

    const diagId = `diag-${Date.now()}`;
    testDiagramIds.push(diagId);
    socket.join(diagId);

    // Unirse al chat
    await new Promise<void>((resolve) => {
      socket.emit("chat-join", { diagramId: diagId, sessionId: testSessionId }, () => resolve());
    });

    // Interceptar la emisión a sala para verificar lo que recibe la sala
    let broadcastPayload: any = null;
    let targetRoom: string = "";
    const originalTo = io.to;
    io.to = (room: string) => {
      targetRoom = room;
      return {
        emit: (event: string, data: any) => {
          if (event === "chat-message") {
            broadcastPayload = data;
          }
        },
      };
    };

    try {
      // Intentar suplantar autor en payload (debe ignorarse por completo)
      const fakeAuthorPayload = {
        diagramId: diagId,
        text: "Mensaje legítimo del equipo",
        authorName: "HackerInfiltrado",
        authorSessionId: "fake-session-999",
        role: "admin",
      };

      await new Promise<void>((resolve) => {
        socket.emit("chat-message", fakeAuthorPayload, (res: any) => {
          assert.equal(res.ok, true);
          resolve();
        });
      });

      assert.equal(targetRoom, diagId);
      assert.ok(broadcastPayload, "Debe haberse emitido chat-message");
      assert.equal(broadcastPayload.diagramId, diagId);
      assert.equal(broadcastPayload.text, "Mensaje legítimo del equipo");
      // El autor debe ser SIEMPRE el de la sesión validada en socket.data
      assert.equal(broadcastPayload.authorName, testUsername);
      // authorSessionId es credencial y NO debe exponerse hacia los clientes
      assert.equal(broadcastPayload.authorSessionId, undefined);
      assert.ok(!("authorSessionId" in broadcastPayload), "authorSessionId no debe existir en el broadcast");
      assert.equal(broadcastPayload.role, "user");
      assert.ok(broadcastPayload.id, "Debe tener id persistido");
    } finally {
      io.to = originalTo;
    }
  });
});
