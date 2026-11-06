import { Collection, ObjectId } from "mongodb";
import { getMongoDb } from "../db/mongo";

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
  createdAt: Date;
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
}

/**
 * Convierte un documento de mensaje interno a su representación pública para los clientes.
 * OMITE estrictamente authorSessionId (credencial sensible del usuario).
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

  if (doc.proposal !== undefined) {
    publicMsg.proposal = doc.proposal;
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
  createdAt: Date;
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
    const docToInsert: Omit<MongoChatMessageDoc, "_id"> = {
      diagramId,
      authorSessionId,
      authorName,
      role: role || "developer",
      text: trimmedText,
      ...(Array.isArray(input.mentions) ? { mentions: input.mentions } : {}),
      ...(input.proposal !== undefined ? { proposal: input.proposal } : {}),
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
      ...(Array.isArray(input.mentions) ? { mentions: input.mentions } : {}),
      ...(input.proposal !== undefined ? { proposal: input.proposal } : {}),
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

    return rawDocs.map((doc: any) => ({
      id: String(doc._id),
      diagramId: doc.diagramId,
      authorSessionId: doc.authorSessionId,
      authorName: doc.authorName,
      role: doc.role,
      text: doc.text,
      ...(Array.isArray(doc.mentions) ? { mentions: doc.mentions } : {}),
      ...(doc.proposal !== undefined ? { proposal: doc.proposal } : {}),
      createdAt: doc.createdAt,
    }));
  } catch (err: any) {
    if (err instanceof ChatValidationError || err instanceof ChatUnavailableError) {
      throw err;
    }
    throw new ChatUnavailableError(
      `Error al listar mensajes de chat_messages: ${err?.message || err}`
    );
  }
};
