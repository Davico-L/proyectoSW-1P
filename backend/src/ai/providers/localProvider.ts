import { ModelProvider, ProviderId, ChatReplyOptions } from "./types";

// ---------------------------------------------------------------------------
// Configuración en memoria del servidor local (Colab u otro endpoint OpenAI-
// compatible). Sin setLocalConfig, isConfigured() devuelve false.
// ---------------------------------------------------------------------------

interface LocalConfig {
  url: string;
  model: string;
}

let _localConfig: LocalConfig | null = null;

export function setLocalConfig(config: LocalConfig): void {
  _localConfig = { url: config.url.trimEnd().replace(/\/$/, ""), model: config.model };
}

export function getLocalConfig(): LocalConfig | null {
  return _localConfig ? { ..._localConfig } : null;
}

export function clearLocalConfig(): void {
  _localConfig = null;
}

// ---------------------------------------------------------------------------
// Mismo prompt de sistema que groq.ts (copiado literalmente para no alterar
// el comportamiento de groq.ts si se extrajera a un módulo compartido).
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Sos el motor de edición de diagramas UML de clases de esta aplicación. Tu única función es interpretar la instrucción del usuario y devolver una lista de operaciones estructuradas sobre el diagrama.

ESQUEMA DE DATOS DEL DIAGRAMA
- Cada clase tiene: className (nombre de la clase), attributes (lista de objetos con { name, type, visibility }), methods (lista de objetos con { name, returnType, visibility }).
- Cada relación tiene: relationType, sourceClassName, targetClassName, multiplicitySource, multiplicityTarget.

TIPOS VÁLIDOS (lista cerrada, no uses otros)
- Tipos de atributo permitidos: String, Integer, Long, Boolean, Double, Date.
- Tipos de retorno de método permitidos: String, Integer, Long, Boolean, Double, Date, void ("void" permitido únicamente como returnType).

VISIBILIDADES VÁLIDAS (lista cerrada)
private, public, protected.

TIPOS DE RELACIÓN VÁLIDOS (lista cerrada)
association, inheritance, composition, aggregation, manyToMany.

MULTIPLICIDADES VÁLIDAS (lista cerrada)
"1", "0..1", "0..*", "1..*", "*".

REGLA EXPLÍCITA DE MULTIPLICIDADES
- sourceClassName es la clase origen y targetClassName es la clase destino.
- multiplicitySource indica cuántas instancias de la clase origen corresponden a UNA instancia de la clase destino.
- multiplicityTarget indica cuántas instancias de la clase destino corresponden a UNA instancia de la clase origen.
- Ejemplo: "un Cliente puede tener cero o muchos Pedidos y cada Pedido pertenece a un Cliente" → sourceClassName: Cliente, targetClassName: Pedido, multiplicitySource: "1", multiplicityTarget: "0..*".

OPERACIONES Y REGLAS DE CAMPOS
1. createClass:
   - Debe incluir: className, attributes, methods.
   - Si no se especifican atributos o métodos en la instrucción, devolver un array vacío [] para dicho campo.
2. updateClass:
   - Debe incluir: className, newClassName, attributes, methods.
   - Regla explícita: los campos que el usuario NO pida modificar deben ir como null (por ejemplo newClassName: null, attributes: null, methods: null). Nunca inventar modificaciones adicionales ni devolver más de una operación cuando la instrucción pide un solo cambio.
3. deleteClass:
   - Debe incluir: className.
4. createRelation:
   - Debe incluir: relationType, sourceClassName, targetClassName, multiplicitySource, multiplicityTarget.
5. updateRelation:
   - Debe incluir: sourceClassName, targetClassName, relationType, multiplicitySource, multiplicityTarget.
   - Regla explícita: los campos que el usuario NO pida modificar deben ir como null (por ejemplo relationType: null, multiplicitySource: null, multiplicityTarget: null). Nunca inventar modificaciones adicionales ni devolver más de una operación cuando la instrucción pide un solo cambio.
6. deleteRelation:
   - Debe incluir: sourceClassName, targetClassName.

REGLAS GENERALES OBLIGATORIAS
1. Las operaciones referencian clases SIEMPRE por nombre exacto (className, sourceClassName, targetClassName), nunca por id — no inventar ids.
2. Si la instrucción no tiene relación con editar el diagrama, devolvé exactamente {"operations": []}.
3. Devolvé únicamente el JSON, sin texto adicional antes o después, sin comentarios ni frases como "let me check".`;

const USER_PROMPT_TEMPLATE = `MODELO ACTUAL DEL DIAGRAMA
{{currentModel}}

INSTRUCCIÓN DEL USUARIO
{{instruction}}`;

// ---------------------------------------------------------------------------
// Mismo esquema JSON que groq.ts (copiado literalmente).
// ---------------------------------------------------------------------------

const attributeSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    type: { type: "string", enum: ["String", "Integer", "Long", "Boolean", "Double", "Date"] },
    visibility: { type: "string", enum: ["private", "public", "protected"] },
  },
  required: ["name", "type", "visibility"],
  additionalProperties: false,
};

const methodSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    returnType: { type: "string", enum: ["String", "Integer", "Long", "Boolean", "Double", "Date", "void"] },
    visibility: { type: "string", enum: ["private", "public", "protected"] },
  },
  required: ["name", "returnType", "visibility"],
  additionalProperties: false,
};

const createClassSchema = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["createClass"] },
    className: { type: "string" },
    attributes: { type: "array", items: attributeSchema },
    methods: { type: "array", items: methodSchema },
  },
  required: ["action", "className", "attributes", "methods"],
  additionalProperties: false,
};

const updateClassSchema = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["updateClass"] },
    className: { type: "string" },
    newClassName: { anyOf: [{ type: "string" }, { type: "null" }] },
    attributes: { anyOf: [{ type: "array", items: attributeSchema }, { type: "null" }] },
    methods: { anyOf: [{ type: "array", items: methodSchema }, { type: "null" }] },
  },
  required: ["action", "className", "newClassName", "attributes", "methods"],
  additionalProperties: false,
};

const deleteClassSchema = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["deleteClass"] },
    className: { type: "string" },
  },
  required: ["action", "className"],
  additionalProperties: false,
};

const createRelationSchema = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["createRelation"] },
    relationType: { type: "string", enum: ["association", "inheritance", "composition", "aggregation", "manyToMany"] },
    sourceClassName: { type: "string" },
    targetClassName: { type: "string" },
    multiplicitySource: { type: "string", enum: ["1", "0..1", "0..*", "1..*", "*"] },
    multiplicityTarget: { type: "string", enum: ["1", "0..1", "0..*", "1..*", "*"] },
  },
  required: ["action", "relationType", "sourceClassName", "targetClassName", "multiplicitySource", "multiplicityTarget"],
  additionalProperties: false,
};

const updateRelationSchema = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["updateRelation"] },
    sourceClassName: { type: "string" },
    targetClassName: { type: "string" },
    relationType: { anyOf: [{ type: "string", enum: ["association", "inheritance", "composition", "aggregation", "manyToMany"] }, { type: "null" }] },
    multiplicitySource: { anyOf: [{ type: "string", enum: ["1", "0..1", "0..*", "1..*", "*"] }, { type: "null" }] },
    multiplicityTarget: { anyOf: [{ type: "string", enum: ["1", "0..1", "0..*", "1..*", "*"] }, { type: "null" }] },
  },
  required: ["action", "sourceClassName", "targetClassName", "relationType", "multiplicitySource", "multiplicityTarget"],
  additionalProperties: false,
};

const deleteRelationSchema = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["deleteRelation"] },
    sourceClassName: { type: "string" },
    targetClassName: { type: "string" },
  },
  required: ["action", "sourceClassName", "targetClassName"],
  additionalProperties: false,
};

const editDiagramResponseSchema = {
  type: "object",
  properties: {
    operations: {
      type: "array",
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
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Mismo post-proceso de normalización de nulls que groq.ts (copiado
// literalmente para no alterar groq.ts).
// ---------------------------------------------------------------------------

function removeNullFields(operations: any[]): void {
  for (const op of operations) {
    if (op && typeof op === "object" && !Array.isArray(op)) {
      for (const key of Object.keys(op)) {
        if (op[key] === null) {
          delete op[key];
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Lógica interna de llamada al endpoint OpenAI-compatible.
// Parámetro useJsonSchema: true → response_format json_schema,
//                           false → fallback a json_object.
// ---------------------------------------------------------------------------

async function callLocal(
  url: string,
  model: string,
  userContent: string,
  timeoutMs: number,
  useJsonSchema: boolean
): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const responseFormat = useJsonSchema
    ? {
        type: "json_schema",
        json_schema: {
          name: "classdraw_uc7",
          strict: true,
          schema: editDiagramResponseSchema,
        },
      }
    : { type: "json_object" };

  let response: Response;
  try {
    response = await fetch(`${url}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: responseFormat,
      }),
      signal: controller.signal,
    });
  } catch (fetchError: any) {
    if (controller.signal.aborted) {
      throw new Error("AI_TIMEOUT");
    }
    throw fetchError;
  } finally {
    clearTimeout(timeoutId);
  }

  return response;
}

// ---------------------------------------------------------------------------
// ModelProvider: Local (Colab)
// ---------------------------------------------------------------------------

export class LocalProvider implements ModelProvider {
  readonly id: ProviderId = "local";
  readonly label: string = "Local (Colab)";

  isConfigured(): boolean {
    return (
      _localConfig !== null &&
      typeof _localConfig.url === "string" &&
      _localConfig.url.trim() !== "" &&
      typeof _localConfig.model === "string" &&
      _localConfig.model.trim() !== ""
    );
  }

  async editDiagramByInstruction(
    currentModel: { classes: any[]; relations: any[] },
    instruction: string
  ): Promise<{ operations: any[] }> {
    if (!this.isConfigured()) {
      throw new Error("El proveedor local no está configurado. Llamá a setLocalConfig primero.");
    }

    const config = _localConfig!;
    const timeoutMs = parseInt(process.env.LOCAL_AI_TIMEOUT_MS || "", 10) || 45000;

    const userContent = USER_PROMPT_TEMPLATE
      .replace("{{currentModel}}", JSON.stringify(currentModel))
      .replace("{{instruction}}", instruction);

    console.log(`[Local] Llamando a ${config.url}/v1/chat/completions (modelo: ${config.model})`);

    // Primer intento: json_schema estricto
    let response = await callLocal(config.url, config.model, userContent, timeoutMs, true);

    // Si el servidor rechaza json_schema (400), reintentamos con json_object
    if (!response.ok && response.status === 400) {
      console.log("[Local] json_schema rechazado (HTTP 400), reintentando con json_object...");
      response = await callLocal(config.url, config.model, userContent, timeoutMs, false);
    }

    if (!response.ok) {
      let errorBody = "";
      try {
        errorBody = await response.text();
      } catch {
        // ignorar
      }
      throw new Error(`Local AI error HTTP ${response.status}: ${errorBody || response.statusText}`);
    }

    console.log("[Local] Respondió correctamente");

    const data: any = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    let parsed: any;
    try {
      parsed = JSON.parse(content || "");
    } catch {
      throw new Error("INVALID_AI_RESPONSE");
    }

    if (!parsed || !Array.isArray(parsed.operations)) {
      throw new Error("INVALID_AI_RESPONSE");
    }

    // Normalización: eliminar propiedades con valor null (mismo comportamiento que groq.ts)
    removeNullFields(parsed.operations);

    return { operations: parsed.operations };
  }

  async chatReply(
    systemPrompt: string,
    userContent: string,
    options?: ChatReplyOptions
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error("El proveedor local no está configurado. Llamá a setLocalConfig primero.");
    }

    const config = _localConfig!;
    const timeoutMs = parseInt(process.env.LOCAL_AI_TIMEOUT_MS || "", 10) || 45000;
    const maxTokens = options?.maxTokens ?? 400;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${config.url}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      if (controller.signal.aborted) {
        throw new Error("AI_TIMEOUT");
      }
      throw fetchError;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      let errorBody = "";
      try { errorBody = await response.text(); } catch { /* ignorar */ }
      throw new Error(`Local AI error HTTP ${response.status}: ${errorBody || response.statusText}`);
    }

    console.log("[Local] chatReply respondió correctamente");

    const data: any = await response.json();
    const text: string = (data?.choices?.[0]?.message?.content ?? "").trim();

    if (!text) {
      throw new Error("INVALID_AI_RESPONSE");
    }

    return text;
  }
}

export const localProvider = new LocalProvider();
