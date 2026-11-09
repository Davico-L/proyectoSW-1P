/**
 * Funciones puras de ayuda para la modificación del diagrama mediante chat de equipo (CU20).
 */

export const MAX_OPERATIONS = 10;

/**
 * Normaliza un texto para clasificación de intención:
 * 1. Quita la mención "@Codia" o "@ia" en cualquier posición (case-insensitive)
 * 2. Quita signos "¿" y "¡"
 * 3. Convierte a minúsculas y elimina tildes/marcas diacríticas (NFD)
 * 4. Colapsa espacios extra
 * 5. Quita un "por favor" inicial (con opcional coma y espacios)
 */
export function normalizeForIntent(text: string): string {
  if (typeof text !== "string") {
    return "";
  }

  // 1. Quitar mención @Codia o @ia en cualquier posición (incluyendo opcional puntuación pegada a la mención)
  let s = text.replace(/@(?:codia|ia)\b\s*[,:;]?/gi, " ");

  // 2. Quitar signos ¿ y ¡
  s = s.replace(/[¿¡]/g, "");

  // 3. Minúsculas y eliminar tildes (convierte á->a, é->e, í->i, ó->o, ú->u, ñ->n)
  s = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // 4. Espacios extra y recorte de posibles signos de puntuación iniciales residuales
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/^[,:;.\-]\s*/, "");

  // 5. Quitar un "por favor" inicial (y signos adyacentes)
  s = s.replace(/^por\s+favor\s*[,:;\-]?\s*/i, "").trim();
  s = s.replace(/^[,:;.\-]\s*/, "");

  return s;
}

// Palabras o frases interrogativas o de explicación (Regla 1)
const QUERY_PREFIXES: readonly string[] = [
  "por que",
  "para que",
  "como",
  "que",
  "cual",
  "cuales",
  "cuando",
  "donde",
  "explica",
  "explicame",
  "dime",
  "diferencia",
];

// Fórmulas de cortesía (para detección de cortesía + explicación / interrogación)
const COURTESY_FORMULAS: readonly string[] = [
  "quiero que",
  "necesito que",
  "ayudame a",
  "me ayudas a",
  "podrias",
  "puedes",
  "podes",
];

// Verbos y sustantivos para detección de operaciones no soportadas sobre atributos/métodos (UC7)
const UNSUPPORTED_DELETE_VERBS: ReadonlySet<string> = new Set([
  "elimina",
  "eliminar",
  "eliminale",
  "eliminales",
  "borra",
  "borrar",
  "borrale",
  "borrales",
  "quita",
  "quitar",
  "quitale",
  "quitales",
  "remueve",
  "remover",
  "remuevele",
  "remueveles",
  "saca",
  "sacar",
  "sacale",
  "sacales",
  "suprime",
  "suprimir",
  "suprimele",
  "suprimeles",
]);

const UNSUPPORTED_FILLER_WORDS: ReadonlySet<string> = new Set([
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
  "todos",
  "todas",
  "su",
  "sus",
  "del",
  "de",
  "al",
  "a",
]);

const UNSUPPORTED_TARGET_NOUNS: ReadonlySet<string> = new Set([
  "atributo",
  "atributos",
  "metodo",
  "metodos",
  "campo",
  "campos",
  "propiedad",
  "propiedades",
  "funcion",
  "funciones",
]);

const UNSUPPORTED_RENAME_SINGLE_VERBS: ReadonlySet<string> = new Set([
  "renombra",
  "renombrar",
  "renombrale",
  "renombrales",
]);

const UNSUPPORTED_RENAME_MULTI_START: ReadonlySet<string> = new Set([
  "cambia",
  "cambiale",
  "cambiales",
  "cambiar",
  "cambiarle",
  "cambiarles",
]);

function followsToUnsupportedTargetNoun(
  tokens: string[],
  startIndex: number
): boolean {
  const next1 = tokens[startIndex + 1];
  if (!next1) return false;
  if (UNSUPPORTED_TARGET_NOUNS.has(next1)) return true;
  if (!UNSUPPORTED_FILLER_WORDS.has(next1)) return false;

  const next2 = tokens[startIndex + 2];
  if (!next2) return false;
  if (UNSUPPORTED_TARGET_NOUNS.has(next2)) return true;
  if (!UNSUPPORTED_FILLER_WORDS.has(next2)) return false;

  const next3 = tokens[startIndex + 3];
  if (!next3) return false;
  if (UNSUPPORTED_TARGET_NOUNS.has(next3)) return true;

  return false;
}

/**
 * Detecta si la instrucción solicita eliminar o renombrar atributos o métodos individuales,
 * operaciones que UC7 no soporta (updateClass solo agrega o actualiza).
 *
 * Devuelve "delete", "rename" o null.
 */
export function detectUnsupportedAttributeRequest(
  text: string
): "delete" | "rename" | null {
  const normalized = normalizeForIntent(text);
  if (!normalized) {
    return null;
  }

  // Quitar signos de puntuación e interrogación residuales y dividir en palabras limpias
  const clean = normalized.replace(/[^\p{L}\p{N}\s]/gu, " ");
  const tokens = clean.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return null;
  }

  // 1. Detección de verbos de borrado seguidos (con máx 2 palabras de relleno) de atributo/método
  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];
    if (UNSUPPORTED_DELETE_VERBS.has(word)) {
      if (followsToUnsupportedTargetNoun(tokens, i)) {
        return "delete";
      }
    }
  }

  // 2. Detección de verbos de renombrado seguidos (con máx 2 palabras de relleno) de atributo/método
  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];
    // Caso 2a: verbo simple "renombra", "renombrar", etc.
    if (UNSUPPORTED_RENAME_SINGLE_VERBS.has(word)) {
      if (followsToUnsupportedTargetNoun(tokens, i)) {
        return "rename";
      }
    }

    // Caso 2b: expresión compuesta "cambia/cambiale [el|de] nombre"
    if (
      UNSUPPORTED_RENAME_MULTI_START.has(word) &&
      i + 2 < tokens.length &&
      (tokens[i + 1] === "el" || tokens[i + 1] === "de") &&
      tokens[i + 2] === "nombre"
    ) {
      if (followsToUnsupportedTargetNoun(tokens, i + 2)) {
        return "rename";
      }
    }
  }

  return null;
}

// Verbos de explicación tras fórmula de cortesía
const EXPLANATION_VERBS: readonly string[] = [
  "explicar",
  "explicarme",
  "explicame",
  "decir",
  "decirme",
  "contar",
  "contarme",
  "mostrar",
  "mostrarme",
  "aclarar",
  "aclararme",
  "ensenar",
  "ensenarme",
];

// Palabras interrogativas tras fórmula de cortesía
const COURTESY_INTERROGATIVES: readonly string[] = [
  "por que",
  "para que",
  "que",
  "como",
  "cual",
  "cuales",
  "cuando",
  "donde",
];

// Fórmulas de cortesía y verbos de modificación (Regla 2)
const MODIFICATION_PREFIXES: readonly string[] = [
  // Fórmulas de cortesía compuestas
  "quiero que",
  "necesito que",
  "ayudame a",
  "me ayudas a",
  // Fórmulas de cortesía simples
  "podrias",
  "puedes",
  "podes",
  // Modificación concreta sobre clase o atributo con mejora/optimización
  "mejora la clase",
  "mejora a la clase",
  "optimiza la clase",
  "optimiza a la clase",
  // Verbos de modificación
  "agregale",
  "agrega",
  "anade",
  "creame",
  "crea",
  "elimina",
  "borra",
  "quita",
  "cambia",
  "modifica",
  "renombra",
  "edita",
  "actualiza",
  "pon",
  "relaciona",
  "conecta",
  "convierte",
  "haz",
];

// Verbos de acción directa de modificación
const MODIFICATION_ACTION_VERBS: readonly string[] = [
  "agregale",
  "agrega",
  "anade",
  "creame",
  "crea",
  "elimina",
  "borra",
  "quita",
  "cambia",
  "modifica",
  "renombra",
  "edita",
  "actualiza",
  "pon",
  "relaciona",
  "conecta",
  "convierte",
  "haz",
  "mejora la clase",
  "mejora a la clase",
  "optimiza la clase",
  "optimiza a la clase",
];

// Verbos de revisión para detección de intención "review"
const REVIEW_VERBS: ReadonlySet<string> = new Set([
  "revisa",
  "revisar",
  "revisame",
  "revisale",
  "revises",
  "evalua",
  "evaluar",
  "evaluame",
  "evaluale",
  "evalues",
  "valida",
  "validar",
  "validame",
  "validale",
  "valides",
  "analiza",
  "analizar",
  "analizame",
  "analizale",
  "analices",
  "audita",
  "auditar",
  "auditame",
  "auditale",
  "audites",
  "verifica",
  "verificar",
  "verificame",
  "verificale",
  "verifiques",
  "chequea",
  "chequear",
  "chequeame",
  "chequeale",
  "chequees",
]);

// Objetos sobre los cuales aplica una revisión
const REVIEW_OBJECTS: ReadonlySet<string> = new Set([
  "diagrama",
  "diagramas",
  "modelo",
  "modelos",
  "clase",
  "clases",
  "relacion",
  "relaciones",
  "esquema",
  "esquemas",
  "diseno",
  "disenos",
  "estructura",
  "estructuras",
  "entidad",
  "entidades",
]);

/**
 * Detecta si el texto contiene un verbo de revisión junto a un objeto de revisión.
 */
function hasReviewVerbWithObject(tokens: string[]): boolean {
  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];
    if (REVIEW_VERBS.has(word)) {
      // Buscar objeto de revisión en las 4 palabras siguientes
      for (let j = i + 1; j <= i + 4 && j < tokens.length; j++) {
        if (REVIEW_OBJECTS.has(tokens[j])) {
          return true;
        }
      }
      // O en las 3 palabras anteriores (ej. "al diagrama, revisalo")
      for (let j = Math.max(0, i - 3); j < i; j++) {
        if (REVIEW_OBJECTS.has(tokens[j])) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Detecta frases clave de revisión:
 * "qué le falta", "qué mejorarías", "sugerencias", "mejoras", "está bien", "tiene errores", "feedback".
 */
function isReviewPhrase(normalized: string): boolean {
  // 1. "que le falta", "que le faltaria", "que falta en/a"
  if (/\bque\s+(?:le\s+)?falta(?:ria)?\b/u.test(normalized)) {
    return true;
  }

  // 2. "que mejorarias", "que cambiarias", "que le cambiarias"
  if (/\bque\s+(?:le\s+)?(?:mejorarias|cambiarias)\b/u.test(normalized)) {
    return true;
  }

  // 3. "sugerencias", "sugerencia" (ej. "dame sugerencias de mejora", "tienes sugerencias", "alguna sugerencia")
  if (/\bsugerencias?\b/u.test(normalized)) {
    return true;
  }

  // 4. "mejoras" (en contexto de revisión: "propone mejoras", "que mejoras", "posibles mejoras", "sugerencias de mejora")
  if (
    /\b(?:propone|proponer|dame|algunas?|posibles?|oportunidades?\s+de|que)\s+mejoras?\b/u.test(
      normalized
    )
  ) {
    return true;
  }

  // 5. "esta bien" (ej. "esta bien mi diagrama?", "esta bien el modelo?", "esta bien?")
  if (/\besta\s+bien\b/u.test(normalized)) {
    return true;
  }

  // 6. "tiene errores", "hay errores", "encuentras errores"
  if (
    /\b(?:tiene|hay|encuentras?|ves)\s+(?:algun\s+)?errores?\b/u.test(
      normalized
    )
  ) {
    return true;
  }

  // 7. "feedback" (ej. "dame feedback", "feedback del modelo")
  if (/\bfeedback\b/u.test(normalized)) {
    return true;
  }

  return false;
}

/**
 * Detecta "mejora" u "optimiza" aplicados al diagrama o modelo en general
 * (ej. "mejora el diagrama", "optimiza el modelo"), distinguiéndolos de
 * objetivos concretos como "mejora la clase X".
 */
function hasGeneralDiagramImprovement(
  tokens: string[],
  normalized: string
): boolean {
  // Si especifica una clase concreta ("mejora la clase..."), no es general
  if (
    /\b(?:mejora|optimiza|mejorar|optimizar)\s+(?:a\s+)?(?:la\s+)?clase\b/u.test(
      normalized
    )
  ) {
    return false;
  }

  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];
    if (
      word === "mejora" ||
      word === "mejorar" ||
      word === "optimiza" ||
      word === "optimizar"
    ) {
      for (let j = i + 1; j <= i + 4 && j < tokens.length; j++) {
        const target = tokens[j];
        if (
          target === "diagrama" ||
          target === "modelo" ||
          target === "esquema" ||
          target === "diseno" ||
          target === "estructura"
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Detecta si la frase contiene un pedido con objetivo concreto de modificación
 * que debe prevalecer como "modification" (ej. "agrega...", "crea...", "elimina...",
 * "mejora la clase X agregando...", etc.).
 */
function hasConcreteModificationCommand(
  tokens: string[],
  normalized: string
): boolean {
  // "mejora la clase X" o "optimiza la clase X"
  if (
    /\b(?:mejora|optimiza|mejorar|optimizar)\s+(?:a\s+)?(?:la\s+)?clase\b/u.test(
      normalized
    )
  ) {
    return true;
  }

  // Verbos de acción directa de modificación al inicio
  for (const prefix of MODIFICATION_ACTION_VERBS) {
    if (startsWithPrefix(normalized, prefix)) {
      return true;
    }
  }

  // Gerundios de modificación que indican acción concreta
  if (
    /\b(?:agregando|creando|eliminando|borrando|quitando|cambiando|modificando|renombrando)\b/u.test(
      normalized
    )
  ) {
    return true;
  }

  return false;
}

// Palabras o raíces interrogativas y de explicación prohibidas en cualquier posición para Regla 2b
const NON_INITIAL_QUERY_WORDS: ReadonlySet<string> = new Set([
  "como",
  "que",
  "cual",
  "cuales",
  "cuando",
  "donde",
  "explica",
  "explicame",
  "dime",
  "diferencia",
  "diferencias",
  "diferencian",
]);

// Verbos de modificación permitidos entre las primeras 8 palabras para Regla 2b
const NON_INITIAL_MODIFICATION_VERBS: ReadonlySet<string> = new Set([
  "agregale",
  "agrega",
  "anade",
  "creame",
  "crea",
  "elimina",
  "borra",
  "quita",
  "cambia",
  "modifica",
  "renombra",
  "edita",
  "actualiza",
  "pon",
  "relaciona",
  "conecta",
  "convierte",
  "haz",
]);

function startsWithPrefix(text: string, prefix: string): boolean {
  const regex = new RegExp(`^${prefix}(?:\\b|[\\s.,!?:;]|$)`, "i");
  return regex.test(text);
}

/**
 * Clasifica la intención del mensaje del usuario entre "query", "modification" o "review".
 * Reglas en orden estricto:
 * 1. Si empieza con palabra interrogativa o de explicación conceptual, es "query" (incluso si contiene un verbo de acción),
 *    salvo que sea una frase específica de revisión (ej. "¿qué le falta a mi diagrama?", "¿qué mejorarías?").
 * 1b. Si empieza con fórmula de cortesía y la palabra siguiente es verbo de explicación o palabra interrogativa, es "query"
 *     (salvo que la continuación sea una frase de revisión).
 * 1c. Si coincide con una intención de revisión ("review") y NO contiene un pedido con objetivo concreto de modificación
 *     (ej. "agrega...", "crea...", "elimina...", "mejora la clase X agregando..."), se clasifica como "review":
 *     - Verbos de revisión (revisa, evalúa, valida, analiza, audita, verifica, chequea) junto a un objeto
 *       (diagrama, modelo, clases, relaciones, esquema, diseño, estructura, entidades).
 *     - Frases clave de revisión ("qué le falta", "qué mejorarías", "sugerencias", "mejoras", "está bien", "tiene errores", "feedback").
 *     - "Mejora" u "optimiza" aplicados al diagrama o modelo en general ("mejora el diagrama").
 * 2. Si empieza con fórmula de cortesía o verbo de modificación (incluyendo "mejora la clase X"), es "modification".
 * 2b. Si el texto no contiene signos "?" ni "¿", no contiene palabras interrogativas ni de explicación en ninguna
 *     posición, y contiene un verbo de modificación como palabra completa en las primeras 8 palabras, es "modification".
 * 3. Todo lo demás, y el texto vacío, es "query".
 */
export function classifyIntent(
  text: string
): "query" | "modification" | "review" {
  const normalized = normalizeForIntent(text);
  if (!normalized) {
    return "query";
  }

  // Regla 1: Palabra interrogativa o de explicación al inicio
  for (const prefix of QUERY_PREFIXES) {
    if (startsWithPrefix(normalized, prefix)) {
      // Excepción: Preguntas de revisión explícitas (ej. "¿qué le falta a mi diagrama?", "¿qué mejorarías?", "dime qué le falta")
      if (isReviewPhrase(normalized)) {
        return "review";
      }
      return "query";
    }
  }

  // Regla 1b: Fórmula de cortesía seguida de verbo de explicación o palabra interrogativa -> query
  for (const formula of COURTESY_FORMULAS) {
    const formulaRegex = new RegExp(`^${formula}\\b\\s*[,:;]?\\s*`, "i");
    const match = normalized.match(formulaRegex);
    if (match) {
      let remainder = normalized.slice(match[0].length).trim();
      remainder = remainder.replace(/^por\s+favor\s*[,:;\-]?\s*/i, "").trim();
      const isQueryFollowup = [
        ...EXPLANATION_VERBS,
        ...COURTESY_INTERROGATIVES,
      ].some((starter) => startsWithPrefix(remainder, starter));
      if (isQueryFollowup) {
        if (isReviewPhrase(remainder) || isReviewPhrase(normalized)) {
          return "review";
        }
        return "query";
      }
    }
  }

  const cleanTokens = normalized
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  // Regla 1c: Intención de revisión ("review")
  // Se evalúa antes de Regla 2 (para que frases como "podrías revisar el diagrama" o "mejora el diagrama"
  // no caigan en modification), SIEMPRE QUE no contenga un pedido con objetivo concreto de modificación
  // (ej. "agrega...", "crea...", "mejora la clase Cliente agregando nombre", etc.).
  const hasConcreteMod = hasConcreteModificationCommand(cleanTokens, normalized);
  if (!hasConcreteMod) {
    if (
      hasReviewVerbWithObject(cleanTokens) ||
      isReviewPhrase(normalized) ||
      hasGeneralDiagramImprovement(cleanTokens, normalized)
    ) {
      return "review";
    }
  }

  // Regla 2: Fórmula de cortesía o verbo de modificación al inicio
  for (const prefix of MODIFICATION_PREFIXES) {
    if (startsWithPrefix(normalized, prefix)) {
      return "modification";
    }
  }

  // Regla 2b: Verbo de modificación no inicial (entre las primeras 8 palabras) en frase declarativa/imperativa
  if (
    typeof text === "string" &&
    !text.includes("?") &&
    !text.includes("¿")
  ) {
    const hasInterrogativePhrase =
      /\bpor\s+que\b/u.test(normalized) || /\bpara\s+que\b/u.test(normalized);

    const hasInterrogativeWord =
      hasInterrogativePhrase ||
      cleanTokens.some((token) => NON_INITIAL_QUERY_WORDS.has(token));

    if (!hasInterrogativeWord) {
      const first8 = cleanTokens.slice(0, 8);
      const hasModificationVerb = first8.some((token) =>
        NON_INITIAL_MODIFICATION_VERBS.has(token)
      );

      if (hasModificationVerb) {
        return "modification";
      }
    }
  }

  // Regla 3: Todo lo demás
  return "query";
}

/**
 * Conjunción copulativa en español ("y" / "e"):
 * Cambia a "e" si la palabra siguiente es "y" o empieza con el sonido /i/ ("i-" o "hi-", salvo diptongos).
 */
export function spanishConjunction(word: string): string {
  const clean = word.trim();
  if (/^(?:y\b|i(?!a|e|o|u)|hi(?!a|e|o|u))/i.test(clean)) {
    return "e";
  }
  return "y";
}

/**
 * Describe una operación individual de forma concisa en español.
 */
function describeOperation(op: any): string | null {
  if (!op || typeof op !== "object" || !op.action) {
    return null;
  }

  switch (op.action) {
    case "createClass": {
      const name = op.className ? String(op.className).trim() : "clase";
      const attrs = Array.isArray(op.attributes) ? op.attributes.length : 0;
      if (attrs > 0) {
        const noun = attrs === 1 ? "atributo" : "atributos";
        return `creé la clase ${name} con ${attrs} ${noun}`;
      }
      return `creé la clase ${name}`;
    }

    case "updateClass": {
      const name = op.className ? String(op.className).trim() : "clase";
      if (
        op.newClassName &&
        typeof op.newClassName === "string" &&
        op.newClassName.trim() !== "" &&
        op.newClassName.trim() !== name
      ) {
        return `renombré la clase ${name} a ${op.newClassName.trim()}`;
      }
      return `actualicé la clase ${name}`;
    }

    case "deleteClass": {
      const name = op.className ? String(op.className).trim() : "clase";
      return `eliminé la clase ${name}`;
    }

    case "createRelation": {
      const s = op.sourceClassName ? String(op.sourceClassName).trim() : "origen";
      const t = op.targetClassName ? String(op.targetClassName).trim() : "destino";
      const conj = spanishConjunction(t);
      return `creé la relación entre ${s} ${conj} ${t}`;
    }

    case "updateRelation": {
      const s = op.sourceClassName ? String(op.sourceClassName).trim() : "origen";
      const t = op.targetClassName ? String(op.targetClassName).trim() : "destino";
      const conj = spanishConjunction(t);
      return `actualicé la relación entre ${s} ${conj} ${t}`;
    }

    case "deleteRelation": {
      const s = op.sourceClassName ? String(op.sourceClassName).trim() : "origen";
      const t = op.targetClassName ? String(op.targetClassName).trim() : "destino";
      const conj = spanishConjunction(t);
      return `eliminé la relación entre ${s} ${conj} ${t}`;
    }

    default:
      return null;
  }
}

/**
 * Une varias cláusulas en una sola oración legible con comas y conjunción ("y" / "e").
 */
function joinClauses(clauses: string[]): string {
  if (clauses.length === 0) return "";
  if (clauses.length === 1) return clauses[0];
  if (clauses.length === 2) {
    const conj = spanishConjunction(clauses[1]);
    return `${clauses[0]} ${conj} ${clauses[1]}`;
  }
  const last = clauses[clauses.length - 1];
  const rest = clauses.slice(0, -1);
  const conj = spanishConjunction(last);
  return `${rest.join(", ")} ${conj} ${last}`;
}

/**
 * Devuelve un resumen corto en español con plantilla de las operaciones aplicadas y avisos de lo descartado.
 * Empieza en minúscula porque el servidor antepone el nombre del usuario.
 */
export function summarizeOperations(
  operations: any[],
  warnings?: string[]
): string {
  const opList = Array.isArray(operations) ? operations : [];
  const clauses: string[] = [];

  for (const op of opList) {
    const desc = describeOperation(op);
    if (desc) {
      clauses.push(desc);
    }
  }

  const cleanWarnings = Array.isArray(warnings)
    ? warnings.map((w) => (typeof w === "string" ? w.trim() : "")).filter(Boolean)
    : [];

  if (clauses.length === 0) {
    if (cleanWarnings.length > 0) {
      return `no se aplicó ningún cambio. Descarté: ${cleanWarnings.join("; ")}.`;
    }
    return "no encontré cambios para aplicar.";
  }

  let summary = joinClauses(clauses);

  if (cleanWarnings.length > 0) {
    summary += `. Descarté: ${cleanWarnings.join("; ")}.`;
  } else {
    summary += ".";
  }

  return summary;
}

export interface OperationLimitResult {
  exceeded: boolean;
  count: number;
  message?: string;
}

/**
 * Verifica si la cantidad de operaciones supera el límite permitido.
 * Si se supera, devuelve exceeded: true y un mensaje descriptivo en español solicitando dividir el pedido.
 */
export function checkOperationLimit(
  operations: any[],
  max: number = MAX_OPERATIONS
): OperationLimitResult {
  const count = Array.isArray(operations) ? operations.length : 0;
  if (count > max) {
    return {
      exceeded: true,
      count,
      message: `el pedido contiene ${count} operaciones y supera el tope máximo de ${max}. Por favor, dividilo en cambios más pequeños.`,
    };
  }
  return {
    exceeded: false,
    count,
  };
}

export {
  normalizeClassName,
  convertExistingCreateToUpdate,
} from "../ai/providers/operationNormalizer";


