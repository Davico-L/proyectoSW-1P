# Tarea Actual: Coordinación de IA

Este documento refleja en tiempo real la tarea activa que está ejecutando el asistente de IA y su estado de avance.

---

## Tarea en Curso

- **Identificador**: TSK-010
- **Nombre**: CU9 Fase 3d: Botón Reintentar y errores específicos para el flujo de imágenes
- **Fecha de Inicio**: 2026-10-22
- **Estado**: Completada
- **Objetivo**: Implementar reintento y manejo de errores específico para el flujo de imágenes:
  - Cambios estrictamente aditivos en `useAiChat.ts`: agregar `retryable?: boolean` a `Message`, ref síncrono `inFlightRef`, ref de última carga procesada `{ imageBase64, mimeType, instruction, imageUrl }`, función `handleRetryImage()`, indicador de carga dinámico (`loadingMessage` o similar, "Leyendo la imagen... (puede tardar hasta 1 minuto)"), y mensajes de error específicos con `retryable: true` o `false`.
  - En `AiChatPanel.tsx`: mostrar botón "Reintentar" solo en el último mensaje de la lista si es del asistente con `retryable === true` y `loading === false`, y reflejar el texto del indicador de carga dinámico.
  - En `AiChat.scss`: estilos para el botón de reintento.

---

## Alcance y Reglas Operativas

- [x] Consulta de directrices en `GEMINI.md`, `frontend/AGENTS.md`, `CONTEXTO.md` y `ESTADO_ACTUAL.md`.
- [ ] Modificación de `useAiChat.ts` estrictamente aditiva (0 líneas borradas o modificadas):
  - Añadir `retryable?: boolean;` al tipo `Message`.
  - Crear `inFlightRef` para evitar doble envío en `handleSendImage` y `handleRetryImage`.
  - Crear `lastProcessedImagePayloadRef` con `{ imageBase64, mimeType, instruction, imageUrl }`.
  - Crear estado o getter para el indicador de espera dinámico ("Leyendo la imagen... (puede tardar hasta 1 minuto)" vs "Pensando...").
  - Mapeo de errores para imágenes: 429, 503, 504/timeout, 422, fallo de red/conexión, 400 INVALID_IMAGE, diagrama no seleccionado, y errores generales.
  - Implementar y exportar `handleRetryImage()`.
- [ ] Actualización de `AiChatPanel.tsx`:
  - Mostrar botón "Reintentar" solo en el último mensaje si `msg.role === 'assistant' && msg.retryable && !loading`.
  - Conectar el click a `handleRetryImage`.
  - Renderizar el texto dinámico de carga en el spinner.
- [ ] Actualización de `AiChat.scss`:
  - Botón `.ai-chat-retry-btn` acorde al diseño (pequeño, secundario).
- [ ] Verificación de compilación limpia del frontend (`tsc` y `yarn build`).
