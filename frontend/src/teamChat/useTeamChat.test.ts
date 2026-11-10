import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTeamChat } from "./useTeamChat";
import type { PublicChatMessage, PublicProposalData } from "./types";

describe("CU22 Fase 3C-1: useTeamChat hook - decideProposal y proposal-updated", () => {
  let mockSocket: {
    connected: boolean;
    emit: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    trigger: (event: string, ...args: any[]) => void;
  };
  let listeners: Record<string, Function[]>;

  beforeEach(() => {
    vi.clearAllMocks();
    listeners = {};

    mockSocket = {
      connected: true,
      emit: vi.fn(),
      on: vi.fn((event: string, cb: Function) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(cb);
      }),
      off: vi.fn((event: string, cb: Function) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((l) => l !== cb);
        }
      }),
      trigger: (event: string, ...args: any[]) => {
        const cbs = listeners[event] || [];
        cbs.forEach((cb) => cb(...args));
      },
    };

    // Mock fetch para fetchChatHistory
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ messages: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    // Mock localStorage
    window.localStorage.setItem("active_session_id", "test-session-123");
    window.localStorage.setItem("active_session_username", "Ana");
  });

  const samplePendingProposal: PublicProposalData = {
    id: "prop-1",
    status: "pending",
    summary: ["creé la clase Factura"],
    requestedBy: "Carlos",
  };

  const sampleMessage: PublicChatMessage = {
    id: "msg-1",
    diagramId: "diag-1",
    authorName: "Codia",
    role: "ai",
    text: "Carlos, propongo: creé la clase Factura. Queda pendiente de aprobación del equipo.",
    createdAt: new Date().toISOString(),
    proposal: samplePendingProposal,
  };

  it("1. Decisión exitosa: emite proposal-decision, marca busy mientras espera, y actualiza proposal en el mensaje", async () => {
    let decisionAck: Function | null = null;
    mockSocket.emit.mockImplementation((event, payload, cb) => {
      if (event === "proposal-decision") {
        decisionAck = cb;
      }
    });

    const { result } = renderHook(() =>
      useTeamChat({
        diagramId: "diag-1",
        socketInstance: mockSocket,
      })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    // Inyectar mensaje inicial simulando recepción por chat-message
    act(() => {
      mockSocket.trigger("chat-message", sampleMessage);
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].proposal?.status).toBe("pending");

    // Ejecutar decideProposal
    let decidePromise: Promise<void>;
    act(() => {
      decidePromise = result.current.decideProposal("msg-1", "approve");
    });

    // Mientras espera ack, debe estar marcado como busy
    expect(result.current.busyByMessageId["msg-1"]).toBe(true);
    expect(result.current.errorByMessageId["msg-1"]).toBeNull();

    expect(mockSocket.emit).toHaveBeenCalledWith(
      "proposal-decision",
      { diagramId: "diag-1", proposalId: "msg-1", decision: "approve" },
      expect.any(Function)
    );

    // Simular ack exitoso del servidor con propuesta aprobada
    const approvedProposal: PublicProposalData = {
      id: "prop-1",
      status: "approved",
      summary: ["creé la clase Factura"],
      requestedBy: "Carlos",
      decidedBy: "Ana",
      decidedAt: new Date().toISOString(),
    };

    await act(async () => {
      decisionAck!({
        ok: true,
        proposal: approvedProposal,
      });
      await decidePromise;
    });

    // Busy debe volver a false y mensaje debe tener propuesta actualizada
    expect(result.current.busyByMessageId["msg-1"]).toBe(false);
    expect(result.current.messages[0].proposal?.status).toBe("approved");
    expect(result.current.messages[0].proposal?.decidedBy).toBe("Ana");
    expect(result.current.errorByMessageId["msg-1"]).toBeNull();
  });

  it("2. Error already_decided: actualiza el proposal si viene en el ack y muestra el aviso en español", async () => {
    let decisionAck: Function | null = null;
    mockSocket.emit.mockImplementation((event, payload, cb) => {
      if (event === "proposal-decision") {
        decisionAck = cb;
      }
    });

    const { result } = renderHook(() =>
      useTeamChat({
        diagramId: "diag-1",
        socketInstance: mockSocket,
      })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    act(() => {
      mockSocket.trigger("chat-message", sampleMessage);
    });

    let decidePromise: Promise<void>;
    act(() => {
      decidePromise = result.current.decideProposal("msg-1", "reject");
    });

    expect(result.current.busyByMessageId["msg-1"]).toBe(true);

    const decidedProposal: PublicProposalData = {
      id: "prop-1",
      status: "approved",
      summary: ["creé la clase Factura"],
      requestedBy: "Carlos",
      decidedBy: "Luis",
    };

    await act(async () => {
      decisionAck!({
        ok: false,
        error: "already_decided",
        proposal: decidedProposal,
      });
      await decidePromise;
    });

    expect(result.current.busyByMessageId["msg-1"]).toBe(false);
    // El mensaje se actualiza con el proposal vigente recibido en el ack
    expect(result.current.messages[0].proposal?.status).toBe("approved");
    expect(result.current.messages[0].proposal?.decidedBy).toBe("Luis");
    // Aviso en español
    expect(result.current.errorByMessageId["msg-1"]).toBe("Otro integrante ya decidió");
  });

  it("3. Otros errores del ack (stale, apply_failed, not_joined, invalid_session, storage_error) guardan aviso en español", async () => {
    const errorCases = [
      { error: "stale", expectedMsg: "El diagrama cambió, la propuesta caducó" },
      { error: "apply_failed", expectedMsg: "No se pudo aplicar, intenta de nuevo" },
      { error: "not_joined", expectedMsg: "No estás unido a la sala" },
      { error: "invalid_session", expectedMsg: "Sesión inválida" },
      { error: "storage_error", expectedMsg: "Error al guardar, intenta de nuevo" },
      { error: "otro_error", expectedMsg: "No se pudo procesar la propuesta" },
    ];

    for (const { error, expectedMsg } of errorCases) {
      let decisionAck: Function | null = null;
      mockSocket.emit.mockImplementation((event, payload, cb) => {
        if (event === "proposal-decision") {
          decisionAck = cb;
        }
      });

      const { result } = renderHook(() =>
        useTeamChat({
          diagramId: "diag-1",
          socketInstance: mockSocket,
        })
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      act(() => {
        mockSocket.trigger("chat-message", sampleMessage);
      });

      let decidePromise: Promise<void>;
      act(() => {
        decidePromise = result.current.decideProposal("msg-1", "approve");
      });

      await act(async () => {
        decisionAck!({ ok: false, error });
        await decidePromise;
      });

      expect(result.current.busyByMessageId["msg-1"]).toBe(false);
      expect(result.current.errorByMessageId["msg-1"]).toBe(expectedMsg);
    }
  });

  it("4. Evento proposal-updated: reemplaza el proposal del mensaje correspondiente y limpia busy y aviso", async () => {
    const { result } = renderHook(() =>
      useTeamChat({
        diagramId: "diag-1",
        socketInstance: mockSocket,
      })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    act(() => {
      mockSocket.trigger("chat-message", sampleMessage);
    });

    expect(result.current.messages[0].proposal?.status).toBe("pending");

    const rejectedProposal: PublicProposalData = {
      id: "prop-1",
      status: "rejected",
      summary: ["creé la clase Factura"],
      requestedBy: "Carlos",
      decidedBy: "Luis",
    };

    // Disparar proposal-updated desde el socket
    act(() => {
      mockSocket.trigger("proposal-updated", {
        diagramId: "diag-1",
        messageId: "msg-1",
        proposal: rejectedProposal,
      });
    });

    expect(result.current.messages[0].proposal?.status).toBe("rejected");
    expect(result.current.messages[0].proposal?.decidedBy).toBe("Luis");
    expect(result.current.busyByMessageId["msg-1"]).toBeFalsy();
    expect(result.current.errorByMessageId["msg-1"]).toBeFalsy();
  });

  it("5. Evento proposal-updated ignora eventos con diagramId distinto o messageId desconocido", async () => {
    const { result } = renderHook(() =>
      useTeamChat({
        diagramId: "diag-1",
        socketInstance: mockSocket,
      })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    act(() => {
      mockSocket.trigger("chat-message", sampleMessage);
    });

    // 5a. diagramId distinto
    act(() => {
      mockSocket.trigger("proposal-updated", {
        diagramId: "otro-diag",
        messageId: "msg-1",
        proposal: { id: "prop-1", status: "rejected" },
      });
    });

    expect(result.current.messages[0].proposal?.status).toBe("pending");

    // 5b. messageId desconocido
    act(() => {
      mockSocket.trigger("proposal-updated", {
        diagramId: "diag-1",
        messageId: "msg-desconocido",
        proposal: { id: "prop-x", status: "rejected" },
      });
    });

    expect(result.current.messages[0].proposal?.status).toBe("pending");
  });

  it("6. Al reconectar el socket (evento connect), el hook recarga el historial mediante fetch", async () => {
    renderHook(() =>
      useTeamChat({
        diagramId: "diag-1",
        socketInstance: mockSocket,
      })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    const fetchCallsBefore = (global.fetch as any).mock.calls.length;

    // Disparar reconexión
    await act(async () => {
      mockSocket.trigger("connect");
    });

    await waitFor(() => {
      expect((global.fetch as any).mock.calls.length).toBeGreaterThan(fetchCallsBefore);
    });
  });
});
