# Registro de Resultados: Coordinación de IA

Este documento recopila los resultados, entregables verificados y métricas de avance de las tareas completadas por el sistema de coordinación de IA.

---

## Estructura de Registro (Plantilla)

### [RES-XXX] Título del Resultado / Entrega
- **Fecha**: AAAA-MM-DD
- **Tarea Asociada**: [Identificador de Tarea]
- **Entregables Producidos**:
  - Lista de archivos creados, modificados o artefactos generados.
- **Verificación Realizada**:
  - Pruebas ejecutadas, comandos de validación o inspecciones realizadas.
- **Notas y Observaciones**:
  - Comentarios adicionales o consideraciones para tareas posteriores.

---

## Historial de Resultados

### [RES-001] Creación del Sistema Base de Coordinación Documental
- **Fecha**: 2026-10-16
- **Tarea Asociada**: TSK-001
- **Entregables Producidos**:
  - Carpeta `coordinacion-ia/`
  - `CONTEXTO.md`: Resumen técnico y funcional del sistema ClassDrawSW verificado en el repositorio.
  - `ESTADO_ACTUAL.md`: Diagnóstico categorizado en Implementado, Parcial, Pendiente y Desconocido.
  - `DECISIONES.md`: Plantilla mínima para registro de decisiones.
  - `TAREA_ACTUAL.md`: Estado y seguimiento de la tarea activa.
  - `RESULTADOS.md`: Estructura para documentación de resultados y entregables.
  - `ERRORES.md`: Plantilla para registro y resolución de incidentes.
- **Verificación Realizada**:
  - Inspección exhaustiva en modo lectura de `backend/`, `frontend/`, `mobile-template/`, `docs/` y configuración del repositorio.
  - Confirmación de integridad: cero modificaciones en archivos preexistentes, dependencias o base de datos.
  - Cero inclusión de secretos o datos sensibles.
- **Notas y Observaciones**:
  - Fase estrictamente documental completada; a la espera de aprobación del usuario para la siguiente etapa.

### [RES-002] Configuración y Verificación del Mecanismo Persistente (Fase 2)
- **Fecha**: 2026-10-16
- **Tarea Asociada**: TSK-002
- **Entregables Producidos**:
  - `GEMINI.md`: Archivo de directrices y reglas persistentes ubicado en la raíz (`D:\proyectoSW-1P\GEMINI.md`).
  - `coordinacion-ia/TAREA_ACTUAL.md`: Actualizado con el ciclo de la Fase 2.
  - `coordinacion-ia/RESULTADOS.md`: Actualizado con el registro histórico de RES-002.
- **Verificación Realizada**:
  - Inspección de `agy-customizations` confirmando soporte nativo de reglas jerárquicas mediante `GEMINI.md` a nivel de repositorio.
  - Comprobación de alcance: `GEMINI.md` en la raíz cubre el directorio raíz, `backend/`, `frontend/`, `mobile-template/` y `coordinacion-ia/`.
  - Verificación de no-conflicto con `frontend/AGENTS.md` (específico de Excalidraw) y preservación total de archivos preexistentes.
### [RES-003] Creación del Servicio de Visión Diagrama (Fase 2a - UC9)
- **Fecha**: 2026-10-17
- **Tarea Asociada**: TSK-004
- **Entregables Producidos**:
  - `backend/src/services/visionDiagram.ts`: Servicio independiente que exporta `diagramFromImage` con SDK `@google/genai`, esquema estructurado (`createClass`, `createRelation`, `ambiguities`), soporte para `VISION_MODEL` y `VISION_FALLBACK_MODEL`, fallback en paralelo con carrera a los 15s, reintentos exponenciales con jitter (1s, 2s, 4s) para 429/503/overload, normalización de identificadores a camelCase y formato estándar de errores de UC7.
- **Verificación Realizada**:
  - Ejecución de `npm run typecheck` (`tsc --noEmit`) en `backend/`: exitoso sin errores (código de salida 0).
  - Ejecución de `npm run build` (`tsc`) en `backend/`: exitoso sin errores (código de salida 0).
  - Verificación de no-alteración: ningún archivo existente (`diagramRoutes.ts`, `gemini.ts`, `groq.ts`, `operationValidator.ts`, etc.) fue modificado.
- **Notas y Observaciones**:
### [RES-004] Creación del Endpoint POST /diagrams/:id/ai-from-image (Fase 2b - UC9)
- **Fecha**: 2026-10-17
- **Tarea Asociada**: TSK-005
- **Entregables Producidos**:
  - `backend/src/routes/aiVisionRoutes.ts`: Controlador del nuevo endpoint con validación de payload (MIME type, decodificación base64 <= 8MB, instrucción recortada a 500 chars), integración con `visionDiagram.ts`, detección de diagramas vacíos, deduplicación de clases y relaciones, reordenamiento e inyección de clave primaria `id` (con `UC9_AUTO_ID`), validación con `validateAndResolveOperations`, filtrado de ambigüedades genéricas (máx 6) con prefijo "Foto: " y logs `[UC9 DEBUG]`.
  - `backend/src/routes/diagramRoutes.ts`: Registro de la nueva ruta `diagramRouter.post("/:id/ai-from-image", handleAiFromImage)` en una única línea aditiva más su import.
- **Verificación Realizada**:
  - Ejecución de `npm run typecheck` en `backend/`: exitoso (código 0, 0 errores).
  - Ejecución de `npm run build` en `backend/`: compilación limpia y completa hacia `dist/` (código 0).
- **Notas y Observaciones**:
  - `ai-edit` no fue modificado; el nuevo endpoint es completamente independiente y aditivo.

### [RES-005] Validación de Magic Bytes y Contenido de Imágenes (CU9 Fase 2b)
- **Fecha**: 2026-10-17
- **Tarea Asociada**: TSK-006
- **Entregables Producidos**:
  - `backend/src/routes/aiVisionRoutes.ts`: Se agregaron las funciones `detectImageMimeType` e `isValidBase64`. Se incorporó la validación estricta de firma binaria (JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`, WEBP `RIFF...WEBP`) y de Base64 bien formado, respondiendo HTTP 400 con `{"error":"INVALID_IMAGE","message":"El archivo no es una imagen JPG, PNG o WEBP válida."}` ante PDFs disfrazados, discrepancias de MIME o cadenas Base64 corruptas, sin invocar a Gemini.
  - `backend/src/scripts/testImageValidation.ts`: Suite de pruebas automatizadas con 13 casos cubriendo detección de formatos, rechazo de PDFs y buffers corruptos, validación de Base64 y respuestas HTTP 400 del handler.
- **Verificación Realizada**:
  - Ejecución de `npx tsx src/scripts/testImageValidation.ts`: 13/13 pruebas superadas exitosamente.
  - Ejecución de `npm run typecheck` (`tsc --noEmit`): exitoso sin errores (código 0).
  - Ejecución de `npm run build` (`tsc`): compilación limpia a `dist/` (código 0).
  - Verificación de no-alteración: `visionDiagram.ts`, `diagramRoutes.ts` (salvo el registro previo), `operationValidator.ts`, `applyAiOperations.ts`, generadores y XMI permanecieron intactos.
- **Notas y Observaciones**:
  - No se generaron solicitudes a Gemini ni alteraciones a la base de datos durante las pruebas.

### [RES-006] Incorporación de Adjunto de Imagen en Frontend del Asistente (CU9 Fase 3a)
- **Fecha**: 2026-10-22
- **Tarea Asociada**: TSK-007
- **Entregables Producidos**:
  - `frontend/src/aiEdit/AiChatPanel.tsx`: Implementación del estado local `attachedImage` y `attachError`, input file oculto para JPG/PNG/WEBP (sin atributo `capture` para soporte en móviles), botón de adjuntar (36×36, clip SVG) a la izquierda del micrófono, validación de tipo y peso (máx. 15 MB), miniatura (~64px) con botón X para remoción, revocación controlada de ObjectURL (al remover, reemplazar o desmontar el componente con `useEffect`), evento `onPaste` en `<textarea>` que detecta imágenes, ejecuta `preventDefault()` y `stopPropagation()` (evitando inserción en el lienzo de Excalidraw) y procesa la imagen, y bloqueo de botón de adjuntar y pegado mientras `loading === true`.
  - `frontend/src/aiEdit/AiChat.scss`: Clases `.ai-chat-attach-preview-container`, `.ai-chat-attach-error`, `.ai-chat-attach-preview`, `.ai-chat-attach-thumb`, `.ai-chat-attach-remove-btn` y estilos unificados para `.ai-chat-attach-btn` equivalentes a `.ai-chat-mic-btn`.
- **Verificación Realizada**:
  - Verificación de tipos TypeScript (`tsc`): exitosa con código de salida 0.
  - Compilación completa de la aplicación (`yarn build` con Vite): exitosa con código de salida 0.
  - Verificación de límites de modificación: `useAiChat.ts`, `applyAiOperations.ts`, servicios y rutas backend no fueron modificados.
- **Notas y Observaciones**:
  - No se realiza envío de imágenes al backend en esta fase; el estado permanece puramente local en el panel listo para la Fase 3b.

### [RES-007] Conexión de Imagen Adjunta con Endpoint de Visión (CU9 Fase 3b)
- **Fecha**: 2026-10-22
- **Tarea Asociada**: TSK-008
- **Entregables Producidos**:
  - `frontend/src/aiEdit/imageUpload.ts`: Nuevo módulo independiente con `prepareImageForUpload` (escala a máx 1600 px sin agrandar, orientación EXIF con `createImageBitmap` / `Image`, dibujo en canvas blanco y compresión JPEG 0.85 sin prefijo data:) y `postImageToBackend` (POST a `/diagrams/:id/ai-from-image`, timeout 110s vía `AbortController`).
  - `frontend/src/aiEdit/useAiChat.ts`: Adiciones estrictamente aditivas (0 líneas preexistentes modificadas o borradas). Incorpora `imageUrl?: string` en `Message`, `lastSentImageRef` para reintentos, y `handleSendImage(file, instruction)` con ciclo completo (loading, user message con miniatura, llamada backend, conteo e informe unificado de clases y relaciones importadas, avisos por operaciones skipped y warnings del servidor, y mapeo homogéneo de errores 400/422/429/503/504).
  - `frontend/src/aiEdit/AiChatPanel.tsx`: Despacho a `handleSendImage(attachedImage.file, inputText)` desde el botón de enviar o presionar Enter cuando hay imagen adjunta, habilitación del botón de enviar con imagen sin requerir texto, limpieza de adjunto e input tras envío, y pintado de `imageUrl` sobre el texto en las burbujas del usuario.
  - `frontend/src/aiEdit/AiChat.scss`: Estilos para `.ai-chat-msg-image` y `.ai-chat-msg-thumb` dentro de las burbujas `.ai-chat-msg--user`.
- **Verificación Realizada**:
  - Inspección de `git diff -U0 frontend/src/aiEdit/useAiChat.ts`: confirmado 100% aditivo (0 líneas eliminadas o modificadas, solo adiciones).
  - Verificación de tipos TypeScript (`tsc`): superada limpiamente sin errores (código 0 en 38.77s).
  - Empaquetado completo de Vite (`yarn build`): concluido con éxito (código 0 en 44.05s).
- **Notas y Observaciones**:
  - `applyAiOperations.ts` y el backend no sufrieron alteraciones.

### [RES-008] Distribución en Cuadrícula para createClass (CU9 Fase 3c)
- **Fecha**: 2026-10-22
- **Tarea Asociada**: TSK-009
- **Entregables Producidos**:
  - `frontend/src/aiEdit/applyAiOperations.ts`: Sustitución del desplazamiento diagonal simple de 15 px por una distribución simétrica en cuadrícula para operaciones `createClass`:
    - `totalCreateClasses = N`
    - `cols = Math.min(N, 4)`, `rows = Math.ceil(N / 4)`
    - `stepX = 250`
    - `stepY = maxCardHeight + 60` (donde `maxCardHeight` calcula el alto real de cada tarjeta UML del lote con la misma fórmula de `createUmlClassElement`: `Math.max(140, lineCount * 22 + 40)`).
    - `x = centerX + (col - (cols - 1) / 2) * stepX`
    - `y = centerY + (row - (rows - 1) / 2) * stepY`
    - Para `N = 1`: los offsets X e Y se anulan a 0, posicionando la clase exactamente en el centro de la vista.
- **Verificación Realizada**:
  - Verificación de tipos TypeScript (`tsc`): superada con código de salida 0 (0 errores).
  - Empaquetado completo de Vite (`yarn build`): empaquetado exitoso con código de salida 0 (`✓ built in 36.34s`).
  - Resto de operaciones (`updateClass`, `deleteClass`, `createRelation`, `deleteRelation`, etc.) no modificadas.
- **Notas y Observaciones**:
  - Cambio autorizado explícitamente para optimizar la visualización de diagramas creados por lotes de IA.

### [RES-009] Botón Reintentar y Errores Específicos para Imagen (CU9 Fase 3d)
- **Fecha**: 2026-10-22
- **Tarea Asociada**: TSK-010
- **Entregables Producidos**:
  - `frontend/src/aiEdit/useAiChat.ts`:
    - Incorporación de `retryable?: boolean` en el tipo `Message`.
    - `inFlightRef` síncrono para protección contra doble envío concurrente tanto en `handleSendImage` como en `handleRetryImage`.
    - `lastProcessedImagePayloadRef` para almacenar `{ imageBase64, mimeType, instruction, imageUrl }` evitando re-compresiones innecesarias.
    - `handleRetryImage()` para repetir la solicitud sin agregar otro mensaje de usuario.
    - Mensajes de error específicos para imágenes con `retryable: true` (429, 503, 504/timeout, 422, fallo de red/conexión, genérico) y `retryable: false` (400 `INVALID_IMAGE`, diagrama no seleccionado).
    - Indicador de espera contextual: `loadingMessage` con `"Leyendo la imagen... (puede tardar hasta 1 minuto)"` para imágenes y `"Pensando..."` para texto y voz.
    - 0 líneas modificadas o eliminadas de la base original de `useAiChat.ts`.
  - `frontend/src/aiEdit/AiChatPanel.tsx`:
    - Botón "Reintentar" renderizado exclusivamente en el último mensaje de la conversación si proviene del asistente con `retryable === true` y `loading === false`.
    - Indicador visual de carga que consume dinámicamente `loadingMessage`.
  - `frontend/src/aiEdit/AiChat.scss`:
    - Estilos `.ai-chat-msg-actions` y `.ai-chat-retry-btn` (botón secundario compacto con hover y estados deshabilitados).
- **Verificación Realizada**:
  - Verificación estricta de diff en `useAiChat.ts`: 100% aditivo respecto a las líneas base preexistentes.
  - Comprobación de tipos TypeScript (`tsc`): superada con código de salida 0 (0 errores).
  - Empaquetado de producción de Vite (`yarn build`): completado con código de salida 0 (`✓ built in 1m 39s`).
  - Cero alteraciones en el backend, `applyAiOperations.ts` ni el flujo de texto y voz.
- **Notas y Observaciones**:
  - Fase completada y lista para verificación integral del flujo de extremo a extremo.




