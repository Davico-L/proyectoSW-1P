import { Collection, ObjectId } from "mongodb";
import { getMongoDb } from "../db/mongo";
import { parseMention } from "./aiChatHelpers";
import { toPublicProposal, PublicProposal } from "./proposalHelpers";

export const CHAT_COLLECTION_NAME = "chat_messages";
export const DEFAULT_MESSAGE_LIMIT = 50;
export const MAX_MESSAGE_LIMIT = 100;
export const MAX_TEXT_LENGTH = 2000;

export class ChatUnavailableError extends Error {
  constructor(message = "El servicio de chat no está disponible (MongoDB no conectado)") {
    super(message);
    this.name = "ChatUnavailableError";
  }
}

export class ChatValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatValidationError";
  }
}

export interface ChatMessageInput {
  diagramId: string;
  authorSessionId: string;
  authorName: string;
  role: string;
  text: string;
  mentions?: string[];
  proposal?: any;
  replyTo?: string;
  addressedTo?: string;
  kind?: string;
  operations?: any[];
  warnings?: string[];
  findings?: any[];
}

export interface ChatMessageDocument {
  id: string;
  diagramId: string;
  authorSessionId: string;
  authorName: string;
  role: string;
  text: string;
  mentions?: string[];
  proposal?: any;
  replyTo?: string;
  addressedTo?: string;
  createdAt: Date;
  kind?: string;
  operations?: any[];
  warnings?: string[];
  findings?: any[];
}

export interface PublicChatMessage {
  id: string;
  diagramId: string;
  authorName: string;
  role: string;
  text: string;
  createdAt: Date;
  mentions?: string[];
  proposal?: any;
  replyTo?: string;
  addressedTo?: string;
  kind?: string;
}

export const toChatMessageDocument = (doc: any): ChatMessageDocument => ({
  id: String(doc._id || doc.id),
  diagramId: doc.diagramId,
  authorSessionId: doc.authorSessionId,
  authorName: doc.authorName,
  role: doc.role,
  text: doc.text,
  createdAt: doc.createdAt,
  ...(Array.isArray(doc.mentions) ? { mentions: doc.mentions } : {}),
  ...(doc.proposal !== undefined ? { proposal: doc.proposal } : {}),
  ...(typeof doc.replyTo === "string" && doc.replyTo ? { replyTo: doc.replyTo } : {}),
  ...(typeof doc.addressedTo === "string" && doc.addressedTo ? { addressedTo: doc.addressedTo } : {}),
  ...(typeof doc.kind === "string" && doc.kind ? { kind: doc.kind } : {}),
  ...(Array.isArray(doc.operations) ? { operations: doc.operations } : {}),
  ...(Array.isArray(doc.warnings) ? { warnings: doc.warnings } : {}),
  ...(Array.isArray(doc.findings) ? { findings: doc.findings } : {}),
});

/**
 * Convierte un documento de mensaje interno a su representación pública para los clientes.
 * OMITE estrictamente authorSessionId (credencial sensible del usuario).
 * proposal se pasa por toPublicProposal; kind sí viaja en la difusión pública;
 * operations, warnings y findings NO se envían a los clientes.
 */
export const toPublicChatMessage = (
  doc: ChatMessageDocument | (ChatMessageDocument & { [key: string]: any })
): PublicChatMessage => {
  const publicMsg: PublicChatMessage = {
    id: doc.id,
    diagramId: doc.diagramId,
    authorName: doc.authorName,
    role: doc.role,
    text: doc.text,
    createdAt: doc.createdAt,
  };

  if (Array.isArray(doc.mentions) && doc.mentions.length > 0) {
    publicMsg.mentions = doc.mentions;
  }

  if (doc.proposal !== undefined && doc.proposal !== null) {
    publicMsg.proposal = toPublicProposal(doc.proposal);
  }

  if (typeof doc.replyTo === "string" && doc.replyTo.trim() !== "") {
    publicMsg.replyTo = doc.replyTo.trim();
  }

  if (typeof doc.addressedTo === "string" && doc.addressedTo.trim() !== "") {
    publicMsg.addressedTo = doc.addressedTo.trim();
  }

  if (typeof doc.kind === "string" && doc.kind.trim() !== "") {
    publicMsg.kind = doc.kind.trim();
  }

  return publicMsg;
};

export interface MongoChatMessageDoc {
  _id?: ObjectId;
  diagramId: string;
  authorSessionId: string;
  authorName: string;
  role: string;
  text: string;
  mentions?: string[];
  proposal?: any;
  replyTo?: string;
  addressedTo?: string;
  createdAt: Date;
  kind?: string;
  operations?: any[];
  warnings?: string[];
  findings?: any[];
}

// Control de inicialización idempotente del índice por diagrama y fecha
let indexEnsured = false;
let indexPromise: Promise<void> | null = null;

export const resetIndexStateForTests = (): void => {
  indexEnsured = false;
  indexPromise = null;
};

/**
 * Asegura de forma idempotente que el índice { diagramId: 1, createdAt: 1 }
 * exista en la colección chat_messages.
 */
export const ensureChatIndexes = async (
  collection: Collection<MongoChatMessageDoc>
): Promise<void> => {
  if (indexEnsured) {
    return;
  }

  if (!indexPromise) {
    indexPromise = (async () => {
      try {
        await collection.createIndex({ diagramId: 1, createdAt: 1 });
        indexEnsured = true;
      } finally {
        indexPromise = null;
      }
    })();
  }

  await indexPromise;
};

/**
 * Guarda un nuevo mensaje de chat en la colección chat_messages.
 * - Recorta espacios en el texto.
 * - Rechaza texto vacío o que exceda los 2000 caracteres con ChatValidationError.
 * - Guarda createdAt y retorna el documento persistido con id como string.
 * - Lanza ChatUnavailableError si MongoDB no está disponible.
 */
export const saveMessage = async (
  input: ChatMessageInput
): Promise<ChatMessageDocument> => {
  const diagramId = typeof input?.diagramId === "string" ? input.diagramId.trim() : "";
  const authorSessionId =
    typeof input?.authorSessionId === "string" ? input.authorSessionId.trim() : "";
  const authorName = typeof input?.authorName === "string" ? input.authorName.trim() : "";
  const role = typeof input?.role === "string" ? input.role.trim() : "";
  const rawText = typeof input?.text === "string" ? input.text : "";
  const trimmedText = rawText.trim();

  if (!diagramId) {
    throw new ChatValidationError("El diagramId es obligatorio");
  }

  if (!authorSessionId) {
    throw new ChatValidationError("El authorSessionId es obligatorio");
  }

  if (!authorName) {
    throw new ChatValidationError("El authorName es obligatorio");
  }

  if (role === "ai" && authorSessionId !== "ai") {
    throw new ChatValidationError(
      "Los mensajes con rol 'ai' requieren authorSessionId 'ai'"
    );
  }

  if (!trimmedText) {
    throw new ChatValidationError("El texto del mensaje no puede estar vacío");
  }

  if (trimmedText.length > MAX_TEXT_LENGTH) {
    throw new ChatValidationError(
      `El texto del mensaje excede el límite máximo de ${MAX_TEXT_LENGTH} caracteres (longitud: ${trimmedText.length})`
    );
  }

  const db = await getMongoDb();
  if (!db) {
    throw new ChatUnavailableError(
      "MongoDB no está disponible. No se puede guardar el mensaje de chat."
    );
  }

  try {
    const collection = db.collection<MongoChatMessageDoc>(CHAT_COLLECTION_NAME);
    await ensureChatIndexes(collection);

    const now = new Date();

    const mentionsList: string[] = Array.isArray(input.mentions)
      ? [...input.mentions]
      : [];

    const mentionCheck = parseMention(trimmedText);
    if (mentionCheck.mentioned && !mentionsList.includes("ia")) {
      mentionsList.push("ia");
    }

    const replyTo =
      typeof input?.replyTo === "string" && input.replyTo.trim() !== ""
        ? input.replyTo.trim()
        : undefined;

    const addressedTo =
      typeof input?.addressedTo === "string" && input.addressedTo.trim() !== ""
        ? input.addressedTo.trim()
        : undefined;

    const kind =
      typeof input?.kind === "string" && input.kind.trim() !== ""
        ? input.kind.trim()
        : undefined;

    const operations = Array.isArray(input?.operations) ? input.operations : undefined;
    const warnings = Array.isArray(input?.warnings) ? input.warnings : undefined;
    const findings = Array.isArray(input?.findings) ? input.findings : undefined;

    const docToInsert: Omit<MongoChatMessageDoc, "_id"> = {
      diagramId,
      authorSessionId,
      authorName,
      role: role || "developer",
      text: trimmedText,
      ...(mentionsList.length > 0 ? { mentions: mentionsList } : {}),
      ...(input.proposal !== undefined ? { proposal: input.proposal } : {}),
      ...(replyTo ? { replyTo } : {}),
      ...(addressedTo ? { addressedTo } : {}),
      ...(kind ? { kind } : {}),
      ...(operations !== undefined ? { operations } : {}),
      ...(warnings !== undefined ? { warnings } : {}),
      ...(findings !== undefined ? { findings } : {}),
      createdAt: now,
    };

    const result = await collection.insertOne(docToInsert as any);

    return {
      id: String(result.insertedId),
      diagramId,
      authorSessionId,
      authorName,
      role: docToInsert.role,
      text: trimmedText,
      ...(mentionsList.length > 0 ? { mentions: mentionsList } : {}),
      ...(input.proposal !== undefined ? { proposal: input.proposal } : {}),
      ...(replyTo ? { replyTo } : {}),
      ...(addressedTo ? { addressedTo } : {}),
      ...(kind ? { kind } : {}),
      ...(operations !== undefined ? { operations } : {}),
      ...(warnings !== undefined ? { warnings } : {}),
      ...(findings !== undefined ? { findings } : {}),
      createdAt: now,
    };
  } catch (err: any) {
    if (err instanceof ChatValidationError || err instanceof ChatUnavailableError) {
      throw err;
    }
    throw new ChatUnavailableError(
      `Error al guardar mensaje en chat_messages: ${err?.message || err}`
    );
  }
};

/**
 * Obtiene los últimos mensajes de un diagrama en orden cronológico ascendente.
 * - limit por defecto 50, con tope máximo de 100.
 * - Lanza ChatUnavailableError si MongoDB no está disponible.
 */
export const listMessages = async (
  diagramId: string,
  limit: number = DEFAULT_MESSAGE_LIMIT
): Promise<ChatMessageDocument[]> => {
  const trimmedDiagramId = typeof diagramId === "string" ? diagramId.trim() : "";
  if (!trimmedDiagramId) {
    throw new ChatValidationError("El diagramId es obligatorio para listar mensajes");
  }

  const parsedLimit = typeof limit === "number" && !isNaN(limit) ? Math.floor(limit) : DEFAULT_MESSAGE_LIMIT;
  const effectiveLimit = Math.min(
    MAX_MESSAGE_LIMIT,
    Math.max(1, parsedLimit <= 0 ? DEFAULT_MESSAGE_LIMIT : parsedLimit)
  );

  const db = await getMongoDb();
  if (!db) {
    throw new ChatUnavailableError(
      "MongoDB no está disponible. No se pueden listar los mensajes de chat."
    );
  }

  try {
    const collection = db.collection<MongoChatMessageDoc>(CHAT_COLLECTION_NAME);
    await ensureChatIndexes(collection);

    // Obtenemos los últimos N mensajes ordenando descendentemente por createdAt
    const rawDocs = await collection
      .find({ diagramId: trimmedDiagramId })
      .sort({ createdAt: -1 })
      .limit(effectiveLimit)
      .toArray();

    // Invertimos para retornar en orden cronológico ascendente (el más antiguo primero entre los últimos N)
    rawDocs.reverse();

    return rawDocs.map(toChatMessageDocument);
  } catch (err: any) {
    if (err instanceof ChatValidationError || err instanceof ChatUnavailableError) {
      throw err;
    }
    throw new ChatUnavailableError(
      `Error al listar mensajes de chat_messages: ${err?.message || err}`
    );
  }
};

/**
 * Obtiene un documento de mensaje completo por su ID y diagramId.
 * - Devuelve el documento completo (con operations) o null si no se encuentra.
 * - Un id inválido devuelve null sin lanzar excepción.
 */
export const getMessageById = async (
  diagramId: string,
  messageId: string
): Promise<ChatMessageDocument | null> => {
  const cleanDiagramId = typeof diagramId === "string" ? diagramId.trim() : "";
  const cleanMessageId = typeof messageId === "string" ? messageId.trim() : "";

  if (!cleanDiagramId || !cleanMessageId || !ObjectId.isValid(cleanMessageId)) {
    return null;
  }

  const db = await getMongoDb();
  if (!db) {
    throw new ChatUnavailableError(
      "MongoDB no está disponible. No se puede obtener el mensaje."
    );
  }

  try {
    const collection = db.collection<MongoChatMessageDoc>(CHAT_COLLECTION_NAME);
    await ensureChatIndexes(collection);

    const doc = await collection.findOne({
      _id: new ObjectId(cleanMessageId),
      diagramId: cleanDiagramId,
    });

    if (!doc) {
      return null;
    }

    return toChatMessageDocument(doc);
  } catch (err: any) {
    if (err instanceof ChatUnavailableError) throw err;
    return null;
  }
};

export type ClaimProposalResult =
  | { ok: true; message: ChatMessageDocument }
  | {
      ok: false;
      reason: "not_found" | "already_decided";
      proposal?: PublicProposal;
    };

/**
 * Reclama atómicamente una propuesta pendiente para iniciar su aplicación.
 * - Realiza un solo findOneAndUpdate con filtro: _id, diagramId y proposal.status "pending"
 *   (también reclama "applying" si proposal.applyingAt tiene más de 60 segundos).
 * - Pone status "applying" y applyingAt con la fecha actual.
 * - Devuelve { ok: true, message } o { ok: false, reason: "not_found" | "already_decided", proposal: versión pública vigente }.
 */
export const claimProposal = async (
  diagramId: string,
  messageId: string,
  decidedBy: string
): Promise<ClaimProposalResult> => {
  const cleanDiagramId = typeof diagramId === "string" ? diagramId.trim() : "";
  const cleanMessageId = typeof messageId === "string" ? messageId.trim() : "";

  if (!cleanDiagramId || !cleanMessageId || !ObjectId.isValid(cleanMessageId)) {
    return { ok: false, reason: "not_found" };
  }

  const db = await getMongoDb();
  if (!db) {
    throw new ChatUnavailableError(
      "MongoDB no está disponible. No se puede reclamar la propuesta."
    );
  }

  try {
    const collection = db.collection<MongoChatMessageDoc>(CHAT_COLLECTION_NAME);
    await ensureChatIndexes(collection);

    const objectId = new ObjectId(cleanMessageId);
    const now = new Date();
    const sixtySecondsAgo = new Date(now.getTime() - 60 * 1000);

    const claimFilter = {
      _id: objectId,
      diagramId: cleanDiagramId,
      $or: [
        { "proposal.status": "pending" },
        {
          "proposal.status": "applying",
          "proposal.applyingAt": { $lt: sixtySecondsAgo },
        },
      ],
    };

    const update = {
      $set: {
        "proposal.status": "applying",
        "proposal.applyingAt": now,
      },
    };

    const updatedDoc = await collection.findOneAndUpdate(
      claimFilter as any,
      update as any,
      { returnDocument: "after" }
    );

    if (updatedDoc) {
      return {
        ok: true,
        message: toChatMessageDocument(updatedDoc),
      };
    }

    // No coincidió con el filtro de reclamo: verificar si el mensaje existe
    const existing = await collection.findOne({
      _id: objectId,
      diagramId: cleanDiagramId,
    });

    if (!existing || !existing.proposal) {
      return {
        ok: false,
        reason: "not_found",
      };
    }

    return {
      ok: false,
      reason: "already_decided",
      proposal: toPublicProposal(existing.proposal),
    };
  } catch (err: any) {
    if (err instanceof ChatUnavailableError) throw err;
    throw new ChatUnavailableError(
      `Error al reclamar propuesta en chat_messages: ${err?.message || err}`
    );
  }
};

export type ProposalOutcome = "approved" | "rejected" | "expired" | "pending";

/**
 * Liquida el resultado de una propuesta previamente reclamada ("applying").
 * - Solo actúa si el estado actual en Mongo es "applying".
 * - Para "approved", "rejected" o "expired": guarda decidedBy (si se suministra) y decidedAt, y quita applyingAt.
 * - Para "pending": reasigna status a "pending" y quita applyingAt.
 * - Devuelve el mensaje actualizado (ChatMessageDocument) o null si no coincidió.
 */
export const settleProposal = async (
  diagramId: string,
  messageId: string,
  outcome: ProposalOutcome,
  decidedBy?: string
): Promise<ChatMessageDocument | null> => {
  const cleanDiagramId = typeof diagramId === "string" ? diagramId.trim() : "";
  const cleanMessageId = typeof messageId === "string" ? messageId.trim() : "";

  if (!cleanDiagramId || !cleanMessageId || !ObjectId.isValid(cleanMessageId)) {
    return null;
  }

  if (!["approved", "rejected", "expired", "pending"].includes(outcome)) {
    return null;
  }

  const db = await getMongoDb();
  if (!db) {
    throw new ChatUnavailableError(
      "MongoDB no está disponible. No se puede liquidar la propuesta."
    );
  }

  try {
    const collection = db.collection<MongoChatMessageDoc>(CHAT_COLLECTION_NAME);
    await ensureChatIndexes(collection);

    const objectId = new ObjectId(cleanMessageId);
    const filter = {
      _id: objectId,
      diagramId: cleanDiagramId,
      "proposal.status": "applying",
    };

    let update: any;
    if (outcome === "pending") {
      update = {
        $set: { "proposal.status": "pending" },
        $unset: { "proposal.applyingAt": "" },
      };
    } else {
      const now = new Date();
      update = {
        $set: {
          "proposal.status": outcome,
          "proposal.decidedAt": now,
          ...(decidedBy ? { "proposal.decidedBy": String(decidedBy).trim() } : {}),
        },
        $unset: { "proposal.applyingAt": "" },
      };
    }

    const updatedDoc = await collection.findOneAndUpdate(
      filter as any,
      update as any,
      { returnDocument: "after" }
    );

    if (!updatedDoc) {
      return null;
    }

    return toChatMessageDocument(updatedDoc);
  } catch (err: any) {
    if (err instanceof ChatUnavailableError) throw err;
    throw new ChatUnavailableError(
      `Error al liquidar propuesta en chat_messages: ${err?.message || err}`
    );
  }
};
