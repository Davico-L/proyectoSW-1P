import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import http from "http";
import { initSocket } from "../socket";
import { pool } from "../db";
import { getMongoDb, closeMongoConnection } from "../db/mongo";
import { CHAT_COLLECTION_NAME } from "./chatRepository";
import {
  ROOM_SETTINGS_COLLECTION_NAME,
  formatSettingsAnnouncement,
  saveRoomSettings,
  RoomSettings,
} from "./roomSettingsRepository";

describe("CU23 - Eventos Socket.IO de Configuración de Codia (chat-join y ai-settings-update)", () => {
  let io: any;
  let server: http.Server;
  const testSessionId = "session-valid-settings-123";
  const testUsername = "AnaDirectora";
  const testSessionId2 = "session-valid-settings-456";
  const testUsername2 = "CarlosDev";
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
        if (params?.[0] === testSessionId2) {
          return {
            rows: [
              {
                id: testSessionId2,
                username: testUsername2,
                created_at: new Date().toISOString(),
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }

      if (queryStr.includes("SELECT 1 FROM sessions WHERE id = $1")) {
        if (params?.[0] === testSessionId || params?.[0] === testSessionId2) {
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
      const db = await getMongoDb();
      if (db && testDiagramIds.length > 0) {
        await db.collection(ROOM_SETTINGS_COLLECTION_NAME).deleteMany({
          diagramId: { $in: testDiagramIds },
        });
        await db.collection(CHAT_COLLECTION_NAME).deleteMany({
          diagramId: { $in: testDiagramIds },
        });
      }
    } catch {
      // Ignorar
    } finally {
      if (io) {
        await new Promise<void>((resolve) => io.close(() => resolve()));
      }
      if (server) {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
      await closeMongoConnection();
    }
  });

  test("1. chat-join exitoso devuelve settings por defecto en el ack", async () => {
    const socket = connectSocket("sock-join-1");
    const diagId = `diag-settings-${Date.now()}-1`;
    testDiagramIds.push(diagId);
    socket.join(diagId);

    await new Promise<void>((resolve) => {
      socket.emit(
        "chat-join",
        { diagramId: diagId, sessionId: testSessionId },
        (res: any) => {
          assert.equal(res.ok, true);
          assert.deepEqual(res.settings, {
            mode: "apply",
            style: "mentora",
          });
          resolve();
        }
      );
    });
  });

  test("2. chat-join exitoso devuelve settings previamente guardadas", async () => {
    const diagId = `diag-settings-${Date.now()}-2`;
    testDiagramIds.push(diagId);

    // Guardar configuración previa
    await saveRoomSettings(
      diagId,
      { mode: "advise", style: "detallada" },
      testUsername
    );

    const socket = connectSocket("sock-join-2");
    socket.join(diagId);

    await new Promise<void>((resolve) => {
      socket.emit(
        "chat-join",
        { diagramId: diagId, sessionId: testSessionId },
        (res: any) => {
          assert.equal(res.ok, true);
          assert.deepEqual(res.settings, {
            mode: "advise",
            style: "detallada",
          });
          resolve();
        }
      );
    });
  });

  test("3. ai-settings-update rechaza con not_joined si no completó chat-join", async () => {
    const socket = connectSocket("sock-no-join");
    const diagId = `diag-settings-${Date.now()}-3`;
    testDiagramIds.push(diagId);
    socket.join(diagId); // En la sala, pero sin chat-join

    await new Promise<void>((resolve) => {
      socket.emit(
        "ai-settings-update",
        { diagramId: diagId, mode: "advise", style: "directa" },
        (res: any) => {
          assert.equal(res.ok, false);
          assert.equal(res.error, "not_joined");
          resolve();
        }
      );
    });
  });

  test("4. ai-settings-update rechaza con invalid_value ante valores no soportados", async () => {
    const socket = connectSocket("sock-invalid-val");
    const diagId = `diag-settings-${Date.now()}-4`;
    testDiagramIds.push(diagId);
    socket.join(diagId);

    await new Promise<void>((resolve) => {
      socket.emit(
        "chat-join",
        { diagramId: diagId, sessionId: testSessionId },
        () => resolve()
      );
    });

    // Modo inválido
    await new Promise<void>((resolve) => {
      socket.emit(
        "ai-settings-update",
        { diagramId: diagId, mode: "destructivo", style: "directa" },
        (res: any) => {
          assert.equal(res.ok, false);
          assert.equal(res.error, "invalid_value");
          resolve();
        }
      );
    });

    // Estilo inválido
    await new Promise<void>((resolve) => {
      socket.emit(
        "ai-settings-update",
        { diagramId: diagId, mode: "apply", style: "invento" },
        (res: any) => {
          assert.equal(res.ok, false);
          assert.equal(res.error, "invalid_value");
          resolve();
        }
      );
    });
  });

  test("5. ai-settings-update responde ok sin guardar ni emitir si los valores son idénticos a los vigentes", async () => {
    const socket = connectSocket("sock-noop");
    const diagId = `diag-settings-${Date.now()}-5`;
    testDiagramIds.push(diagId);
    socket.join(diagId);

    await new Promise<void>((resolve) => {
      socket.emit(
        "chat-join",
        { diagramId: diagId, sessionId: testSessionId },
        () => resolve()
      );
    });

    let eventEmitted = false;
    socket.on("ai-settings-changed", () => {
      eventEmitted = true;
    });
    socket.on("chat-message", () => {
      eventEmitted = true;
    });

    // Los valores por defecto iniciales son mode: "apply", style: "mentora"
    await new Promise<void>((resolve) => {
      socket.emit(
        "ai-settings-update",
        { diagramId: diagId, mode: "apply", style: "mentora" },
        (res: any) => {
          assert.equal(res.ok, true);
          assert.deepEqual(res.settings, { mode: "apply", style: "mentora" });
          resolve();
        }
      );
    });

    // Pequeño timeout para verificar que no emitió nada
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(eventEmitted, false, "No debe emitir eventos si no hubo cambios");
  });

  test("6. ai-settings-update exitoso persiste, emite chat-message role 'system' y ai-settings-changed a la sala", async () => {
    const diagId = `diag-settings-${Date.now()}-6`;
    testDiagramIds.push(diagId);

    const socketA = connectSocket("sock-client-a");
    socketA.join(diagId);

    await new Promise<void>((resolve) => {
      socketA.emit(
        "chat-join",
        { diagramId: diagId, sessionId: testSessionId },
        () => resolve()
      );
    });

    let receivedChangedEvent: any = null;
    let receivedSystemMessage: any = null;
    let targetRoom: string = "";

    const originalTo = io.to;
    io.to = (room: string) => {
      targetRoom = room;
      return {
        emit: (event: string, data: any) => {
          if (event === "ai-settings-changed") {
            receivedChangedEvent = data;
          }
          if (event === "chat-message" && data?.role === "system") {
            receivedSystemMessage = data;
          }
        },
      };
    };

    try {
      // Cliente A cambia el estilo a "directa"
      await new Promise<void>((resolve) => {
        socketA.emit(
          "ai-settings-update",
          { diagramId: diagId, mode: "apply", style: "directa" },
          (res: any) => {
            assert.equal(res.ok, true);
            assert.deepEqual(res.settings, {
              mode: "apply",
              style: "directa",
            });
            resolve();
          }
        );
      });

      assert.equal(targetRoom, diagId, "Debe emitirse a la sala del diagrama");

      // Verificación de ai-settings-changed emitido
      assert.ok(receivedChangedEvent, "Debió emitirse ai-settings-changed a la sala");
      assert.equal(receivedChangedEvent.diagramId, diagId);
      assert.equal(receivedChangedEvent.mode, "apply");
      assert.equal(receivedChangedEvent.style, "directa");
      assert.equal(receivedChangedEvent.updatedBy, testUsername);

      // Verificación de chat-message system emitido
      assert.ok(receivedSystemMessage, "Debió emitirse mensaje de sistema a la sala");
      assert.equal(receivedSystemMessage.role, "system");
      assert.equal(receivedSystemMessage.authorName, "Sistema");
      assert.match(
        receivedSystemMessage.text,
        new RegExp(`${testUsername} cambió el estilo de Codia a 'Directa'`)
      );
    } finally {
      io.to = originalTo;
    }
  });

  test("7. formatSettingsAnnouncement genera texto correcto para modo, estilo y ambos", () => {
    const onlyMode = formatSettingsAnnouncement("Pedro", true, "advise", false, "mentora");
    assert.equal(onlyMode, "Pedro cambió el modo de Codia a 'Solo asesora'");

    const onlyStyle = formatSettingsAnnouncement("Lucía", false, "apply", true, "detallada");
    assert.equal(onlyStyle, "Lucía cambió el estilo de Codia a 'Detallada'");

    const both = formatSettingsAnnouncement("Marcos", true, "advise", true, "directa");
    assert.equal(
      both,
      "Marcos cambió el modo de Codia a 'Solo asesora'. Marcos cambió el estilo de Codia a 'Directa'"
    );
  });
});
