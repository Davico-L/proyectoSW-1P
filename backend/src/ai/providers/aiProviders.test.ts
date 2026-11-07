import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import { AddressInfo } from "net";
import { app } from "../../app";
import { pool } from "../../db";
import {
  getFallbackChain,
  getActiveProviderId,
  setActiveProviderId,
  clearHealthCache,
  editWithFallback,
  chatWithFallback,
} from "./providerManager";
import { getProvider, registerProvider } from "./index";
import { ModelProvider, checkTruncatedResponse } from "./types";

describe("CU24 — Selección de proveedores IA y mecanismo de fallback", () => {
  let server: http.Server;
  let baseUrl: string;
  const testSessionId = "session-ai-provider-test-123";
  let originalPoolQuery: any;
  let originalGroqProvider: ModelProvider | undefined;
  let originalGeminiProvider: ModelProvider | undefined;
  let originalLocalProvider: ModelProvider | undefined;

  before(async () => {
    // Interceptar consultas de sesión para pruebas HTTP
    originalPoolQuery = pool.query;
    (pool as any).query = async (text: any, params?: any[]) => {
      const queryStr = typeof text === "string" ? text : text?.text || "";

      if (queryStr.includes("FROM sessions") && queryStr.includes("WHERE id = $1")) {
        if (params?.[0] === testSessionId) {
          return {
            rows: [
              {
                id: testSessionId,
                username: "AiTester",
                created_at: new Date().toISOString(),
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }

      if (queryStr.includes("FROM diagrams") && queryStr.includes("WHERE id = $1")) {
        if (params?.[0] === "diagram-ai-test-123") {
          return {
            rows: [
              {
                id: "diagram-ai-test-123",
                session_id: testSessionId,
                name: "Diagrama AI Test",
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

    // Guardar proveedores originales
    originalGroqProvider = getProvider("groq");
    originalGeminiProvider = getProvider("gemini");
    originalLocalProvider = getProvider("local");

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://localhost:${port}`;
  });

  after(async () => {
    if (originalPoolQuery) {
      (pool as any).query = originalPoolQuery;
    }
    if (originalGroqProvider) registerProvider(originalGroqProvider);
    if (originalGeminiProvider) registerProvider(originalGeminiProvider);
    if (originalLocalProvider) registerProvider(originalLocalProvider);
    clearHealthCache();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  // -------------------------------------------------------------------------
  // 1. Cadena de fallback: getFallbackChain(active)
  // -------------------------------------------------------------------------
  describe("getFallbackChain", () => {
    test("cuando activo es 'local', la cadena es local -> groq -> gemini", () => {
      const chain = getFallbackChain("local");
      assert.deepEqual(chain, ["local", "groq", "gemini"]);
    });

    test("cuando activo es 'groq', la cadena es groq -> local -> gemini", () => {
      const chain = getFallbackChain("groq");
      assert.deepEqual(chain, ["groq", "local", "gemini"]);
    });

    test("cuando activo es 'gemini', la cadena es gemini -> local -> groq", () => {
      const chain = getFallbackChain("gemini");
      assert.deepEqual(chain, ["gemini", "local", "groq"]);
    });

    test("si el id no está en la lista base, retorna la lista base completa sin duplicados", () => {
      const chain = getFallbackChain("desconocido" as any);
      assert.deepEqual(chain, ["local", "groq", "gemini"]);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Endpoint PUT /ai/providers/active - Autenticación y validación
  // -------------------------------------------------------------------------
  describe("PUT /ai/providers/active - Autenticación y validación", () => {
    test("7. Sin encabezado x-session-id responde HTTP 401", async () => {
      const res = await fetch(`${baseUrl}/ai/providers/active`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "groq" }),
      });
      assert.equal(res.status, 401);
      const json = await res.json();
      assert.equal(json.error, "No autenticado");
    });

    test("7b. Con sesión inexistente responde HTTP 401", async () => {
      const res = await fetch(`${baseUrl}/ai/providers/active`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": "session-invalida-999",
        },
        body: JSON.stringify({ id: "groq" }),
      });
      assert.equal(res.status, 401);
    });

    test("6. Con identificador inválido responde HTTP 400", async () => {
      const res = await fetch(`${baseUrl}/ai/providers/active`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": testSessionId,
        },
        body: JSON.stringify({ id: "openai-gpt4" }),
      });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error, "INVALID_INPUT");
    });
  });

  // -------------------------------------------------------------------------
  // 3. Selección de proveedores (incluso no disponibles)
  // -------------------------------------------------------------------------
  describe("PUT /ai/providers/active - Selección de proveedores", () => {
    test("1. Seleccionar 'local' con Colab apagado responde HTTP 200 y queda activo", async () => {
      // Local no está configurado ni en línea
      const res = await fetch(`${baseUrl}/ai/providers/active`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": testSessionId,
        },
        body: JSON.stringify({ id: "local" }),
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.ok, true);
      assert.equal(json.active, "local");
      assert.equal(getActiveProviderId(), "local");
    });

    test("3. Seleccionar 'groq' responde HTTP 200 y queda activo", async () => {
      const res = await fetch(`${baseUrl}/ai/providers/active`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": testSessionId,
        },
        body: JSON.stringify({ id: "groq" }),
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.ok, true);
      assert.equal(json.active, "groq");
      assert.equal(getActiveProviderId(), "groq");
    });

    test("4. Seleccionar 'gemini' responde HTTP 200 y queda activo", async () => {
      const res = await fetch(`${baseUrl}/ai/providers/active`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": testSessionId,
        },
        body: JSON.stringify({ id: "gemini" }),
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.ok, true);
      assert.equal(json.active, "gemini");
      assert.equal(getActiveProviderId(), "gemini");
    });
  });

  // -------------------------------------------------------------------------
  // 4. Mecanismo de Fallback con editWithFallback
  // -------------------------------------------------------------------------
  describe("Mecanismo de Fallback", () => {
    test("2. Con 'local' activo y Colab apagado: salta Local y recurre a Groq", async () => {
      setActiveProviderId("local");
      clearHealthCache();

      // Mock Local: no configurado
      registerProvider({
        id: "local",
        label: "Local",
        isConfigured: () => false,
        editDiagramByInstruction: async () => {
          throw new Error("Local offline");
        },
        chatReply: async () => { throw new Error("Local offline"); },
      });

      // Mock Groq: configurado y responde exitosamente
      registerProvider({
        id: "groq",
        label: "Groq",
        isConfigured: () => true,
        editDiagramByInstruction: async () => {
          return { operations: [{ action: "createClass", className: "Pedido" }] };
        },
        chatReply: async () => "mock",
      });

      // Mock Gemini: no configurado
      registerProvider({
        id: "gemini",
        label: "Gemini",
        isConfigured: () => false,
        editDiagramByInstruction: async () => {
          throw new Error("Gemini offline");
        },
        chatReply: async () => { throw new Error("Gemini offline"); },
      });

      const result = await editWithFallback({ classes: [], relations: [] }, "crear Pedido");
      assert.equal(result.provider, "groq");
      assert.equal(result.fallback, true);
      assert.equal(result.operations.length, 1);
      assert.equal(result.operations[0].className, "Pedido");
    });

    test("5. Con 'gemini' activo y no disponible: recurre a Local y luego a Groq", async () => {
      setActiveProviderId("gemini");
      clearHealthCache();

      // Mock Gemini: no configurado
      registerProvider({
        id: "gemini",
        label: "Gemini",
        isConfigured: () => false,
        editDiagramByInstruction: async () => {
          throw new Error("Gemini offline");
        },
        chatReply: async () => { throw new Error("Gemini offline"); },
      });

      // Mock Local: no configurado
      registerProvider({
        id: "local",
        label: "Local",
        isConfigured: () => false,
        editDiagramByInstruction: async () => {
          throw new Error("Local offline");
        },
        chatReply: async () => { throw new Error("Local offline"); },
      });

      // Mock Groq: configurado y atiende
      registerProvider({
        id: "groq",
        label: "Groq",
        isConfigured: () => true,
        editDiagramByInstruction: async () => {
          return { operations: [{ action: "createClass", className: "Factura" }] };
        },
        chatReply: async () => "mock",
      });

      const result = await editWithFallback({ classes: [], relations: [] }, "crear Factura");
      assert.equal(result.provider, "groq");
      assert.equal(result.fallback, true);
      assert.equal(result.operations[0].className, "Factura");
    });

    test("8. Si los tres proveedores fallan o están no disponibles, lanza AI_ALL_PROVIDERS_FAILED", async () => {
      setActiveProviderId("local");
      clearHealthCache();

      registerProvider({
        id: "local",
        label: "Local",
        isConfigured: () => false,
        editDiagramByInstruction: async () => {
          throw new Error("Local offline");
        },
        chatReply: async () => { throw new Error("Local offline"); },
      });

      registerProvider({
        id: "groq",
        label: "Groq",
        isConfigured: () => false,
        editDiagramByInstruction: async () => {
          throw new Error("Groq offline");
        },
        chatReply: async () => { throw new Error("Groq offline"); },
      });

      registerProvider({
        id: "gemini",
        label: "Gemini",
        isConfigured: () => false,
        editDiagramByInstruction: async () => {
          throw new Error("Gemini offline");
        },
        chatReply: async () => { throw new Error("Gemini offline"); },
      });

      await assert.rejects(
        async () => {
          await editWithFallback({ classes: [], relations: [] }, "crear Producto");
        },
        (err: any) => {
          assert.equal(err.message, "AI_ALL_PROVIDERS_FAILED");
          return true;
        }
      );
    });

    test("8b. POST /diagrams/:id/ai-edit responde HTTP 503 AI_SERVICE_UNAVAILABLE si todos los proveedores fallan", async () => {
      setActiveProviderId("local");
      clearHealthCache();

      registerProvider({
        id: "local",
        label: "Local",
        isConfigured: () => false,
        editDiagramByInstruction: async () => {
          throw new Error("Local offline");
        },
        chatReply: async () => { throw new Error("Local offline"); },
      });

      registerProvider({
        id: "groq",
        label: "Groq",
        isConfigured: () => false,
        editDiagramByInstruction: async () => {
          throw new Error("Groq offline");
        },
        chatReply: async () => { throw new Error("Groq offline"); },
      });

      registerProvider({
        id: "gemini",
        label: "Gemini",
        isConfigured: () => false,
        editDiagramByInstruction: async () => {
          throw new Error("Gemini offline");
        },
        chatReply: async () => { throw new Error("Gemini offline"); },
      });

      const res = await fetch(`${baseUrl}/diagrams/diagram-ai-test-123/ai-edit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": testSessionId,
        },
        body: JSON.stringify({
          instruction: "crear una clase Cliente",
        }),
      });

      assert.equal(res.status, 503);
      const json = await res.json();
      assert.equal(json.error, "AI_SERVICE_UNAVAILABLE");
      assert.equal(json.message, "La IA no está disponible por ahora");
    });
  });

  // -------------------------------------------------------------------------
  // 7. CU19 — chatReply y corte por límite (TRUNCATED_RESPONSE)
  // -------------------------------------------------------------------------
  describe("CU19 — Manejo de respuestas truncadas en chatReply", () => {
    test("checkTruncatedResponse: no lanza si isLimitCut es falso", () => {
      assert.doesNotThrow(() => {
        checkTruncatedResponse("Texto corto", false);
      });
    });

    test("checkTruncatedResponse: lanza TRUNCATED_RESPONSE si isLimitCut es true y texto < 200 caracteres", () => {
      assert.throws(
        () => {
          checkTruncatedResponse("David Luna, la diferencia principal entre una asociación", true);
        },
        (err: any) => err.message === "TRUNCATED_RESPONSE" && err.code === "TRUNCATED_RESPONSE"
      );
    });

    test("checkTruncatedResponse: lanza TRUNCATED_RESPONSE si isLimitCut es true, texto >= 200 pero sin signos de cierre", () => {
      const longTextWithoutEnding = "palabra ".repeat(35); // > 200 chars sin punto ni signo
      assert.ok(longTextWithoutEnding.length >= 200);
      assert.throws(
        () => {
          checkTruncatedResponse(longTextWithoutEnding, true);
        },
        (err: any) => err.message === "TRUNCATED_RESPONSE"
      );
    });

    test("checkTruncatedResponse: conserva la respuesta si isLimitCut es true, texto >= 200 y tiene signo de cierre", () => {
      const longTextWithEnding = "Esta es una explicación extensa sobre las asociaciones en UML. " + "palabra ".repeat(30);
      assert.ok(longTextWithEnding.length >= 200);
      assert.doesNotThrow(() => {
        checkTruncatedResponse(longTextWithEnding, true);
      });
    });

    test("chatWithFallback: Gemini con MAX_TOKENS y texto corto (< 200 chars) cae al siguiente proveedor (Groq)", async () => {
      setActiveProviderId("gemini");
      clearHealthCache();

      let geminiCalls = 0;
      let groqCalls = 0;

      registerProvider({
        id: "gemini",
        label: "Gemini",
        isConfigured: () => true,
        editDiagramByInstruction: async () => ({ operations: [] }),
        chatReply: async () => {
          geminiCalls++;
          checkTruncatedResponse("David Luna, la diferencia principal entre una asociación", true);
          return "";
        },
      });

      registerProvider({
        id: "groq",
        label: "Groq",
        isConfigured: () => true,
        editDiagramByInstruction: async () => ({ operations: [] }),
        chatReply: async () => {
          groqCalls++;
          return "David Luna, la asociación es una relación estructural y la composición implica dependencia de vida.";
        },
      });

      registerProvider({
        id: "local",
        label: "Local",
        isConfigured: () => false,
        editDiagramByInstruction: async () => ({ operations: [] }),
        chatReply: async () => { throw new Error("Local offline"); },
      });

      const result = await chatWithFallback("sys", "¿diferencia entre asociación y composición?");

      // Debe intentar Gemini 1 sola vez (sin reintentos inútiles ante TRUNCATED_RESPONSE) y pasar a Groq
      assert.equal(geminiCalls, 1);
      assert.equal(groqCalls, 1);
      assert.equal(result.provider, "groq");
      assert.equal(result.fallback, true);
      assert.match(result.text, /la asociación es una relación estructural/);
    });

    test("chatWithFallback: Gemini con MAX_TOKENS y texto largo (>= 200 chars con punto) se conserva", async () => {
      setActiveProviderId("gemini");
      clearHealthCache();

      let geminiCalls = 0;
      const longResponseWithPunctuation =
        "David Luna, la asociación en UML representa una relación general entre clases independientes. " +
        "Por otro lado, la composición define que las partes no pueden existir sin el todo. " +
        "Por ejemplo, una factura y sus líneas de detalle representan una composición típica en cualquier modelo";

      assert.ok(longResponseWithPunctuation.length >= 200);

      registerProvider({
        id: "gemini",
        label: "Gemini",
        isConfigured: () => true,
        editDiagramByInstruction: async () => ({ operations: [] }),
        chatReply: async () => {
          geminiCalls++;
          checkTruncatedResponse(longResponseWithPunctuation, true);
          return longResponseWithPunctuation;
        },
      });

      const result = await chatWithFallback("sys", "¿diferencia entre asociación y composición?");

      assert.equal(geminiCalls, 1);
      assert.equal(result.provider, "gemini");
      assert.equal(result.fallback, false);
      assert.equal(result.text, longResponseWithPunctuation);
    });

    test("chatWithFallback: Gemini con respuesta normal (no MAX_TOKENS) se conserva normalmente", async () => {
      setActiveProviderId("gemini");
      clearHealthCache();

      let geminiCalls = 0;
      const normalResponse = "David Luna, ¿en qué puedo ayudarte?";

      registerProvider({
        id: "gemini",
        label: "Gemini",
        isConfigured: () => true,
        editDiagramByInstruction: async () => ({ operations: [] }),
        chatReply: async () => {
          geminiCalls++;
          checkTruncatedResponse(normalResponse, false);
          return normalResponse;
        },
      });

      const result = await chatWithFallback("sys", "@codia");

      assert.equal(geminiCalls, 1);
      assert.equal(result.provider, "gemini");
      assert.equal(result.fallback, false);
      assert.equal(result.text, normalResponse);
    });
  });
});
