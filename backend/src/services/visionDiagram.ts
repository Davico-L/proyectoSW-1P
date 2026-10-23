import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

export interface VisionDiagramResult {
  operations: any[];
  ambiguities: string[];
  usedFallback: boolean;
}

const SYSTEM_PROMPT = `Sos un lector de diagramas de clases UML. Recibís una imagen (pizarra, hoja, impreso o captura) y devolvés SOLO JSON con "operations" (usando únicamente createClass y createRelation) y "ambiguities".

Reglas:
- Usá los nombres de clases, atributos y métodos exactamente como aparecen en la imagen. No inventes clases, atributos ni relaciones que no se vean. Ignorá títulos, notas, firmas, tachones y todo lo que no sea parte del diagrama de clases.
- Atributos "nombre: tipo" o "tipo nombre". Tipos permitidos: String, Integer, Long, Boolean, Double, Date. Mapeo: int/integer/entero -> Integer; long/bigint -> Long; string/varchar/texto/cadena -> String; double/float/decimal/real -> Double; bool/boolean -> Boolean; date/datetime/fecha -> Date. Tipo desconocido -> String y anotalo en ambiguities.
- Visibilidad: "+" public, "-" private, "#" protected. Sin símbolo -> private.
- Métodos "nombre(): tipoRetorno". Sin tipo de retorno -> "void".
- relationType permitido: association, inheritance, composition, aggregation, manyToMany. Triángulo vacío -> inheritance; rombo relleno -> composition; rombo vacío -> aggregation; línea simple -> association; si ambos extremos son "muchos" -> manyToMany.
- Dirección: en inheritance, source = clase hija y target = clase padre (el triángulo está del lado del padre). En composition y aggregation, source = la clase que lleva el rombo (el "todo") y target = la parte. En association, source = el extremo izquierdo o superior.
- Multiplicidades permitidas: 1, 0..1, 0..*, 1..*, *. Equivalencias: n, N, m, M -> *; 0..n -> 0..*; 1..n -> 1..*. multiplicitySource es la etiqueta del lado de la clase origen y multiplicityTarget la del lado de la clase destino. Sin etiqueta -> 1 y anotá la suposición en ambiguities.
- Clase de asociación: una clase unida por una línea punteada al MEDIO de la línea que une otras dos clases A y B. NO la conectes con las etiquetas de esa línea original y descartá esas multiplicidades. Creá la clase y exactamente dos relaciones association: A (multiplicitySource "1") hacia la clase de asociación (multiplicityTarget "0..*"), y B (multiplicitySource "1") hacia la clase de asociación (multiplicityTarget "0..*"). La clase de asociación es siempre el destino (target). Ejemplo: si Alumno y Materia están unidos por una línea con una clase Inscripcion colgada con línea punteada, el resultado es Alumno 1 -> 0..* Inscripcion y Materia 1 -> 0..* Inscripcion.
- Todas las createClass van antes que las createRelation.
- Si la imagen no contiene un diagrama de clases, devolvé operations: [].
- Todo lo ilegible, dudoso o asumido va en ambiguities, una frase corta por ítem.
- Tipos compuestos o genéricos (List<X>, X[], nombres de clase como tipo, Object, etc.): usá String y anotalo en ambiguities. Para métodos, el tipo de retorno debe ser uno de la lista permitida o "void".
- Ignorá los parámetros de los métodos y las etiquetas de texto sobre las relaciones (no existen en el contrato).
- En imágenes manuscritas o de pizarra: tolerá letra irregular, brillos y sombras. Si dudás entre dos lecturas de un nombre, elegí la más probable y anotá la duda en ambiguities. No corrijas la ortografía de los nombres de clases ni de atributos.
- No dupliques clases: si la misma clase aparece dos veces en la imagen, creala una sola vez.
- "void" solo se usa si la imagen dice void o el método no declara tipo de retorno. Si el método declara un tipo que no está en la lista permitida, el retorno es "String" y se anota en ambiguities. Ejemplo: "listarLibros(): List<Libro>" -> returnType "String" y una ambigüedad que diga que List<Libro> se mapeó a String.
- En relaciones inheritance, multiplicitySource y multiplicityTarget siempre son "1" y NO se anotan en ambiguities.
- No anotes en ambiguities que asumiste la visibilidad por defecto ni que una clase no tiene métodos o atributos.
- Si un atributo no tiene tipo escrito, inferilo por su nombre y NO lo anotes en ambiguities: fecha o date -> Date; precio, monto, total, costo, saldo, sueldo -> Double; cantidad, stock, edad, año, anio, numero -> Integer; activo, habilitado, vigente -> Boolean; un atributo llamado id -> Long; cualquier otro caso, incluidos nombre y email -> String. No pongas String a todo por defecto: inferí cada atributo por separado.`;

// Esquema reducido copiado de test-vision.mjs
const attributeSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    type: {
      type: Type.STRING,
      enum: ["String", "Integer", "Long", "Boolean", "Double", "Date"],
    },
    visibility: {
      type: Type.STRING,
      enum: ["private", "public", "protected"],
    },
  },
  required: ["name", "type", "visibility"],
};

const methodSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    returnType: {
      type: Type.STRING,
      enum: [
        "String",
        "Integer",
        "Long",
        "Boolean",
        "Double",
        "Date",
        "void",
      ],
    },
    visibility: {
      type: Type.STRING,
      enum: ["private", "public", "protected"],
    },
  },
  required: ["name", "returnType", "visibility"],
};

const createClassSchema = {
  type: Type.OBJECT,
  properties: {
    action: { type: Type.STRING, enum: ["createClass"] },
    className: { type: Type.STRING },
    attributes: { type: Type.ARRAY, items: attributeSchema },
    methods: { type: Type.ARRAY, items: methodSchema },
  },
  required: ["action", "className", "attributes", "methods"],
};

const createRelationSchema = {
  type: Type.OBJECT,
  properties: {
    action: { type: Type.STRING, enum: ["createRelation"] },
    relationType: {
      type: Type.STRING,
      enum: [
        "association",
        "inheritance",
        "composition",
        "aggregation",
        "manyToMany",
      ],
    },
    sourceClassName: { type: Type.STRING },
    targetClassName: { type: Type.STRING },
    multiplicitySource: {
      type: Type.STRING,
      enum: ["1", "0..1", "0..*", "1..*", "*"],
    },
    multiplicityTarget: {
      type: Type.STRING,
      enum: ["1", "0..1", "0..*", "1..*", "*"],
    },
  },
  required: [
    "action",
    "relationType",
    "sourceClassName",
    "targetClassName",
    "multiplicitySource",
    "multiplicityTarget",
  ],
};

const visionDiagramResponseSchema = {
  type: Type.OBJECT,
  properties: {
    operations: {
      type: Type.ARRAY,
      items: {
        anyOf: [createClassSchema, createRelationSchema],
      },
    },
    ambiguities: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ["operations", "ambiguities"],
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function lowerFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/**
 * Normalización: baja a minúscula la primera letra de nombres de atributos y métodos.
 * No altera nombres de clases.
 */
function normalizeOperations(operations: any[]): any[] {
  if (!Array.isArray(operations)) return [];
  return operations.map((op) => {
    if (!op || typeof op !== "object") return op;

    if (op.action === "createClass") {
      const attributes = Array.isArray(op.attributes)
        ? op.attributes.map((attr: any) => {
            if (!attr || typeof attr !== "object") return attr;
            return {
              ...attr,
              name: typeof attr.name === "string" ? lowerFirst(attr.name) : attr.name,
            };
          })
        : [];

      const methods = Array.isArray(op.methods)
        ? op.methods.map((method: any) => {
            if (!method || typeof method !== "object") return method;
            return {
              ...method,
              name: typeof method.name === "string" ? lowerFirst(method.name) : method.name,
            };
          })
        : [];

      return {
        ...op,
        attributes,
        methods,
      };
    }

    return op;
  });
}

function getThinkingLevelForModel(modelName: string): ThinkingLevel | null {
  const envLevel = process.env.THINKING_LEVEL?.trim().toUpperCase();
  if (envLevel === "NONE") return null;
  if (envLevel) {
    if (envLevel === "MINIMAL") return ThinkingLevel.MINIMAL;
    if (envLevel === "LOW") return ThinkingLevel.LOW;
    if (envLevel === "MEDIUM") return ThinkingLevel.MEDIUM;
    if (envLevel === "HIGH") return ThinkingLevel.HIGH;
    return ThinkingLevel.LOW;
  }

  if (modelName.includes("3.6")) {
    return ThinkingLevel.MINIMAL;
  }
  if (modelName.includes("3.1-flash-lite")) {
    return ThinkingLevel.LOW;
  }
  return ThinkingLevel.LOW;
}

function isThinkingConfig400(error: any): boolean {
  const status = Number(error?.status ?? error?.statusCode);
  const msg = String(error?.message ?? "").toLowerCase();
  const fullText = String(error ?? "").toLowerCase();
  const is400 = status === 400 || msg.includes("400") || msg.includes("invalid_argument");
  return is400 && (msg.includes("thinking") || fullText.includes("thinking"));
}

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

function isOverloadOrRateLimit(error: any): boolean {
  if (!error) return false;
  if (isTimeout(error)) return false;
  if (error?.message === "INVALID_AI_RESPONSE") return false;

  const rawStatus = error?.status ?? error?.statusCode ?? error?.code;
  const statusStr = String(rawStatus ?? "").toUpperCase();
  const msg = String(error?.message ?? "").toUpperCase();
  const full = String(error ?? "").toUpperCase();

  return (
    statusStr === "429" ||
    statusStr === "503" ||
    statusStr === "RESOURCE_EXHAUSTED" ||
    statusStr === "UNAVAILABLE" ||
    msg.includes("429") ||
    msg.includes("503") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("OVERLOADED") ||
    msg.includes("QUOTA") ||
    full.includes("429") ||
    full.includes("503") ||
    full.includes("OVERLOADED") ||
    full.includes("RESOURCE_EXHAUSTED") ||
    full.includes("UNAVAILABLE")
  );
}

function toUc7StandardError(error: any): any {
  if (error instanceof Error && error.message === "INVALID_AI_RESPONSE") {
    return error;
  }
  if (error?.message === "AI_TIMEOUT" || isTimeout(error)) {
    const err: any = new Error("AI_TIMEOUT");
    err.status = 504;
    return err;
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
    const err: any = new Error("AI_RATE_LIMIT");
    err.status = 429;
    return err;
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
    const err: any = new Error("AI_SERVICE_UNAVAILABLE");
    err.status = 503;
    return err;
  }

  return error;
}

async function callGeminiVision(
  ai: GoogleGenAI,
  modelName: string,
  imageBase64: string,
  mimeType: string,
  instruction?: string
): Promise<{ operations: any[]; ambiguities: string[] }> {
  const initialLevel = getThinkingLevelForModel(modelName);

  const contents: any[] = [
    {
      inlineData: {
        mimeType,
        data: imageBase64,
      },
    },
  ];

  if (instruction && instruction.trim() !== "") {
    contents.push({ text: instruction.trim() });
  }

  const buildConfig = (thinkingLevel: ThinkingLevel | null) => ({
    systemInstruction: SYSTEM_PROMPT,
    responseMimeType: "application/json",
    responseSchema: visionDiagramResponseSchema,
    httpOptions: {
      timeout: 45000,
    },
    ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
  });

  let response;
  try {
    response = await ai.models.generateContent({
      model: modelName,
      contents,
      config: buildConfig(initialLevel),
    });
  } catch (error: any) {
    if (initialLevel && isThinkingConfig400(error)) {
      // Reintentar una vez sin esa configuración y no contarlo como fallo de saturación
      response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: buildConfig(null),
      });
    } else {
      throw error;
    }
  }

  const rawText = response?.text || "";
  try {
    const parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.operations)) {
      throw new Error("INVALID_AI_RESPONSE");
    }
    return {
      operations: parsed.operations,
      ambiguities: Array.isArray(parsed.ambiguities) ? parsed.ambiguities : [],
    };
  } catch {
    throw new Error("INVALID_AI_RESPONSE");
  }
}

/**
 * Procesa una imagen con diagrama de clases UML usando visión multimodal (Gemini).
 * Implementa reintentos con backoff para saturación, lanzamiento de respaldo en paralelo
 * a los 15s y normalización de operaciones.
 *
 * @param imageBase64 Imagen codificada en base64
 * @param mimeType Tipo MIME de la imagen (ej: "image/png", "image/jpeg", "image/webp")
 * @param instruction Indicación opcional en lenguaje natural provista por el usuario
 * @returns { operations, ambiguities, usedFallback }
 */
export async function diagramFromImage(
  imageBase64: string,
  mimeType: string,
  instruction?: string
): Promise<VisionDiagramResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no está configurada.");
  }

  const primaryModel = process.env.VISION_MODEL || "gemini-3.6-flash";
  const fallbackModel = process.env.VISION_FALLBACK_MODEL || "gemini-3.1-flash-lite";

  const ai = new GoogleGenAI({ apiKey });
  const startTime = Date.now();
  const GLOBAL_TIMEOUT_MS = 100000; // ~100 s tope total

  let resolved = false;
  let primaryAttempts = 0;
  let fallbackAttempts = 0;
  let fallbackLaunched = false;
  let primaryError: any = null;
  let fallbackError: any = null;

  return new Promise<VisionDiagramResult>((resolve, reject) => {
    // Timeout global para tope de ~100 s
    const globalTimeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        const err: any = new Error("AI_TIMEOUT");
        err.status = 504;
        reject(err);
      }
    }, GLOBAL_TIMEOUT_MS);

    let fallbackTimerId: NodeJS.Timeout | null = null;

    const cleanup = () => {
      clearTimeout(globalTimeoutId);
      if (fallbackTimerId) {
        clearTimeout(fallbackTimerId);
      }
    };

    const handleSuccess = (
      raw: { operations: any[]; ambiguities: string[] },
      fromFallback: boolean,
      attempts: number,
      modelUsed: string
    ) => {
      if (resolved) return;
      resolved = true;
      cleanup();

      const normalizedOps = normalizeOperations(raw.operations);
      const latencyMs = Date.now() - startTime;

      console.log(
        `[UC9 DEBUG] Modelo usado: ${modelUsed}, Respaldo: ${fromFallback}, Intentos: ${attempts}, Latencia: ${latencyMs}ms, Operaciones: ${normalizedOps.length}`
      );

      resolve({
        operations: normalizedOps,
        ambiguities: raw.ambiguities,
        usedFallback: fromFallback,
      });
    };

    const checkBothFailed = () => {
      if (resolved) return;
      if (primaryError && (!fallbackLaunched || fallbackError)) {
        resolved = true;
        cleanup();
        const finalErr = fallbackError || primaryError;
        reject(toUc7StandardError(finalErr));
      }
    };

    const launchFallback = () => {
      if (fallbackLaunched || resolved) return;
      fallbackLaunched = true;

      (async () => {
        fallbackAttempts = 1;
        try {
          const res = await callGeminiVision(ai, fallbackModel, imageBase64, mimeType, instruction);
          handleSuccess(res, true, fallbackAttempts, fallbackModel);
        } catch (err: any) {
          fallbackError = err;
          checkBothFailed();
        }
      })();
    };

    // Respaldo en paralelo a los 15s si el principal no respondió
    fallbackTimerId = setTimeout(() => {
      launchFallback();
    }, 15000);

    // Flujo del modelo principal
    (async () => {
      const maxRetries = 3;
      const backoffs = [1000, 2000, 4000];

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        if (resolved) return;
        primaryAttempts = attempt;
        try {
          const res = await callGeminiVision(ai, primaryModel, imageBase64, mimeType, instruction);
          handleSuccess(res, false, primaryAttempts, primaryModel);
          return;
        } catch (err: any) {
          primaryError = err;

          if (isTimeout(err)) {
            // Timeout por intento de 45 s; no se reintenta el principal
            break;
          }

          if (isOverloadOrRateLimit(err)) {
            if (attempt < maxRetries) {
              const baseWait = backoffs[attempt - 1];
              const jitter = Math.floor(Math.random() * 500);
              await sleep(baseWait + jitter);
              continue;
            }
          }

          // Error no recuperable con reintentos
          break;
        }
      }

      // Si el principal falló definitivamente y el respaldo aún no arrancó, lanzarlo de inmediato
      if (!fallbackLaunched && !resolved) {
        if (fallbackTimerId) clearTimeout(fallbackTimerId);
        launchFallback();
      } else {
        checkBothFailed();
      }
    })();
  });
}
