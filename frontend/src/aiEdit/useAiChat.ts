import { useState, useCallback } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { BACKEND_URL } from "../../excalidraw-app/data/backendSync";
import { applyAiOperations } from "./applyAiOperations";

export type MessageRole = "user" | "assistant";
export type MessageVariant = "success" | "warning" | "error" | "info";

export interface Message {
  id: string;
  role: MessageRole;
  text: string;
  variant?: MessageVariant;
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

  const handleSendInstruction = useCallback(
    async (customText?: string) => {
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
        // 3. POST a /diagrams/:id/ai-edit con { instruction }
        const response = await fetch(`${backendUrl}/diagrams/${diagramId}/ai-edit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ instruction: textToSend }),
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

  return {
    messages,
    loading,
    inputText,
    setInputText,
    handleSendInstruction,
  };
};
