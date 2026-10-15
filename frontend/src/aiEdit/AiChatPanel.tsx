import React, { useRef, useEffect, useState } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useAiChat, type Message } from "./useAiChat";
import { useSpeechRecognition } from "./useSpeechRecognition";
import "./AiChat.scss";

export interface AiChatPanelProps {
  diagramId: string | null;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onClose: () => void;
  backendUrl?: string;
}

export const AiChatPanel: React.FC<AiChatPanelProps> = ({
  diagramId,
  excalidrawAPI,
  onClose,
  backendUrl,
}) => {
  const {
    messages,
    loading,
    inputText,
    setInputText,
    handleSendInstruction,
    addCustomMessage,
  } = useAiChat({ diagramId, excalidrawAPI, backendUrl });

  // Hook de reconocimiento de voz configurado en es-BO
  const {
    isSupported,
    status: speechStatus,
    interimText,
    finalText,
    error: speechError,
    start: startSpeech,
    stop: stopSpeech,
    reset: resetSpeech,
  } = useSpeechRecognition({ lang: "es-BO" });

  const isListening = speechStatus === "listening";

  // Almacena el texto que tenía el cuadro antes de empezar a dictar
  const [baseText, setBaseText] = useState<string>("");

  // Indica si el contenido actual proviene de dictado de voz
  const isVoiceActiveRef = useRef<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll hacia el final cuando se agrega un mensaje o cambia el estado de carga
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Enfocar el textarea al abrir el panel
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Detener la escucha al cerrar el panel
  const handleClose = () => {
    if (isListening) {
      stopSpeech();
    }
    resetSpeech();
    onClose();
  };

  // Manejo de errores de voz como mensajes en el chat
  useEffect(() => {
    if (!speechError) {
      return;
    }

    let errorMessageText = "No se pudo iniciar el dictado, intentá de nuevo o escribí la instrucción.";
    switch (speechError) {
      case "not-allowed":
        errorMessageText = "Necesito acceso al micrófono para escucharte. Habilitalo en el navegador.";
        break;
      case "no-speech":
        errorMessageText = "No escuché nada, intentá de nuevo.";
        break;
      case "network":
        errorMessageText = "No se pudo usar el dictado por voz (error de red o navegador no compatible, por ejemplo Brave). Probá en Chrome o Edge, o escribí la instrucción.";
        break;
      case "audio-capture":
        errorMessageText = "No encontré un micrófono disponible.";
        break;
      default:
        errorMessageText = "No se pudo iniciar el dictado, intentá de nuevo o escribí la instrucción.";
        break;
    }

    addCustomMessage(errorMessageText, "error");
  }, [speechError, addCustomMessage]);

  // Manejo de transcripción final: fusionar con baseText y actualizar inputText
  useEffect(() => {
    if (finalText) {
      const combined = baseText
        ? `${baseText.trim()} ${finalText.trim()}`
        : finalText.trim();
      setInputText(combined);
      isVoiceActiveRef.current = true;
    }
  }, [finalText, baseText, setInputText]);

  // Handler para iniciar o detener el dictado con el botón de micrófono
  const handleToggleVoice = () => {
    if (loading || !isSupported) {
      return;
    }

    if (isListening) {
      stopSpeech();
    } else {
      // Guardar el texto actual como base
      setBaseText(inputText);
      resetSpeech();
      startSpeech();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);
    // Si el cuadro queda vacío, se desactiva el indicador de voz
    if (val.trim() === "") {
      isVoiceActiveRef.current = false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      // Si está escuchando, detener la escucha y NO enviar todavía
      if (isListening) {
        stopSpeech();
        return;
      }

      const sourceToSend = isVoiceActiveRef.current ? "voice" : "text";
      isVoiceActiveRef.current = false;
      resetSpeech();
      handleSendInstruction(undefined, { source: sourceToSend });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Si está escuchando, detener la escucha y NO enviar todavía
    if (isListening) {
      stopSpeech();
      return;
    }

    const sourceToSend = isVoiceActiveRef.current ? "voice" : "text";
    isVoiceActiveRef.current = false;
    resetSpeech();
    handleSendInstruction(undefined, { source: sourceToSend });
  };

  // Valor a mostrar en el textarea: mientras escucha con texto parcial, muestra base + parcial
  const displayValue = isListening && interimText
    ? baseText
      ? `${baseText.trim()} ${interimText}`
      : interimText
    : inputText;

  return (
    <div className="ai-chat-panel" role="dialog" aria-label="Asistente de edición IA">
      {/* Header */}
      <div className="ai-chat-header">
        <div className="ai-chat-header-title">
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 2L13.8 7.2L19 9L13.8 10.8L12 16L10.2 10.8L5 9L10.2 7.2L12 2Z" />
            <path d="M19 15L20 18L23 19L20 20L19 23L18 20L15 19L18 18L19 15Z" />
            <path d="M5 16L5.8 18.2L8 19L5.8 19.8L5 22L4.2 19.8L2 19L4.2 18.2L5 16Z" />
          </svg>
          <span>Asistente Copilot UML</span>
        </div>
        <button
          type="button"
          className="ai-chat-close-btn"
          onClick={handleClose}
          aria-label="Cerrar panel de chat"
          title="Cerrar"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Lista de mensajes */}
      <div className="ai-chat-messages">
        {messages.map((msg: Message) => {
          const isUser = msg.role === "user";
          const variantClass = !isUser && msg.variant ? `variant-${msg.variant}` : "variant-info";

          return (
            <div
              key={msg.id}
              className={`ai-chat-msg ${
                isUser ? "ai-chat-msg--user" : `ai-chat-msg--assistant ${variantClass}`
              }`}
            >
              {msg.text}
            </div>
          );
        })}

        {/* Indicador de carga temporal del asistente */}
        {loading && (
          <div className="ai-chat-msg ai-chat-msg--assistant variant-info">
            <div className="ai-chat-loading-indicator">
              <div className="ai-chat-spinner" />
              <span>Pensando...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Indicador visual de escucha activa */}
      {isListening && (
        <div className="ai-chat-voice-status">
          <div className="ai-chat-voice-dot" />
          <span>Escuchando…</span>
        </div>
      )}

      {/* Input de texto con botón de micrófono y botón de enviar */}
      <form className="ai-chat-input-area" onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          rows={2}
          value={displayValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={
            isListening
              ? "Dictá tu instrucción..."
              : "Escribí una instrucción (Enter para enviar, Shift+Enter para salto de línea)..."
          }
          disabled={loading}
          aria-label="Instrucción para el asistente"
        />

        {/* Botón de micrófono */}
        <button
          type="button"
          className={`ai-chat-mic-btn ${isListening ? "is-listening" : ""}`}
          onClick={handleToggleVoice}
          disabled={loading || !isSupported}
          title={
            !isSupported
              ? "Tu navegador no soporta dictado por voz; usá el chat de texto"
              : isListening
              ? "Detener dictado por voz"
              : "Dictar instrucción por voz"
          }
          aria-label={
            !isSupported
              ? "Dictado no soportado"
              : isListening
              ? "Detener dictado"
              : "Iniciar dictado por voz"
          }
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>

        {/* Botón de enviar */}
        <button
          type="submit"
          className="ai-chat-send-btn"
          disabled={loading || !displayValue.trim()}
          title="Enviar instrucción"
          aria-label="Enviar"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </div>
  );
};
