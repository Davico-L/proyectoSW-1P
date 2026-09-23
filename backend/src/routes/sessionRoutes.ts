import { Router, Request, Response } from "express";
import { createSession, getSession } from "../services/sessionService";

export const sessionRouter = Router();

// POST /session: Crear una nueva sesión
sessionRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const rawUsername = typeof req.body?.username === "string" ? req.body.username : undefined;
    const session = await createSession(rawUsername);
    res.status(201).json(session);
  } catch (error: any) {
    console.error("[sessionRoutes] Error en POST /session:", error);
    res.status(500).json({
      error: "Error interno al crear la sesión en la base de datos.",
      details: error?.message,
    });
  }
});

// GET /session/:sessionId: Obtener información de una sesión por ID
sessionRouter.get("/:sessionId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    if (!sessionId || typeof sessionId !== "string") {
      res.status(400).json({ error: "Identificador de sesión inválido." });
      return;
    }

    const session = await getSession(sessionId);

    if (!session) {
      res.status(404).json({ error: "Sesión no encontrada." });
      return;
    }

    res.status(200).json(session);
  } catch (error: any) {
    console.error("[sessionRoutes] Error en GET /session/:sessionId:", error);
    res.status(500).json({
      error: "Error interno al consultar la sesión.",
      details: error?.message,
    });
  }
});
