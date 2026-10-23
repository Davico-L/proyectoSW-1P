import { BACKEND_URL } from "../../excalidraw-app/data/backendSync";

export interface PreparedImage {
  imageBase64: string;
  mimeType: "image/jpeg";
}

export interface PostImagePayload {
  imageBase64: string;
  mimeType: string;
  instruction?: string;
}

/**
 * Dibuja un origen visual (ImageBitmap o HTMLImageElement) en un elemento Canvas
 * rellenando con fondo blanco, reduciendo proporcionalmente a un lado máximo de 1600 px
 * (sin agrandar si las dimensiones son menores) y exportando a JPEG con calidad 0.85.
 */
function renderCanvasToJpegBase64(
  source: ImageBitmap | HTMLImageElement,
  srcWidth: number,
  srcHeight: number,
): PreparedImage {
  const MAX_DIM = 1600;
  let targetWidth = srcWidth;
  let targetHeight = srcHeight;

  if (targetWidth > MAX_DIM || targetHeight > MAX_DIM) {
    if (targetWidth >= targetHeight) {
      targetHeight = Math.round((targetHeight * MAX_DIM) / targetWidth);
      targetWidth = MAX_DIM;
    } else {
      targetWidth = Math.round((targetWidth * MAX_DIM) / targetHeight);
      targetHeight = MAX_DIM;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("No se pudo obtener el contexto 2D del canvas");
  }

  // Fondo blanco para garantizar fondo limpio en imágenes PNG con transparencia
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  const commaIdx = dataUrl.indexOf(",");
  const imageBase64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;

  return {
    imageBase64,
    mimeType: "image/jpeg",
  };
}

/**
 * Reduce la imagen a un lado máximo de 1600 px (sin agrandar) respetando la orientación EXIF,
 * la dibuja sobre un canvas con fondo blanco y la exporta a JPEG calidad 0.85.
 * Devuelve { imageBase64 (sin prefijo data:), mimeType: "image/jpeg" }.
 */
export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  // Intento 1: createImageBitmap con orientación EXIF automática "from-image"
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      } as ImageBitmapOptions);

      try {
        return renderCanvasToJpegBase64(bitmap, bitmap.width, bitmap.height);
      } finally {
        bitmap.close?.();
      }
    } catch (err) {
      console.warn("[imageUpload] Fallback a HTMLImageElement tras error en createImageBitmap:", err);
    }
  }

  // Intento 2: Respaldo clásico con HTMLImageElement y URL de objeto
  return new Promise<PreparedImage>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const result = renderCanvasToJpegBase64(
          img,
          img.naturalWidth || img.width,
          img.naturalHeight || img.height,
        );
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo cargar la imagen para procesarla."));
    };

    img.src = objectUrl;
  });
}

/**
 * Envía la imagen procesada al endpoint POST /diagrams/:id/ai-from-image con los mismos
 * encabezados y formato de URL que ai-edit, con timeout de 110 segundos vía AbortController.
 */
export async function postImageToBackend(
  diagramId: string,
  payload: PostImagePayload,
  backendUrl: string = BACKEND_URL,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 110_000);

  try {
    const requestBody: { imageBase64: string; mimeType: string; instruction?: string } = {
      imageBase64: payload.imageBase64,
      mimeType: payload.mimeType,
    };

    if (payload.instruction && payload.instruction.trim().length > 0) {
      requestBody.instruction = payload.instruction.trim();
    }

    const response = await fetch(`${backendUrl}/diagrams/${diagramId}/ai-from-image`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
