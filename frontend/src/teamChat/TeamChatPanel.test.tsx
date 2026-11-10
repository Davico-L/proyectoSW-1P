import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TeamChatPanel } from "./TeamChatPanel";
import type { PublicChatMessage } from "./types";

// Mock de socket y sync para aislar el render de TeamChatPanel
vi.mock("../../excalidraw-app/data/realtimeSync", () => ({
  socket: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connected: true,
  },
}));

vi.mock("../../excalidraw-app/data/backendSync", () => ({
  getActiveDiagramId: vi.fn(() => "diag-test-1"),
  ACTIVE_SESSION_KEY: "active_session_id",
  BACKEND_URL: "http://localhost:3000",
}));

// Mock de selectores secundarios para enfocarnos en los mensajes y propuestas
vi.mock("./TeamModelSelector", () => ({
  TeamModelSelector: () => <div data-testid="mock-team-model-selector" />,
}));

vi.mock("./TeamRoomSettingsSelector", () => ({
  TeamRoomSettingsSelector: () => (
    <div data-testid="mock-team-room-settings-selector" />
  ),
}));

describe("CU22 Fase 3C-2: TeamChatPanel - Integración de ProposalCard", () => {
  const defaultProps = {
    isConnected: true,
    isJoined: true,
    error: null,
    isSending: false,
    currentUsername: "Ana",
    onSendMessage: vi.fn().mockResolvedValue(true),
    onClose: vi.fn(),
    onClearError: vi.fn(),
    diagramId: "diag-test-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("un mensaje con proposal pendiente muestra la tarjeta con botones y llama a decideProposal", () => {
    const decideProposalMock = vi.fn();
    const messages: PublicChatMessage[] = [
      {
        id: "msg-prop-1",
        diagramId: "diag-test-1",
        authorSessionId: "codia-session",
        authorName: "Codia",
        role: "ai",
        text: "He preparado una propuesta para agregar la clase Factura.",
        createdAt: "2026-11-10T00:00:00.000Z",
        proposal: {
          id: "prop-1",
          status: "pending",
          summary: ["Crear clase Factura"],
          requestedBy: "Ana",
        },
      },
    ];

    const { rerender } = render(
      <TeamChatPanel
        {...defaultProps}
        messages={messages}
        decideProposal={decideProposalMock}
      />
    );

    // Texto de Codia visible
    expect(
      screen.getByText("He preparado una propuesta para agregar la clase Factura.")
    ).toBeInTheDocument();

    // ProposalCard presente
    expect(screen.getByText("Propuesta de Codia")).toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    expect(screen.getByText("Crear clase Factura")).toBeInTheDocument();

    // Botones de acción disponibles
    const approveBtn = screen.getByRole("button", { name: "Aprobar" });
    const rejectBtn = screen.getByRole("button", { name: "Rechazar" });
    expect(approveBtn).toBeInTheDocument();
    expect(rejectBtn).toBeInTheDocument();
    expect(approveBtn).not.toBeDisabled();
    expect(rejectBtn).not.toBeDisabled();

    // Clic en Aprobar
    fireEvent.click(approveBtn);
    expect(decideProposalMock).toHaveBeenCalledTimes(1);
    expect(decideProposalMock).toHaveBeenCalledWith("msg-prop-1", "approve");

    // Clic en Rechazar
    fireEvent.click(rejectBtn);
    expect(decideProposalMock).toHaveBeenCalledTimes(2);
    expect(decideProposalMock).toHaveBeenCalledWith("msg-prop-1", "reject");
  });

  it("uno aprobado muestra 'Aprobada por X' sin botones", () => {
    const messages: PublicChatMessage[] = [
      {
        id: "msg-prop-2",
        diagramId: "diag-test-1",
        authorSessionId: "codia-session",
        authorName: "Codia",
        role: "ai",
        text: "Propuesta procesada.",
        createdAt: "2026-11-10T00:00:00.000Z",
        proposal: {
          id: "prop-2",
          status: "approved",
          summary: ["Crear clase Factura"],
          requestedBy: "Ana",
          decidedBy: "Luis",
          decidedAt: "2026-11-10T00:05:00.000Z",
        },
      },
    ];

    render(
      <TeamChatPanel
        {...defaultProps}
        messages={messages}
      />
    );

    expect(screen.getByText("Propuesta de Codia")).toBeInTheDocument();
    expect(screen.getByText("Aprobada por Luis")).toBeInTheDocument();

    // Sin botones de aprobar o rechazar
    expect(screen.queryByRole("button", { name: "Aprobar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Rechazar" })).toBeNull();
  });

  it("un mensaje sin proposal no muestra tarjeta", () => {
    const messages: PublicChatMessage[] = [
      {
        id: "msg-user-1",
        diagramId: "diag-test-1",
        authorSessionId: "sess-ana",
        authorName: "Ana",
        role: "user",
        text: "Hola a todos en el equipo",
        createdAt: "2026-11-10T00:00:00.000Z",
      },
      {
        id: "msg-ai-1",
        diagramId: "diag-test-1",
        authorSessionId: "codia-session",
        authorName: "Codia",
        role: "ai",
        text: "Hola Ana, ¿en qué puedo ayudarte hoy?",
        createdAt: "2026-11-10T00:01:00.000Z",
      },
    ];

    render(
      <TeamChatPanel
        {...defaultProps}
        messages={messages}
      />
    );

    // Los mensajes se renderizan
    expect(screen.getByText("Hola a todos en el equipo")).toBeInTheDocument();
    expect(screen.getByText("Hola Ana, ¿en qué puedo ayudarte hoy?")).toBeInTheDocument();

    // Ninguna tarjeta de propuesta renderizada
    expect(screen.queryByText("Propuesta de Codia")).toBeNull();
    expect(screen.queryByRole("button", { name: "Aprobar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Rechazar" })).toBeNull();
  });

  it("muestra estado ocupado 'Procesando…' y botones deshabilitados si busyByMessageId está activo", () => {
    const messages: PublicChatMessage[] = [
      {
        id: "msg-busy-1",
        diagramId: "diag-test-1",
        authorSessionId: "codia-session",
        authorName: "Codia",
        role: "ai",
        text: "Propuesta lista",
        createdAt: "2026-11-10T00:00:00.000Z",
        proposal: {
          id: "prop-busy",
          status: "pending",
          summary: ["Crear clase Factura"],
          requestedBy: "Ana",
        },
      },
    ];

    render(
      <TeamChatPanel
        {...defaultProps}
        messages={messages}
        busyByMessageId={{ "msg-busy-1": true }}
      />
    );

    const approveBtn = screen.getByRole("button", { name: "Procesando…" });
    const rejectBtn = screen.getByRole("button", { name: "Rechazar" });

    expect(approveBtn).toBeInTheDocument();
    expect(approveBtn).toBeDisabled();
    expect(rejectBtn).toBeDisabled();
  });

  it("muestra la alerta de error si errorByMessageId contiene un mensaje para ese mensaje", () => {
    const messages: PublicChatMessage[] = [
      {
        id: "msg-err-1",
        diagramId: "diag-test-1",
        authorSessionId: "codia-session",
        authorName: "Codia",
        role: "ai",
        text: "Propuesta lista",
        createdAt: "2026-11-10T00:00:00.000Z",
        proposal: {
          id: "prop-err",
          status: "pending",
          summary: ["Crear clase Factura"],
          requestedBy: "Ana",
        },
      },
    ];

    render(
      <TeamChatPanel
        {...defaultProps}
        messages={messages}
        errorByMessageId={{ "msg-err-1": "Otro integrante ya decidió" }}
      />
    );

    expect(screen.getByText("Otro integrante ya decidió")).toBeInTheDocument();
  });
});
