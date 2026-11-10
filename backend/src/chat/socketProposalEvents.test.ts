import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import http from "http";
import { initSocket } from "../socket";
import { pool } from "../db";
import { getMongoDb, closeMongoConnection } from "../db/mongo";
import {
  saveMessage,
  CHAT_COLLECTION_NAME,
} from "./chatRepository";
import { createProposal } from "./proposalHelpers";

describe("CU22 Fase 2B - Evento Socket.IO proposal-decision (flujos reject y approve)", () => {
  let io: any;
  let server: http.Server;
  const testSessionAna = "session-test-ana-111";
  const testUsernameAna = "AnaDirectora";
  const testSessionCarlos = "session-test-carlos-222";
  const testUsernameCarlos = "CarlosDev";
  const testDiagramIds: string[] = [];
  const mockDiagrams = new Map<string, any>();
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

    originalPoolQuery = pool.query;
    (pool as any).query = async (text: any, params?: any[]) => {
      const queryStr = typeof text === "string" ? text : text?.text || "";

      if (queryStr.includes("FROM sessions") && queryStr.includes("WHERE id = $1")) {
        if (params?.[0] === testSessionAna) {
          return {
            rows: [
              {
                id: testSessionAna,
                username: testUsernameAna,
                created_at: new Date().toISOString(),
              },
            ],
            rowCount: 1,
          };
        }
        if (params?.[0] === testSessionCarlos) {
          return {
            rows: [
              {
                id: testSessionCarlos,
                username: testUsernameCarlos,
                created_at: new Date().toISOString(),
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }

      if (queryStr.includes("SELECT 1 FROM sessions WHERE id = $1")) {
        if (params?.[0] === testSessionAna || params?.[0] === testSessionCarlos) {
          return { rows: [{ "?column?": 1 }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      if (queryStr.includes("FROM diagrams") && queryStr.includes("WHERE id = $1")) {
        const diagId = params?.[0];
        if (mockDiagrams.has(diagId)) {
          const d = mockDiagrams.get(diagId);
          return {
            rows: [
              {
                id: diagId,
                session_id: "test-session",
                name: "Diagrama de Prueba",
                data: d.data,
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
  });

  after(async () => {
    try {
      if (originalPoolQuery) {
        (pool as any).query = originalPoolQuery;
      }
      mockDiagrams.clear();
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

  test("1. Rechazo exitoso: liquida a 'rejected', emite proposal-updated y chat-message del sistema, y responde ack ok", async () => {
    const diagId = `diag-prop-reject-${Date.now()}`;
    testDiagramIds.push(diagId);

    const proposal = createProposal({
      summary: ["agregar la clase Factura"],
      requestedBy: testUsernameCarlos,
    });

    const savedDoc = await saveMessage({
      diagramId: diagId,
      authorSessionId: "ai",
      authorName: "Codia",
      role: "ai",
      text: `${testUsernameCarlos}, propongo: agregar la clase Factura. Queda pendiente de aprobación del equipo.`,
      kind: "proposal",
      operations: [{ action: "createClass", className: "Factura" }],
      proposal,
    });

    const socket = connectSocket("sock-ana-reject-1");
    socket.join(diagId);

    await new Promise<void>((resolve) => {
      socket.emit("chat-join", { diagramId: diagId, sessionId: testSessionAna }, () => resolve());
    });

    // Interceptar emisiones a la sala para verificar proposal-updated y mensaje de sistema
    let proposalUpdatedPayload: any = null;
    let systemMessagePayload: any = null;

    const originalTo = io.to;
    io.to = (room: string) => ({
      emit: (event: string, payload: any) => {
        if (room === diagId) {
          if (event === "proposal-updated") {
            proposalUpdatedPayload = payload;
          }
          if (event === "chat-message" && payload?.role === "system") {
            systemMessagePayload = payload;
          }
        }
      },
    });

    try {
      const ackRes = await new Promise<any>((resolve) => {
        socket.emit(
          "proposal-decision",
          {
            diagramId: diagId,
            proposalId: savedDoc.id,
            decision: "reject",
          },
          resolve
        );
      });

      // 1. Verificar respuesta de acknowledgement
      assert.equal(ackRes.ok, true, "El ack debe ser exitoso");
      assert.ok(ackRes.proposal, "El ack debe devolver el objeto proposal público");
      assert.equal(ackRes.proposal.status, "rejected");
      assert.equal(ackRes.proposal.decidedBy, testUsernameAna);
      assert.ok(ackRes.proposal.decidedAt, "Debe tener decidedAt");
      assert.deepEqual(ackRes.proposal.summary, ["agregar la clase Factura"]);
      assert.equal(ackRes.proposal.requestedBy, testUsernameCarlos);

      // 2. Verificar broadcast de evento "proposal-updated"
      assert.ok(proposalUpdatedPayload, "Debe emitirse proposal-updated a la sala");
      assert.equal(proposalUpdatedPayload.diagramId, diagId);
      assert.equal(proposalUpdatedPayload.messageId, savedDoc.id);
      assert.equal(proposalUpdatedPayload.proposal.status, "rejected");
      assert.equal(proposalUpdatedPayload.proposal.decidedBy, testUsernameAna);

      // 3. Verificar difusión de mensaje de sistema
      assert.ok(systemMessagePayload, "Debe emitirse mensaje de sistema a la sala");
      assert.equal(systemMessagePayload.role, "system");
      assert.equal(
        systemMessagePayload.text,
        `${testUsernameAna} rechazó la propuesta de Codia`
      );

      // 4. Verificar persistencia en MongoDB
      const db = await getMongoDb();
      assert.ok(db, "MongoDB disponible");
      const inMongo = await db.collection(CHAT_COLLECTION_NAME).findOne({
        diagramId: diagId,
        _id: new (await import("mongodb")).ObjectId(savedDoc.id),
      });
      assert.ok(inMongo, "Mensaje encontrado en Mongo");
      assert.equal(inMongo.proposal?.status, "rejected");
      assert.equal(inMongo.proposal?.decidedBy, testUsernameAna);
      assert.ok(inMongo.proposal?.decidedAt);
      assert.equal(inMongo.proposal?.applyingAt, undefined, "applyingAt debe haberse quitado");
    } finally {
      io.to = originalTo;
    }
  });

  test("2. Rechazo exitoso cuando proposalId es el UUID interno de la propuesta", async () => {
    const diagId = `diag-prop-uuid-${Date.now()}`;
    testDiagramIds.push(diagId);

    const proposal = createProposal({
      summary: ["crear clase Pedido"],
      requestedBy: testUsernameCarlos,
    });

    const savedDoc = await saveMessage({
      diagramId: diagId,
      authorSessionId: "ai",
      authorName: "Codia",
      role: "ai",
      text: `${testUsernameCarlos}, propongo: crear clase Pedido. Queda pendiente de aprobación del equipo.`,
      kind: "proposal",
      operations: [{ action: "createClass", className: "Pedido" }],
      proposal,
    });

    const socket = connectSocket("sock-ana-uuid-2");
    socket.join(diagId);

    await new Promise<void>((resolve) => {
      socket.emit("chat-join", { diagramId: diagId, sessionId: testSessionAna }, () => resolve());
    });

    // Enviar proposalId con el UUID de la propuesta (proposal.id)
    const ackRes = await new Promise<any>((resolve) => {
      socket.emit(
        "proposal-decision",
        {
          diagramId: diagId,
          proposalId: proposal.id,
          decision: "reject",
        },
        resolve
      );
    });

    assert.equal(ackRes.ok, true);
    assert.equal(ackRes.proposal.status, "rejected");
    assert.equal(ackRes.proposal.decidedBy, testUsernameAna);
  });

  test("3. Doble rechazo concurrente: solo uno gana y el segundo falla con already_decided", async () => {
    const diagId = `diag-prop-concurrent-${Date.now()}`;
    testDiagramIds.push(diagId);

    const proposal = createProposal({
      summary: ["agregar clase Auditoria"],
      requestedBy: "Sistema",
    });

    const savedDoc = await saveMessage({
      diagramId: diagId,
      authorSessionId: "ai",
      authorName: "Codia",
      role: "ai",
      text: "Propuesta de auditoria",
      kind: "proposal",
      operations: [{ action: "createClass", className: "Auditoria" }],
      proposal,
    });

    const socketAna = connectSocket("sock-concurrent-ana");
    socketAna.join(diagId);
    await new Promise<void>((resolve) => {
      socketAna.emit("chat-join", { diagramId: diagId, sessionId: testSessionAna }, () => resolve());
    });

    const socketCarlos = connectSocket("sock-concurrent-carlos");
    socketCarlos.join(diagId);
    await new Promise<void>((resolve) => {
      socketCarlos.emit("chat-join", { diagramId: diagId, sessionId: testSessionCarlos }, () => resolve());
    });

    const [resAna, resCarlos] = await Promise.all([
      new Promise<any>((resolve) =>
        socketAna.emit(
          "proposal-decision",
          { diagramId: diagId, proposalId: savedDoc.id, decision: "reject" },
          resolve
        )
      ),
      new Promise<any>((resolve) =>
        socketCarlos.emit(
          "proposal-decision",
          { diagramId: diagId, proposalId: savedDoc.id, decision: "reject" },
          resolve
        )
      ),
    ]);

    const successes = [resAna, resCarlos].filter((r) => r.ok === true);
    const failures = [resAna, resCarlos].filter((r) => r.ok === false);

    assert.equal(successes.length, 1, "Exactamente una de las dos solicitudes debe tener éxito");
    assert.equal(failures.length, 1, "La otra solicitud debe fallar");
    assert.equal(failures[0].error, "already_decided");
    assert.ok(failures[0].proposal, "Debe incluir el objeto propuesta vigente");
    assert.ok(["pending", "rejected"].includes(failures[0].proposal.status));
  });

  test("4. Rechaza con not_joined si el socket no completó chat-join en la sala", async () => {
    const socket = connectSocket("sock-no-join");
    const diagId = `diag-no-join-${Date.now()}`;
    testDiagramIds.push(diagId);
    socket.join(diagId); // en la sala socket, pero no hizo chat-join

    const ackRes = await new Promise<any>((resolve) => {
      socket.emit(
        "proposal-decision",
        {
          diagramId: diagId,
          proposalId: "678901234567890123456789",
          decision: "reject",
        },
        resolve
      );
    });

    assert.equal(ackRes.ok, false);
    assert.equal(ackRes.error, "not_joined");
  });

  test("5. Rechaza con invalid_session si la sesión de socket.data no es válida en Postgres", async () => {
    const socket = connectSocket("sock-invalid-session");
    const diagId = `diag-inv-sess-${Date.now()}`;
    testDiagramIds.push(diagId);
    socket.join(diagId);

    // Simular que de algún modo el socket tiene datos corruptos de sesión
    socket.data = {
      diagramId: diagId,
      sessionId: "session-inexistente-999",
      authorName: "Fantasma",
    };

    const ackRes = await new Promise<any>((resolve) => {
      socket.emit(
        "proposal-decision",
        {
          diagramId: diagId,
          proposalId: "678901234567890123456789",
          decision: "reject",
        },
        resolve
      );
    });

    assert.equal(ackRes.ok, false);
    assert.equal(ackRes.error, "invalid_session");
  });

  test("6. Rechaza con not_found ante propuesta inexistente o payload mal formado", async () => {
    const socket = connectSocket("sock-not-found");
    const diagId = `diag-not-found-${Date.now()}`;
    testDiagramIds.push(diagId);
    socket.join(diagId);

    await new Promise<void>((resolve) => {
      socket.emit("chat-join", { diagramId: diagId, sessionId: testSessionAna }, () => resolve());
    });

    // 1. Id inexistente válido como ObjectId
    const resNonExistent = await new Promise<any>((resolve) => {
      socket.emit(
        "proposal-decision",
        {
          diagramId: diagId,
          proposalId: "678901234567890123456789",
          decision: "reject",
        },
        resolve
      );
    });
    assert.equal(resNonExistent.ok, false);
    assert.equal(resNonExistent.error, "not_found");

    // 2. ProposalId vacío
    const resEmptyId = await new Promise<any>((resolve) => {
      socket.emit(
        "proposal-decision",
        {
          diagramId: diagId,
          proposalId: "   ",
          decision: "reject",
        },
        resolve
      );
    });
    assert.equal(resEmptyId.ok, false);
    assert.equal(resEmptyId.error, "not_found");

    // 3. Decisión inválida (ni approve ni reject)
    const resBadDecision = await new Promise<any>((resolve) => {
      socket.emit(
        "proposal-decision",
        {
          diagramId: diagId,
          proposalId: "678901234567890123456789",
          decision: "maybe" as any,
        },
        resolve
      );
    });
    assert.equal(resBadDecision.ok, false);
    assert.equal(resBadDecision.error, "not_found");

    // 4. Payload nulo
    const resNull = await new Promise<any>((resolve) => {
      socket.emit("proposal-decision", null as any, resolve);
    });
    assert.equal(resNull.ok, false);
    assert.equal(resNull.error, "not_found");
  });

  test("7. Aprobación exitosa: valida operaciones, emite ai-operations solo al socket de quien aprueba, liquida como approved y difunde a la sala", async () => {
    const diagId = `diag-prop-approve-ok-${Date.now()}`;
    testDiagramIds.push(diagId);

    // Diagrama existente con lienzo vacío
    mockDiagrams.set(diagId, { data: { elements: [] } });

    const proposal = createProposal({
      summary: ["agregar la clase Factura"],
      requestedBy: testUsernameCarlos,
    });

    const savedDoc = await saveMessage({
      diagramId: diagId,
      authorSessionId: "ai",
      authorName: "Codia",
      role: "ai",
      text: `${testUsernameCarlos}, propongo: agregar la clase Factura. Queda pendiente de aprobación del equipo.`,
      kind: "proposal",
      operations: [{ action: "createClass", className: "Factura" }],
      proposal,
    });

    // Dos sockets en la misma sala: Ana (aprueba) y Carlos (observador)
    const socketAna = connectSocket("sock-ana-approver");
    socketAna.join(diagId);
    await new Promise<void>((resolve) => {
      socketAna.emit("chat-join", { diagramId: diagId, sessionId: testSessionAna }, () => resolve());
    });

    const socketCarlos = connectSocket("sock-carlos-observer");
    socketCarlos.join(diagId);
    await new Promise<void>((resolve) => {
      socketCarlos.emit("chat-join", { diagramId: diagId, sessionId: testSessionCarlos }, () => resolve());
    });

    let anaReceivedAiOperations = false;
    let carlosReceivedAiOperations = false;
    let receivedPayloadOnAna: any = null;

    socketAna.on("ai-operations", (payload: any) => {
      anaReceivedAiOperations = true;
      receivedPayloadOnAna = payload;
    });

    socketCarlos.on("ai-operations", () => {
      carlosReceivedAiOperations = true;
    });

    let proposalUpdatedPayload: any = null;
    let systemMessagePayload: any = null;

    const originalTo = io.to;
    io.to = (room: string) => ({
      emit: (event: string, payload: any) => {
        if (room === diagId) {
          if (event === "proposal-updated") {
            proposalUpdatedPayload = payload;
          }
          if (event === "chat-message" && payload?.role === "system") {
            systemMessagePayload = payload;
          }
        }
      },
    });

    try {
      const ackRes = await new Promise<any>((resolve) => {
        socketAna.emit(
          "proposal-decision",
          {
            diagramId: diagId,
            proposalId: savedDoc.id,
            decision: "approve",
          },
          resolve
        );
      });

      // 1. Ack exitoso
      assert.equal(ackRes.ok, true, "Ack debe ser ok: true");
      assert.ok(ackRes.proposal, "Debe incluir proposal pública");
      assert.equal(ackRes.proposal.status, "approved");
      assert.equal(ackRes.proposal.decidedBy, testUsernameAna);
      assert.ok(ackRes.proposal.decidedAt);

      // 2. ai-operations se emitió SOLO a socketAna, no a socketCarlos
      assert.equal(anaReceivedAiOperations, true, "Socket de Ana debe haber recibido ai-operations");
      assert.equal(carlosReceivedAiOperations, false, "Socket de Carlos NO debe recibir ai-operations");
      assert.ok(
        receivedPayloadOnAna.messageId.startsWith(`${savedDoc.id}:`),
        "messageId debe incluir prefix del mensaje y timestamp"
      );
      assert.equal(receivedPayloadOnAna.diagramId, diagId);
      assert.deepEqual(receivedPayloadOnAna.operations, [
        { action: "createClass", className: "Factura" },
      ]);

      // 3. Difusión a la sala: proposal-updated y mensaje de sistema
      assert.ok(proposalUpdatedPayload, "Debe emitirse proposal-updated a la sala");
      assert.equal(proposalUpdatedPayload.proposal.status, "approved");
      assert.equal(proposalUpdatedPayload.proposal.decidedBy, testUsernameAna);

      assert.ok(systemMessagePayload, "Debe emitirse mensaje de sistema a la sala");
      assert.equal(systemMessagePayload.text, `${testUsernameAna} aprobó la propuesta de Codia`);

      // 4. Mongo persistido
      const db = await getMongoDb();
      assert.ok(db);
      const inMongo = await db.collection(CHAT_COLLECTION_NAME).findOne({
        diagramId: diagId,
        _id: new (await import("mongodb")).ObjectId(savedDoc.id),
      });
      assert.ok(inMongo);
      assert.equal(inMongo.proposal?.status, "approved");
      assert.equal(inMongo.proposal?.decidedBy, testUsernameAna);
    } finally {
      io.to = originalTo;
    }
  });

  test("8. Doble aprobación concurrente: se aplica una sola vez y la segunda falla con already_decided", async () => {
    const diagId = `diag-prop-double-approve-${Date.now()}`;
    testDiagramIds.push(diagId);

    mockDiagrams.set(diagId, { data: { elements: [] } });

    const proposal = createProposal({
      summary: ["crear clase Recibo"],
      requestedBy: "Tester",
    });

    const savedDoc = await saveMessage({
      diagramId: diagId,
      authorSessionId: "ai",
      authorName: "Codia",
      role: "ai",
      text: "Propuesta de recibo",
      kind: "proposal",
      operations: [{ action: "createClass", className: "Recibo" }],
      proposal,
    });

    const socketAna = connectSocket("sock-double-ana");
    socketAna.join(diagId);
    await new Promise<void>((resolve) => {
      socketAna.emit("chat-join", { diagramId: diagId, sessionId: testSessionAna }, () => resolve());
    });

    const socketCarlos = connectSocket("sock-double-carlos");
    socketCarlos.join(diagId);
    await new Promise<void>((resolve) => {
      socketCarlos.emit("chat-join", { diagramId: diagId, sessionId: testSessionCarlos }, () => resolve());
    });

    const [resAna, resCarlos] = await Promise.all([
      new Promise<any>((resolve) =>
        socketAna.emit(
          "proposal-decision",
          { diagramId: diagId, proposalId: savedDoc.id, decision: "approve" },
          resolve
        )
      ),
      new Promise<any>((resolve) =>
        socketCarlos.emit(
          "proposal-decision",
          { diagramId: diagId, proposalId: savedDoc.id, decision: "approve" },
          resolve
        )
      ),
    ]);

    const successes = [resAna, resCarlos].filter((r) => r.ok === true);
    const failures = [resAna, resCarlos].filter((r) => r.ok === false);

    assert.equal(successes.length, 1, "Solo una aprobación debe tener éxito");
    assert.equal(failures.length, 1, "La otra debe fallar");
    assert.equal(failures[0].error, "already_decided");
    assert.ok(failures[0].proposal);
  });

  test("9. Propuesta caducada tras cambiar el diagrama (stale): liquida a expired y emite aviso a la sala", async () => {
    const diagId = `diag-prop-stale-${Date.now()}`;
    testDiagramIds.push(diagId);

    // El diagrama NO contiene la clase Usuario (lienzo vacío)
    mockDiagrams.set(diagId, { data: { elements: [] } });

    // La propuesta intenta agregar un atributo a Usuario (que no existe)
    const proposal = createProposal({
      summary: ["agregar atributo email a Usuario"],
      requestedBy: testUsernameCarlos,
    });

    const savedDoc = await saveMessage({
      diagramId: diagId,
      authorSessionId: "ai",
      authorName: "Codia",
      role: "ai",
      text: "Propuesta de atributo en clase eliminada",
      kind: "proposal",
      operations: [
        {
          action: "addAttribute",
          className: "Usuario",
          attribute: { name: "email", type: "String" },
        },
      ],
      proposal,
    });

    const socketAna = connectSocket("sock-ana-stale");
    socketAna.join(diagId);
    await new Promise<void>((resolve) => {
      socketAna.emit("chat-join", { diagramId: diagId, sessionId: testSessionAna }, () => resolve());
    });

    let proposalUpdatedPayload: any = null;
    let systemMessagePayload: any = null;

    const originalTo = io.to;
    io.to = (room: string) => ({
      emit: (event: string, payload: any) => {
        if (room === diagId) {
          if (event === "proposal-updated") {
            proposalUpdatedPayload = payload;
          }
          if (event === "chat-message" && payload?.role === "system") {
            systemMessagePayload = payload;
          }
        }
      },
    });

    try {
      const ackRes = await new Promise<any>((resolve) => {
        socketAna.emit(
          "proposal-decision",
          {
            diagramId: diagId,
            proposalId: savedDoc.id,
            decision: "approve",
          },
          resolve
        );
      });

      // 1. Debe responder ack { ok: false, error: "stale", proposal }
      assert.equal(ackRes.ok, false);
      assert.equal(ackRes.error, "stale");
      assert.ok(ackRes.proposal);
      assert.equal(ackRes.proposal.status, "expired");

      // 2. proposal-updated emitido con status: "expired" y sin decidedBy
      assert.ok(proposalUpdatedPayload);
      assert.equal(proposalUpdatedPayload.proposal.status, "expired");
      assert.equal(proposalUpdatedPayload.proposal.decidedBy, undefined);

      // 3. Mensaje de sistema exacto
      assert.ok(systemMessagePayload);
      assert.equal(
        systemMessagePayload.text,
        "La propuesta de Codia caducó porque el diagrama cambió. Repite el pedido a Codia."
      );

      // 4. Mongo persistido con status expired
      const db = await getMongoDb();
      assert.ok(db);
      const inMongo = await db.collection(CHAT_COLLECTION_NAME).findOne({
        diagramId: diagId,
        _id: new (await import("mongodb")).ObjectId(savedDoc.id),
      });
      assert.ok(inMongo);
      assert.equal(inMongo.proposal?.status, "expired");
      assert.equal(inMongo.proposal?.decidedBy, undefined);
    } finally {
      io.to = originalTo;
    }
  });

  test("10. Ack con fallo o timeout: revierte a pending y se puede reintentar con éxito", async () => {
    const diagId = `diag-prop-retry-${Date.now()}`;
    testDiagramIds.push(diagId);

    mockDiagrams.set(diagId, { data: { elements: [] } });

    const proposal = createProposal({
      summary: ["crear clase Orden"],
      requestedBy: testUsernameCarlos,
    });

    const savedDoc = await saveMessage({
      diagramId: diagId,
      authorSessionId: "ai",
      authorName: "Codia",
      role: "ai",
      text: "Propuesta de clase Orden",
      kind: "proposal",
      operations: [{ action: "createClass", className: "Orden" }],
      proposal,
    });

    const socketAna = connectSocket("sock-retry-ana");
    socketAna.join(diagId);
    await new Promise<void>((resolve) => {
      socketAna.emit("chat-join", { diagramId: diagId, sessionId: testSessionAna }, () => resolve());
    });

    // 1er intento: simulamos fallo del cliente (applied: 0)
    socketAna._onEmitWithAck = async () => ({ applied: 0, failed: 1 });

    const ackRes1 = await new Promise<any>((resolve) => {
      socketAna.emit(
        "proposal-decision",
        {
          diagramId: diagId,
          proposalId: savedDoc.id,
          decision: "approve",
        },
        resolve
      );
    });

    assert.equal(ackRes1.ok, false);
    assert.equal(ackRes1.error, "apply_failed");
    assert.equal(ackRes1.proposal.status, "pending");

    // Verificar en Mongo que volvió a pending
    const db = await getMongoDb();
    assert.ok(db);
    const inMongo1 = await db.collection(CHAT_COLLECTION_NAME).findOne({
      diagramId: diagId,
      _id: new (await import("mongodb")).ObjectId(savedDoc.id),
    });
    assert.ok(inMongo1);
    assert.equal(inMongo1.proposal?.status, "pending");
    assert.equal(inMongo1.proposal?.applyingAt, undefined);

    // 2do intento: ahora el cliente responde exitosamente con applied: 1
    socketAna._onEmitWithAck = async () => ({ applied: 1, failed: 0 });

    const ackRes2 = await new Promise<any>((resolve) => {
      socketAna.emit(
        "proposal-decision",
        {
          diagramId: diagId,
          proposalId: savedDoc.id,
          decision: "approve",
        },
        resolve
      );
    });

    assert.equal(ackRes2.ok, true);
    assert.equal(ackRes2.proposal.status, "approved");
    assert.equal(ackRes2.proposal.decidedBy, testUsernameAna);

    const inMongo2 = await db.collection(CHAT_COLLECTION_NAME).findOne({
      diagramId: diagId,
      _id: new (await import("mongodb")).ObjectId(savedDoc.id),
    });
    assert.ok(inMongo2);
    assert.equal(inMongo2.proposal?.status, "approved");
  });

  test("11. Aprobar su propia propuesta: permitido a cualquier integrante unido a la sala", async () => {
    const diagId = `diag-prop-self-approve-${Date.now()}`;
    testDiagramIds.push(diagId);

    mockDiagrams.set(diagId, { data: { elements: [] } });

    // La propuesta fue pedida por Ana
    const proposal = createProposal({
      summary: ["crear clase Perfil"],
      requestedBy: testUsernameAna,
    });

    const savedDoc = await saveMessage({
      diagramId: diagId,
      authorSessionId: "ai",
      authorName: "Codia",
      role: "ai",
      text: `${testUsernameAna}, propongo: crear clase Perfil. Queda pendiente de aprobación del equipo.`,
      kind: "proposal",
      operations: [{ action: "createClass", className: "Perfil" }],
      proposal,
    });

    const socketAna = connectSocket("sock-self-ana");
    socketAna.join(diagId);
    await new Promise<void>((resolve) => {
      socketAna.emit("chat-join", { diagramId: diagId, sessionId: testSessionAna }, () => resolve());
    });

    // Ana aprueba su propia propuesta
    const ackRes = await new Promise<any>((resolve) => {
      socketAna.emit(
        "proposal-decision",
        {
          diagramId: diagId,
          proposalId: savedDoc.id,
          decision: "approve",
        },
        resolve
      );
    });

    assert.equal(ackRes.ok, true);
    assert.equal(ackRes.proposal.status, "approved");
    assert.equal(ackRes.proposal.requestedBy, testUsernameAna);
    assert.equal(ackRes.proposal.decidedBy, testUsernameAna);
  });

  test("12. Aprobar una propuesta ya rechazada devuelve already_decided", async () => {
    const diagId = `diag-prop-already-rejected-${Date.now()}`;
    testDiagramIds.push(diagId);

    mockDiagrams.set(diagId, { data: { elements: [] } });

    const proposal = createProposal({
      summary: ["crear clase Log"],
      requestedBy: testUsernameCarlos,
    });

    const savedDoc = await saveMessage({
      diagramId: diagId,
      authorSessionId: "ai",
      authorName: "Codia",
      role: "ai",
      text: "Propuesta a rechazar primero",
      kind: "proposal",
      operations: [{ action: "createClass", className: "Log" }],
      proposal,
    });

    const socketAna = connectSocket("sock-ana-flow");
    socketAna.join(diagId);
    await new Promise<void>((resolve) => {
      socketAna.emit("chat-join", { diagramId: diagId, sessionId: testSessionAna }, () => resolve());
    });

    const socketCarlos = connectSocket("sock-carlos-flow");
    socketCarlos.join(diagId);
    await new Promise<void>((resolve) => {
      socketCarlos.emit("chat-join", { diagramId: diagId, sessionId: testSessionCarlos }, () => resolve());
    });

    // 1. Ana rechaza la propuesta
    const rejectRes = await new Promise<any>((resolve) => {
      socketAna.emit(
        "proposal-decision",
        {
          diagramId: diagId,
          proposalId: savedDoc.id,
          decision: "reject",
        },
        resolve
      );
    });
    assert.equal(rejectRes.ok, true);
    assert.equal(rejectRes.proposal.status, "rejected");

    // 2. Carlos intenta aprobar la propuesta ya rechazada
    const approveRes = await new Promise<any>((resolve) => {
      socketCarlos.emit(
        "proposal-decision",
        {
          diagramId: diagId,
          proposalId: savedDoc.id,
          decision: "approve",
        },
        resolve
      );
    });

    assert.equal(approveRes.ok, false);
    assert.equal(approveRes.error, "already_decided");
    assert.ok(approveRes.proposal);
    assert.equal(approveRes.proposal.status, "rejected");
  });
});
