import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { importXmiToCanvas } from "./importXmiToCanvas";
import * as backendSyncModule from "../../excalidraw-app/data/backendSync";
import {
  ACTIVE_DIAGRAM_KEY,
  ACTIVE_SESSION_KEY,
} from "../../excalidraw-app/data/backendSync";
import { LocalData } from "../../excalidraw-app/data/LocalData";
import { debouncedEmitDiagramUpdate } from "../../excalidraw-app/data/realtimeSync";

describe("importXmiToCanvas", () => {
  const rootDir = path.resolve(__dirname, "../../..");
  const testRelationsXmiPath = path.resolve(
    rootDir,
    "backend/test-relations-output.xmi"
  );

  let sceneElements: ExcalidrawElement[] = [];
  let updateSceneCalls: { elements: readonly ExcalidrawElement[] }[] = [];
  let mockExcalidrawAPI: ExcalidrawImperativeAPI;

  beforeEach(() => {
    sceneElements = [];
    updateSceneCalls = [];

    mockExcalidrawAPI = {
      isDestroyed: false,
      getSceneElements: vi.fn(() => [...sceneElements]),
      updateScene: vi.fn(({ elements }) => {
        sceneElements = [...elements];
        updateSceneCalls.push({ elements: [...elements] });
      }),
      resetScene: vi.fn(() => {
        sceneElements = [];
      }),
      getAppState: vi.fn(
        () =>
          ({
            zoom: { value: 1 },
            scrollX: 0,
            scrollY: 0,
            width: 1000,
            height: 800,
          } as any)
      ),
      getFiles: vi.fn(() => ({})),
      scrollToContent: vi.fn(),
    } as unknown as ExcalidrawImperativeAPI;

    window.history.replaceState({}, "", "/");
    localStorage.setItem(ACTIVE_SESSION_KEY, "test-session-123");
    localStorage.setItem(ACTIVE_DIAGRAM_KEY, "old-diagram-id");

    // Mock fetch para el backend
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = url.toString();

      // Sesión
      if (urlStr.includes("/session/")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ sessionId: "test-session-123" }),
        } as Response;
      }
      if (urlStr.endsWith("/session")) {
        return {
          ok: true,
          status: 201,
          json: async () => ({ sessionId: "test-session-123" }),
        } as Response;
      }

      // POST /diagrams: Crear nuevo diagrama
      if (urlStr.endsWith("/diagrams") && init?.method === "POST") {
        const body = JSON.parse(init.body as string);
        return {
          ok: true,
          status: 201,
          json: async () => ({
            id: "new-imported-diagram-999",
            session_id: body.session_id,
            name: body.name,
            data: body.data,
          }),
        } as Response;
      }

      // PUT /diagrams/:id: Actualizar diagrama existente
      if (urlStr.includes("/diagrams/") && init?.method === "PUT") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        } as Response;
      }

      return {
        ok: false,
        status: 404,
        json: async () => ({ error: "Not found" }),
      } as Response;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("1. Si el XML es inválido o no tiene clases, lanza el error y NO crea diagrama ni llama a updateScene", async () => {
    const invalidXml = "<invalid><not-xmi/></invalid>";

    await expect(
      importXmiToCanvas(invalidXml, mockExcalidrawAPI)
    ).rejects.toThrow("El archivo no es un XMI válido o no contiene clases");

    expect(fetch).not.toHaveBeenCalled();
    expect(mockExcalidrawAPI.updateScene).not.toHaveBeenCalled();
    // No debe haber modificado el diagrama activo en localStorage
    expect(localStorage.getItem(ACTIVE_DIAGRAM_KEY)).toBe("old-diagram-id");
  });

  it("2. Importa correctamente test-relations-output.xmi: crea diagrama nuevo, agrega clases antes que flechas y persiste", async () => {
    const xml = fs.readFileSync(testRelationsXmiPath, "utf-8");

    const result = await importXmiToCanvas(xml, mockExcalidrawAPI, {
      diagramName: "Colegio y Profesores",
    });

    // Validar resultado devuelto
    expect(result.diagramId).toBe("new-imported-diagram-999");
    expect(result.stats).toEqual({
      classes: 6,
      relations: 5,
      ignoredElements: 0,
      discardedRelations: 0,
    });

    // Validar que se activó el nuevo diagrama y no el viejo
    expect(localStorage.getItem(ACTIVE_DIAGRAM_KEY)).toBe(
      "new-imported-diagram-999"
    );

    // Validar llamadas a updateScene
    expect(updateSceneCalls.length).toBeGreaterThanOrEqual(2);

    // La primera llamada a updateScene debe agregar todas las 6 clases (container + text = 12 elementos)
    const firstCallElements = updateSceneCalls[0].elements;
    expect(firstCallElements.length).toBe(12);

    const containers = firstCallElements.filter(
      (el) => el.customData?.type === "umlClass"
    );
    expect(containers.length).toBe(6);

    const classNames = containers.map(
      (c) => (c.customData as any)?.className
    );
    expect(classNames).toEqual(
      expect.arrayContaining([
        "Persona",
        "Estudiante",
        "Colegio",
        "Aula",
        "Profesor",
        "Materia",
      ])
    );

    // Las relaciones se agregaron posteriormente
    const finalElements = sceneElements;
    const arrows = finalElements.filter(
      (el) => el.type === "arrow" && el.customData?.type === "umlRelation"
    );
    expect(arrows.length).toBe(5);

    // Validar tipos de relaciones en las flechas
    const relationTypes = arrows.map(
      (a) => (a.customData as any)?.relationType
    );
    expect(relationTypes).toContain("inheritance");
    expect(relationTypes).toContain("association");
    expect(relationTypes).toContain("composition");
    expect(relationTypes).toContain("aggregation");
    expect(relationTypes).toContain("manyToMany");

    // Verificar que se guardó en el backend mediante PUT /diagrams/new-imported-diagram-999
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/diagrams/new-imported-diagram-999"),
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("3. Transición segura de A a B: guarda A antes del POST de B, no llama setActiveDiagramId(null), cancela debounces y activa B", async () => {
    // Configurar escenario: diagrama previo 'diagram-A' con elementos existentes en el lienzo
    window.history.replaceState({}, "", "/?diagramId=diagram-A");
    localStorage.setItem(ACTIVE_DIAGRAM_KEY, "diagram-A");
    const existingElement = {
      id: "elem-1",
      type: "rectangle",
      isDeleted: false,
    } as ExcalidrawElement;
    sceneElements = [existingElement];

    const callOrder: string[] = [];

    // Espiar setActiveDiagramId
    const setActiveIdSpy = vi
      .spyOn(backendSyncModule, "setActiveDiagramId")
      .mockImplementation((id: string | null) => {
        callOrder.push(`setActiveDiagramId:${id}`);
        if (id) {
          localStorage.setItem(ACTIVE_DIAGRAM_KEY, id);
        } else {
          localStorage.removeItem(ACTIVE_DIAGRAM_KEY);
        }
      });

    // Espiar cancelSave y debouncedEmitDiagramUpdate.cancel
    const cancelSaveSpy = vi
      .spyOn(LocalData, "cancelSave")
      .mockImplementation(() => {
        callOrder.push("LocalData.cancelSave");
      });

    const cancelEmitSpy = vi
      .spyOn(debouncedEmitDiagramUpdate, "cancel")
      .mockImplementation(() => {
        callOrder.push("debouncedEmitDiagramUpdate.cancel");
      });

    let postElementsLength = 0;

    // Mock fetch registrando orden de llamadas
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = url.toString();

      if (urlStr.endsWith("/session")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ sessionId: "test-session-123" }),
        } as Response;
      }

      if (urlStr.includes("/diagrams/diagram-A") && init?.method === "PUT") {
        callOrder.push("PUT /diagrams/diagram-A (guardar A)");
        return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
      }

      if (urlStr.endsWith("/diagrams") && init?.method === "POST") {
        const body = JSON.parse(init.body as string);
        postElementsLength = body?.data?.elements?.length || 0;
        callOrder.push("POST /diagrams (crear B)");
        return {
          ok: true,
          status: 201,
          json: async () => ({
            id: "diagram-B-new",
            name: "Diagrama B",
            data: body.data,
          }),
        } as Response;
      }

      if (urlStr.includes("/diagrams/diagram-B-new") && init?.method === "PUT") {
        callOrder.push("PUT /diagrams/diagram-B-new (guardar B)");
        return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
      }

      return { ok: true, status: 200, json: async () => ({}) } as Response;
    });

    const xml = fs.readFileSync(testRelationsXmiPath, "utf-8");
    const result = await importXmiToCanvas(xml, mockExcalidrawAPI, {
      diagramName: "Diagrama B",
    });

    // (a) El guardado de A se completa antes del POST de B
    const saveAIndex = callOrder.indexOf("PUT /diagrams/diagram-A (guardar A)");
    const postBIndex = callOrder.indexOf("POST /diagrams (crear B)");
    const setActiveBIndex = callOrder.indexOf("setActiveDiagramId:diagram-B-new");

    expect(saveAIndex).toBeGreaterThanOrEqual(0);
    expect(postBIndex).toBeGreaterThanOrEqual(0);
    expect(setActiveBIndex).toBeGreaterThanOrEqual(0);
    expect(saveAIndex).toBeLessThan(postBIndex);

    // (b) Al momento de activar B, el estado persistido de B ya contiene elementos (no está vacío)
    expect(postBIndex).toBeLessThan(setActiveBIndex);
    expect(postElementsLength).toBeGreaterThan(0);

    // (c) Nunca se llama a setActiveDiagramId(null)
    const setActiveNullCalls = callOrder.filter(
      (c) => c === "setActiveDiagramId:null"
    );
    expect(setActiveNullCalls).toHaveLength(0);
    expect(setActiveIdSpy).not.toHaveBeenCalledWith(null);

    // (d) Se cancelan los debounces antes del cambio de ID a B
    const cancelSaveIndex = callOrder.indexOf("LocalData.cancelSave");
    const cancelEmitIndex = callOrder.indexOf("debouncedEmitDiagramUpdate.cancel");

    expect(cancelSaveIndex).toBeGreaterThanOrEqual(0);
    expect(cancelEmitIndex).toBeGreaterThanOrEqual(0);
    expect(cancelSaveIndex).toBeLessThan(setActiveBIndex);
    expect(cancelEmitIndex).toBeLessThan(setActiveBIndex);

    // (e) El id activo final es B
    expect(result.diagramId).toBe("diagram-B-new");
    expect(localStorage.getItem(ACTIVE_DIAGRAM_KEY)).toBe(
      "diagram-B-new"
    );
  });
});
