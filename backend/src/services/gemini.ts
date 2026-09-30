import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const SYSTEM_PROMPT_TEMPLATE = `Sos el motor de edición de diagramas UML de clases de esta aplicación. Tu única función es traducir instrucciones en lenguaje natural del usuario en una lista de operaciones estructuradas sobre el diagrama. Nunca generás texto explicativo fuera del JSON de salida.

ESQUEMA DE DATOS DEL DIAGRAMA
Cada clase tiene: className, attributes (lista de {name, type, visibility}), methods (lista de {name, returnType, visibility}).
Cada relación tiene: relationType, sourceClassName, targetClassName, multiplicitySource, multiplicityTarget.

TIPOS DE ATRIBUTO/RETORNO VÁLIDOS (lista cerrada, no uses otros)
String, Integer, Long, Boolean, Double, Date (y "void" solo como returnType de método).

TIPOS DE RELACIÓN VÁLIDOS (lista cerrada)
association, inheritance, composition, aggregation, manyToMany.

VISIBILIDADES VÁLIDAS
private, public, protected.

CAMPOS POR TIPO DE OPERACIÓN
- createClass: debe incluir className, attributes y methods. Si el usuario especifica atributos o métodos, deben aparecer todos. Si no especifica alguno de esos grupos, devolver el array correspondiente vacío.
- updateClass: debe incluir className y solamente los campos que el usuario pide modificar (newClassName, attributes y/o methods). No inventar modificaciones.
- deleteClass: debe incluir className.
- createRelation: debe incluir relationType, sourceClassName, targetClassName, multiplicitySource y multiplicityTarget. Si el usuario no especifica multiplicidad, usar "1" como valor por defecto.
- updateRelation: debe identificar la relación mediante sourceClassName y targetClassName e incluir únicamente los campos que se solicitan modificar.
- deleteRelation: debe incluir sourceClassName y targetClassName.

VALORES POR DEFECTO
- Para atributos solicitados sin tipo explícito, usar String.
- Para atributos solicitados sin visibilidad explícita, usar private.
- Para métodos sin returnType explícito, usar void.
- Para métodos sin visibilidad explícita, usar public.

REGLAS
1. Las operaciones referencian clases SIEMPRE por nombre (className, sourceClassName, targetClassName), nunca por id — no conocés los ids internos del diagrama.
2. Si la instrucción del usuario no tiene ninguna relación con editar el diagrama (un saludo, una pregunta general, algo ambiguo sin acción clara), devolvé exactamente {"operations": []}.
3. No inventes clases, atributos o relaciones que el usuario no pidió explícita o implícitamente.
4. Si el usuario pide una acción sobre una clase que no te fue provista en el modelo actual, igual generá la operación (el backend se encarga de validar si existe o no) — vos no rechaces la operación, solo traducí la instrucción.
5. Devolvé únicamente el JSON, sin texto adicional antes o después.

EJEMPLO
Instrucción: "agregá una clase Cliente con nombre y email"
Salida:
{"operations":[{"action":"createClass","className":"Cliente","attributes":[{"name":"nombre","type":"String","visibility":"private"},{"name":"email","type":"String","visibility":"private"}],"methods":[]}]}

MODELO ACTUAL DEL DIAGRAMA
{{currentModel}}

INSTRUCCIÓN DEL USUARIO
{{instruction}}`;

const attributeSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    type: { type: Type.STRING, enum: ["String", "Integer", "Long", "Boolean", "Double", "Date"] },
    visibility: { type: Type.STRING, enum: ["private", "public", "protected"] },
  },
  required: ["name", "type", "visibility"],
};

const methodSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    returnType: { type: Type.STRING, enum: ["String", "Integer", "Long", "Boolean", "Double", "Date", "void"] },
    visibility: { type: Type.STRING, enum: ["private", "public", "protected"] },
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

const updateClassSchema = {
  type: Type.OBJECT,
  properties: {
    action: { type: Type.STRING, enum: ["updateClass"] },
    className: { type: Type.STRING },
    newClassName: { type: Type.STRING },
    attributes: { type: Type.ARRAY, items: attributeSchema },
    methods: { type: Type.ARRAY, items: methodSchema },
  },
  required: ["action", "className"],
};

const deleteClassSchema = {
  type: Type.OBJECT,
  properties: {
    action: { type: Type.STRING, enum: ["deleteClass"] },
    className: { type: Type.STRING },
  },
  required: ["action", "className"],
};

const createRelationSchema = {
  type: Type.OBJECT,
  properties: {
    action: { type: Type.STRING, enum: ["createRelation"] },
    relationType: { type: Type.STRING, enum: ["association", "inheritance", "composition", "aggregation", "manyToMany"] },
    sourceClassName: { type: Type.STRING },
    targetClassName: { type: Type.STRING },
    multiplicitySource: { type: Type.STRING, enum: ["1", "0..1", "0..*", "1..*", "*"] },
    multiplicityTarget: { type: Type.STRING, enum: ["1", "0..1", "0..*", "1..*", "*"] },
  },
  required: ["action", "relationType", "sourceClassName", "targetClassName", "multiplicitySource", "multiplicityTarget"],
};

const updateRelationSchema = {
  type: Type.OBJECT,
  properties: {
    action: { type: Type.STRING, enum: ["updateRelation"] },
    sourceClassName: { type: Type.STRING },
    targetClassName: { type: Type.STRING },
    relationType: { type: Type.STRING, enum: ["association", "inheritance", "composition", "aggregation", "manyToMany"] },
    multiplicitySource: { type: Type.STRING, enum: ["1", "0..1", "0..*", "1..*", "*"] },
    multiplicityTarget: { type: Type.STRING, enum: ["1", "0..1", "0..*", "1..*", "*"] },
  },
  required: ["action", "sourceClassName", "targetClassName"],
};

const deleteRelationSchema = {
  type: Type.OBJECT,
  properties: {
    action: { type: Type.STRING, enum: ["deleteRelation"] },
    sourceClassName: { type: Type.STRING },
    targetClassName: { type: Type.STRING },
  },
  required: ["action", "sourceClassName", "targetClassName"],
};

export const editDiagramResponseSchema = {
  type: Type.OBJECT,
  properties: {
    operations: {
      type: Type.ARRAY,
      items: {
        anyOf: [
          createClassSchema,
          updateClassSchema,
          deleteClassSchema,
          createRelationSchema,
          updateRelationSchema,
          deleteRelationSchema,
        ],
      },
    },
  },
  required: ["operations"],
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function isTimeoutError(error: any): boolean {
  if (!error) return false;

  const rawStatus = error?.status ?? error?.statusCode;
  const statusNum = Number(rawStatus);
  if (!isNaN(statusNum) && statusNum >= 400 && statusNum < 500 && statusNum !== 408) {
    return false;
  }

  if (error?.message === "INVALID_AI_RESPONSE") {
    return false;
  }

  // 1. Chequeo de status / statusCode / code numérico o string 504
  if (
    error?.status === 504 ||
    error?.statusCode === 504 ||
    error?.code === 504 ||
    String(error?.status) === "504" ||
    String(error?.statusCode) === "504" ||
    String(error?.code) === "504"
  ) {
    return true;
  }

  const statusStr = String(rawStatus ?? "").toUpperCase();
  const codeStr = String(error?.code ?? "").toUpperCase();
  const name = String(error?.name ?? "");
  const message = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "").toLowerCase();
  const causeName = String(error?.cause?.name ?? "");
  const causeMessage = String(error?.cause?.message ?? "").toLowerCase();
  const causeCode = String(error?.cause?.code ?? "").toLowerCase();
  const fullText = String(error).toLowerCase();

  // 2. Chequeo de DEADLINE_EXCEEDED en status o code
  if (
    statusStr === "DEADLINE_EXCEEDED" ||
    codeStr === "DEADLINE_EXCEEDED" ||
    String(error?.cause?.status ?? "").toUpperCase() === "DEADLINE_EXCEEDED" ||
    String(error?.cause?.code ?? "").toUpperCase() === "DEADLINE_EXCEEDED"
  ) {
    return true;
  }

  // 3. Chequeo de mensajes de deadline exceeded / deadline expired
  if (
    message.includes("deadline exceeded") ||
    message.includes("deadline expired") ||
    causeMessage.includes("deadline exceeded") ||
    causeMessage.includes("deadline expired") ||
    fullText.includes("deadline exceeded") ||
    fullText.includes("deadline expired")
  ) {
    return true;
  }

  // 4. Chequeo de timeouts locales y aborts
  return (
    name === "AbortError" ||
    name === "TimeoutError" ||
    causeName === "AbortError" ||
    causeName === "TimeoutError" ||
    code === "etimedout" ||
    code === "und_err_headers_timeout" ||
    code === "und_err_body_timeout" ||
    code === "20" ||
    causeCode === "etimedout" ||
    causeCode === "und_err_headers_timeout" ||
    causeCode === "und_err_body_timeout" ||
    message.includes("aborted") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    causeMessage.includes("aborted") ||
    causeMessage.includes("timeout") ||
    causeMessage.includes("timed out")
  );
}

function isOverloadError(error: any): boolean {
  if (!error) return false;

  const rawStatus = error?.status ?? error?.statusCode;
  const statusNum = Number(rawStatus);
  if (!isNaN(statusNum) && statusNum >= 400 && statusNum < 500 && statusNum !== 408) {
    return false;
  }

  if (error?.message === "INVALID_AI_RESPONSE") {
    return false;
  }

  if (isTimeoutError(error)) {
    return true;
  }

  const message = String(error?.message ?? "").toLowerCase();
  const status = String(rawStatus ?? error?.code ?? "").toLowerCase();
  const fullText = String(error).toLowerCase();

  return (
    status === "503" ||
    status === "unavailable" ||
    message.includes("503") ||
    message.includes("unavailable") ||
    message.includes("overloaded") ||
    fullText.includes("503") ||
    fullText.includes("unavailable") ||
    fullText.includes("overloaded")
  );
}

export async function editDiagramByInstruction(
  currentModel: { classes: any[]; relations: any[] },
  instruction: string
): Promise<{ operations: any[] }> {
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  const prompt = SYSTEM_PROMPT_TEMPLATE.replace(
    "{{currentModel}}",
    JSON.stringify(currentModel)
  ).replace("{{instruction}}", instruction);

  const maxAttempts = 3;
  let response;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[Gemini] Intento ${attempt}/${maxAttempts}`);
      console.log("[Gemini] Modelo: gemini-3.6-flash");
      response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: editDiagramResponseSchema,
          httpOptions: {
            timeout: 20000,
          },
        },
      });
      console.log("[Gemini] Respuesta recibida correctamente.");
      console.log("[UC7 DEBUG] Gemini response OK"); // TEMP UC7 DEBUG
      break;
    } catch (error: any) {
      if (isOverloadError(error)) {
        const isTimeout = isTimeoutError(error);

        if (isTimeout) {
          console.log(
            `[Gemini] Deadline/timeout del intento ${attempt}/${maxAttempts}.`
          );
        }

        if (attempt < maxAttempts) {
          const delayMs = attempt === 1 ? 1000 : 2000;
          if (!isTimeout) {
            console.log(
              `[Gemini] Sobrecarga detectada. Reintentando en ${delayMs}ms...`
            );
          }
          await sleep(delayMs);
          continue;
        } else {
          if (isTimeout) {
            console.log("[Gemini] Se agotaron los 3 intentos por timeout/deadline.");
          } else {
            console.log("[Gemini] Se agotaron los 3 intentos por sobrecarga.");
          }
        }
      }
      throw error;
    }
  }

  try {
    const parsed = JSON.parse(response?.text || "");
    console.log("[UC7 DEBUG] Gemini JSON parsed"); // TEMP UC7 DEBUG
    return parsed;
  } catch {
    throw new Error("INVALID_AI_RESPONSE");
  }
}
