import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginScreen } from "../components/LoginScreen";
import { BACKEND_URL, ACTIVE_SESSION_KEY, ACTIVE_USERNAME_KEY } from "../data/backendSync";

describe("LoginScreen Component", () => {
  const onLoginSuccessMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders tool brand name, subtitle, input, and Enter button", () => {
    render(<LoginScreen onLoginSuccess={onLoginSuccessMock} />);

    // Brand and header
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("ClassDrawSW");
    expect(
      screen.getByText("Diseña diagramas de clases de forma colaborativa, con ayuda de IA."),
    ).toBeInTheDocument();

    // No CU references or PostgreSQL text
    expect(screen.queryByText(/CU15/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/PostgreSQL/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Gestión de Sesión/i)).not.toBeInTheDocument();

    // Form elements
    const input = screen.getByLabelText("Nombre de usuario");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("placeholder", "Ej. Ana Gómez (opcional)");
    expect(
      screen.getByText("Si lo dejas vacío, se te asignará un nombre de invitado."),
    ).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /entrar/i });
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn).not.toBeDisabled();
  });

  it("submits empty username and assigns guest session successfully", async () => {
    const fakeSession = {
      sessionId: "session-1234",
      username: "Invitado-5678",
      createdAt: new Date().toISOString(),
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => fakeSession,
    } as Response);

    render(<LoginScreen onLoginSuccess={onLoginSuccessMock} />);

    const submitBtn = screen.getByRole("button", { name: /entrar/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(`${BACKEND_URL}/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: "" }),
      });
    });

    await waitFor(() => {
      expect(localStorage.getItem(ACTIVE_SESSION_KEY)).toBe(fakeSession.sessionId);
      expect(localStorage.getItem(ACTIVE_USERNAME_KEY)).toBe(fakeSession.username);
      expect(onLoginSuccessMock).toHaveBeenCalledWith(fakeSession.sessionId, fakeSession.username);
    });
  });

  it("submits typed username on Enter key press", async () => {
    const fakeSession = {
      sessionId: "session-custom-99",
      username: "Carlos Developer",
      createdAt: new Date().toISOString(),
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => fakeSession,
    } as Response);

    render(<LoginScreen onLoginSuccess={onLoginSuccessMock} />);

    const input = screen.getByLabelText("Nombre de usuario");
    fireEvent.change(input, { target: { value: "Carlos Developer" } });

    // Submit via form submit / Enter
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(`${BACKEND_URL}/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: "Carlos Developer" }),
      });
    });

    await waitFor(() => {
      expect(onLoginSuccessMock).toHaveBeenCalledWith("session-custom-99", "Carlos Developer");
    });
  });

  it("shows error alert with aria-live when login request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Error interno del servidor" }),
    } as Response);

    render(<LoginScreen onLoginSuccess={onLoginSuccessMock} />);

    const submitBtn = screen.getByRole("button", { name: /entrar/i });
    fireEvent.click(submitBtn);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Error interno del servidor");
    expect(onLoginSuccessMock).not.toHaveBeenCalled();
  });

  it("shows friendly network error when fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("Failed to fetch"));

    render(<LoginScreen onLoginSuccess={onLoginSuccessMock} />);

    const submitBtn = screen.getByRole("button", { name: /entrar/i });
    fireEvent.click(submitBtn);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No se pudo conectar con el servidor backend");
    expect(onLoginSuccessMock).not.toHaveBeenCalled();
  });
});
