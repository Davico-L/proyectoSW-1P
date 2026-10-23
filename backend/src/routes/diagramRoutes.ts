import { Router, Request, Response } from "express";
import { sessionExists } from "../services/sessionService";
import {
  createDiagram,
  getDiagramById,
  updateDiagram,
  listDiagramsBySession,
} from "../services/diagramService";
import { extractUmlModel } from "../backendGenerator/extractModel";
import { buildBackendZip } from "../backendGenerator/buildZip";
import { editDiagramByInstruction, isTimeoutError } from "../services/gemini";
import { editDiagramByInstructionGroq } from "../services/groq";
import { validateAndResolveOperations } from "../services/operationValidator";
import { generateXmiDocument } from "../xmiExporter/generateXmi";
import { handleAiFromImage } from "./aiVisionRoutes";

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

// POST /diagrams/:id/generate-backend: Generar y descargar el backend Spring Boot como archivo ZIP
diagramRouter.post("/:id/generate-backend", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== "string") {
      res.status(400).json({ error: "Identificador de diagrama inválido." });
      return;
    }

    const diagram = await getDiagramById(id);
    if (!diagram) {
      res.status(404).json({ error: "Diagrama no encontrado" });
      return;
    }

    const model = extractUmlModel(diagram.data);
    const zipBuffer = await buildBackendZip(model);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="generated-backend.zip"');
    res.send(zipBuffer);
  } catch (error: any) {
    if (
      error instanceof Error &&
      error.message === "El diagrama debe tener al menos una clase válida para generar el backend"
    ) {
      res.status(400).json({ error: error.message });
      return;
    }

    console.error("[diagramRoutes] Error en POST /diagrams/:id/generate-backend:", error);
    res.status(500).json({ error: "Error generando el backend" });
  }
});

// POST /diagrams/:id/export-xmi: Exportar diagrama a archivo XMI 2.1
diagramRouter.post("/:id/export-xmi", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== "string") {
      res.status(400).json({ error: "Identificador de diagrama inválido." });
      return;
    }

    // 1. Traer el diagrama de Postgres por :id
    const diagram = await getDiagramById(id);
    if (!diagram) {
      res.status(404).json({ error: "Diagrama no encontrado" });
      return;
    }

    // 2. Extraer el modelo con extractUmlModel
    const model = extractUmlModel(diagram.data);

    // 3. Validar que model.classes tenga al menos una clase válida (mismo criterio de CU5)
    const validClasses = (model?.classes || []).filter(
      (c) => c.className && c.className.trim() !== ""
    );

    if (validClasses.length === 0) {
      res.status(400).json({
        error: "El diagrama debe tener al menos una clase válida para exportar",
      });
      return;
    }

    // 4. Generar el documento XMI 2.1
    const xmi = generateXmiDocument({
      ...model,
      classes: validClasses,
    });

    // 5. Devolver como archivo descargable .xmi
    const rawName = diagram.name && diagram.name.trim() !== "" ? diagram.name.trim() : "diagrama";
    const safeName = rawName.replace(/[/\\?%*:|"<>]/g, "_");
    const filename = `${safeName}.xmi`;

    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(xmi);
  } catch (error: any) {
    console.error("[diagramRoutes] Error en POST /diagrams/:id/export-xmi:", error);
    res.status(500).json({ error: "Error exportando a XMI" });
  }
});

// POST /diagrams/:id/ai-from-image: Generar operaciones UML a partir de imagen (UC9)
diagramRouter.post("/:id/ai-from-image", handleAiFromImage);

// POST /diagrams/:id/ai-edit: Editar diagrama mediante instrucciones en lenguaje natural usando IA
diagramRouter.post("/:id/ai-edit", async (req: Request, res: Response): Promise<void> => {
  const provider = (process.env.AI_PROVIDER || "groq").toLowerCase();
  console.log(`[AI-EDIT] Proveedor: ${provider}`);

  try {
    const { id } = req.params;
    const { instruction, source } = req.body;

    const isVoice = source === "voice";
    console.log(`[UC8 DEBUG] AI-edit source: ${isVoice ? "voice" : "text"}`);

    if (!id || typeof id !== "string") {
      res.status(400).json({ error: "Identificador de diagrama inválido." });
      return;
    }

    if (!instruction || typeof instruction !== "string" || instruction.trim() === "") {
      res.status(400).json({
        error: "El campo 'instruction' es requerido y debe ser una cadena no vacía.",
      });
      return;
    }

    // 1. Obtener diagrama de la BD por id y llamar a extractUmlModel(diagramData)
    const diagram = await getDiagramById(id);
    if (!diagram) {
      res.status(404).json({ error: "Diagrama no encontrado" });
      return;
    }

    const { classes, relations } = extractUmlModel(diagram.data);

    // 2. Transformar relations: mapear sourceClassId/targetClassId a sourceClassName/targetClassName
    const classMap = new Map<string, string>();
    for (const c of classes) {
      classMap.set(c.id, c.className);
    }

    const transformedRelations = [];
    for (const rel of relations) {
      const sourceClassName = classMap.get(rel.sourceClassId);
      const targetClassName = classMap.get(rel.targetClassId);
      if (sourceClassName && targetClassName) {
        transformedRelations.push({
          relationType: rel.relationType,
          sourceClassName,
          targetClassName,
          multiplicitySource: rel.multiplicitySource,
          multiplicityTarget: rel.multiplicityTarget,
        });
      }
    }

    // 3. Armar currentModel
    const currentModel = {
      classes: classes.map((c) => ({
        className: c.className,
        attributes: c.attributes,
        methods: c.methods,
      })),
      relations: transformedRelations,
    };

    // 4. Armar la instrucción a enviar (si es voz, anteponer la nota de robustez fonética)
    const instructionToSend = isVoice
      ? "Nota: la siguiente instrucción fue dictada por voz y puede contener errores de transcripción o falta de puntuación. Interpretá 'entero' como Integer, 'texto' o 'cadena' como String, 'decimal' como Double, 'fecha' como Date, 'booleano' o 'verdadero o falso' como Boolean, 'largo' como Long, y emparejá los nombres de clase mal escuchados con las clases existentes si suenan parecido. La nota no es una orden de edición; la instrucción del usuario es solo lo que sigue.\n\nInstrucción: " +
        instruction.trim()
      : instruction.trim();

    // 5. Llamar al proveedor de IA configurado
    const result =
      provider === "gemini"
        ? await editDiagramByInstruction(currentModel, instructionToSend)
        : await editDiagramByInstructionGroq(currentModel, instructionToSend);
    console.log("[UC7 DEBUG] editDiagramByInstruction OK"); // TEMP UC7 DEBUG

    // 5. Validar y resolver operaciones contra las clases existentes
    const { validOperations, warnings } = validateAndResolveOperations(
      result.operations,
      classes
    );
    console.log(`[UC7 DEBUG] Validation OK - validOperations: ${validOperations.length}, warnings: ${warnings.length}`); // TEMP UC7 DEBUG

    console.log("[UC7 DEBUG] Sending HTTP 200"); // TEMP UC7 DEBUG
    res.status(200).json({ validOperations, warnings });
  } catch (error: any) {
    if (error instanceof Error && error.message === "INVALID_AI_RESPONSE") {
      res.status(422).json({
        error: "No se pudo interpretar la instrucción, intentá reformularla",
      });
      return;
    }

    if (error?.message === "AI_TIMEOUT" || isTimeoutError(error)) {
      res.status(504).json({
        error: "AI_TIMEOUT",
        message: "El servicio de IA tardó demasiado en responder. Intentá nuevamente.",
      });
      return;
    }

    const statusStr = String(error?.status ?? error?.statusCode ?? error?.code ?? "").toUpperCase();
    const messageStr = String(error?.message ?? "").toUpperCase();
    const fullTextStr = String(error).toUpperCase();

    if (
      error?.message === "AI_RATE_LIMIT" ||
      statusStr === "429" ||
      statusStr === "RESOURCE_EXHAUSTED" ||
      messageStr.includes("429") ||
      messageStr.includes("RESOURCE_EXHAUSTED") ||
      messageStr.includes("QUOTA") ||
      fullTextStr.includes("429") ||
      fullTextStr.includes("RESOURCE_EXHAUSTED")
    ) {
      res.status(429).json({
        error: "AI_QUOTA_EXCEEDED",
        message: "Se alcanzó temporalmente el límite de uso del servicio de IA. Intentá nuevamente más tarde.",
      });
      return;
    }

    if (
      statusStr === "503" ||
      statusStr === "UNAVAILABLE" ||
      messageStr.includes("503") ||
      messageStr.includes("UNAVAILABLE") ||
      fullTextStr.includes("503") ||
      fullTextStr.includes("UNAVAILABLE")
    ) {
      res.status(503).json({
        error: "AI_SERVICE_UNAVAILABLE",
        message: "El servicio de IA está temporalmente saturado. Intentá nuevamente en unos momentos.",
      });
      return;
    }

    console.error("[diagramRoutes] Error en POST /diagrams/:id/ai-edit:", error);
    res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Error interno procesando la edición con IA",
    });
  }
});


