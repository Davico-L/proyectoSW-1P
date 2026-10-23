import { useState, useCallback } from "react";
import { useRef } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { BACKEND_URL } from "../../excalidraw-app/data/backendSync";
import { applyAiOperations } from "./applyAiOperations";
import { prepareImageForUpload, postImageToBackend } from "./imageUpload";

export type MessageRole = "user" | "assistant";
export type MessageVariant = "success" | "warning" | "error" | "info";

export interface Message {
  id: string;
  role: MessageRole;
  text: string;
  variant?: MessageVariant;
  imageUrl?: string;
  retryable?: boolean;
}

interface UseAiChatOptions {
  diagramId: string | null;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  backendUrl?: string;
}

const createMessageId = (): string =>
  `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export const useAiChat = ({
  diagramId,
  excalidrawAPI,
  backendUrl = BACKEND_URL,
}: UseAiChatOptions) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "¡Hola! Escribí qué querés agregar, modificar o eliminar en el diagrama UML (ej: 'Crear clase Usuario con atributo email: String').",
      variant: "info",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const lastSentImageRef = useRef<{ file: File; instruction?: string } | null>(null);
  const inFlightRef = useRef<boolean>(false);
  const lastProcessedImagePayloadRef = useRef<{
    imageBase64: string;
    mimeType: string;
    instruction?: string;
    imageUrl: string;
  } | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);

  const handleSendInstruction = useCallback(
    async (customText?: string, options?: { source?: "voice" | "text" }) => {
      const textToSend = (customText ?? inputText).trim();
      if (!textToSend || loading) {
        return;
      }

      // 1. Agregar el mensaje del usuario a la lista
      const userMessage: Message = {
        id: createMessageId(),
        role: "user",
        text: textToSend,
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputText("");

      // 2. Poner loading en true
      setLoading(true);

      if (!diagramId) {
        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId(),
            role: "assistant",
            text: "No hay un diagrama activo seleccionado. Guardá o abrí un diagrama primero.",
            variant: "error",
          },
        ]);
        setLoading(false);
        return;
      }

      try {
        // 3. POST a /diagrams/:id/ai-edit con { instruction, (source si es voice) }
        const requestBody: { instruction: string; source?: "voice" } = {
          instruction: textToSend,
        };
        if (options?.source === "voice") {
          requestBody.source = "voice";
        }

        const response = await fetch(`${backendUrl}/diagrams/${diagramId}/ai-edit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });
        console.log(`[UC7 DEBUG] HTTP response: ${response.status}`); // TEMP UC7 DEBUG

        // Manejo de respuestas no exitosas
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);

          // 422: mensaje de error funcional del backend
          if (response.status === 422) {
            const errorMessage =
              errorData?.error?.message ||
              (typeof errorData?.error === "string" ? errorData.error : null) ||
              errorData?.message ||
              "No se pudo interpretar la instrucción, intentá reformularla.";

            setMessages((prev) => [
              ...prev,
              {
                id: createMessageId(),
                role: "assistant",
                text: errorMessage,
                variant: "error",
              },
            ]);
            return;
          }

          // 503, 429 y 504: mostrar el campo message devuelto por el backend
          if (
            response.status === 503 ||
            response.status === 429 ||
            response.status === 504
          ) {
            const messageText =
              errorData?.message ||
              (response.status === 503
                ? "El servicio de IA está temporalmente saturado. Intentá nuevamente en unos momentos."
                : response.status === 429
                ? "Se alcanzó temporalmente el límite de uso del servicio de IA. Intentá nuevamente más tarde."
                : "El servicio de IA tardó demasiado en responder. Intentá nuevamente.");

            setMessages((prev) => [
              ...prev,
              {
                id: createMessageId(),
                role: "assistant",
                text: messageText,
                variant: "error",
              },
            ]);
            return;
          }

          // Para cualquier respuesta inesperada (500, etc.)
          setMessages((prev) => [
            ...prev,
            {
              id: createMessageId(),
              role: "assistant",
              text: "Ocurrió un error al procesar la instrucción, intentá de nuevo.",
              variant: "error",
            },
          ]);
          return;
        }

        // Si la respuesta es 200 con { validOperations, warnings }
        const data = await response.json().catch(() => ({}));
        const validOperations = Array.isArray(data?.validOperations)
          ? data.validOperations
          : [];
        const warnings = Array.isArray(data?.warnings) ? data.warnings : [];
        console.log(`[UC7 DEBUG] Response JSON parsed - validOperations: ${validOperations.length}, warnings: ${warnings.length}`); // TEMP UC7 DEBUG

        const newAssistantMessages: Message[] = [];

        // Caso: validOperations vacío y warnings vacío
        if (validOperations.length === 0 && warnings.length === 0) {
          newAssistantMessages.push({
            id: createMessageId(),
            role: "assistant",
            text: "No encontré ningún cambio para aplicar a partir de esa instrucción.",
            variant: "info",
          });
        }

        // Caso: validOperations > 0 -> aplicar operaciones en Excalidraw
        if (validOperations.length > 0) {
          if (excalidrawAPI) {
            console.log("[UC7 DEBUG] Calling applyAiOperations"); // TEMP UC7 DEBUG
            const { applied, results } = applyAiOperations(validOperations, excalidrawAPI);
            console.log(`[UC7 DEBUG] applyAiOperations OK - applied: ${applied}`); // TEMP UC7 DEBUG
            for (const item of results) {
              newAssistantMessages.push({
                id: createMessageId(),
                role: "assistant",
                text: item.description,
                variant: item.status !== "skipped" ? "success" : "warning",
              });
            }
          } else {
            newAssistantMessages.push({
              id: createMessageId(),
              role: "assistant",
              text: "No se pudo acceder a la API del lienzo para aplicar los cambios.",
              variant: "error",
            });
          }
        }

        // Caso: warnings > 0 (independientemente de validOperations)
        if (warnings.length > 0) {
          for (const warning of warnings) {
            newAssistantMessages.push({
              id: createMessageId(),
              role: "assistant",
              text: warning,
              variant: "warning",
            });
          }
        }

        setMessages((prev) => [...prev, ...newAssistantMessages]);
        console.log("[UC7 DEBUG] Chat result messages added"); // TEMP UC7 DEBUG
      } catch (error) {
        // 6. Error de red u otro error no esperado
        console.error("[UC7 DEBUG] Frontend error:", error); // TEMP UC7 DEBUG
        // 6. Error de red u otro error no esperado
        console.error("[AiChat] Error de red o inesperado:", error);
        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId(),
            role: "assistant",
            text: "Ocurrió un error al procesar la instrucción, intentá de nuevo.",
            variant: "error",
          },
        ]);
      } finally {
        // 7. Poner loading en false y limpiar input
        setLoading(false);
      }
    },
    [backendUrl, diagramId, excalidrawAPI, inputText, loading],
  );

  const addCustomMessage = useCallback(
    (text: string, variant: MessageVariant = "info", role: MessageRole = "assistant") => {
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role,
          text,
          variant,
        },
      ]);
    },
    [],
  );

  const loadingMessage = isImageLoading
    ? "Leyendo la imagen... (puede tardar hasta 1 minuto)"
    : "Pensando...";

  /**
   * Ejecuta la petición de procesamiento de imagen al backend y gestiona la respuesta,
   * aplicando las operaciones sobre el lienzo y reportando errores o avisos.
   */
  const executeImageUploadRequest = useCallback(
    async (payload: {
      imageBase64: string;
      mimeType: string;
      instruction?: string;
    }) => {
      // 4. Enviar al endpoint de visión del backend
      const response = await postImageToBackend(
        diagramId!,
        {
          imageBase64: payload.imageBase64,
          mimeType: payload.mimeType,
          instruction: payload.instruction,
        },
        backendUrl,
      );

      // Manejo de respuestas no exitosas con mensajes de error propios para el flujo de imagen
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);

        // 400 con INVALID_IMAGE: mostrá el message del backend, retryable false
        if (response.status === 400) {
          const errorMessage =
            errorData?.message ||
            errorData?.error?.message ||
            (typeof errorData?.error === "string" ? errorData.error : null) ||
            "El archivo no es una imagen JPG, PNG o WEBP válida.";

          setMessages((prev) => [
            ...prev,
            {
              id: createMessageId(),
              role: "assistant",
              text: errorMessage,
              variant: "error",
              retryable: false,
            },
          ]);
          return;
        }

        // 429: La IA alcanzó su límite de uso. Esperá unos segundos y tocá Reintentar.
        if (response.status === 429) {
          setMessages((prev) => [
            ...prev,
            {
              id: createMessageId(),
              role: "assistant",
              text: "La IA alcanzó su límite de uso. Esperá unos segundos y tocá Reintentar.",
              variant: "error",
              retryable: true,
            },
          ]);
          return;
        }

        // 503: El servicio de IA está saturado. Tocá Reintentar en unos segundos.
        if (response.status === 503) {
          setMessages((prev) => [
            ...prev,
            {
              id: createMessageId(),
              role: "assistant",
              text: "El servicio de IA está saturado. Tocá Reintentar en unos segundos.",
              variant: "error",
              retryable: true,
            },
          ]);
          return;
        }

        // 504: La IA tardó demasiado en responder. Tocá Reintentar.
        if (response.status === 504) {
          setMessages((prev) => [
            ...prev,
            {
              id: createMessageId(),
              role: "assistant",
              text: "La IA tardó demasiado en responder. Tocá Reintentar.",
              variant: "error",
              retryable: true,
            },
          ]);
          return;
        }

        // 422: La IA no devolvió un resultado válido. Tocá Reintentar o probá con una foto más nítida.
        if (response.status === 422) {
          setMessages((prev) => [
            ...prev,
            {
              id: createMessageId(),
              role: "assistant",
              text: "La IA no devolvió un resultado válido. Tocá Reintentar o probá con una foto más nítida.",
              variant: "error",
              retryable: true,
            },
          ]);
          return;
        }

        // Cualquier otro error HTTP no contemplado: retryable true
        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId(),
            role: "assistant",
            text: "No pude procesar la imagen. Tocá Reintentar.",
            variant: "error",
            retryable: true,
          },
        ]);
        return;
      }

      // Si la respuesta es 200 con { validOperations, warnings }
      const data = await response.json().catch(() => ({}));
      const validOperations = Array.isArray(data?.validOperations)
        ? data.validOperations
        : [];
      const warnings = Array.isArray(data?.warnings) ? data.warnings : [];

      // Si validOperations viene vacío, mostrar los warnings con variant "warning" y terminar
      if (validOperations.length === 0) {
        const newAssistantMessages: Message[] = [];
        if (warnings.length > 0) {
          for (const warning of warnings) {
            newAssistantMessages.push({
              id: createMessageId(),
              role: "assistant",
              text: warning,
              variant: "warning",
            });
          }
        } else {
          newAssistantMessages.push({
            id: createMessageId(),
            role: "assistant",
            text: "No detecté ningún elemento en la imagen.",
            variant: "warning",
          });
        }
        setMessages((prev) => [...prev, ...newAssistantMessages]);
        return;
      }

      // Si hay validOperations, llamar a applyAiOperations(validOperations, excalidrawAPI)
      const newAssistantMessages: Message[] = [];

      if (excalidrawAPI) {
        const { applied, results } = applyAiOperations(validOperations, excalidrawAPI);

        let createdClasses = 0;
        let createdRelations = 0;
        const skippedMessages: Message[] = [];

        for (const item of results) {
          const isCreated = item.status === "applied" || (item.status as string) === "created";
          if (isCreated) {
            if (item.action === "createClass") {
              createdClasses++;
            } else if (item.action === "createRelation") {
              createdRelations++;
            }
          } else if (item.status === "skipped") {
            skippedMessages.push({
              id: createMessageId(),
              role: "assistant",
              text: item.reason || item.description,
              variant: "warning",
            });
          }
        }

        // Un solo mensaje variant "success": "Importé N clases y M relaciones desde la imagen"
        newAssistantMessages.push({
          id: createMessageId(),
          role: "assistant",
          text: `Importé ${createdClasses} clases y ${createdRelations} relaciones desde la imagen`,
          variant: "success",
        });

        // Luego un mensaje "warning" por cada resultado "skipped" con su reason
        newAssistantMessages.push(...skippedMessages);
      } else {
        newAssistantMessages.push({
          id: createMessageId(),
          role: "assistant",
          text: "No se pudo acceder a la API del lienzo para aplicar los cambios.",
          variant: "error",
        });
      }

      // Y luego un mensaje "warning" por cada warning del backend
      if (warnings.length > 0) {
        for (const warning of warnings) {
          newAssistantMessages.push({
            id: createMessageId(),
            role: "assistant",
            text: warning,
            variant: "warning",
          });
        }
      }

      setMessages((prev) => [...prev, ...newAssistantMessages]);
    },
    [backendUrl, diagramId, excalidrawAPI],
  );

  const handleSendImage = useCallback(
    async (file: File, instruction?: string) => {
      // Protección contra doble envío mediante ref síncrono y estado loading
      if (inFlightRef.current || loading) {
        return;
      }

      inFlightRef.current = true;
      lastSentImageRef.current = { file, instruction: instruction?.trim() };

      const userText = instruction?.trim() || "Imagen adjunta";
      const previewUrl = URL.createObjectURL(file);

      // 1. Agregar el mensaje del usuario con la imageUrl de la miniatura
      const userMessage: Message = {
        id: createMessageId(),
        role: "user",
        text: userText,
        imageUrl: previewUrl,
      };

      setMessages((prev) => [...prev, userMessage]);

      if (!diagramId) {
        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId(),
            role: "assistant",
            text: "No hay un diagrama activo seleccionado. Guardá o abrí un diagrama primero.",
            variant: "error",
            retryable: false,
          },
        ]);
        inFlightRef.current = false;
        return;
      }

      // 2. Activar estados de carga
      setIsImageLoading(true);
      setLoading(true);

      try {
        // 3. Preparar imagen (redimensionar a <= 1600px, EXIF, fondo blanco, JPEG 0.85)
        const { imageBase64, mimeType } = await prepareImageForUpload(file);

        // Guardar carga ya procesada para reintentos sin volver a reducir la imagen
        lastProcessedImagePayloadRef.current = {
          imageBase64,
          mimeType,
          instruction: instruction?.trim(),
          imageUrl: previewUrl,
        };

        await executeImageUploadRequest({
          imageBase64,
          mimeType,
          instruction: instruction?.trim(),
        });
      } catch (error: any) {
        console.error("[AiChat] Error al procesar imagen:", error);
        let errorText = "No pude procesar la imagen. Tocá Reintentar.";

        if (error?.name === "AbortError") {
          errorText = "La IA tardó demasiado en responder. Tocá Reintentar.";
        } else if (
          error instanceof TypeError ||
          error?.message?.includes("fetch") ||
          error?.message?.includes("NetworkError") ||
          error?.message?.includes("Failed to fetch")
        ) {
          errorText = "No pude conectarme con el servidor. Revisá la conexión y tocá Reintentar.";
        }

        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId(),
            role: "assistant",
            text: errorText,
            variant: "error",
            retryable: true,
          },
        ]);
      } finally {
        // Protección contra doble envío: inFlightRef vuelve a false en finally
        inFlightRef.current = false;
        setIsImageLoading(false);
        setLoading(false);
      }
    },
    [diagramId, executeImageUploadRequest, loading],
  );

  const handleRetryImage = useCallback(async () => {
    // Si no hay carga guardada o hay una petición en curso, salir sin hacer nada
    if (
      !lastProcessedImagePayloadRef.current ||
      inFlightRef.current ||
      loading
    ) {
      return;
    }

    if (!diagramId) {
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: "assistant",
          text: "No hay un diagrama activo seleccionado. Guardá o abrí un diagrama primero.",
          variant: "error",
          retryable: false,
        },
      ]);
      return;
    }

    inFlightRef.current = true;
    setIsImageLoading(true);
    setLoading(true);

    const saved = lastProcessedImagePayloadRef.current;

    try {
      // Repetir exactamente el envío con la carga ya guardada SIN agregar otro mensaje de usuario
      await executeImageUploadRequest({
        imageBase64: saved.imageBase64,
        mimeType: saved.mimeType,
        instruction: saved.instruction,
      });
    } catch (error: any) {
      console.error("[AiChat] Error al reintentar imagen:", error);
      let errorText = "No pude procesar la imagen. Tocá Reintentar.";

      if (error?.name === "AbortError") {
        errorText = "La IA tardó demasiado en responder. Tocá Reintentar.";
      } else if (
        error instanceof TypeError ||
        error?.message?.includes("fetch") ||
        error?.message?.includes("NetworkError") ||
        error?.message?.includes("Failed to fetch")
      ) {
        errorText = "No pude conectarme con el servidor. Revisá la conexión y tocá Reintentar.";
      }

      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: "assistant",
          text: errorText,
          variant: "error",
          retryable: true,
        },
      ]);
    } finally {
      inFlightRef.current = false;
      setIsImageLoading(false);
      setLoading(false);
    }
  }, [diagramId, executeImageUploadRequest, loading]);

  return {
    messages,
    loading,
    inputText,
    setInputText,
    handleSendInstruction,
    handleSendImage,
    handleRetryImage,
    isImageLoading,
    loadingMessage,
    lastSentImageRef,
    lastProcessedImagePayloadRef,
    addCustomMessage,
  };
};
