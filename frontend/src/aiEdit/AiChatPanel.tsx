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
    handleSendImage,
    handleRetryImage,
    loadingMessage,
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

  // Estado local para adjuntar imagen y mensajes de validación
  const [attachedImage, setAttachedImage] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);

  const previewUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Liberar URL de vista previa al desmontar el componente
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  // Constantes de validación para imágenes
  const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const MAX_IMAGE_SIZE = 15 * 1024 * 1024; // 15 MB

  const validateAndAttachFile = (file: File) => {
    const isMimeValid = ALLOWED_MIME_TYPES.includes(file.type) || file.type === "image/jpg";
    const isExtValid = /\.(jpe?g|png|webp)$/i.test(file.name);

    if (!isMimeValid && !isExtValid) {
      setAttachError("Elegí una imagen JPG, PNG o WEBP");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setAttachError("La imagen pesa demasiado (máx. 15 MB)");
      return;
    }

    // Revocar URL previa si existe
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    const previewUrl = URL.createObjectURL(file);
    previewUrlRef.current = previewUrl;
    setAttachedImage({ file, previewUrl });
    setAttachError(null);
  };

  const handleRemoveImage = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setAttachedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAttachClick = () => {
    if (loading) {
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    validateAndAttachFile(file);
    e.target.value = "";
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    let imageFile: File | null = null;

    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            imageFile = file;
            break;
          }
        }
      }
    }

    if (!imageFile && e.clipboardData?.files) {
      for (let i = 0; i < e.clipboardData.files.length; i++) {
        const file = e.clipboardData.files[i];
        if (file.type.startsWith("image/")) {
          imageFile = file;
          break;
        }
      }
    }

    if (imageFile) {
      e.preventDefault();
      e.stopPropagation();

      if (!loading) {
        validateAndAttachFile(imageFile);
      }
    }
  };

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

      if (attachedImage) {
        const fileToSend = attachedImage.file;
        const textToSend = inputText;
        handleRemoveImage();
        setInputText("");
        handleSendImage(fileToSend, textToSend);
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

    if (attachedImage) {
      const fileToSend = attachedImage.file;
      const textToSend = inputText;
      handleRemoveImage();
      setInputText("");
      handleSendImage(fileToSend, textToSend);
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
        {messages.map((msg: Message, index: number) => {
          const isUser = msg.role === "user";
          const variantClass = !isUser && msg.variant ? `variant-${msg.variant}` : "variant-info";
          const isLastMessage = index === messages.length - 1;
          const showRetry = isLastMessage && !isUser && msg.retryable && !loading;

          return (
            <div
              key={msg.id}
              className={`ai-chat-msg ${
                isUser ? "ai-chat-msg--user" : `ai-chat-msg--assistant ${variantClass}`
              }`}
            >
              {isUser && msg.imageUrl && (
                <div className="ai-chat-msg-image">
                  <img
                    src={msg.imageUrl}
                    alt="Miniatura adjunta"
                    className="ai-chat-msg-thumb"
                  />
                </div>
              )}
              <div className="ai-chat-msg-text">{msg.text}</div>
              {showRetry && (
                <div className="ai-chat-msg-actions">
                  <button
                    type="button"
                    className="ai-chat-retry-btn"
                    onClick={handleRetryImage}
                    disabled={loading}
                    title="Reintentar procesamiento de la imagen"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="23 4 23 10 17 10" />
                      <polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    <span>Reintentar</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Indicador de carga temporal del asistente */}
        {loading && (
          <div className="ai-chat-msg ai-chat-msg--assistant variant-info">
            <div className="ai-chat-loading-indicator">
              <div className="ai-chat-spinner" />
              <span>{loadingMessage || "Pensando..."}</span>
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

      {/* Vista previa de imagen adjunta y/o error de validación */}
      {(attachedImage || attachError) && (
        <div className="ai-chat-attach-preview-container">
          {attachError && (
            <div className="ai-chat-attach-error" role="alert">
              {attachError}
            </div>
          )}
          {attachedImage && (
            <div className="ai-chat-attach-preview">
              <img
                src={attachedImage.previewUrl}
                alt={attachedImage.file.name || "Miniatura de imagen adjunta"}
                className="ai-chat-attach-thumb"
              />
              <button
                type="button"
                className="ai-chat-attach-remove-btn"
                onClick={handleRemoveImage}
                disabled={loading}
                title="Quitar imagen"
                aria-label="Quitar imagen adjunta"
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
          )}
        </div>
      )}

      {/* Input de texto con botones de acción */}
      <form className="ai-chat-input-area" onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          rows={2}
          value={displayValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            isListening
              ? "Dictá tu instrucción..."
              : "Escribí una instrucción (Enter para enviar, Shift+Enter para salto de línea)..."
          }
          disabled={loading}
          aria-label="Instrucción para el asistente"
        />

        {/* Input de archivo oculto para adjuntar imagen (sin atributo capture para permitir cámara o galería) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: "none" }}
          onChange={handleFileInputChange}
          disabled={loading}
          tabIndex={-1}
        />

        {/* Botón de adjuntar imagen */}
        <button
          type="button"
          className="ai-chat-attach-btn"
          onClick={handleAttachClick}
          disabled={loading}
          title="Adjuntar imagen (JPG, PNG o WEBP)"
          aria-label="Adjuntar imagen"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>

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
          disabled={loading || (!displayValue.trim() && !attachedImage)}
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
