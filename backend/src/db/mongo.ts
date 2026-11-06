import { MongoClient, Db } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

let clientInstance: MongoClient | null = null;
let dbInstance: Db | null = null;

export interface MongoConnectionStatus {
  connected: boolean;
  message?: string;
  latencyMs?: number;
}

/**
 * Resuelve el nombre de la base de datos a utilizar.
 * Si MONGODB_DB_NAME está definido, lo prioriza.
 * Si la URI contiene nombre de base de datos, lo extrae.
 * En caso contrario, retorna "classdraw" por defecto.
 */
export const resolveDefaultDbName = (uri?: string): string => {
  if (process.env.MONGODB_DB_NAME?.trim()) {
    return process.env.MONGODB_DB_NAME.trim();
  }

  if (uri) {
    const match = uri.match(/^mongodb(?:\+srv)?:\/\/[^\/]+\/([^?]+)/);
    if (match && match[1] && match[1].trim()) {
      return decodeURIComponent(match[1].trim());
    }
  }

  return "classdraw";
};

/**
 * Verifica y establece la conexión con MongoDB Atlas mediante un ping a la base de datos.
 * Tolerante a fallos: no lanza excepciones hacia arriba y limpia referencias si el cliente falla.
 */
export const checkMongoConnection = async (): Promise<MongoConnectionStatus> => {
  const uri = process.env.MONGODB_URI?.trim();

  if (!uri) {
    return {
      connected: false,
      message: "Variable MONGODB_URI no configurada o vacía en el entorno",
    };
  }

  const start = Date.now();
  const defaultDb = resolveDefaultDbName(uri);

  try {
    // Si ya existe un cliente en caché, comprobamos que responda al ping
    if (clientInstance) {
      try {
        const activeDb = dbInstance || clientInstance.db(defaultDb);
        await activeDb.command({ ping: 1 });
        return {
          connected: true,
          latencyMs: Date.now() - start,
        };
      } catch {
        // El cliente anterior quedó roto o desconectado: lo cerramos y limpiamos para reconectar
        try {
          await clientInstance.close();
        } catch {
          // Ignorar error al cerrar cliente roto
        }
        clientInstance = null;
        dbInstance = null;
      }
    }

    // Timeout de 4 segundos para evitar bloquear el proceso si Atlas o la red están caídos
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 4000,
      connectTimeoutMS: 4000,
    });

    await client.connect();

    const db = client.db(defaultDb);
    await db.command({ ping: 1 });

    clientInstance = client;
    dbInstance = db;

    return {
      connected: true,
      latencyMs: Date.now() - start,
    };
  } catch (err: any) {
    // Si falló el intento de conexión, aseguramos no dejar clientes zombis o rotos
    if (clientInstance) {
      try {
        await clientInstance.close();
      } catch {
        // Ignorar
      }
      clientInstance = null;
      dbInstance = null;
    }

    return {
      connected: false,
      message: err?.message || "Error desconocido al conectar a MongoDB",
      latencyMs: Date.now() - start,
    };
  }
};

/**
 * Obtiene la instancia de la base de datos de MongoDB.
 * Si aún no está conectada o la conexión inicial falló, reintenta conectar de forma segura.
 * Si no es posible conectar, retorna null sin tumbar el proceso ni retener un cliente roto.
 */
export const getMongoDb = async (dbName?: string): Promise<Db | null> => {
  if (!clientInstance) {
    // Reintenta conectar sin tumbar el proceso
    await checkMongoConnection();
  }

  if (!clientInstance) {
    return null;
  }

  const targetDbName = dbName || resolveDefaultDbName(process.env.MONGODB_URI);
  return clientInstance.db(targetDbName);
};

/**
 * Obtiene el cliente singleton de MongoDB si está conectado.
 */
export const getMongoClient = (): MongoClient | null => {
  return clientInstance;
};

/**
 * Cierra la conexión activa a MongoDB de forma segura y resetea las referencias.
 */
export const closeMongoConnection = async (): Promise<void> => {
  if (clientInstance) {
    try {
      await clientInstance.close();
    } finally {
      clientInstance = null;
      dbInstance = null;
    }
  }
};
