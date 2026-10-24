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

  it("renders tool brand name, subtitle, inputs, and submit button", () => {
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
    const usernameInput = screen.getByLabelText("Nombre de usuario");
    expect(usernameInput).toBeInTheDocument();
    expect(usernameInput).toHaveAttribute("placeholder", "Ej. Ana Gómez");

    const passwordInput = screen.getByLabelText("Contraseña");
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute("type", "password");

    expect(
      screen.getByText("Si tu cuenta es anterior y aún no tiene contraseña, la que escribas quedará registrada"),
    ).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /iniciar sesión/i });
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn).not.toBeDisabled();

    const toggleBtn = screen.getByRole("button", { name: /crear cuenta/i });
    expect(toggleBtn).toBeInTheDocument();
  });

  it("submits login with username and password successfully", async () => {
    const fakeSession = {
      session_id: "session-1234",
      username: "Ana Gómez",
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => fakeSession,
    } as Response);

    render(<LoginScreen onLoginSuccess={onLoginSuccessMock} />);

    fireEvent.change(screen.getByLabelText("Nombre de usuario"), {
      target: { value: "Ana Gómez" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "secreto123" },
    });

    const submitBtn = screen.getByRole("button", { name: /iniciar sesión/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(`${BACKEND_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: "Ana Gómez", password: "secreto123" }),
      });
    });

    await waitFor(() => {
      expect(localStorage.getItem(ACTIVE_SESSION_KEY)).toBe(fakeSession.session_id);
      expect(localStorage.getItem(ACTIVE_USERNAME_KEY)).toBe(fakeSession.username);
      expect(onLoginSuccessMock).toHaveBeenCalledWith(fakeSession.session_id, fakeSession.username);
    });
  });

  it("submits typed username on Enter key press", async () => {
    const fakeSession = {
      session_id: "session-custom-99",
      username: "Carlos Developer",
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => fakeSession,
    } as Response);

    render(<LoginScreen onLoginSuccess={onLoginSuccessMock} />);

    const input = screen.getByLabelText("Nombre de usuario");
    fireEvent.change(input, { target: { value: "Carlos Developer" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "password123" },
    });

    // Submit via form submit / Enter
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(`${BACKEND_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: "Carlos Developer", password: "password123" }),
      });
    });

    await waitFor(() => {
      expect(onLoginSuccessMock).toHaveBeenCalledWith("session-custom-99", "Carlos Developer");
    });
  });

  it("shows error alert with aria-live when login request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "Credenciales incorrectas." }),
    } as Response);

    render(<LoginScreen onLoginSuccess={onLoginSuccessMock} />);

    fireEvent.change(screen.getByLabelText("Nombre de usuario"), {
      target: { value: "Carlos" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "password123" },
    });

    const submitBtn = screen.getByRole("button", { name: /iniciar sesión/i });
    fireEvent.click(submitBtn);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Usuario o contraseña incorrectos");
    expect(onLoginSuccessMock).not.toHaveBeenCalled();
  });

  it("shows friendly network error when fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("Failed to fetch"));

    render(<LoginScreen onLoginSuccess={onLoginSuccessMock} />);

    fireEvent.change(screen.getByLabelText("Nombre de usuario"), {
      target: { value: "Carlos" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "password123" },
    });

    const submitBtn = screen.getByRole("button", { name: /iniciar sesión/i });
    fireEvent.click(submitBtn);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No se pudo conectar con el servidor backend");
    expect(onLoginSuccessMock).not.toHaveBeenCalled();
  });
});
