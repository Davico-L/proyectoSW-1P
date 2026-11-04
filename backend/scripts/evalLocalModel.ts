import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { setLocalConfig, localProvider } from "../src/ai/providers";
import { validateAndResolveOperations } from "../src/services/operationValidator";
import { UmlClass } from "../src/backendGenerator/types";

// Cargar variables de entorno desde .env local o raíz si existen
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// ---------------------------------------------------------------------------
// 1. Verificación de variables de entorno requeridas
// ---------------------------------------------------------------------------

const rawUrl = process.env.LOCAL_EVAL_URL?.trim();
const model = process.env.LOCAL_EVAL_MODEL?.trim();

if (!rawUrl || !model) {
  console.error("=================================================================");
  console.error("ERROR: Faltan las variables de entorno LOCAL_EVAL_URL y/o LOCAL_EVAL_MODEL.");
  console.error("=================================================================");
  console.error("Debes definir ambas variables para ejecutar la evaluación del modelo local:");
  console.error("  LOCAL_EVAL_URL   - URL base del servidor OpenAI-compatible (ej. https://xxx.ngrok-free.app o http://localhost:8000)");
  console.error("  LOCAL_EVAL_MODEL - Identificador del modelo cargado (ej. Qwen/Qwen2.5-Coder-7B-Instruct)");
  console.error("\nEjemplos de ejecución:");
  console.error("  # En Linux / macOS / Bash:");
  console.error('  LOCAL_EVAL_URL="http://localhost:8000" LOCAL_EVAL_MODEL="qwen2.5-coder" npx tsx scripts/evalLocalModel.ts');
  console.error("  # En PowerShell (Windows):");
  console.error('  $env:LOCAL_EVAL_URL="http://localhost:8000"; $env:LOCAL_EVAL_MODEL="qwen2.5-coder"; npx tsx scripts/evalLocalModel.ts');
  console.error("=================================================================\n");
  process.exit(1);
}

const cleanedUrl = rawUrl.replace(/\/$/, "");

// ---------------------------------------------------------------------------
// 2. Modelo UML de ejemplo (Cliente y Pedido con relación de asociación)
// ---------------------------------------------------------------------------

const sampleUmlClasses: UmlClass[] = [
  {
    id: "class_cliente",
    className: "Cliente",
    attributes: [
      { name: "id", type: "Long", visibility: "private" },
      { name: "nombre", type: "String", visibility: "private" },
      { name: "correo", type: "String", visibility: "private" },
    ],
    methods: [],
  },
  {
    id: "class_pedido",
    className: "Pedido",
    attributes: [
      { name: "id", type: "Long", visibility: "private" },
    ],
    methods: [],
  },
];

const sampleModel = {
  classes: sampleUmlClasses.map((c) => ({
    className: c.className,
    attributes: c.attributes,
    methods: c.methods,
  })),
  relations: [
    {
      relationType: "association",
      sourceClassName: "Cliente",
      targetClassName: "Pedido",
      multiplicitySource: "1",
      multiplicityTarget: "0..*",
    },
  ],
};

// ---------------------------------------------------------------------------
// 3. Catálogo de 12 instrucciones de edición UML
// ---------------------------------------------------------------------------

const INSTRUCTIONS: string[] = [
  "crea una clase Producto con nombre, precio y stock",
  "agrega el atributo telefono a Cliente",
  "elimina la clase Pedido",
  "renombra Cliente a Usuario",
  "crea una relación de asociación entre Producto y Pedido",
  "haz que Cliente tenga muchos Pedido",
  "crea tres clases: Doctor, Paciente y Cita, y relaciónalas",
  "agrega a Pedido los atributos fecha y total",
  "borra el atributo correo de Cliente",
  "crea una clase abstracta Persona y haz que Cliente herede de Persona",
  "agrega el método calcularTotal a Pedido",
  "cambia la relación entre Cliente y Pedido a composición",
];

const RECOGNIZED_ACTIONS = new Set([
  "createClass",
  "updateClass",
  "deleteClass",
  "createRelation",
  "updateRelation",
  "deleteRelation",
]);

interface DiagramEvalItem {
  id: number;
  instruction: string;
  ok: boolean;
  statusText: string;
  durationMs: number;
  operationsCount: number;
  validOperationsCount?: number;
  warnings?: string[];
  operations?: any[];
  error?: string;
}

// ---------------------------------------------------------------------------
// 4. Catálogo de 3 preguntas conversacionales directas (sin esquema)
// ---------------------------------------------------------------------------

interface ChatQuestion {
  id: number;
  name: string;
  prompt: string;
}

const CHAT_QUESTIONS: ChatQuestion[] = [
  { id: 1, name: "Davico", prompt: "Soy Davico, ¿qué es un atributo derivado?" },
  { id: 2, name: "Ana", prompt: "Soy Ana, ¿cuándo conviene usar composición y no agregación?" },
  { id: 3, name: "Luis", prompt: "Soy Luis, ¿qué mejorarías en un diagrama con una clase de 15 atributos?" },
];

const SENIOR_SYSTEM_PROMPT =
  "Eres un desarrollador senior del equipo. Responde siempre en español y dirígete por su nombre a quien te pregunta";

interface ChatEvalItem {
  id: number;
  name: string;
  prompt: string;
  ok: boolean;
  durationMs: number;
  includesName: boolean;
  isSpanish: boolean;
  responseSnippet: string;
  fullResponse?: string;
  error?: string;
}

function detectSpanish(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  // Detección basada en stopwords y vocabulario técnico en español
  const spanishMarkers = [
    /\b(el|la|los|las|un|una|unos|unas|de|del|en|para|por|con|sin|sobre|que|es|son|fue|ser|estar|como|más|pero|o|y|e|si|este|esta|estos|estas|su|sus|al|se|lo|le|les|me|te|nos)\b/i,
    /\b(clase|clases|atributo|atributos|relación|relaciones|método|métodos|composición|agregación|diagrama|herencia|asociación|código|sistema|desarrollador|modelo|diseño)\b/i,
    /[áéíóúüñ¿¡]/i,
  ];
  let matches = 0;
  for (const marker of spanishMarkers) {
    if (marker.test(text)) matches++;
  }
  return matches >= 2;
}

// ---------------------------------------------------------------------------
// 5. Ejecución principal de la evaluación
// ---------------------------------------------------------------------------

async function runEvaluation(): Promise<void> {
  console.log("\n=================================================================");
  console.log("   EVALUACIÓN DE MODELO LOCAL (CU24 - Colab / OpenAI compatible)");
  console.log("=================================================================");
  console.log(`URL objetivo : ${cleanedUrl}`);
  console.log(`Modelo       : ${model}`);
  console.log(`Fecha / Hora : ${new Date().toISOString()}`);
  console.log("=================================================================\n");

  // Configurar localProvider
  setLocalConfig({ url: cleanedUrl, model });

  const diagramResults: DiagramEvalItem[] = [];

  console.log("--- FASE 1: Evaluación de 12 Instrucciones de Edición UML ---");
  for (let i = 0; i < INSTRUCTIONS.length; i++) {
    const instruction = INSTRUCTIONS[i];
    process.stdout.write(`[${i + 1}/12] "${instruction}"... `);

    const start = Date.now();
    try {
      const result = await localProvider.editDiagramByInstruction(sampleModel, instruction);
      const durationMs = Date.now() - start;

      const ops = Array.isArray(result?.operations) ? result.operations : [];
      const allRecognized =
        ops.length > 0 &&
        ops.every((op) => op && typeof op === "object" && RECOGNIZED_ACTIONS.has(op.action));

      // Validación semántica mediante la función pura validateAndResolveOperations
      const validation = validateAndResolveOperations(ops, sampleUmlClasses);

      const ok = allRecognized;
      const statusText = ok ? "OK" : ops.length === 0 ? "Fallo (0 ops)" : "Fallo (acción desconocida)";

      diagramResults.push({
        id: i + 1,
        instruction,
        ok,
        statusText,
        durationMs,
        operationsCount: ops.length,
        validOperationsCount: validation.validOperations.length,
        warnings: validation.warnings,
        operations: ops,
      });

      console.log(`${ok ? "OK" : "FALLO"} (${durationMs}ms, ${ops.length} ops)`);
    } catch (err: any) {
      const durationMs = Date.now() - start;
      const errorMsg =
        err?.message === "INVALID_AI_RESPONSE"
          ? "INVALID_AI_RESPONSE"
          : err?.message === "AI_TIMEOUT"
          ? "AI_TIMEOUT"
          : err?.message || String(err);

      diagramResults.push({
        id: i + 1,
        instruction,
        ok: false,
        statusText: `Fallo (${errorMsg})`,
        durationMs,
        operationsCount: 0,
        error: errorMsg,
      });

      console.log(`FALLO [${errorMsg}] (${durationMs}ms)`);
    }
  }

  console.log("\n--- FASE 2: Evaluación de 3 Preguntas Conversacionales Senior ---");
  const chatResults: ChatEvalItem[] = [];

  for (const q of CHAT_QUESTIONS) {
    process.stdout.write(`[${q.id}/3] Para ${q.name}: "${q.prompt}"... `);
    const start = Date.now();

    const timeoutMs = parseInt(process.env.LOCAL_AI_TIMEOUT_MS || "", 10) || 45000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${cleanedUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SENIOR_SYSTEM_PROMPT },
            { role: "user", content: q.prompt },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: any = await response.json();
      const content = String(data?.choices?.[0]?.message?.content || "").trim();
      const durationMs = Date.now() - start;

      const lowerContent = content.toLowerCase();
      const includesName = lowerContent.includes(q.name.toLowerCase());
      const isSpanish = detectSpanish(content);
      const ok = includesName && isSpanish;

      const snippet = content.replace(/\s+/g, " ").slice(0, 100);

      chatResults.push({
        id: q.id,
        name: q.name,
        prompt: q.prompt,
        ok,
        durationMs,
        includesName,
        isSpanish,
        responseSnippet: snippet,
        fullResponse: content,
      });

      console.log(
        `${ok ? "OK" : "PARCIAL/FALLO"} (${durationMs}ms) [Nombre: ${includesName ? "Sí" : "No"}, Español: ${isSpanish ? "Sí" : "No"}]`
      );
    } catch (err: any) {
      clearTimeout(timeoutId);
      const durationMs = Date.now() - start;
      const errorMsg = controller.signal.aborted ? "AI_TIMEOUT" : err?.message || String(err);

      chatResults.push({
        id: q.id,
        name: q.name,
        prompt: q.prompt,
        ok: false,
        durationMs,
        includesName: false,
        isSpanish: false,
        responseSnippet: "",
        error: errorMsg,
      });

      console.log(`FALLO [${errorMsg}] (${durationMs}ms)`);
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Impresión de Tablas Resumen y Métricas Totales
  // ---------------------------------------------------------------------------

  console.log("\n=================================================================");
  console.log("                    TABLA RESUMEN DE EDICIÓN UML                 ");
  console.log("=================================================================");
  console.log("#  | Estado                           | ms    | Instrucción");
  console.log("---+----------------------------------+-------+---------------------------------");
  for (const item of diagramResults) {
    const num = String(item.id).padStart(2, " ");
    const status = item.statusText.padEnd(32, " ").slice(0, 32);
    const ms = String(item.durationMs).padStart(5, " ");
    console.log(`${num} | ${status} | ${ms} | ${item.instruction}`);
  }

  console.log("\n=================================================================");
  console.log("                TABLA RESUMEN CONVERSACIONAL (SENIOR)            ");
  console.log("=================================================================");
  console.log("Nombre | Nombre? | Español? | ms    | Inicio de respuesta");
  console.log("-------+---------+----------+-------+---------------------------------------");
  for (const item of chatResults) {
    const name = item.name.padEnd(6, " ");
    const incName = (item.includesName ? "Sí" : "No").padEnd(7, " ");
    const esp = (item.isSpanish ? "Sí" : "No").padEnd(8, " ");
    const ms = String(item.durationMs).padStart(5, " ");
    const snip = item.responseSnippet.slice(0, 39);
    console.log(`${name} | ${incName} | ${esp} | ${ms} | ${snip}`);
  }

  // Métricas acumuladas
  const validDiagramCount = diagramResults.filter((r) => r.ok).length;
  const diagramDurations = diagramResults.map((r) => r.durationMs);
  const avgDuration =
    diagramDurations.length > 0
      ? Math.round(diagramDurations.reduce((a, b) => a + b, 0) / diagramDurations.length)
      : 0;
  const maxDuration = diagramDurations.length > 0 ? Math.max(...diagramDurations) : 0;
  const correctNamesCount = chatResults.filter((r) => r.includesName).length;
  const spanishCount = chatResults.filter((r) => r.isSpanish).length;

  console.log("\n=================================================================");
  console.log("                         TOTALES FINALES                         ");
  console.log("=================================================================");
  console.log(`Instrucciones válidas devueltas : ${validDiagramCount} / 12`);
  console.log(`Tiempo promedio de respuesta    : ${avgDuration} ms`);
  console.log(`Tiempo máximo de respuesta      : ${maxDuration} ms`);
  console.log(`Nombres reconocidos en chat     : ${correctNamesCount} / 3`);
  console.log(`Respuestas en español en chat   : ${spanishCount} / 3`);
  console.log("=================================================================\n");

  // ---------------------------------------------------------------------------
  // 7. Guardar resultados completos en backend/scripts/eval-results.json
  // ---------------------------------------------------------------------------

  const outputPath = path.resolve(__dirname, "eval-results.json");
  const fullDetail = {
    timestamp: new Date().toISOString(),
    config: {
      url: cleanedUrl,
      model,
    },
    summary: {
      totalInstructions: INSTRUCTIONS.length,
      validInstructions: validDiagramCount,
      avgDurationMs: avgDuration,
      maxDurationMs: maxDuration,
      totalQuestions: CHAT_QUESTIONS.length,
      namesCorrect: correctNamesCount,
      spanishCorrect: spanishCount,
    },
    diagramResults,
    chatResults,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(fullDetail, null, 2), "utf-8");
  console.log(`Resultados detallados guardados en: ${outputPath}\n`);
}

// Ejecutar
runEvaluation().catch((err) => {
  console.error("Error fatal en la ejecución de la evaluación:", err);
  process.exit(1);
});
