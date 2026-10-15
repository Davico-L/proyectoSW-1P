import { useState, useRef, useEffect, useCallback } from "react";

// Declaración local de tipos para la Web Speech API sin instalar librerías externas
export type SpeechRecognitionErrorCode =
  | "not-allowed"
  | "no-speech"
  | "network"
  | "audio-capture"
  | "unknown";

export type SpeechRecognitionStatus = "idle" | "listening" | "error";

interface SpeechRecognitionHookOptions {
  lang?: string;
}

interface SpeechRecognitionHookResult {
  isSupported: boolean;
  status: SpeechRecognitionStatus;
  interimText: string;
  finalText: string;
  error: SpeechRecognitionErrorCode | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

// Interfaces mínimas de Web Speech API
interface IWindowWithSpeech extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export const useSpeechRecognition = (
  options: SpeechRecognitionHookOptions = {}
): SpeechRecognitionHookResult => {
  const { lang = "es-BO" } = options;

  const [status, setStatus] = useState<SpeechRecognitionStatus>("idle");
  const [interimText, setInterimText] = useState<string>("");
  const [finalText, setFinalText] = useState<string>("");
  const [error, setError] = useState<SpeechRecognitionErrorCode | null>(null);

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);

  // Detección de soporte en el navegador
  const isSupported =
    typeof window !== "undefined" &&
    Boolean(
      (window as IWindowWithSpeech).SpeechRecognition ||
        (window as IWindowWithSpeech).webkitSpeechRecognition
    );

  const mapErrorCode = (nativeError: string): SpeechRecognitionErrorCode => {
    switch (nativeError) {
      case "not-allowed":
      case "service-not-allowed":
        return "not-allowed";
      case "no-speech":
        return "no-speech";
      case "network":
        return "network";
      case "audio-capture":
        return "audio-capture";
      default:
        return "unknown";
    }
  };

  const stop = useCallback(() => {
    if (recognitionRef.current && isListeningRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn("[UC8 DEBUG] Error calling recognition.stop():", err);
      }
    }
  }, []);

  const reset = useCallback(() => {
    stop();
    setInterimText("");
    setFinalText("");
    setError(null);
    setStatus("idle");
  }, [stop]);

  const start = useCallback(() => {
    if (!isSupported) {
      console.warn("[UC8 DEBUG] SpeechRecognition is not supported in this browser.");
      return;
    }

    // Si ya está escuchando, no reiniciar innecesariamente
    if (isListeningRef.current) {
      return;
    }

    try {
      const SpeechRecognitionConstructor =
        (window as IWindowWithSpeech).SpeechRecognition ||
        (window as IWindowWithSpeech).webkitSpeechRecognition;

      const recognition = new SpeechRecognitionConstructor();
      recognition.lang = lang;
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        isListeningRef.current = true;
        setStatus("listening");
        setError(null);
        setInterimText("");
        setFinalText("");
        console.log(`[UC8 DEBUG] Speech recognition started (lang: ${lang})`);
      };

      recognition.onresult = (event: any) => {
        let currentInterim = "";
        let currentFinal = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            currentFinal += transcript;
          } else {
            currentInterim += transcript;
          }
        }

        if (currentInterim) {
          console.log(`[UC8 DEBUG] Interim transcript: "${currentInterim}"`);
          setInterimText(currentInterim);
        }

        if (currentFinal) {
          console.log(`[UC8 DEBUG] Final transcript: "${currentFinal}"`);
          setFinalText((prev) => (prev ? `${prev} ${currentFinal}` : currentFinal));
          setInterimText("");
        }
      };

      recognition.onerror = (event: any) => {
        const mappedError = mapErrorCode(event.error);
        console.error(`[UC8 DEBUG] Recognition error: ${event.error} -> mapped to: ${mappedError}`);
        setError(mappedError);
        setStatus("error");
      };

      recognition.onend = () => {
        isListeningRef.current = false;
        setStatus((prev) => (prev === "error" ? "error" : "idle"));
        console.log("[UC8 DEBUG] Speech recognition ended");
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error("[UC8 DEBUG] Exception starting recognition:", err);
      setError("unknown");
      setStatus("error");
      isListeningRef.current = false;
    }
  }, [isSupported, lang]);

  // Limpieza al desmontar el componente para evitar micrófonos abiertos
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
          console.log("[UC8 DEBUG] Recognition aborted on unmount");
        } catch {
          // Ignorar si ya estaba cerrado
        }
      }
    };
  }, []);

  return {
    isSupported,
    status,
    interimText,
    finalText,
    error,
    start,
    stop,
    reset,
  };
};
