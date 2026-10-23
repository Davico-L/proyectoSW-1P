import { Request, Response } from "express";
import { getDiagramById } from "../services/diagramService";
import { extractUmlModel } from "../backendGenerator/extractModel";
import { validateAndResolveOperations } from "../services/operationValidator";
import { diagramFromImage } from "../services/visionDiagram";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_DECODED_BYTES = 8 * 1024 * 1024; // 8 MB

function isTimeout(error: any): boolean {
  if (!error) return false;
  const rawStatus = error?.status ?? error?.statusCode;
  const statusStr = String(rawStatus ?? "").toUpperCase();
  const codeStr = String(error?.code ?? "").toUpperCase();
  const name = String(error?.name ?? "");
  const msg = String(error?.message ?? "").toLowerCase();
  const causeMsg = String(error?.cause?.message ?? "").toLowerCase();

  return (
    statusStr === "504" ||
    statusStr === "DEADLINE_EXCEEDED" ||
    codeStr === "DEADLINE_EXCEEDED" ||
    name === "AbortError" ||
    name === "TimeoutError" ||
    msg.includes("deadline exceeded") ||
    msg.includes("timed out") ||
    msg.includes("timeout") ||
    msg.includes("aborted") ||
    causeMsg.includes("deadline exceeded") ||
    causeMsg.includes("timed out") ||
    causeMsg.includes("timeout")
  );
}

export function isValidBase64(str: string): boolean {
  if (!str || typeof str !== "string") return false;
  const trimmed = str.trim();
  if (trimmed.length === 0 || trimmed.length % 4 !== 0) {
    return false;
  }
  return /^[A-Za-z0-9+/]+={0,2}$/.test(trimmed);
}

export function detectImageMimeType(
  buffer: Buffer
): "image/jpeg" | "image/png" | "image/webp" | null {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  // JPEG: comienza con FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: comienza con 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // WEBP: comienza con RIFF (52 49 46 46) y contiene WEBP (57 45 42 50) en bytes 8-11
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

/**
 * Handler para POST /diagrams/:id/ai-from-image (UC9)
 * Procesa una imagen de diagrama de clases con Gemini Vision y devuelve operaciones y warnings.
 */
export async function handleAiFromImage(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  if (!id || typeof id !== "string") {
    res.status(400).json({ error: "Identificador de diagrama inválido." });
    return;
  }

  const { imageBase64, mimeType, instruction } = req.body;

  // 1) Validación de entrada
  if (
    !mimeType ||
    typeof mimeType !== "string" ||
    !ALLOWED_MIME_TYPES.includes(mimeType.trim().toLowerCase())
  ) {
    res.status(400).json({ error: "Elegí una imagen JPG, PNG o WEBP" });
    return;
  }

  if (!imageBase64 || typeof imageBase64 !== "string") {
    res.status(400).json({ error: "La imagen no puede estar vacía" });
    return;
  }

  // Quitar prefijo data:...;base64, si viene
  let cleanBase64 = imageBase64.trim();
  const dataUrlPrefixMatch = /^data:[^;]+;base64,/i;
  if (dataUrlPrefixMatch.test(cleanBase64)) {
    cleanBase64 = cleanBase64.replace(dataUrlPrefixMatch, "");
  }
  cleanBase64 = cleanBase64.trim();

  if (!cleanBase64) {
    res.status(400).json({ error: "La imagen no puede estar vacía" });
    return;
  }

  // Validar formato Base64 bien formado
  if (!isValidBase64(cleanBase64)) {
    res.status(400).json({
      error: "INVALID_IMAGE",
      message: "El archivo no es una imagen JPG, PNG o WEBP válida.",
    });
    return;
  }

  // Decodificar Base64
  let decodedBuffer: Buffer;
  try {
    decodedBuffer = Buffer.from(cleanBase64, "base64");
  } catch {
    res.status(400).json({
      error: "INVALID_IMAGE",
      message: "El archivo no es una imagen JPG, PNG o WEBP válida.",
    });
    return;
  }

  // Validar tamaño decodificado <= 8 MB
  if (decodedBuffer.length > MAX_DECODED_BYTES) {
    res.status(400).json({
      error: "La imagen supera el límite máximo permitido de 8 MB",
    });
    return;
  }

  // Validar firma binaria (magic bytes) y coincidencia con mimeType declarado
  const detectedMime = detectImageMimeType(decodedBuffer);
  const normalizedMime = mimeType.trim().toLowerCase();

  if (!detectedMime || detectedMime !== normalizedMime) {
    res.status(400).json({
      error: "INVALID_IMAGE",
      message: "El archivo no es una imagen JPG, PNG o WEBP válida.",
    });
    return;
  }

  // Recortar instruction a 500 caracteres
  const trimmedInstruction =
    typeof instruction === "string" ? instruction.trim().slice(0, 500) : undefined;

  // Obtener diagrama de la BD y extraer clases actuales
  const diagram = await getDiagramById(id);
  if (!diagram) {
    res.status(404).json({ error: "Diagrama no encontrado" });
    return;
  }

  const { classes, relations } = extractUmlModel(diagram.data);

  try {
    // 2) Llamada a diagramFromImage de visionDiagram.ts
    const visionResult = await diagramFromImage(
      cleanBase64,
      mimeType.trim().toLowerCase(),
      trimmedInstruction
    );

    const { operations, ambiguities, usedFallback } = visionResult;

    // 3) Si operations viene vacío: responder 200 y no seguir
    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      console.log(`[UC9 DEBUG] Operaciones modelo: 0, tras filtros: 0, tras validador: 0, avisos: 1`);
      res.status(200).json({
        validOperations: [],
        warnings: [
          "No detecté un diagrama de clases en la imagen. Probá con una foto más nítida y completa.",
        ],
      });
      return;
    }

    // 4) Duplicados:
    // Descartar createClass cuyo nombre ya exista en el diagrama (case-insensitive)
    // o que se repita dentro del lote (conservar la primera).
    const existingClassNames = new Set(
      classes.map((c) => (c.className || "").trim().toLowerCase())
    );
    const batchClassNames = new Set<string>();
    const step4Warnings: string[] = [];
    const deDuplicatedOps: any[] = [];
    const seenRelations = new Set<string>();

    for (const op of operations) {
      if (!op || typeof op !== "object" || !op.action) {
        continue;
      }

      if (op.action === "createClass") {
        const rawName = typeof op.className === "string" ? op.className.trim() : "";
        const lowerName = rawName.toLowerCase();

        if (existingClassNames.has(lowerName) || batchClassNames.has(lowerName)) {
          step4Warnings.push(`Foto: la clase ${rawName || op.className} ya existe, se omitió`);
          continue;
        }

        batchClassNames.add(lowerName);
        deDuplicatedOps.push(op);
      } else if (op.action === "createRelation") {
        // Descartar createRelation idénticas repetidas (mismo par, tipo y sentido)
        const sName = (op.sourceClassName || "").trim().toLowerCase();
        const tName = (op.targetClassName || "").trim().toLowerCase();
        const rType = (op.relationType || "").trim().toLowerCase();
        const relKey = `${sName}->${rType}->${tName}`;

        if (seenRelations.has(relKey)) {
          continue;
        }

        seenRelations.add(relKey);
        deDuplicatedOps.push(op);
      } else {
        deDuplicatedOps.push(op);
      }
    }

    // 5) Reglas de id, solo sobre las clases creadas en este lote:
    // (a) Si la clase tiene un atributo llamado id (case-insensitive) que no está primero, moverlo al primer lugar.
    // (b) Si no tiene ningún atributo id y no es el origen (sourceClassName) de una relación inheritance,
    //     agregarle al principio { name: "id", type: "Long", visibility: "private" } y el aviso "Foto: agregué id (clave primaria) a X".
    //     Se desactiva con UC9_AUTO_ID=false (por defecto activa).
    const autoIdEnabled = process.env.UC9_AUTO_ID !== "false";

    // Detectar nombres de clases que son source en una relación de herencia en el lote o diagrama existente
    const inheritanceChildNames = new Set<string>();
    for (const op of deDuplicatedOps) {
      if (op.action === "createRelation" && op.relationType === "inheritance" && op.sourceClassName) {
        inheritanceChildNames.add(op.sourceClassName.trim().toLowerCase());
      }
    }
    for (const rel of relations) {
      if (rel.relationType === "inheritance") {
        const sourceCls = classes.find((c) => c.id === rel.sourceClassId);
        if (sourceCls?.className) {
          inheritanceChildNames.add(sourceCls.className.trim().toLowerCase());
        }
      }
    }

    const step5Warnings: string[] = [];
    const adjustedOps: any[] = [];

    for (const op of deDuplicatedOps) {
      if (op.action === "createClass") {
        const rawClassName = op.className || "Clase";
        const currentAttributes: any[] = Array.isArray(op.attributes) ? [...op.attributes] : [];

        // Buscar atributo id
        const idIndex = currentAttributes.findIndex(
          (a) => a && typeof a.name === "string" && a.name.trim().toLowerCase() === "id"
        );

        if (idIndex >= 0) {
          // (a) Si ya tiene id y no está primero, moverlo al primer lugar
          if (idIndex > 0) {
            const [idAttr] = currentAttributes.splice(idIndex, 1);
            currentAttributes.unshift(idAttr);
          }
        } else {
          // (b) Si no tiene id y no es subclase en inheritance, agregarlo al inicio
          const isInheritanceChild = inheritanceChildNames.has(
            String(rawClassName).trim().toLowerCase()
          );

          if (!isInheritanceChild && autoIdEnabled) {
            currentAttributes.unshift({
              name: "id",
              type: "Long",
              visibility: "private",
            });
            step5Warnings.push(`Foto: agregué id (clave primaria) a ${rawClassName}`);
          }
        }

        adjustedOps.push({
          ...op,
          attributes: currentAttributes,
        });
      } else {
        adjustedOps.push(op);
      }
    }

    // 6) Llamar a validateAndResolveOperations con las operaciones resultantes y las clases actuales
    const { validOperations, warnings: validatorWarnings } = validateAndResolveOperations(
      adjustedOps,
      classes
    );

    // 7) Warnings finales:
    // Validator + pasos 4 y 5 + ambigüedades filtradas con prefijo "Foto: "
    // Filtrar ambigüedades genéricas:
    // - eliminá las que sean una sola palabra
    // - o coincidan con el nombre de un atributo
    // - o hablen de visibilidad por defecto o de que no se especificaron métodos o multiplicidades
    const allAttrNames = new Set<string>();
    for (const op of adjustedOps) {
      if (op.action === "createClass" && Array.isArray(op.attributes)) {
        for (const attr of op.attributes) {
          if (attr?.name) {
            allAttrNames.add(attr.name.trim().toLowerCase());
          }
        }
      }
    }

    const filteredAmbiguities: string[] = [];
    if (Array.isArray(ambiguities)) {
      for (const amb of ambiguities) {
        if (!amb || typeof amb !== "string") continue;
        const trimmed = amb.trim();
        if (!trimmed) continue;

        // Descartar si es una sola palabra (sin espacios)
        if (!trimmed.includes(" ")) {
          continue;
        }

        const ambLower = trimmed.toLowerCase();

        // Descartar si coincide con el nombre de un atributo
        if (allAttrNames.has(ambLower)) {
          continue;
        }

        // Descartar si habla de visibilidad por defecto
        if (
          ambLower.includes("visibilidad") ||
          ambLower.includes("visibility") ||
          ambLower.includes("por defecto") ||
          ambLower.includes("default")
        ) {
          continue;
        }

        // Descartar si habla de que no se especificaron métodos
        if (
          ambLower.includes("método") ||
          ambLower.includes("metodo") ||
          ambLower.includes("sin método") ||
          ambLower.includes("no tiene método") ||
          ambLower.includes("no se especificaron método") ||
          ambLower.includes("no especificó método")
        ) {
          continue;
        }

        // Descartar si habla de multiplicidades
        if (ambLower.includes("multiplicidad") || ambLower.includes("multiplicity")) {
          continue;
        }

        const formatted = trimmed.startsWith("Foto: ") ? trimmed : `Foto: ${trimmed}`;
        filteredAmbiguities.push(formatted);
      }
    }

    // Combinar todos los warnings, quitar duplicados y limitar a máx 6
    const combinedWarnings = [
      ...validatorWarnings,
      ...step4Warnings,
      ...step5Warnings,
      ...filteredAmbiguities,
    ];

    const uniqueWarnings: string[] = [];
    for (const w of combinedWarnings) {
      if (!uniqueWarnings.includes(w)) {
        uniqueWarnings.push(w);
      }
      if (uniqueWarnings.length >= 6) {
        break;
      }
    }

    // Si se usó modelo de respaldo, agregar aviso especial
    if (usedFallback) {
      const fallbackWarning =
        "Foto: se usó el modelo de respaldo; revisá las relaciones, sobre todo las clases de asociación.";
      if (!uniqueWarnings.includes(fallbackWarning)) {
        uniqueWarnings.push(fallbackWarning);
      }
    }

    // 8) Log [UC9 DEBUG]
    console.log(
      `[UC9 DEBUG] Operaciones modelo: ${operations.length}, tras filtros: ${adjustedOps.length}, tras validador: ${validOperations.length}, avisos: ${uniqueWarnings.length}`
    );

    res.status(200).json({
      validOperations,
      warnings: uniqueWarnings,
    });
  } catch (error: any) {
    if (error instanceof Error && error.message === "INVALID_AI_RESPONSE") {
      res.status(422).json({
        error: "No se pudo interpretar la instrucción, intentá reformularla",
      });
      return;
    }

    if (error?.message === "AI_TIMEOUT" || isTimeout(error)) {
      res.status(504).json({
        error: "AI_TIMEOUT",
        message: "El servicio de IA tardó demasiado en responder. Intentá nuevamente.",
      });
      return;
    }

    const statusStr = String(error?.status ?? error?.statusCode ?? error?.code ?? "").toUpperCase();
    const messageStr = String(error?.message ?? "").toUpperCase();
    const fullTextStr = String(error ?? "").toUpperCase();

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
      error?.message === "AI_SERVICE_UNAVAILABLE" ||
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

    console.error("[diagramRoutes] Error en POST /diagrams/:id/ai-from-image:", error);
    res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Error interno procesando la imagen con IA",
    });
  }
}
