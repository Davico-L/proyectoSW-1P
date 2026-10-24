# Tarea Actual: Coordinación de IA

Este documento refleja en tiempo real la tarea activa que está ejecutando el asistente de IA y su estado de avance.

---

## Tarea en Curso

- **Identificador**: TSK-023
- **Nombre**: CU-Auth Fase 5b: Deshabilitar POST /session respondiendo HTTP 410 Gone
- **Fecha de Inicio**: 2026-10-24
- **Estado**: Completada
- **Objetivo**: Modificar ÚNICAMENTE sessionRoutes.ts y app.ts (texto informativo). En sessionRoutes.ts responder 410 Gone en POST / con mensaje claro. En app.ts actualizar endpoints en GET / a GET /session/:id y /auth. Typecheck, build y pruebas de backend limpios.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-022
- **Nombre**: CU-Collab Fase C2: Reconciliación de elementos remotos en App.tsx con reconcileElements
- **Fecha de Inicio**: 2026-10-24
- **Estado**: Completada

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
