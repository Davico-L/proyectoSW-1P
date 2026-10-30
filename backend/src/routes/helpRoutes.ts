import { Router, Request, Response } from "express";
import { HELP_TOPICS } from "../help/helpTopics";
import { getSession } from "../services/sessionService";
import { askHelpAssistant, HelpAiError } from "../services/helpAssistant";

export const helpRouter = Router();

helpRouter.get("/topics", (_req: Request, res: Response): void => {
  res.status(200).json({ topics: HELP_TOPICS });
});

helpRouter.post("/ask", async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Sesión: leer header x-session-id y validar con getSession
    const sessionId = req.headers["x-session-id"];
    if (!sessionId || typeof sessionId !== "string") {
      res.status(401).json({ error: "No autenticado" });
      return;
    }

    const session = await getSession(sessionId);
    if (!session) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }

    // 2. Body: { question: string, history?: {role, content}[] }
    const { question, history } = req.body || {};
    if (
      typeof question !== "string" ||
      question.trim().length === 0 ||
      question.trim().length > 500
    ) {
      res.status(400).json({
        error: "La pregunta debe tener entre 1 y 500 caracteres.",
      });
      return;
    }

    // 3. Llamada al asistente de ayuda
    const answer = await askHelpAssistant({
      question,
      history,
      username: session.username,
    });

    res.status(200).json({ answer });
  } catch (error: any) {
    if (error instanceof HelpAiError) {
      if (error.status === 422) {
        res.status(422).json({ error: error.message });
        return;
      }

      // Asegurar que ningún error de IA salga con HTTP 401 (reservado exclusivamente para sesión inválida)
      const status = error.status === 401 ? 503 : error.status;
      const code = error.status === 401 ? "AI_UNAVAILABLE" : error.code;
      const message =
        error.status === 401
          ? "El asistente de IA no está disponible por ahora. Probá con una de las preguntas sugeridas."
          : error.message;

      res.status(status).json({
        error: code,
        message,
      });
      return;
    }

    console.error("[helpRoutes] Error en POST /help/ask:", error?.message || error);
    res.status(500).json({
      error: "No se pudo obtener una respuesta, intentá nuevamente.",
    });
  }
});
