import React, { act } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TeamRoomSettingsSelector } from "./TeamRoomSettingsSelector";

describe("CU23 Fase 3: TeamRoomSettingsSelector", () => {
  let mockSocket: {
    emit: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
  };
  let listeners: Record<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    listeners = {};

    mockSocket = {
      emit: vi.fn(),
      on: vi.fn((event: string, cb: Function) => {
        listeners[event] = cb;
      }),
      off: vi.fn((event: string, cb: Function) => {
        if (listeners[event] === cb) {
          delete listeners[event];
        }
      }),
    };
  });

  it("renderiza el botón de engranaje deshabilitado si no está conectado o no se ha unido", () => {
    render(
      <TeamRoomSettingsSelector
        diagramId="diag-1"
        isConnected={false}
        isJoined={false}
        socketInstance={mockSocket}
      />
    );

    const button = screen.getByRole("button", { name: "Codia" });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Codia");
  });

  it("toma los valores por defecto (apply, mentora) si chat-join no devuelve settings", async () => {
    mockSocket.emit.mockImplementation((event, payload, cb) => {
      if (event === "chat-join" && cb) {
        cb({ ok: true });
      }
    });

    render(
      <TeamRoomSettingsSelector
        diagramId="diag-1"
        isConnected={true}
        isJoined={true}
        socketInstance={mockSocket}
      />
    );

    const button = screen.getByRole("button", { name: "Codia" });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);

    // Debe abrir el diálogo
    expect(screen.getByRole("dialog", { name: "Configuración de Codia" })).toBeInTheDocument();

    // Valores por defecto marcados
    const applyRadio = screen.getByRole("radio", { name: /aplica los cambios/i });
    const mentoraRadio = screen.getByRole("radio", { name: /mentora/i });
    expect(applyRadio).toHaveAttribute("aria-checked", "true");
    expect(mentoraRadio).toHaveAttribute("aria-checked", "true");
  });

  it("toma la configuración inicial desde el ack de chat-join", async () => {
    mockSocket.emit.mockImplementation((event, payload, cb) => {
      if (event === "chat-join" && cb) {
        cb({
          ok: true,
          settings: { mode: "advise", style: "detallada" },
        });
      }
    });

    render(
      <TeamRoomSettingsSelector
        diagramId="diag-1"
        isConnected={true}
        isJoined={true}
        socketInstance={mockSocket}
      />
    );

    const button = screen.getByRole("button", { name: "Codia" });
    fireEvent.click(button);

    const adviseRadio = screen.getByRole("radio", { name: /solo asesora/i });
    const detalladaRadio = screen.getByRole("radio", { name: /detallada/i });
    expect(adviseRadio).toHaveAttribute("aria-checked", "true");
    expect(detalladaRadio).toHaveAttribute("aria-checked", "true");
  });

  it("emite ai-settings-update al seleccionar una opción y actualiza al recibir ack ok", async () => {
    mockSocket.emit.mockImplementation((event, payload, cb) => {
      if (event === "chat-join" && cb) {
        cb({ ok: true, settings: { mode: "apply", style: "mentora" } });
      }
    });

    render(
      <TeamRoomSettingsSelector
        diagramId="diag-1"
        isConnected={true}
        isJoined={true}
        socketInstance={mockSocket}
      />
    );

    const triggerBtn = screen.getByRole("button", { name: "Codia" });
    fireEvent.click(triggerBtn);

    const adviseRadio = screen.getByRole("radio", { name: /solo asesora/i });
    expect(adviseRadio).toHaveAttribute("aria-checked", "false");

    // Mock para ai-settings-update
    let updateCallback: Function | null = null;
    mockSocket.emit.mockImplementation((event, payload, cb) => {
      if (event === "ai-settings-update") {
        updateCallback = cb;
      }
    });

    fireEvent.click(adviseRadio);

    expect(mockSocket.emit).toHaveBeenCalledWith(
      "ai-settings-update",
      { diagramId: "diag-1", mode: "advise", style: "mentora" },
      expect.any(Function)
    );

    // Mientras espera el ack, las opciones deben deshabilitarse
    expect(adviseRadio).toBeDisabled();
    expect(adviseRadio).toHaveAttribute("aria-checked", "false"); // No cambia hasta el ack

    // Simular ack exitoso
    await act(async () => {
      updateCallback!({
        ok: true,
        settings: { mode: "advise", style: "mentora" },
      });
    });

    await waitFor(() => {
      expect(adviseRadio).not.toBeDisabled();
      expect(adviseRadio).toHaveAttribute("aria-checked", "true");
    });
  });

  it("muestra banner de error y conserva el valor anterior si el ack falla", async () => {
    mockSocket.emit.mockImplementation((event, payload, cb) => {
      if (event === "chat-join" && cb) {
        cb({ ok: true, settings: { mode: "apply", style: "mentora" } });
      }
    });

    render(
      <TeamRoomSettingsSelector
        diagramId="diag-1"
        isConnected={true}
        isJoined={true}
        socketInstance={mockSocket}
      />
    );

    const triggerBtn = screen.getByRole("button", { name: "Codia" });
    fireEvent.click(triggerBtn);

    const directaRadio = screen.getByRole("radio", { name: /directa/i });

    let updateCallback: Function | null = null;
    mockSocket.emit.mockImplementation((event, payload, cb) => {
      if (event === "ai-settings-update") {
        updateCallback = cb;
      }
    });

    fireEvent.click(directaRadio);

    // Responder con error
    await act(async () => {
      updateCallback!({ ok: false, error: "storage_error" });
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar la configuración");
    });

    // Mentora sigue marcada
    const mentoraRadio = screen.getByRole("radio", { name: /mentora/i });
    expect(mentoraRadio).toHaveAttribute("aria-checked", "true");
    expect(directaRadio).toHaveAttribute("aria-checked", "false");
  });

  it("se actualiza reactivamente al recibir el evento ai-settings-changed de la misma sala", async () => {
    mockSocket.emit.mockImplementation((event, payload, cb) => {
      if (event === "chat-join" && cb) {
        cb({ ok: true, settings: { mode: "apply", style: "mentora" } });
      }
    });

    render(
      <TeamRoomSettingsSelector
        diagramId="diag-1"
        isConnected={true}
        isJoined={true}
        socketInstance={mockSocket}
      />
    );

    const triggerBtn = screen.getByRole("button", { name: "Codia" });
    fireEvent.click(triggerBtn);

    // Disparar evento de otro diagrama: debe ser ignorado
    await act(async () => {
      listeners["ai-settings-changed"]?.({
        diagramId: "otro-diag",
        mode: "advise",
        style: "detallada",
      });
    });

    const applyRadio = screen.getByRole("radio", { name: /aplica los cambios/i });
    expect(applyRadio).toHaveAttribute("aria-checked", "true");

    // Disparar evento del mismo diagrama: debe actualizarse
    await act(async () => {
      listeners["ai-settings-changed"]?.({
        diagramId: "diag-1",
        mode: "advise",
        style: "directa",
      });
    });

    await waitFor(() => {
      const adviseRadio = screen.getByRole("radio", { name: /solo asesora/i });
      const directaRadio = screen.getByRole("radio", { name: /directa/i });
      expect(adviseRadio).toHaveAttribute("aria-checked", "true");
      expect(directaRadio).toHaveAttribute("aria-checked", "true");
    });
  });

  it("se cierra con la tecla Escape y limpia listeners al desmontar", () => {
    const { unmount } = render(
      <TeamRoomSettingsSelector
        diagramId="diag-1"
        isConnected={true}
        isJoined={true}
        socketInstance={mockSocket}
      />
    );

    const triggerBtn = screen.getByRole("button", { name: "Codia" });
    fireEvent.click(triggerBtn);

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Presionar Escape
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Desmontar
    unmount();
    expect(mockSocket.off).toHaveBeenCalledWith(
      "ai-settings-changed",
      expect.any(Function)
    );
  });

  it("renderiza el diálogo en document.body (portal) con position fixed y maneja clic dentro y fuera", () => {
    render(
      <TeamRoomSettingsSelector
        diagramId="diag-1"
        isConnected={true}
        isJoined={true}
        socketInstance={mockSocket}
      />
    );

    const triggerBtn = screen.getByRole("button", { name: "Codia" });
    fireEvent.click(triggerBtn);

    const dialog = screen.getByRole("dialog", { name: "Configuración de Codia" });
    expect(dialog).toBeInTheDocument();

    // Verificación de Portal: el elemento padre en el DOM real es document.body
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog.style.position).toBe("fixed");

    // Clic dentro del diálogo NO debe cerrarlo
    fireEvent.mouseDown(dialog);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Disparar evento de resize en ventana recalcula posición sin error
    fireEvent(window, new Event("resize"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Clic fuera del diálogo (en document.body fuera del botón y dropdown) debe cerrarlo
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("muestra el tercer radio 'Pide aprobación' con su descripción correspondiente", async () => {
    mockSocket.emit.mockImplementation((event, payload, cb) => {
      if (event === "chat-join" && cb) {
        cb({ ok: true });
      }
    });

    render(
      <TeamRoomSettingsSelector
        diagramId="diag-1"
        isConnected={true}
        isJoined={true}
        socketInstance={mockSocket}
      />
    );

    const button = screen.getByRole("button", { name: "Codia" });
    fireEvent.click(button);

    const approvalRadio = screen.getByRole("radio", { name: /pide aprobación/i });
    expect(approvalRadio).toBeInTheDocument();
    expect(
      screen.getByText("Codia propone los cambios y el equipo los aprueba o rechaza")
    ).toBeInTheDocument();
    expect(approvalRadio).toHaveAttribute("aria-checked", "false");
  });

  it("al seleccionar el radio 'Pide aprobación', emite ai-settings-update con mode 'approval'", async () => {
    mockSocket.emit.mockImplementation((event, payload, cb) => {
      if (event === "chat-join" && cb) {
        cb({ ok: true, settings: { mode: "apply", style: "mentora" } });
      }
    });

    render(
      <TeamRoomSettingsSelector
        diagramId="diag-1"
        isConnected={true}
        isJoined={true}
        socketInstance={mockSocket}
      />
    );

    const triggerBtn = screen.getByRole("button", { name: "Codia" });
    fireEvent.click(triggerBtn);

    const approvalRadio = screen.getByRole("radio", { name: /pide aprobación/i });
    expect(approvalRadio).toHaveAttribute("aria-checked", "false");

    let updateCallback: Function | null = null;
    mockSocket.emit.mockImplementation((event, payload, cb) => {
      if (event === "ai-settings-update") {
        updateCallback = cb;
      }
    });

    fireEvent.click(approvalRadio);

    expect(mockSocket.emit).toHaveBeenCalledWith(
      "ai-settings-update",
      { diagramId: "diag-1", mode: "approval", style: "mentora" },
      expect.any(Function)
    );

    expect(approvalRadio).toBeDisabled();

    await act(async () => {
      updateCallback!({
        ok: true,
        settings: { mode: "approval", style: "mentora" },
      });
    });

    await waitFor(() => {
      expect(approvalRadio).not.toBeDisabled();
      expect(approvalRadio).toHaveAttribute("aria-checked", "true");
    });
  });

  it("refleja el modo 'approval' recibido del servidor tanto en chat-join como en ai-settings-changed", async () => {
    // 1. Recibir approval en chat-join
    mockSocket.emit.mockImplementation((event, payload, cb) => {
      if (event === "chat-join" && cb) {
        cb({
          ok: true,
          settings: { mode: "approval", style: "directa" },
        });
      }
    });

    render(
      <TeamRoomSettingsSelector
        diagramId="diag-1"
        isConnected={true}
        isJoined={true}
        socketInstance={mockSocket}
      />
    );

    const triggerBtn = screen.getByRole("button", { name: "Codia" });
    fireEvent.click(triggerBtn);

    const approvalRadio = screen.getByRole("radio", { name: /pide aprobación/i });
    expect(approvalRadio).toHaveAttribute("aria-checked", "true");

    // 2. Recibir ai-settings-changed con mode "apply" y luego "approval" desde el socket
    await act(async () => {
      listeners["ai-settings-changed"]?.({
        diagramId: "diag-1",
        mode: "apply",
        style: "directa",
      });
    });

    await waitFor(() => {
      expect(approvalRadio).toHaveAttribute("aria-checked", "false");
    });

    await act(async () => {
      listeners["ai-settings-changed"]?.({
        diagramId: "diag-1",
        mode: "approval",
        style: "directa",
      });
    });

    await waitFor(() => {
      expect(approvalRadio).toHaveAttribute("aria-checked", "true");
    });
  });
});
