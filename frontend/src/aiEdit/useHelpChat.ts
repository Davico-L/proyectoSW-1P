import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { BACKEND_URL } from "../../excalidraw-app/data/backendSync";
import type { Message } from "./useAiChat";

export interface HelpTopic {
  id: string;
  question: string;
  answer: string;
}

export const SUGGESTED_TOPIC_IDS = [
  "asistente",
  "crear-clase",
  "crear-relacion",
  "compartir",
  "ia-voz",
  "generar-backend",
] as const;

const createMessageId = (): string =>
  `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export function useHelpChat(backendUrl: string = BACKEND_URL) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "¡Hola! Soy el asistente de ayuda. Tocá una pregunta sugerida o escribí la tuya.",
    },
  ]);
  const [loading, setLoading] = useState<boolean>(false);
  const inFlightRef = useRef<boolean>(false);

  const [topics, setTopics] = useState<HelpTopic[]>([]);
  const [askedTopicIds, setAskedTopicIds] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchTopics = async () => {
      try {
        const response = await fetch(`${backendUrl}/help/topics`);
        if (response.ok) {
          const data = await response.json();
          if (isMounted && Array.isArray(data?.topics)) {
            setTopics(data.topics);
          }
        }
      } catch {
        // Si falla, dejá la lista vacía sin mostrar error ni romper el hook
      }
    };

    fetchTopics();

    return () => {
      isMounted = false;
    };
  }, [backendUrl]);

  const askPrepared = useCallback(
    (topicId: string) => {
      if (loading || inFlightRef.current) {
        return;
      }

      const topic = topics.find((t) => t.id === topicId);
      if (!topic) {
        return;
      }

      const userMessage: Message = {
        id: createMessageId(),
        role: "user",
        text: topic.question,
      };

      const assistantMessage: Message = {
        id: createMessageId(),
        role: "assistant",
        text: topic.answer,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setAskedTopicIds((prev) =>
        prev.includes(topicId) ? prev : [...prev, topicId],
      );
    },
    [loading, topics],
  );

  const suggestedTopics = useMemo(
    () =>
      SUGGESTED_TOPIC_IDS.filter((id) => !askedTopicIds.includes(id))
        .map((id) => topics.find((t) => t.id === id))
        .filter((t): t is HelpTopic => t !== undefined),
    [topics, askedTopicIds],
  );

  const moreTopics = useMemo(
    () =>
      topics.filter(
        (t) =>
          !SUGGESTED_TOPIC_IDS.includes(t.id as any) &&
          !askedTopicIds.includes(t.id),
      ),
    [topics, askedTopicIds],
  );

  const sendQuestion = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }

      if (inFlightRef.current || loading) {
        return;
      }

      if (trimmed.length > 500) {
        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId(),
            role: "assistant",
            text: "La pregunta es demasiado larga (máximo 500 caracteres).",
            variant: "warning",
          },
        ]);
        return;
      }

      inFlightRef.current = true;
      setLoading(true);

      const userMessage: Message = {
        id: createMessageId(),
        role: "user",
        text: trimmed,
      };

      setMessages((prev) => [...prev, userMessage]);

      const history = messages
        .filter(
          (m) =>
            m.id !== "welcome" &&
            m.variant !== "warning" &&
            m.variant !== "error",
        )
        .slice(-6)
        .map((m) => ({
          role: m.role,
          content: m.text.slice(0, 500),
        }));

      try {
        let sessionId = "";
        try {
          sessionId =
            localStorage.getItem("classdraw_session_id") ||
            localStorage.getItem("active_session_id") ||
            "";
        } catch {
          sessionId = "";
        }

        const response = await fetch(`${backendUrl}/help/ask`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-session-id": sessionId,
          },
          body: JSON.stringify({
            question: trimmed,
            history,
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as { answer: string };
          setMessages((prev) => [
            ...prev,
            {
              id: createMessageId(),
              role: "assistant",
              text: data.answer,
            },
          ]);
          return;
        }

        if (response.status === 401) {
          try {
            localStorage.removeItem("classdraw_session_id");
            localStorage.removeItem("active_session_id");
            localStorage.removeItem("active_session_username");
            localStorage.removeItem("active_diagram_id");
          } catch {
            // ignore storage errors
          }
          try {
            window.dispatchEvent(new CustomEvent("session-invalid"));
          } catch {
            // ignore dispatch errors
          }

          setMessages((prev) => [
            ...prev,
            {
              id: createMessageId(),
              role: "assistant",
              text: "Tu sesión expiró. Volvé a iniciar sesión.",
              variant: "error",
            },
          ]);
          return;
        }

        if (
          response.status === 429 ||
          response.status === 503 ||
          response.status === 504
        ) {
          const errorData = await response.json().catch(() => null);
          const defaultMsg =
            response.status === 429
              ? "Se alcanzó temporalmente el límite de uso del servicio de IA. Intentá nuevamente más tarde."
              : response.status === 503
              ? "El servicio de IA está temporalmente saturado. Intentá nuevamente en unos momentos."
              : "El servicio de IA tardó demasiado en responder. Intentá nuevamente.";
          const messageText = errorData?.message || defaultMsg;

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

        if (response.status === 422) {
          const errorData = await response.json().catch(() => null);
          const errorMessage =
            (typeof errorData?.error === "string"
              ? errorData.error
              : errorData?.error?.message) ||
            errorData?.message ||
            "No se pudo procesar la pregunta.";

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

        if (response.status === 400) {
          const errorData = await response.json().catch(() => null);
          const errorMessage =
            (typeof errorData?.error === "string"
              ? errorData.error
              : errorData?.error?.message) ||
            errorData?.message ||
            "La pregunta debe tener entre 1 y 500 caracteres.";

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

        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId(),
            role: "assistant",
            text: "No se pudo obtener una respuesta, intentá nuevamente.",
            variant: "error",
          },
        ]);
      } catch (error: any) {
        console.error(
          "[useHelpChat] Error en la petición de ayuda:",
          error?.name || "NetworkError",
        );

        const isNetworkError =
          error instanceof TypeError ||
          error?.name === "NetworkError" ||
          error?.message?.includes("fetch") ||
          error?.message?.includes("NetworkError") ||
          error?.message?.includes("Failed to fetch");

        const text = isNetworkError
          ? "No se pudo conectar con el servidor, intentá nuevamente."
          : "No se pudo obtener una respuesta, intentá nuevamente.";

        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId(),
            role: "assistant",
            text,
            variant: "error",
          },
        ]);
      } finally {
        setLoading(false);
        inFlightRef.current = false;
      }
    },
    [backendUrl, loading, messages],
  );

  return {
    messages,
    loading,
    sendQuestion,
    askPrepared,
    suggestedTopics,
    moreTopics,
  };
}
