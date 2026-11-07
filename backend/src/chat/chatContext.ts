import { UmlModel, UmlRelation } from "../backendGenerator/types";

export interface ChatMessageSummary {
  authorName?: string;
  text?: string;
}

export interface BuildChatContextParams {
  modelCompact: string;
  recentMessages: ChatMessageSummary[];
  askerName: string;
  question: string;
}

const RELATION_TYPE_MAP: Record<string, string> = {
  association: "asociación",
  inheritance: "herencia",
  composition: "composición",
  aggregation: "agregación",
  manyToMany: "muchos a muchos",
};

/**
 * Formatea una relación resolviendo los nombres de clase y multiplicidades.
 */
function formatRelation(
  rel: UmlRelation,
  sourceName: string,
  targetName: string
): string {
  const typeLabel =
    RELATION_TYPE_MAP[rel.relationType] || rel.relationType || "asociación";
  const sMult = rel.multiplicitySource ? `${rel.multiplicitySource} ` : "";
  const tMult = rel.multiplicityTarget ? ` ${rel.multiplicityTarget}` : "";

  return `${sourceName} ${sMult}—${tMult} ${targetName} (${typeLabel})`
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Serializa de forma compacta el modelo UML extraído por extractUmlModel.
 *
 * Formato: "Cliente(id: Integer, nombre: String); Pedido(...); relaciones: Cliente 1 — * Pedido (asociación)"
 * Tope de 40 clases: si hay más, corta y agrega "(+N clases omitidas)".
 * Si el diagrama está vacío devuelve "El diagrama está vacío.".
 * Si una relación apunta a un id que no existe, se omite silenciosamente sin fallar.
 */
export function formatModelCompact(model?: UmlModel | null): string {
  if (!model || !Array.isArray(model.classes) || model.classes.length === 0) {
    return "El diagrama está vacío.";
  }

  // 1. Mapeo de id de Excalidraw a nombre de clase
  const classMap = new Map<string, string>();
  for (const c of model.classes) {
    if (c && typeof c.id === "string") {
      classMap.set(c.id, c.className || "Clase");
    }
  }

  // 2. Formatear hasta 40 clases
  const totalClasses = model.classes.length;
  const displayedClasses = model.classes.slice(0, 40);

  const formattedClasses = displayedClasses.map((c) => {
    const members: string[] = [];

    if (Array.isArray(c.attributes)) {
      for (const attr of c.attributes) {
        if (!attr?.name) continue;
        const typePart = attr.type ? `: ${attr.type}` : "";
        members.push(`${attr.name}${typePart}`);
      }
    }

    if (Array.isArray(c.methods)) {
      for (const method of c.methods) {
        if (!method?.name) continue;
        const methodName = method.name.endsWith("()")
          ? method.name
          : `${method.name}()`;
        const returnPart = method.returnType ? `: ${method.returnType}` : "";
        members.push(`${methodName}${returnPart}`);
      }
    }

    const className = c.className || "Clase";
    return `${className}(${members.join(", ")})`;
  });

  let classesPart = formattedClasses.join("; ");
  if (totalClasses > 40) {
    const omitted = totalClasses - 40;
    classesPart += `; (+${omitted} clases omitidas)`;
  }

  // 3. Formatear relaciones válidas
  const formattedRelations: string[] = [];
  if (Array.isArray(model.relations)) {
    for (const rel of model.relations) {
      if (!rel) continue;
      const sourceName = classMap.get(rel.sourceClassId);
      const targetName = classMap.get(rel.targetClassId);

      // Si apunta a un id inexistente, omitir sin fallar
      if (!sourceName || !targetName) {
        continue;
      }

      formattedRelations.push(formatRelation(rel, sourceName, targetName));
    }
  }

  if (formattedRelations.length > 0) {
    return `${classesPart}; relaciones: ${formattedRelations.join("; ")}`;
  }

  return classesPart;
}

/**
 * Construye el prompt de contexto para la IA en el chat de equipo.
 *
 * Estructura:
 * - Diagrama actual: {modelCompact}
 * - Conversación reciente: (omitido si no hay mensajes)
 * - Pregunta de {askerName}: {question}
 */
export function buildChatContext({
  modelCompact,
  recentMessages,
  askerName,
  question,
}: BuildChatContextParams): string {
  const blocks: string[] = [];

  // Bloque: Diagrama actual
  const cleanModel = (modelCompact || "").trim() || "El diagrama está vacío.";
  blocks.push(`Diagrama actual: ${cleanModel}`);

  // Bloque: Conversación reciente (omitido si no hay mensajes)
  const validMessages = Array.isArray(recentMessages) ? recentMessages : [];
  if (validMessages.length > 0) {
    const last6 = validMessages.slice(-6);
    const lines = last6.map((msg) => {
      const author = (msg.authorName || "Usuario").trim();
      const rawText = msg.text || "";
      const truncated =
        rawText.length > 250 ? rawText.slice(0, 250) : rawText;
      return `${author}: ${truncated}`;
    });

    blocks.push(`Conversación reciente (solo contexto):\n${lines.join("\n")}`);
  }

  // Última línea: Pregunta de {askerName}: {question}
  const cleanAsker = (askerName || "Usuario").trim();
  blocks.push(`Pregunta de ${cleanAsker}: ${question || ""}`);

  return blocks.join("\n\n");
}
