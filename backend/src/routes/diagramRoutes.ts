import { Router, Request, Response } from "express";
import { sessionExists } from "../services/sessionService";
import {
  createDiagram,
  getDiagramById,
  updateDiagram,
  listDiagramsBySession,
} from "../services/diagramService";

export const diagramRouter = Router();

// POST /diagrams: Crear un nuevo diagrama
diagramRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { session_id, name, data } = req.body;

    // Validación de session_id
    if (!session_id || typeof session_id !== "string") {
      res.status(400).json({
        error: "El campo 'session_id' es requerido y debe ser una cadena válida.",
      });
      return;
    }

    // Validar que la sesión exista
    const exists = await sessionExists(session_id);
    if (!exists) {
      res.status(404).json({
        error: `La sesión con ID '${session_id}' no existe. Debe iniciar sesión previamente.`,
      });
      return;
    }

    // Validación de name
    if (!name || typeof name !== "string" || name.trim() === "") {
      res.status(400).json({
        error: "El campo 'name' es requerido y no puede estar vacío.",
      });
      return;
    }

    // Validación de data (debe ser un objeto o contenido JSON para elements y appState)
    if (data === undefined || data === null || typeof data !== "object") {
      res.status(400).json({
        error: "El campo 'data' es requerido y debe ser un objeto JSON (elements, appState).",
      });
      return;
    }

    const diagram = await createDiagram(session_id, name, data);
    res.status(201).json(diagram);
  } catch (error: any) {
    console.error("[diagramRoutes] Error en POST /diagrams:", error);
    res.status(500).json({
      error: "Error interno al guardar el diagrama.",
      details: error?.message,
    });
  }
});

// GET /diagrams: Listar diagramas (opcional por query ?session_id=...)
diagramRouter.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { session_id } = req.query;
    if (session_id && typeof session_id === "string") {
      const diagrams = await listDiagramsBySession(session_id);
      res.status(200).json(diagrams);
      return;
    }
    res.status(400).json({
      error: "Especifique el parámetro de consulta '?session_id=UUID' para listar diagramas.",
    });
  } catch (error: any) {
    console.error("[diagramRoutes] Error en GET /diagrams:", error);
    res.status(500).json({ error: "Error al consultar diagramas." });
  }
});

// GET /diagrams/:id: Obtener diagrama por ID
diagramRouter.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== "string") {
      res.status(400).json({ error: "Identificador de diagrama inválido." });
      return;
    }

    const diagram = await getDiagramById(id);
    if (!diagram) {
      res.status(404).json({ error: "Diagrama no encontrado." });
      return;
    }

    res.status(200).json(diagram);
  } catch (error: any) {
    console.error("[diagramRoutes] Error en GET /diagrams/:id:", error);
    res.status(500).json({ error: "Error interno al recuperar el diagrama." });
  }
});

// PUT /diagrams/:id: Actualizar datos de un diagrama existente
diagramRouter.put("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { data, name } = req.body;

    if (!id || typeof id !== "string") {
      res.status(400).json({ error: "Identificador de diagrama inválido." });
      return;
    }

    if (data === undefined || data === null || typeof data !== "object") {
      res.status(400).json({
        error: "El campo 'data' es requerido para actualizar el estado del diagrama.",
      });
      return;
    }

    const updated = await updateDiagram(id, data, name);
    if (!updated) {
      res.status(404).json({ error: "Diagrama no encontrado para actualizar." });
      return;
    }

    res.status(200).json(updated);
  } catch (error: any) {
    console.error("[diagramRoutes] Error en PUT /diagrams/:id:", error);
    res.status(500).json({
      error: "Error interno al actualizar el diagrama.",
      details: error?.message,
    });
  }
});
