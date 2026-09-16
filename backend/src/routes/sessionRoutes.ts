import { Router, Request, Response } from "express";
import { createSession, getSession } from "../services/sessionService";

export const sessionRouter = Router();

sessionRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  const { username } = req.body;

  if (!username || typeof username !== "string" || username.trim() === "") {
    res.status(400).json({
      error: "El campo 'username' es requerido y debe ser una cadena no vacía.",
    });
    return;
  }

  const session = await createSession(username);
  res.status(201).json(session);
});

sessionRouter.get("/:sessionId", async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.params;
  const session = await getSession(sessionId);

  if (!session) {
    res.status(404).json({ error: "Sesión no encontrada." });
    return;
  }

  res.status(200).json(session);
});
