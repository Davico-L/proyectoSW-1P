import { Collection, ObjectId } from "mongodb";
import { getMongoDb } from "../db/mongo";

export const ROOM_SETTINGS_COLLECTION_NAME = "ai_room_settings";

export type RoomMode = "apply" | "advise";
export type RoomStyle = "directa" | "mentora" | "detallada";

export const VALID_ROOM_MODES: readonly RoomMode[] = ["apply", "advise"] as const;
export const VALID_ROOM_STYLES: readonly RoomStyle[] = [
  "directa",
  "mentora",
  "detallada",
] as const;

export interface RoomSettings {
  mode: RoomMode;
  style: RoomStyle;
}

export interface SavedRoomSettings extends RoomSettings {
  updatedBy: string;
}

export const DEFAULT_ROOM_SETTINGS: Readonly<RoomSettings> = Object.freeze({
  mode: "apply",
  style: "mentora",
});

export function isValidMode(val: any): val is RoomMode {
  return typeof val === "string" && (VALID_ROOM_MODES as readonly string[]).includes(val);
}

export function isValidStyle(val: any): val is RoomStyle {
  return typeof val === "string" && (VALID_ROOM_STYLES as readonly string[]).includes(val);
}

export const MODE_LABELS: Record<RoomMode, string> = {
  apply: "Aplica los cambios",
  advise: "Solo asesora",
};

export const STYLE_LABELS: Record<RoomStyle, string> = {
  directa: "Directa",
  mentora: "Mentora",
  detallada: "Detallada",
};

/**
 * Genera el texto del mensaje de sistema anunciado en el chat tras un cambio de configuración.
 * "<Nombre> cambió el modo de Codia a '<etiqueta>'" y/o "<Nombre> cambió el estilo de Codia a '<etiqueta>'".
 * Si cambian ambos, un solo mensaje con las dos frases separadas por punto.
 */
export function formatSettingsAnnouncement(
  authorName: string,
  modeChanged: boolean,
  newMode: RoomMode,
  styleChanged: boolean,
  newStyle: RoomStyle
): string {
  const cleanName = (authorName || "").trim() || "Un integrante";
  const phrases: string[] = [];
  if (modeChanged) {
    phrases.push(`${cleanName} cambió el modo de Codia a '${MODE_LABELS[newMode]}'`);
  }
  if (styleChanged) {
    phrases.push(`${cleanName} cambió el estilo de Codia a '${STYLE_LABELS[newStyle]}'`);
  }
  return phrases.join(". ");
}

export interface MongoRoomSettingsDoc {
  _id?: ObjectId;
  diagramId: string;
  mode: RoomMode;
  style: RoomStyle;
  updatedAt: Date;
  updatedBy: string;
}

// Control de inicialización idempotente del índice único por diagramId
let indexEnsured = false;
let indexPromise: Promise<void> | null = null;

export const resetRoomSettingsIndexStateForTests = (): void => {
  indexEnsured = false;
  indexPromise = null;
};

/**
 * Asegura de forma idempotente que el índice único { diagramId: 1 }
 * exista en la colección ai_room_settings.
 */
export const ensureRoomSettingsIndexes = async (
  collection: Collection<MongoRoomSettingsDoc>
): Promise<void> => {
  if (indexEnsured) {
    return;
  }

  if (!indexPromise) {
    indexPromise = (async () => {
      try {
        await collection.createIndex({ diagramId: 1 }, { unique: true });
        indexEnsured = true;
      } finally {
        indexPromise = null;
      }
    })();
  }

  await indexPromise;
};

/**
 * Obtiene la configuración de Codia para la sala (diagrama).
 * Si no existe el documento o MongoDB falla, devuelve los valores por defecto ({ mode: "apply", style: "mentora" })
 * sin lanzar error.
 */
export async function getRoomSettings(diagramId: string): Promise<RoomSettings> {
  const cleanDiagramId = typeof diagramId === "string" ? diagramId.trim() : "";
  if (!cleanDiagramId) {
    return { ...DEFAULT_ROOM_SETTINGS };
  }

  try {
    const db = await getMongoDb();
    if (!db) {
      return { ...DEFAULT_ROOM_SETTINGS };
    }

    const collection = db.collection<MongoRoomSettingsDoc>(ROOM_SETTINGS_COLLECTION_NAME);
    await ensureRoomSettingsIndexes(collection);

    const doc = await collection.findOne({ diagramId: cleanDiagramId });
    if (!doc) {
      return { ...DEFAULT_ROOM_SETTINGS };
    }

    return {
      mode: isValidMode(doc.mode) ? doc.mode : DEFAULT_ROOM_SETTINGS.mode,
      style: isValidStyle(doc.style) ? doc.style : DEFAULT_ROOM_SETTINGS.style,
    };
  } catch (_err) {
    // Si Mongo falla, devuelve valores por defecto sin lanzar excepción
    return { ...DEFAULT_ROOM_SETTINGS };
  }
}

/**
 * Guarda o actualiza (upsert) la configuración de Codia para una sala.
 * Valida contra la lista cerrada y lanza Error("invalid_value") si algún valor no es válido.
 * Si MongoDB falla, propaga el error.
 */
export async function saveRoomSettings(
  diagramId: string,
  settings: { mode: any; style: any },
  updatedBy: string
): Promise<SavedRoomSettings> {
  const cleanDiagramId = typeof diagramId === "string" ? diagramId.trim() : "";
  if (!cleanDiagramId) {
    throw new Error("invalid_value");
  }

  if (!isValidMode(settings?.mode) || !isValidStyle(settings?.style)) {
    throw new Error("invalid_value");
  }

  const cleanUpdatedBy = typeof updatedBy === "string" ? updatedBy.trim() : "";

  const db = await getMongoDb();
  if (!db) {
    throw new Error("MongoDB no disponible");
  }

  const collection = db.collection<MongoRoomSettingsDoc>(ROOM_SETTINGS_COLLECTION_NAME);
  await ensureRoomSettingsIndexes(collection);

  const now = new Date();
  await collection.updateOne(
    { diagramId: cleanDiagramId },
    {
      $set: {
        diagramId: cleanDiagramId,
        mode: settings.mode,
        style: settings.style,
        updatedAt: now,
        updatedBy: cleanUpdatedBy,
      },
    },
    { upsert: true }
  );

  return {
    mode: settings.mode,
    style: settings.style,
    updatedBy: cleanUpdatedBy,
  };
}
