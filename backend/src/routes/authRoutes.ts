/**
 * authRoutes.ts
 *
 * POST /auth/register  — Registro de nuevo usuario con contraseña.
 * POST /auth/login     — Login de usuario existente con contraseña.
 *
 * NUNCA se devuelven ni registran password ni password_hash.
 */

import { Router, Request, Response } from "express";
import { registerUser, loginUser } from "../services/authService";

export const authRouter = Router();

// POST /auth/register
authRouter.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body ?? {};
    const result = await registerUser(username, password);
    res.status(201).json(result);
  } catch (err: any) {
    switch (err?.code) {
      case "EMPTY_USERNAME":
        res.status(400).json({ error: err.message });
        return;
      case "SHORT_PASSWORD":
        res.status(400).json({ error: err.message });
        return;
      case "USERNAME_TAKEN":
        res.status(409).json({ error: err.message });
        return;
      default:
        console.error("[authRoutes] Error en POST /auth/register:", err?.message || err);
        res.status(500).json({ error: "Error interno al registrar el usuario." });
    }
  }
});

// POST /auth/login
authRouter.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body ?? {};
    const result = await loginUser(username, password);
    res.status(200).json(result);
  } catch (err: any) {
    switch (err?.code) {
      case "MISSING_FIELDS":
        res.status(400).json({ error: err.message });
        return;
      case "SHORT_PASSWORD":
        res.status(400).json({ error: err.message });
        return;
      case "INVALID_CREDENTIALS":
        res.status(401).json({ error: err.message });
        return;
      default:
        console.error("[authRoutes] Error en POST /auth/login:", err?.message || err);
        res.status(500).json({ error: "Error interno al iniciar sesión." });
    }
  }
});
