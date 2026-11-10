import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import http from "http";
import { ObjectId } from "mongodb";
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
    emitter.connected = true;
    emitter.rooms = new Set<string>([id]);
    emitter.data = {};
    emitter.join = (room: string) => {
      emitter.rooms.add(room);
    };
    emitter.leave = (room: string) => {
      emitter.rooms.delete(room);
    };
    emitter.timeout = (_ms: number) => ({
      emitWithAck: async (event: string, payload: any) => {
        emitter.emit(event, payload);
        if (typeof emitter._onEmitWithAck === "function") {
          return await emitter._onEmitWithAck(event, payload);
        }
        return { applied: 1, failed: 0 };
      },
    });
    return emitter;
  };

  const connectSocket = (id: string, targetIo = io) => {
    const socket = createMockSocket(id);
    const handler = targetIo.of("/").listeners("connection")[0];
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
        if (params?.[0] === "session-ia-impersonator") {
          return {
            rows: [
              {
                id: "session-ia-impersonator",
                username: "  Ia  ",
                created_at: new Date().toISOString(),
              },
            ],
            rowCount: 1,
          };
        }
        if (params?.[0] === "session-codia-impersonator") {
          return {
            rows: [
              {
                id: "session-codia-impersonator",
                username: "  Codia  ",
                created_at: new Date().toISOString(),
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }

      if (queryStr.includes("SELECT 1 FROM sessions WHERE id = $1")) {
        if (
          params?.[0] === testSessionId ||
          params?.[0] === "session-ia-impersonator" ||
          params?.[0] === "session-codia-impersonator"
        ) {
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

  test("8. chat-join con nombre de usuario 'Ia' asigna authorName 'IA (usuario)' sin rechazar la unión", async () => {
    const socket = connectSocket("sock-ia-test");

    const diagId = `diag-${Date.now()}`;
    testDiagramIds.push(diagId);
    socket.join(diagId);

    await new Promise<void>((resolve) => {
      socket.emit(
        "chat-join",
        { diagramId: diagId, sessionId: "session-ia-impersonator" },
        (res: any) => {
          assert.equal(res.ok, true, "La unión NO debe ser rechazada");
          assert.equal(
            socket.data.authorName,
            "IA (usuario)",
            "El authorName debe transformarse a 'IA (usuario)'"
          );
          resolve();
        }
      );
    });
  });

  test("9. chat-join con nombre de usuario 'Codia' asigna authorName 'Codia (usuario)' sin rechazar la unión", async () => {
    const socket = connectSocket("sock-codia-test");

    const diagId = `diag-${Date.now()}`;
    testDiagramIds.push(diagId);
    socket.join(diagId);

    await new Promise<void>((resolve) => {
      socket.emit(
        "chat-join",
        { diagramId: diagId, sessionId: "session-codia-impersonator" },
        (res: any) => {
          assert.equal(res.ok, true, "La unión NO debe ser rechazada");
          assert.equal(
            socket.data.authorName,
            "Codia (usuario)",
            "El authorName debe transformarse a 'Codia (usuario)'"
          );
          resolve();
        }
      );
    });
  });

  test("10. CU22: en modo approval, un pedido de modificación guarda mensaje con proposal pendiente y operations en Mongo, la sala recibe el mensaje sin operations y no se emite ai-operations", async () => {
    const customServer = http.createServer();
    const mockAiChatService = {
      answerInRoom: async (params: any) => {
        return {
          kind: "proposal" as const,
          message: `${params.askerName}, propongo: agregar la clase Factura. Queda pendiente de aprobación del equipo.`,
          operations: [{ action: "createClass", className: "Factura" }],
          proposal: {
            id: "prop-approval-test-1",
            status: "pending" as const,
            summary: ["agregar la clase Factura"],
            requestedBy: params.askerName,
          },
        };
      },
    };
    const customIo = initSocket(customServer, mockAiChatService as any);

    try {
      const socket = connectSocket("sock-approval-10", customIo);
      const diagId = `diag-approval-${Date.now()}`;
      testDiagramIds.push(diagId);
      socket.join(diagId);

      await new Promise<void>((resolve) => {
        socket.emit("chat-join", { diagramId: diagId, sessionId: testSessionId }, () => resolve());
      });

      let aiOperationsEmitted = false;
      socket.on("ai-operations", () => {
        aiOperationsEmitted = true;
      });

      let aiBroadcastPayload: any = null;
      const aiMessageReceived = new Promise<void>((resolve) => {
        (customIo as any).to = (room: string) => ({
          emit: (event: string, payload: any) => {
            if (room === diagId && event === "chat-message" && payload.role === "ai") {
              aiBroadcastPayload = payload;
              resolve();
            }
          },
        });
      });

      await new Promise<void>((resolve) => {
        socket.emit(
          "chat-message",
          { diagramId: diagId, text: "@Codia agrega la clase Factura" },
          (res: any) => {
            assert.equal(res.ok, true);
            resolve();
          }
        );
      });

      await aiMessageReceived;

      // 1. No debe emitirse ai-operations al socket
      assert.equal(aiOperationsEmitted, false, "En modo approval NO debe emitirse ai-operations al socket");

      // 2. Broadcast de sala recibe kind: proposal, sin operations, con proposal pendiente
      assert.ok(aiBroadcastPayload, "La sala debe recibir el broadcast de Codia");
      assert.equal(aiBroadcastPayload.kind, "proposal");
      assert.equal(aiBroadcastPayload.operations, undefined, "operations no debe exponerse en el broadcast");
      assert.ok(!("operations" in aiBroadcastPayload));
      assert.ok(aiBroadcastPayload.proposal, "Debe incluir el objeto proposal público");
      assert.equal(aiBroadcastPayload.proposal.status, "pending");
      assert.deepEqual(aiBroadcastPayload.proposal.summary, ["agregar la clase Factura"]);

      // 3. En MongoDB se persisten proposal y operations
      const db = await getMongoDb();
      assert.ok(db, "MongoDB debe estar conectado");
      const docInMongo = await db.collection(CHAT_COLLECTION_NAME).findOne({
        diagramId: diagId,
        role: "ai",
      });
      assert.ok(docInMongo, "El mensaje de Codia debe estar en la BD Mongo");
      assert.equal(docInMongo.kind, "proposal");
      assert.equal(docInMongo.proposal?.status, "pending");
      assert.deepEqual(docInMongo.proposal?.summary, ["agregar la clase Factura"]);
      assert.deepEqual(docInMongo.operations, [{ action: "createClass", className: "Factura" }]);
    } finally {
      await new Promise<void>((resolve) => customIo.close(() => resolve()));
      customServer.close();
    }
  });

  test("11. En modo apply, un pedido de modificación sigue emitiendo ai-operations al socket", async () => {
    let receivedAiOperationsPayload: any = null;
    const customServer = http.createServer();
    const mockAiChatService = {
      answerInRoom: async (params: any) => {
        const ops = [{ action: "createClass", className: "Factura" }];
        await params.onOperations(ops, []);
        return {
          kind: "modification" as const,
          message: `${params.askerName}, apliqué los cambios al diagrama.`,
          operations: ops,
        };
      },
    };
    const customIo = initSocket(customServer, mockAiChatService as any);

    try {
      const socket = connectSocket("sock-apply-11", customIo);
      const diagId = `diag-apply-${Date.now()}`;
      testDiagramIds.push(diagId);
      socket.join(diagId);

      socket._onEmitWithAck = async (event: string, payload: any) => {
        if (event === "ai-operations") {
          receivedAiOperationsPayload = payload;
          return { applied: 1, failed: 0 };
        }
        return null;
      };

      await new Promise<void>((resolve) => {
        socket.emit("chat-join", { diagramId: diagId, sessionId: testSessionId }, () => resolve());
      });

      let aiBroadcastPayload: any = null;
      const aiMessageReceived = new Promise<void>((resolve) => {
        (customIo as any).to = (room: string) => ({
          emit: (event: string, payload: any) => {
            if (room === diagId && event === "chat-message" && payload.role === "ai") {
              aiBroadcastPayload = payload;
              resolve();
            }
          },
        });
      });

      await new Promise<void>((resolve) => {
        socket.emit(
          "chat-message",
          { diagramId: diagId, text: "@Codia agrega la clase Factura" },
          (res: any) => {
            assert.equal(res.ok, true);
            resolve();
          }
        );
      });

      await aiMessageReceived;

      // 1. Debe haberse emitido ai-operations con ack al socket del autor
      assert.ok(receivedAiOperationsPayload, "En modo apply SÍ debe emitirse ai-operations al socket");
      assert.equal(receivedAiOperationsPayload.diagramId, diagId);
      assert.deepEqual(receivedAiOperationsPayload.operations, [
        { action: "createClass", className: "Factura" },
      ]);

      // 2. Broadcast de sala recibe kind: modification, sin operations
      assert.ok(aiBroadcastPayload, "La sala debe recibir el broadcast de Codia");
      assert.equal(aiBroadcastPayload.kind, "modification");
      assert.equal(aiBroadcastPayload.operations, undefined, "operations no debe viajar en el broadcast");
      assert.equal(aiBroadcastPayload.proposal, undefined, "No debe haber proposal en modo apply");
    } finally {
      await new Promise<void>((resolve) => customIo.close(() => resolve()));
      customServer.close();
    }
  });
});
