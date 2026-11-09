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





---

### [RES-015] Botón "Mis diagramas" en el menú del lienzo (CU-Auth Fase 4b)
- **Fecha**: 2026-10-24
- **Archivos Modificados**:
  - `frontend/excalidraw-app/components/AppMainMenu.tsx`: Prop `onOpenDiagrams?: () => void` y renderizado del ítem "Mis diagramas" con `<MainMenu.Separator />` antes de "Cerrar sesión".
  - `frontend/excalidraw-app/App.tsx`: Importación de `saveDiagramToBackend` y `SessionExpiredError`. `ExcalidrawWrapper` pasa `onOpenDiagrams` con `excalidrawAPI`. `ExcalidrawApp` implementa `handleReturnToDiagrams(api)` en el orden estricto solicitado (guardar diagrama, flush y abandono de sala realtime, reseteo de escena, cancelación de timers y sync state, purga de IndexedDB de archivos y claves de diagrama en localStorage preservando sesión y username, y retorno a DiagramsScreen).
- **Archivos NO Modificados**: `handleLogout`, `backendSync.ts`, `realtimeSync.ts`, `DiagramsScreen.tsx`, ni backend.
- **Pruebas Ejecutadas**:
  - `yarn test:typecheck` (`tsc`): código de salida 0.
  - `npx vitest run LoginScreen importXmiToCanvas`: 8/8 pruebas pasadas.
  - `yarn build`: código de salida 0 (`✓ built in 1m 2s`).

---

### [RES-016] Reconciliación de elementos remotos en tiempo real con reconcileElements (CU-Collab Fase C2)
- **Fecha**: 2026-10-24
- **Archivos Modificados**:
  - `frontend/excalidraw-app/App.tsx`: En `applyRemoteChange` se calculó la fusión de elementos con `reconcileElements(excalidrawAPI.getSceneElementsIncludingDeleted(), elements as readonly RemoteExcalidrawElement[], excalidrawAPI.getAppState())` antes de entregarlos a `excalidrawAPI.updateScene({ elements: reconciledElements, captureUpdate: CaptureUpdateAction.NEVER })`. Se conservaron intactos `isApplyingRemoteChange.current` y el bloque `try/catch/finally`.
- **Archivos NO Modificados**: `realtimeSync.ts`, `backendSync.ts`, `Collab.tsx`, backend.
- **Origen de importación**: `reconcileElements` ya se encontraba importado desde `"@excalidraw/excalidraw"` (mismo paquete y export que utiliza `Collab.tsx`) y `RemoteExcalidrawElement` desde `"@excalidraw/excalidraw/data/reconcile"`.
- **Pruebas Ejecutadas**:
  - `yarn test:typecheck` (`tsc`): código de salida 0.
  - `npx vitest run LoginScreen importXmiToCanvas`: 8/8 pruebas pasadas.
  - `yarn build`: código de salida 0 (`✓ built in 1m 1s`).

---

### [RES-017] Deshabilitación de endpoint POST /session respondiendo 410 Gone (CU-Auth Fase 5b)
- **Fecha**: 2026-10-24
- **Archivos Modificados**:
  - `backend/src/routes/sessionRoutes.ts`: Reemplazado el handler de `POST /` para responder HTTP 410 Gone con mensaje de deprecación indicando el uso de `POST /auth/login` o `POST /auth/register`. Se removió el import no utilizado de `createSession`.
  - `backend/src/app.ts`: Actualizado el texto informativo de `endpoints` en la ruta raíz `GET /` reflejando validación con `GET /session/:id` y autenticación en `/auth`.
- **Archivos NO Modificados**: `GET /session/:id`, `sessionService.ts`, `authService.ts`, `authRoutes.ts`, frontend.
- **Pruebas Ejecutadas**:
  - Backend typecheck (`npm run typecheck`): código de salida 0.
  - Backend build (`npm run build`): código de salida 0.
  - Frontend vitest (`npx vitest run LoginScreen importXmiToCanvas`): 8/8 pruebas pasadas.

---

### [RES-018] Base de conocimiento de ayuda en backend (CU-Ayuda Fase 1)
- **Fecha**: 2026-10-26
- **Archivos Creados**:
  - `backend/src/help/helpTopics.ts`: Exporta `HelpTopic` y `HELP_TOPICS` con 16 tópicos estructurados con textos exactos sin markdown y voseo rioplatense. Se ajustó el límite de imagen a 15 MB en `ia-foto` y se verificó la versión real de Java (17) en `ejecutar-backend`.
- **Archivos NO Modificados**: Ningún archivo existente modificado.
- **Pruebas Ejecutadas**:
  - Backend build (`npm --prefix backend run build`): compilación TypeScript exitosa con código 0.

---

### [RES-019] Endpoint GET /help/topics y registro de helpRouter (CU-Ayuda Fase 2)
- **Fecha**: 2026-10-26
- **Archivos Creados**:
  - `backend/src/routes/helpRoutes.ts`: Exporta `helpRouter = Router()` con la ruta `GET /topics` que responde HTTP 200 con `{ topics: HELP_TOPICS }` sin requerir sesión.
- **Archivos Modificados**:
  - `backend/src/app.ts`: Importado `helpRouter` y registrado con `app.use("/help", helpRouter);` junto a las demás rutas bajo el middleware de CORS.
- **Pruebas Ejecutadas**:
  - Backend build (`npm --prefix backend run build`): compilación TypeScript exitosa con código 0 (`tsc`).

---

### [RES-020] Servicio de IA para el modo Ayuda (CU-Ayuda Fase 3)
- **Fecha**: 2026-10-27
- **Archivos Creados**:
  - `backend/src/services/helpAssistant.ts`: Exporta `askHelpAssistant` y la clase `HelpAiError`. Implementa invocación en texto plano (Groq con `reasoning_effort: "low"` y modelo `openai/gpt-oss-20b`, Gemini con `gemini-3.6-flash`), prompt compilado a nivel de módulo con los 16 temas de `HELP_TOPICS`, validación de entrada (500 caracteres, últimos 6 mensajes del historial), logs `[UC17 DEBUG]` con proveedor, duración y tokens (sin registrar textos sensibles), y hasta 1 reintento con 1500 ms ante 503 o 429.
- **Archivos NO Modificados**: Ningún archivo existente modificado.
- **Pruebas Ejecutadas**:
  - Backend build (`npm --prefix backend run build`): compilación TypeScript exitosa con código 0 (`tsc`).
  - Pruebas directas de ejecución con Groq y Gemini: ambos proveedores responden correctamente y se verificó el reintento ante 503.
  - Validación de entrada: rechazo inmediato de preguntas vacías con `HelpAiError(400)`.

---

### [RES-021] Endpoint POST /help/ask en helpRoutes.ts (CU-Ayuda Fase 4)
- **Fecha**: 2026-10-27
- **Archivos Modificados**:
  - `backend/src/routes/helpRoutes.ts`: Implementada la ruta `POST /ask` con validación de sesión inline contra `getSession(sessionId)` (retornando 401 si falta o no existe), validación de `question` (1 a 500 caracteres, retornando 400), invocación a `askHelpAssistant({ question, history, username: session.username })`, mapeo de errores de `HelpAiError` (422 con `{ error: message }`, y 429/503/504 con `{ error: code, message }`) y fallback 500 registrando en logs sin incluir el contenido de la pregunta.
- **Archivos NO Modificados**: Ningún otro archivo modificado.
- **Pruebas Ejecutadas**:
  - Backend build (`npm --prefix backend run build`): compilación TypeScript exitosa con código 0 (`tsc`).

---

### [RES-022] Ajustes en helpTopics.ts y helpAssistant.ts (CU-Ayuda Fase 5)
- **Fecha**: 2026-10-27
- **Archivos Modificados**:
  - `backend/src/help/helpTopics.ts`: Pregunta de `ia-voz` actualizada a "¿Cómo uso la voz o el dictado por micrófono?". En `crear-relacion`, agregada la oración verificada en código: "En Herencia, el origen es la clase hija y el destino la clase padre.".
  - `backend/src/services/helpAssistant.ts`: Añadidas reglas literales en el prompt de sistema para ampliación semántica de temas ("la voz", "hablar", "dictar", "micrófono", "compartir", "colaborar"), estricto apego a la base, voseo obligatorio y texto plano estricto. Implementada función pura `sanitizeHelpResponse` para sanitización post-proceso (eliminación de `**` y comillas invertidas, reemplazo de guiones no separables U+2011/U+2010 por "-", eliminación de espacios al final de líneas y colapso de 3 o más saltos de línea a 2).
- **Archivos NO Modificados**: Ningún otro archivo modificado.
- **Pruebas Ejecutadas**:
  - Backend build (`npm --prefix backend run build`): compilación TypeScript exitosa con código 0 (`tsc`).
  - Prueba unitaria de `sanitizeHelpResponse`: remoción correcta de markdown, guiones unicode, espacios finales y saltos de línea redundantes.

---

### [RES-023] Pista determinista por palabras clave en helpAssistant.ts (CU-Ayuda Fase 6)
- **Fecha**: 2026-10-27
- **Archivos Modificados**:
  - `backend/src/services/helpAssistant.ts`: Definida la constante `TOPIC_HINTS` con los 7 patrones regex verificados contra `HELP_TOPICS`. Implementada la función pura `getTopicHints` con normalización Unicode NFD. Añadida la regla literal de pistas internas al prompt de sistema. Inyección condicional de `[Pista interna: ...]` al final del mensaje del usuario enviado al modelo y registro del campo `pistas:` en logs `[UC17 DEBUG]`.
- **Archivos NO Modificados**: Ningún otro archivo modificado.
- **Pruebas Ejecutadas**:
  - Backend build (`npm --prefix backend run build`): compilación TypeScript exitosa con código 0 (`tsc`).
  - Pruebas unitarias de `getTopicHints`: coincidencia exacta de patrones con y sin acentos, límite de 2 temas.

---

### [RES-024] Pista negativa y normalización de espacios en helpAssistant.ts (CU-Ayuda Fase 7)
- **Fecha**: 2026-10-27
- **Archivos Modificados**:
  - `backend/src/services/helpAssistant.ts`:
    1. En `sanitizeHelpResponse`: normalización previa de espacios especiales (U+00A0, U+202F, U+2009, U+200A, U+2007, U+2002, U+2003, U+3000) a espacio estándar ASCII 32 y remoción de caracteres de ancho cero (U+200B, U+200C, U+200D, U+2060, U+FEFF).
    2. Constante `UNSUPPORTED_FORMAT`: regex para formatos no soportados (pdf, word, docx, excel, xlsx, png, svg, jpeg/jpg, csv, json). Si la consulta contiene "exportar", "descargar" o "guardar" y coincide con dicho regex, se inyecta la pista negativa interna y se registra `pistas: sin-soporte` en `[UC17 DEBUG]`.
    3. En `SYSTEM_PROMPT`: agregadas las reglas literales para manejo de pista negativa ("usá exactamente la frase indicada y nada más") y copiado fiel de pasos de la base sin parafrasear.
- **Archivos NO Modificados**: Ningún otro archivo modificado.
- **Pruebas Ejecutadas**:
  - Backend build (`npm --prefix backend run build`): compilación TypeScript exitosa con código 0 (`tsc`).
  - Prueba de normalización de espacios con `"lo que\u202Fquerés"`: transformado correctamente a `"lo que querés"` (espacio ASCII 32).
  - Pruebas de regex de formato no soportado (PDF detectado, XMI no afectado).

---

### [RES-025] Hook useHelpChat.ts en frontend (CU-Ayuda Fase 8)
- **Fecha**: 2026-10-27
- **Archivos Creados**:
  - `frontend/src/aiEdit/useHelpChat.ts`: Hook personalizado de React `useHelpChat(backendUrl: string = BACKEND_URL)` que exporta `{ messages, loading, sendQuestion }`. Reutiliza la interfaz `Message` de `useAiChat.ts`, arranca con mensaje inicial de bienvenida en voseo, valida longitud máxima de 500 caracteres (con mensaje warning sin enviar), previene doble envío con `inFlightRef`, construye el historial con los últimos 6 mensajes válidos (filtrando bienvenida y advertencias/errores), extrae `x-session-id` desde `localStorage` (`classdraw_session_id` o `active_session_id`), envía POST a `/help/ask` y maneja estados HTTP (401 con invalidación de sesión en almacenamiento y evento `session-invalid`; 429/503/504; 422; 400; errores de red y otros errores) asegurando `loading = false` en `finally` y sin registrar el contenido de la pregunta en logs.
- **Archivos NO Modificados**: Ningún archivo existente fue modificado.
- **Pruebas Ejecutadas**:
  - Frontend typecheck (`yarn --cwd frontend test:typecheck`): compilación TypeScript exitosa con código 0 (`tsc`).

---

### [RES-026] Pestañas Editar y Ayuda en AiChatPanel.tsx y estilos en AiChat.scss (CU-Ayuda Fase 9)
- **Fecha**: 2026-10-27
- **Archivos Modificados**:
  - `frontend/src/aiEdit/AiChatPanel.tsx`: Integración aditiva de pestañas "Editar" y "Ayuda" con `role="tab"` y `aria-selected`. Estado local `mode` ("edit" | "help"), conexión con `useHelpChat(backendUrl)`, detención del dictado al alternar pestañas, bifurcación condicional de mensajes con clase `ai-chat-msg-text--help`, placeholder dinámico de ayuda, envío mediante `sendQuestion` y limpieza de `inputText`, botón con estado "Pensando..." deshabilitado en carga de ayuda, ocultamiento del botón de adjuntar y bloqueo de pegado de imágenes en modo ayuda sin alterar la imagen adjunta de edición.
  - `frontend/src/aiEdit/AiChat.scss`: Clases aditivas `.ai-chat-tabs`, `.ai-chat-tab`, `.ai-chat-tab--active` con indicador inferior, y `.ai-chat-msg-text--help { white-space: pre-wrap; }`.
- **Archivos NO Modificados**: `useAiChat.ts`, `AiChatButton.tsx` ni ningún otro archivo.
- **Pruebas Ejecutadas**:
  - Chequeo de tipos (`yarn --cwd frontend test:typecheck`): exitoso con código 0 (`tsc`).
  - Build de frontend (`yarn --cwd frontend build`): exitoso con código 0 (`vite build`).

---

### [RES-027] Autorización de x-session-id en CORS preflight del backend
- **Fecha**: 2026-10-27
- **Archivos Modificados**:
  - `backend/src/app.ts`: Agregado `"x-session-id"` al array `allowedHeaders` en la configuración de `cors(...)`, preservando orígenes (`allowedOrigins`), credenciales (`credentials: true`), métodos (`GET, POST, PUT, DELETE, OPTIONS`) y headers previos (`Content-Type`, `Authorization`).
- **Archivos NO Modificados**: Ningún endpoint, lógica funcional, autenticación ni hooks del frontend fueron modificados.
- **Pruebas Ejecutadas**:
  - Compilación TypeScript de backend (`npm --prefix backend run build`): exitosa con código 0.
  - Test de preflight HTTP OPTIONS contra `/help/ask` con cabecera `Origin: http://localhost:3001` y `Access-Control-Request-Headers: x-session-id, Content-Type`: respuesta HTTP 204 con `Access-Control-Allow-Origin: http://localhost:3001` y `Access-Control-Allow-Headers: Content-Type,Authorization,x-session-id`.

---

### [RES-028] Temas sugeridos y askPrepared en useHelpChat.ts (CU-Ayuda Fase 10)
- **Fecha**: 2026-10-27
- **Archivos Modificados**:
  - `frontend/src/aiEdit/useHelpChat.ts`: Exportada la interfaz `HelpTopic` y la constante `SUGGESTED_TOPIC_IDS`. Añadida la carga inicial vía `GET ${backendUrl}/help/topics` sin cabeceras de sesión (capturando fallos sin romper el estado), estado local `askedTopicIds`, función pura de UI `askPrepared(topicId)` que inserta directamente en `messages` el mensaje de usuario (`question`) y el del asistente (`answer`) sumando el id a `askedTopicIds` sin realizar llamadas de red, listas calculadas memoizadas `suggestedTopics` y `moreTopics`, y mensaje de bienvenida actualizado a `"¡Hola! Soy el asistente de ayuda. Tocá una pregunta sugerida o escribí la tuya."`.
- **Archivos NO Modificados**: Ningún otro archivo modificado.
- **Pruebas Ejecutadas**:
  - Chequeo de tipos (`yarn --cwd frontend test:typecheck`): exitoso con código 0 (`tsc`).
  - Build de frontend (`yarn --cwd frontend build`): exitoso con código 0 (`vite build`).

---

### [RES-029] Chips de sugerencias de temas en AiChatPanel.tsx y estilos en AiChat.scss (CU-Ayuda Fase 11)
- **Fecha**: 2026-10-27
- **Archivos Modificados**:
  - `frontend/src/aiEdit/AiChatPanel.tsx`: Destructuración de `askPrepared`, `suggestedTopics` y `moreTopics` desde `useHelpChat`. Estado local `showMoreTopics`. Renderizado aditivo del bloque `.ai-chat-suggestions` con botones `.ai-chat-chip` para `suggestedTopics` y para `moreTopics` desplegables condicionalmente mediante botón `.ai-chat-chip--more` ("Ver más preguntas" / "Ver menos"). Bloque no renderizado si no hay sugerencias y condicionado a modo "help" cuando no está cargando. Auto-scroll actualizado para incluir el bloque de sugerencias.
  - `frontend/src/aiEdit/AiChat.scss`: Clases aditivas `.ai-chat-suggestions` (flex wrap con gap), `.ai-chat-chip` (botón con borde redondeado e interacción hover) y `.ai-chat-chip--more` (estilo sutil punteado con hover diferenciado).
- **Archivos NO Modificados**: `useAiChat.ts`, `useHelpChat.ts` ni ningún otro archivo. Camino de modo "edit" 100% inalterado.
- **Pruebas Ejecutadas**:
  - Chequeo de tipos (`yarn --cwd frontend test:typecheck`): exitoso con código 0 (`tsc`).
  - Build de frontend (`yarn --cwd frontend build`): exitoso con código 0 (`vite build`).

---

### [RES-030] Mapeo de errores de proveedor de IA a 503 AI_UNAVAILABLE en backend (CU-Ayuda)
- **Fecha**: 2026-10-27
- **Archivos Modificados**:
  - `backend/src/services/helpAssistant.ts`: Mapeo de errores del proveedor distintos a 429, 503 o 504 (tales como 401, 403, 400, 404, etc.) a `HelpAiError(503, "AI_UNAVAILABLE", "El asistente de IA no está disponible por ahora. Probá con una de las preguntas sugeridas.")`. Logueo del `status original` del proveedor con prefijo `[UC17 DEBUG]` sin revelar texto de la pregunta ni de la respuesta.
  - `backend/src/routes/helpRoutes.ts`: Salvaguarda en el bloque `catch` para que cualquier error con status 401 sea transformado a status 503, garantizando que el único HTTP 401 que puede salir de `POST /help/ask` provenga exclusivamente de sesión ausente o inválida (`{ "error": "No autenticado" }`).
- **Archivos NO Modificados**: Ningún otro archivo modificado.
- **Pruebas Ejecutadas**:
  - Compilación TypeScript de backend (`npm --prefix backend run build`): exitosa con código 0 (`tsc`).

---

### [RES-031] Módulo helpOnboarding.ts y prop initialMode en AiChatPanel (CU-Ayuda Fase 12)
- **Fecha**: 2026-10-27
- **Archivos Creados**:
  - `frontend/src/aiEdit/helpOnboarding.ts`: Funciones exportadas puras `hasSeenHelpOnboarding(username)` y `markHelpOnboardingSeen(username)`. Almacena en `localStorage` bajo `"help_onboarding_seen_" + username.trim().toLowerCase()`. Manejo seguro con `try/catch` (devolviendo `true` si falla el almacenamiento o si el nombre de usuario está vacío para no interrumpir al usuario; `mark` no realiza operaciones si el usuario está vacío).
- **Archivos Modificados**:
  - `frontend/src/aiEdit/AiChatPanel.tsx`: Añadida prop opcional `initialMode?: "edit" | "help"` a la interfaz `AiChatPanelProps`, inicializando por defecto `initialMode = "edit"` y utilizada exclusivamente como valor inicial del estado `mode`.
- **Archivos NO Modificados**: Ningún otro archivo modificado.
- **Pruebas Ejecutadas**:
  - Chequeo de tipos (`yarn --cwd frontend test:typecheck`): exitoso con código 0 (`tsc`).
  - Build de producción (`yarn --cwd frontend build`): exitoso con código 0 (`vite build`).

---

### [RES-032] Onboarding de ayuda automática en App.tsx (CU-Ayuda Fase 13)
- **Fecha**: 2026-10-27
- **Archivos Modificados**:
  - `frontend/excalidraw-app/App.tsx`: Incorporación del estado `aiChatInitialMode` ("edit" | "help"), ref de guarda `helpOnboardingTriggeredRef` para prevenir doble ejecución en StrictMode, `useEffect` que verifica la presencia del lienzo mostrado (`currentDiagramId || getActiveDiagramId()`) y usuario activo (`activeUsername / ACTIVE_USERNAME_KEY`) con `!hasSeenHelpOnboarding(username)` para activar `setAiChatInitialMode("help")`, `setIsAiChatOpen(true)` y `markHelpOnboardingSeen(username)`. `useEffect` que reestablece `aiChatInitialMode` a "edit" al cerrar el panel (`!isAiChatOpen`), y pase de `initialMode={aiChatInitialMode}` a `<AiChatPanel>`.
- **Archivos NO Modificados**: Ningún otro archivo modificado.
- **Pruebas Ejecutadas**:
  - Chequeo de tipos (`yarn --cwd frontend test:typecheck`): exitoso con código 0 (`tsc`).
  - Build de producción (`yarn --cwd frontend build`): exitoso con código 0 (`vite build`).

---

### [RES-033] Corrección de condición de carrera en initialMode / onboarding en App.tsx (CU-Ayuda)
- **Fecha**: 2026-10-27
- **Archivos Modificados**:
  - `frontend/excalidraw-app/App.tsx`: Incorporada la ref `wasOpenRef = useRef(false)`. Se corrigió el efecto de reseteo para que evalúe `if (wasOpenRef.current && !isAiChatOpen)`, ejecutando `setAiChatInitialMode("edit")` única y exclusivamente en la transición de `true` a `false` (cuando el usuario cierra el panel), evitando que en el montaje inicial cuando `isAiChatOpen` aún es `false` se pise el valor `"help"` programado por el efecto de onboarding automático.
- **Archivos NO Modificados**: Ningún otro archivo modificado.
- **Pruebas Ejecutadas**:
  - Chequeo de tipos (`yarn --cwd frontend test:typecheck`): exitoso con código 0 (`tsc`).
  - Build de producción (`yarn --cwd frontend build`): exitoso con código 0 (`vite build`).


---

### [RES-044] Implementación del generador de app móvil (backend, mobile-template y frontend)
- **Fecha**: 2026-10-31
- **Tarea Asociada**: TSK-050
- **Entregables Producidos**:
  - `mobile-template/assets/esquema.json`: Esquema por defecto de barbería (`Cliente` y `Atencion`).
  - `mobile-template/pubspec.yaml`: Declaración del asset `assets/esquema.json`.
  - `mobile-template/lib/esquema/cargar_esquema.dart`: Función `cargarEsquema([AssetBundle?])` que lee `assets/esquema.json` con `rootBundle` y ante error o ausencia recurre a `esquemaBarberia`.
  - `mobile-template/lib/pantallas/pantalla_voz.dart`: Adaptada para inicializarse con `cargarEsquema()` y configurar `_servicioIa.preparar(construirPrompt(esquema), esquemaValidador)`.
  - `mobile-template/test/cargar_esquema_test.dart`: 2 pruebas unitarias (JSON válido y asset faltante/inválido con fallback).
  - `backend/src/mobileGenerator/converter.ts`: Función `convertUmlModelToSchema` que mapea `UmlModel` al formato `esquema.json` (`String` -> `texto`, `number`/`int`/`float`/`double` -> `numero`, demás -> `otro`; relaciones `association`/`composition`/`aggregation` con `*` a `1` convertidas a `ref` al inicio; `inheritance`, `manyToMany` y relaciones `*` a `*` ignoradas).
  - `backend/src/mobileGenerator/buildMobileZip.ts`: Empaquetador ZIP con `archiver` que excluye `build`, `.dart_tool`, `android/build`, `.gradle`, `.idea`, `node_modules` y `.gguf`; reemplaza `assets/esquema.json` y genera `LEEME.txt` con instrucciones completas en español.
  - `backend/src/mobileGenerator/converter.test.ts`: 6 pruebas unitarias con `node:test` cubriendo barbería, tienda, tipos no soportados, exclusión de herencia/manyToMany/* a *, reglas de exclusión y generación de ZIP.
  - `backend/src/routes/diagramRoutes.ts`: Endpoint `POST /diagrams/:id/generate-mobile` con la misma firma y validación que `generate-backend`.
  - `backend/package.json`: Script `test` añadido para ejecución directa con `tsx --test`.
  - `frontend/excalidraw-app/App.tsx`: Botón toolbar «Generar app móvil» con icono de dispositivo móvil, estado `isGeneratingMobile`, flujo de descarga de `generated-mobile.zip` y notificaciones Toast idénticas a CU5.
- **Pruebas Ejecutadas**:
  - `npm test` en `backend`: 6 tests ejecutados y aprobados (100% pass, 0 fail).
  - `npm run typecheck` en `backend`: 0 errores TypeScript.
  - `yarn test:typecheck` en `frontend`: 0 errores TypeScript.
  - `flutter analyze` en `mobile-template`: 0 issues encontrados.
  - `flutter test` en `mobile-template`: 80 tests ejecutados y aprobados (+79, 0 fallos).
  - `git status --short`: Verificado estado limpio y consistente.


---

### [RES-045] Omisión de atributos id en mobileGenerator y migración de base por firma de esquema en Repositorio
- **Fecha**: 2026-10-31
- **Tarea Asociada**: TSK-051
- **Entregables Producidos**:
  - `backend/src/mobileGenerator/converter.ts`: Omisión estricta de cualquier atributo cuyo nombre en minúsculas sea exactamente "id" (`attrName.toLowerCase() === "id"`), permitiendo generar clases con lista vacía `campos: []` sin fallar.
  - `backend/src/mobileGenerator/converter.test.ts`: Prueba unitaria verificando la omisión de atributos `id` e `ID` en distintas clases y la generación exitosa de clases con `campos: []`.
  - `mobile-template/lib/datos/repositorio.dart`:
    - Función estática `calcularFirma(Esquema)` basada en las sentencias DDL generadas.
    - Persistencia de la firma en `esquema_firma.txt` junto a `app.db`.
    - Detección de cambio de firma (o presencia de base sin firma) con rotación no destructiva de `app.db` a `app_anterior_<timestamp>.db` (incluyendo archivos auxiliares sqlite `-wal`, `-shm`, `-journal`).
    - Apertura/recreación limpia de la nueva base de datos con las tablas del esquema activo y guardado de la firma nueva.
    - Parámetros opcionales `directorioBases` y `abrirDbFn` para permitir inyección de dependencias y pruebas unitarias aisladas en disco.
  - `mobile-template/test/repositorio_test.dart`: 3 pruebas unitarias completas respaldadas en archivos físicos verificando: (1) firma distinta con renombrado a `app_anterior_...`, nueva base vacía y preservación de registros en la base vieja; (2) firma igual con retención de datos sin rotación; (3) base preexistente sin archivo de firma tratada como firma distinta.
- **Pruebas Ejecutadas**:
  - `npm test` en `backend`: 7 tests ejecutados y aprobados (100% pass, 0 fail).
  - `npm run typecheck` en `backend`: 0 errores TypeScript.
  - `flutter analyze` en `mobile-template`: 0 issues encontrados.
  - `flutter test` en `mobile-template`: 83 tests ejecutados y aprobados (+82, 0 fallos).
  - `git status --short`: Verificado estado del repositorio.

---

### [RES-046] Implementación de interfaz ModelProvider y adaptadores Groq y Gemini (CU24 Fase 1 Paso 1)
- **Fecha**: 2026-11-03
- **Tarea Asociada**: TSK-052
- **Entregables Producidos**:
  - `backend/src/ai/providers/types.ts`: Declaración de tipos `ProviderId` ("local" | "groq" | "gemini") e interfaz común `ModelProvider` exponiendo `id`, `label`, `isConfigured(): boolean` y `editDiagramByInstruction(currentModel, instruction): Promise<{ operations: any[] }>`.
  - `backend/src/ai/providers/groqProvider.ts`: Adaptador `GroqProvider` que implementa `ModelProvider`, verifica la variable `GROQ_API_KEY` en `isConfigured()`, y delega a `editDiagramByInstructionGroq` de `backend/src/services/groq.ts` sin modificar el servicio original. Instancia exportada `groqProvider`.
  - `backend/src/ai/providers/geminiProvider.ts`: Adaptador `GeminiProvider` que implementa `ModelProvider`, verifica `GEMINI_API_KEY` en `isConfigured()`, y delega a `editDiagramByInstruction` de `backend/src/services/gemini.ts` sin modificar el servicio original. Instancia exportada `geminiProvider`.
  - `backend/src/ai/providers/index.ts`: Re-exportación de tipos y proveedores, registro interno y exportación de la función `getProvider(id: ProviderId | string): ModelProvider | undefined`.
- **Archivos NO Modificados**:
  - `diagramRoutes.ts`, `helpAssistant.ts`, `visionDiagram.ts`, `gemini.ts` y `groq.ts` se mantuvieron 100% intactos. `gemini.ts` sigue exportando `isTimeoutError` inalterado.
- **Pruebas Ejecutadas**:
  - `npm --prefix backend run build` (`tsc`): 0 errores TypeScript, compilación exitosa (código 0).
  - `git status --short`: Verificados únicamente los archivos creados en `backend/src/ai/providers/`.

---

### [RES-047] Reemplazo de selección de proveedor en diagramRoutes.ts con getProvider (CU24 Fase 1 Paso 2)
- **Fecha**: 2026-11-03
- **Tarea Asociada**: TSK-053
- **Entregables Producidos**:
  - `backend/src/routes/diagramRoutes.ts`:
    - Eliminados imports en desuso `editDiagramByInstruction` (de `services/gemini.ts`) y `editDiagramByInstructionGroq` (de `services/groq.ts`).
    - Añadido import `getProvider` desde `../ai/providers`.
    - Conservado inalterado el import `isTimeoutError` desde `../services/gemini`.
    - En `POST /diagrams/:id/ai-edit`, resolución de proveedor mediante `getProvider(configuredProvider === "gemini" ? "gemini" : "groq")`.
    - Reemplazada la bifurcación ternaria por la invocación unificada `await provider.editDiagramByInstruction(currentModel, instructionToSend)`.
    - Preservados al 100% el bloque catch, respuestas HTTP, validación semántica de operaciones y parámetros.
- **Archivos NO Modificados**:
  - `helpAssistant.ts`, `visionDiagram.ts`, `gemini.ts`, `groq.ts` y ningún otro archivo del backend o frontend fue tocado.
- **Pruebas Ejecutadas**:
  - `npm --prefix backend run build` (`tsc`): 0 errores TypeScript (código 0).
  - `npm --prefix backend test`: 7 tests pasados exitosamente (100% pass, 0 fail).
  - `git diff backend/src/routes/diagramRoutes.ts`: Inspección y verificación de diff mínimo y exacto.

---

### [RES-048] Implementación de LocalProvider para servidor local tipo Colab (CU24 Fase 2 Paso 1)
- **Fecha**: 2026-11-03
- **Tarea Asociada**: TSK-054
- **Entregables Producidos**:
  - `backend/src/ai/providers/localProvider.ts` (**nuevo**):
    - Estado en memoria con `setLocalConfig({url, model})`, `getLocalConfig()` y `clearLocalConfig()`.
    - Clase `LocalProvider` implementando `ModelProvider` con `id: "local"`, `label: "Local (Colab)"`.
    - `isConfigured()` retorna `true` solo si `_localConfig` tiene `url` y `model` no vacíos.
    - Prompt de sistema (`SYSTEM_PROMPT`) y esquema JSON (`editDiagramResponseSchema`) copiados literalmente desde `groq.ts` sin modificar ese archivo.
    - Normalización de nulls copiada literalmente desde `groq.ts` (función interna `removeNullFields`).
    - `editDiagramByInstruction`: llama a `POST {url}/v1/chat/completions` con `response_format: { type: "json_schema", ... }`; si el servidor responde HTTP 400, reintenta con `response_format: { type: "json_object" }`; timeout configurable via `LOCAL_AI_TIMEOUT_MS` (default 45000 ms); lanza `AI_TIMEOUT` si `AbortController` cancela, `INVALID_AI_RESPONSE` si el JSON es inválido o falta `operations`.
    - Instancia singleton exportada `localProvider`.
  - `backend/src/ai/providers/index.ts` (**modificado**):
    - Añadido import y re-exportación de `LocalProvider` y `localProvider`.
    - Proveedor `"local"` registrado en el `Map` interno.
- **Archivos NO Modificados**:
  - `groq.ts`, `gemini.ts`, `diagramRoutes.ts`, `helpAssistant.ts`, `visionDiagram.ts` y el resto del repositorio se mantuvieron 100% intactos.
- **Pruebas Ejecutadas**:
  - `npm --prefix backend run build` (`tsc`): 0 errores TypeScript (código 0).

---

### [RES-049] Script de evaluación de modelo local backend/scripts/evalLocalModel.ts (CU24 Fase 2 Paso 2)
- **Fecha**: 2026-11-03
- **Tarea Asociada**: TSK-055
- **Entregables Producidos**:
  - `backend/scripts/evalLocalModel.ts` (**nuevo**):
    - Validación de variables de entorno requeridas `LOCAL_EVAL_URL` y `LOCAL_EVAL_MODEL` con mensaje claro de uso y salida limpia si faltan.
    - Modelo UML de ejemplo con clases `Cliente` y `Pedido` y relación `association` (multiplicidad `1` a `0..*`).
    - Configuración en memoria con `setLocalConfig` y evaluación de las 12 instrucciones de edición estructurada sobre `localProvider.editDiagramByInstruction`.
    - Medición de tiempos por instrucción (ms), reconocimiento de acciones (`createClass`, `updateClass`, `deleteClass`, `createRelation`, `updateRelation`, `deleteRelation`), validación semántica con la función pura `validateAndResolveOperations` de `operationValidator.ts` y captura de errores tipados (`INVALID_AI_RESPONSE` y `AI_TIMEOUT`).
    - Evaluación de 3 preguntas conversacionales directas a `${url}/v1/chat/completions` (sin esquema) con prompt de desarrollador senior dirigiéndose por nombre (`Davico`, `Ana`, `Luis`), midiendo respuesta en español e inclusión del nombre.
    - Presentación en terminal de tablas resumen para edición y conversación, y métricas totales (instrucciones válidas / 12, tiempos promedio y máximo, nombres / 3 y español / 3).
    - Persistencia de resultados completos en `backend/scripts/eval-results.json`.
  - `.gitignore` (**modificado**):
    - Adición de `backend/scripts/eval-results.json` para evitar versionar los resultados de pruebas locales.
- **Archivos NO Modificados**:
  - Ningún otro archivo preexistente del repositorio fue modificado.
- **Pruebas Ejecutadas**:
  - `npm --prefix backend run build` (`tsc`): 0 errores TypeScript (código 0).
  - Ejecución de prueba con variables ausentes: comprobación de mensaje de error explicativo y código de salida 1.
  - `npm --prefix backend test`: 7/7 tests aprobados (código 0).

---

### [RES-050] Endpoint de registro de modelo local POST /ai/providers/local/register (CU24 Fase 3 Paso 1)
- **Fecha**: 2026-11-03
- **Tarea Asociada**: TSK-056
- **Entregables Producidos**:
  - `backend/src/routes/aiProviderRoutes.ts` (**nuevo**):
    - Router Express `aiProviderRouter` con `POST /local/register`.
    - Autenticación por `x-registration-token` comparada con `process.env.AI_REGISTRATION_TOKEN` usando `crypto.timingSafeEqual`; responde 401 si falta la variable o el token no coincide. Nunca se imprime el token en logs.
    - Validación de `url` (string no vacío, debe comenzar con `https://` o `http://localhost` solo en `NODE_ENV !== "production"`) y `model` (string no vacío). Responde 400 con detalle si falla.
    - Probe de conectividad a `{url}/v1/chat/completions` con timeout de 3 s mediante `AbortController`; si no responde o HTTP >= 500 (excepto 400), responde 502 con `MODEL_UNREACHABLE` sin registrar nada.
    - Tras validación exitosa, llama a `setLocalConfig({ url, model })` y responde 200 con `{ ok: true, provider: "local", model }`.
  - `backend/src/app.ts` (**modificado**):
    - Añadido import de `aiProviderRouter`.
    - Añadido `x-registration-token` en `allowedHeaders` del middleware CORS.
    - Montado `app.use("/ai/providers", aiProviderRouter)` sin alterar otras rutas.
  - `backend/.env.example` (**modificado**):
    - Documentadas las nuevas variables: `AI_PROVIDER`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `AI_REGISTRATION_TOKEN` y `LOCAL_AI_TIMEOUT_MS` (todas comentadas).
- **Archivos NO Modificados**:
  - `diagramRoutes.ts`, `helpAssistant.ts`, `groq.ts`, `gemini.ts` y todos los proveedores de IA se mantuvieron 100% intactos.
- **Pruebas Ejecutadas**:
  - `npm --prefix backend run build` (`tsc`): 0 errores TypeScript (código 0).
  - `npm --prefix backend test`: 7/7 tests aprobados (código 0).
  - `git diff backend/src/app.ts`: Verificado diff mínimo y exacto (3 adiciones, 1 sustitución de línea).

---

### [RES-051] Respaldo automático entre proveedores y conexión con ai-edit (CU24 Fase 4 Paso 1)
- **Fecha**: 2026-11-03
- **Tarea Asociada**: TSK-057
- **Entregables Producidos**:
  - `backend/src/ai/providers/providerManager.ts` (**nuevo**):
    - Estado en memoria del proveedor activo (`activeProviderId`), inicializado según `AI_PROVIDER` (si es "gemini" o "local" usa ese, cualquier otro o vacío usa "groq"). Funciones `getActiveProviderId()` y `setActiveProviderId()`.
    - Health check por proveedor con caché en memoria de 30 s: para `local` realiza ping mínimo a `{url}/v1/chat/completions` con timeout estricto de 3 s; para `groq` y `gemini` verifica `isConfigured()`.
    - Función `editWithFallback(currentModel, instruction)`:
      - Orden de respaldo: `local → groq → gemini` (y gemini solo si `isConfigured()`).
      - Si el health check indica no disponible, salta el proveedor sin invocarlo.
      - Reintento único ante `INVALID_AI_RESPONSE` o error de conexión.
      - Salto inmediato sin reintento ante `AI_TIMEOUT` del proveedor local.
      - Retorno de `{ operations, provider, fallback }` (con `fallback: true` cuando no fue el proveedor activo).
      - Registro en consola del proveedor que atendió la consulta y si hubo respaldo (sin tokens ni claves).
      - Si todos fallan por indisponibilidad, lanza el error `AI_ALL_PROVIDERS_FAILED`. Si alguno falló por formato inválido, relanza el último error.
  - `backend/src/ai/providers/index.ts` (**modificado**):
    - Re-exportación de `providerManager.ts`.
  - `backend/src/routes/diagramRoutes.ts` (**modificado**):
    - Reemplazada la llamada directa por `editWithFallback(currentModel, instructionToSend)`.
    - Añadidos los campos `provider` y `fallback` a la respuesta JSON 200 sin quitar ni renombrar `validOperations` ni `warnings`.
    - Mapeo en el bloque catch de `AI_ALL_PROVIDERS_FAILED` a HTTP 503 con `{ error: "AI_SERVICE_UNAVAILABLE", message: "La IA no está disponible por ahora" }`.
- **Archivos NO Modificados**:
  - `helpAssistant.ts`, `visionDiagram.ts`, `groq.ts`, `gemini.ts`, `localProvider.ts` y `aiProviderRoutes.ts` permanecieron intactos.
- **Pruebas Ejecutadas**:
  - `npm --prefix backend run build` (`tsc`): 0 errores TypeScript (código 0).
  - `npm --prefix backend test`: 7/7 tests aprobados (código 0).
  - `git diff backend/src/routes/diagramRoutes.ts`: Verificada integración limpia sin alterar validación ni flujo.

---

### [RES-052] Endpoints para listar y cambiar proveedor activo GET /ai/providers y PUT /ai/providers/active (CU24 Fase 4 Paso 2)
- **Fecha**: 2026-11-04
- **Tarea Asociada**: TSK-058
- **Entregables Producidos**:
  - `backend/src/ai/providers/providerManager.ts` (**modificado**):
    - Parámetro opcional `forceRefresh = false` en `checkProviderHealth(id, forceRefresh)` para saltar la caché de 30 s ante solicitudes explícitas.
    - Constantes exportadas de modelos estándar `GROQ_MODEL_NAME = "openai/gpt-oss-20b"` y `GEMINI_MODEL_NAME = "gemini-3.6-flash"`.
    - Interfaz `ProviderInfo` y función `listProviders(forceRefresh = false)` que itera por `["local", "groq", "gemini"]` devolviendo `{ id, label, available, active, model }` sin exponer URL de túneles ni credenciales.
  - `backend/src/routes/aiProviderRoutes.ts` (**modificado**):
    - Middleware `requireUserSession` que valida `x-session-id` o `authorization` contra `getSession()`, retornando 401 `{ error: "No autenticado" }` si falta o no existe.
    - Endpoint `GET /ai/providers`: protegido por sesión, acepta `?refresh=1` para forzar comprobación de salud fresca y devuelve la lista de proveedores.
    - Endpoint `PUT /ai/providers/active`: protegido por sesión, valida que `id` sea `"local" | "groq" | "gemini"` (400 si es inválido), ejecuta comprobación fresca de salud (`checkProviderHealth(id, true)`); responde 409 `{ error: "PROVIDER_UNAVAILABLE", message: "El modelo seleccionado no está disponible" }` si no responde dejando el activo intacto; o actualiza el activo en memoria con `setActiveProviderId(id)` y responde 200 `{ ok: true, active: id }`.
  - Inalterado `POST /ai/providers/local/register` que continúa autenticado únicamente por `x-registration-token`.
- **Archivos NO Modificados**:
  - `diagramRoutes.ts`, `helpAssistant.ts`, `groq.ts`, `gemini.ts`, `localProvider.ts` y `visionDiagram.ts` permanecieron 100% intactos.
- **Pruebas Ejecutadas**:
  - `npm --prefix backend run build` (`tsc`): 0 errores TypeScript (código 0).
  - `npm --prefix backend test`: 7/7 tests aprobados (código 0).
  - `git diff backend/src/routes/aiProviderRoutes.ts`: Verificada implementación limpia de GET y PUT junto a POST /local/register existente.

---

### [RES-059] Instalación y Módulo de Conexión a MongoDB Atlas (CU18 Fase 1)
- **Fecha**: 2026-11-05
- **Tarea Asociada**: TSK-059
- **Entregables Producidos**:
  - `backend/package.json` y `package-lock.json` (**modificados**): Instalación de la dependencia oficial `mongodb` (v7.8.0).
  - `backend/src/db/mongo.ts` (**creado**):
    - Cliente singleton `MongoClient` reutilizable con lectura de `MONGODB_URI` y opcional `MONGODB_DB_NAME`.
    - Función `getMongoDb(dbName?)`: Retorna la base de datos `Db` o `null` si la conexión no está activa.
    - Función `getMongoClient()`: Retorna la instancia del cliente `MongoClient` o `null`.
    - Función `checkMongoConnection()`: Conexión y verificación tolerante a fallos mediante ping (`admin.command({ ping: 1 })`), con timeout de 4 segundos (`serverSelectionTimeoutMS: 4000`), midiendo latencia y retornando `{ connected, latencyMs, message }` sin lanzar excepciones no controladas.
    - Función `closeMongoConnection()`: Cierre seguro del cliente para finalización ordenada del servidor.
  - `backend/.env.example` (**modificado**): Adición de la variable `MONGODB_URI=` documentada para Atlas.
  - `backend/src/index.ts` (**modificado**):
    - Al arrancar `server.listen`, invoca `checkMongoConnection()` de forma asíncrona sin bloquear el inicio del servidor Express, Postgres ni Socket.IO.
    - En caso de indisponibilidad o falta de variable, emite un `console.warn` claro sin interrumpir el funcionamiento normal.
    - En `handleShutdown`, añade `closeMongoConnection()` para liberación de recursos.
- **Archivos NO Modificados**:
  - `backend/src/socket.ts`, servicios de sincronización, base de datos Postgres y el frontend permanecieron 100% intactos.
- **Pruebas Ejecutadas**:
  - `npm --prefix backend run typecheck`: 0 errores TypeScript.
  - Comprobación con `MONGODB_URI` no definida: Retorna `{ connected: false, message: 'Variable MONGODB_URI no configurada o vacía en el entorno' }`.
  - Comprobación con `MONGODB_URI` mal formada / inalcanzable: Retorna `{ connected: false, message: '...', latencyMs: ... }` sin bloquear ni provocar excepciones no capturadas.
  - Arranque del servidor `index.ts`: Servidor arranca de forma inmediata en el puerto configurado registrando aviso en consola de forma limpia sin afectar a PostgreSQL ni Socket.IO.

---

### [RES-060] Repositorio de Mensajes de Chat y Reintento de Conexión en MongoDB (CU18 Fase 2)
- **Fecha**: 2026-11-05
- **Tarea Asociada**: TSK-060
- **Entregables Producidos**:
  - `backend/src/db/mongo.ts` (**modificado**):
    - `getMongoDb(dbName?)`: Ahora es asíncrono y reintenta conectar de forma segura si la conexión aún no existe o falló previamente, sin retener clientes rotos en caché ni arrojar excepciones no controladas.
    - `resolveDefaultDbName(uri?)`: Extrae el nombre de base de datos de la URI o retorna `"classdraw"` por defecto si la URI no incluye base de datos.
    - `checkMongoConnection()`: Detecta clientes en caché desconectados mediante ping y los recicla limpiamente para reconectar.
  - `backend/src/chat/chatRepository.ts` (**creado**):
    - Clases de error `ChatValidationError` y `ChatUnavailableError`.
    - `saveMessage(input)`: Recorta espacios, valida diagramId/authorSessionId/authorName y texto no vacío, rechaza textos mayores a 2000 caracteres, asigna `createdAt` (Date), inserta en `chat_messages` y retorna el documento con `id` como string.
    - `listMessages(diagramId, limit)`: Consulta los últimos mensajes de un diagrama por `createdAt: -1`, los invierte a orden cronológico ascendente, con `limit` por defecto 50 y tope de 100.
    - `ensureChatIndexes(collection)`: Crea de forma idempotente el índice `{ diagramId: 1, createdAt: 1 }`.
    - Manejo de fallos: Lanza `ChatUnavailableError` ante falta de conexión a Mongo o errores de red.
  - `backend/src/chat/chatRepository.test.ts` (**creado**):
    - Suite de 7 pruebas unitarias completas:
      1. Guardar y listar mensaje exitosamente.
      2. Orden cronológico ascendente.
      3. Límite de mensajes por defecto 50 y tope máximo 100.
      4. Rechazo controlado de texto vacío o con solo espacios.
      5. Validación estricta de 2000 (válido) y 2001 (inválido) caracteres.
      6. Dos diagramas distintos sin mezclar mensajes.
      7. Error controlado sin Mongo (`ChatUnavailableError`).
      8. Limpieza de documentos de prueba en base de datos tras la ejecución.
  - `backend/package.json` (**modificado**): Script `"test"` actualizado para incluir `src/chat/chatRepository.test.ts`.
- **Archivos NO Modificados**:
  - `socket.ts`, rutas de Express y frontend permanecieron 100% intactos.
- **Pruebas Ejecutadas**:
  - `npm --prefix backend run typecheck`: 0 errores TypeScript.
  - `npm --prefix backend test`: 14/14 tests aprobados (7 de converter + 7 de chatRepository, código 0).

---

### [RES-061] Eventos de Socket chat-join y chat-message para Chat de Equipo (CU18 Fase 3 Paso 1)
- **Fecha**: 2026-11-05
- **Tarea Asociada**: TSK-061
- **Entregables Producidos**:
  - `backend/src/socket.ts` (**modificado**):
    - Se agregaron los manejadores de eventos `chat-join` y `chat-message` preservando intactos los eventos existentes (`join-diagram`, `leave-diagram`, `diagram-update`, `diagram-state`).
    - Evento `chat-join`: Valida payload no vacío (`bad_request`), comprueba pertenencia del socket a la sala del diagrama con `socket.rooms.has(diagramId)` (`not_in_room`), valida sesión contra PostgreSQL con `getSession` (`invalid_session`) y almacena en `socket.data` `{ diagramId, sessionId, authorName: session.username }`, respondiendo `{ ok: true }`.
    - Evento `chat-message`: Exige pertenencia y correspondencia con `socket.data.diagramId` y `socket.rooms.has(diagramId)` (`not_joined`), valida sesión contra Postgres con `sessionExists` (`invalid_session`), garantiza que `authorSessionId` y `authorName` provengan exclusivamente de `socket.data` (inmune a suplantación desde el payload), valida texto no vacío (`empty`) y máx 2000 caracteres (`too_long`), persiste con `saveMessage` usando role `"user"` y manejo controlado de `ChatUnavailableError` (`unavailable`), emite `chat-message` a toda la sala mediante `io.to(diagramId).emit(...)` y confirma al remitente con `{ ok: true }`.
  - `backend/src/chat/socketChatEvents.test.ts` (**creado**):
    - Suite de 7 pruebas unitarias completas:
      1. `chat-join` rechaza con `bad_request` ante parámetros nulos, vacíos o ausentes.
      2. `chat-join` rechaza con `not_in_room` si el socket no ha ingresado a la sala del diagrama.
      3. `chat-join` rechaza con `invalid_session` si la sesión no existe en base de datos.
      4. `chat-join` exitoso almacena `diagramId`, `sessionId` y `authorName` en `socket.data`.
      5. `chat-message` rechaza con `not_joined` si el socket no completó `chat-join` para esa sala.
      6. `chat-message` valida `empty` y `too_long` (más de 2000 caracteres).
      7. `chat-message` guarda mensaje, emite a la sala y aplica estrictamente la identidad del autor de `socket.data` ignorando datos fraudulentos del payload.
  - `backend/package.json` (**modificado**): Script `"test"` ampliado para ejecutar los tres conjuntos de tests.
- **Archivos NO Modificados**:
  - Frontend, rutas de Express y tablas de PostgreSQL permanecieron 100% intactos.
- **Pruebas Ejecutadas**:
  - `npm --prefix backend run typecheck`: 0 errores TypeScript.
  - `npm --prefix backend test`: 21/21 tests aprobados (7 converter + 7 chatRepository + 7 socketChatEvents, código 0).

---

### [RES-062] Endpoint GET /diagrams/:id/chat para Historial de Mensajes (CU18 Fase 3 Paso 2)
- **Fecha**: 2026-11-05
- **Tarea Asociada**: TSK-062
- **Entregables Producidos**:
  - `backend/src/routes/diagramRoutes.ts` (**modificado**):
    - Implementación del endpoint `GET /diagrams/:id/chat?limit=50`.
    - Validación del encabezado `x-session-id` contra `getSession` (401 `{ error: "No autenticado" }` si falta o no existe).
    - Verificación de existencia del diagrama con `getDiagramById(id)` (404 `{ error: "Diagrama no encontrado." }`), siguiendo estrictamente el mismo patrón de los demás endpoints del router sin inventar permisos artificiales de acceso/propiedad.
    - Validación de `limit` opcional (por defecto 50, máx 100): si viene definido y no es un entero positivo (`/^\d+$/` > 0), responde 400 `{ error: "El parámetro 'limit' debe ser un número entero positivo." }`.
    - Llamada asíncrona a `listMessages(id, limit)` de `chatRepository.ts`, devolviendo HTTP 200 `{ messages: [...] }` en orden cronológico ascendente y formato idéntico al evento `chat-message`.
    - Mapeo de `ChatUnavailableError` a HTTP 503 `{ error: "chat_unavailable" }`.
  - `backend/src/chat/diagramChatEndpoint.test.ts` (**creado**):
    - Suite de 6 pruebas de integración HTTP:
      1. Sin encabezado `x-session-id` responde 401.
      2. Con sesión inexistente en `x-session-id` responde 401.
      3. Con diagrama inexistente responde 404.
      4. Con `limit` inválido (0, negativos, cadenas o decimales) responde 400.
      5. Con sesión válida y diagrama válido responde 200 con mensajes en orden cronológico ascendente y estructura idéntica a `chat-message`.
      6. Con `limit=2` responde exactamente los últimos 2 mensajes.
  - `backend/package.json` (**modificado**): Script `"test"` ampliado para ejecutar los cuatro conjuntos de tests.
- **Archivos NO Modificados**:
  - `socket.ts`, frontend y base de datos relacional permanecieron 100% intactos.
- **Pruebas Ejecutadas**:
  - `npm --prefix backend run typecheck`: 0 errores TypeScript.
  - `npm --prefix backend test`: 27/27 tests aprobados (7 converter + 7 chatRepository + 7 socketChatEvents + 6 diagramChatEndpoint, código 0).

---

### [RES-063] Sanitización de Mensajes de Chat Omitiendo authorSessionId (CU18 Ajuste de Seguridad)
- **Fecha**: 2026-11-05
- **Tarea Asociada**: TSK-063
- **Entregables Producidos**:
  - `backend/src/chat/chatRepository.ts` (**modificado**):
    - Definición de interfaz `PublicChatMessage` `{ id, diagramId, authorName, role, text, createdAt, mentions?, proposal? }`.
    - Función compartida `toPublicChatMessage(doc)`: Extrae y retorna únicamente las propiedades públicas, omitiendo de forma estricta `authorSessionId` (credencial sensible del usuario).
  - `backend/src/socket.ts` (**modificado**):
    - En el manejador `chat-message`, antes de emitir a la sala, convierte el documento guardado con `toPublicChatMessage(savedDoc)` asegurando que ningún socket de la sala reciba el `authorSessionId`.
  - `backend/src/routes/diagramRoutes.ts` (**modificado**):
    - En `GET /diagrams/:id/chat`, transforma los documentos retornados por `listMessages` mediante `messages.map(toPublicChatMessage)` antes de serializar el JSON de respuesta.
  - `backend/src/chat/chatRepository.test.ts` (**modificado**):
    - Agregada prueba unitaria específica para `toPublicChatMessage` validando la ausencia estricta de `authorSessionId` tanto en valor como en clave (`!('authorSessionId' in publicDoc)`).
  - `backend/src/chat/socketChatEvents.test.ts` y `backend/src/chat/diagramChatEndpoint.test.ts` (**modificados**):
    - Pruebas ajustadas para verificar que tanto el broadcast del socket como la respuesta HTTP no incluyan `authorSessionId`.
- **Archivos NO Modificados**:
  - Frontend, base de datos relacional y configuración general permanecieron intactos.
- **Pruebas Ejecutadas**:
  - `npm --prefix backend run typecheck`: 0 errores TypeScript.
  - `npm --prefix backend test`: 28/28 tests aprobados (código 0).

---

### [RES-064] Panel de Chat del Equipo en Frontend con Sincronización y Reintentos (CU18 Fase 4)
- **Fecha**: 2026-11-05
- **Tarea Asociada**: TSK-064
- **Entregables Producidos**:
  - `frontend/src/teamChat/types.ts` (**creado**):
    - Tipado para `PublicChatMessage` `{ id, diagramId, authorName, role, text, createdAt, mentions?, proposal? }`.
  - `frontend/src/teamChat/useTeamChat.ts` (**creado**):
    - Hook de gestión de chat del equipo que reutiliza el singleton `socket` de `realtimeSync.ts`.
    - Manejo de ciclo de vida: permanece montado mientras haya diagrama activo.
    - Emisión de `chat-join` `{ diagramId, sessionId }` (desde `localStorage` `active_session_id`) al conectar, reconectar y cambiar de diagrama.
    - Estrategia de reintento: ante respuesta `not_in_room`, reintenta automáticamente cada 500 ms hasta 5 veces para solventar condiciones de carrera cuando `join-diagram` toma algunos milisegundos.
    - Carga de historial mediante `GET /diagrams/:id/chat?limit=50` con encabezado `x-session-id`, fusionando mensajes sin duplicar por `id`.
    - Recepción en tiempo real de `chat-message`, deduplicando por `id` y descartando mensajes de otros diagramas.
    - Contador de mensajes no leídos (`unreadCount`) mientras el panel está cerrado, reseteado al abrir.
    - Envío de mensajes con `chat-message` `{ diagramId, text }`: preserva el texto ingresado ante errores y vacía el textarea únicamente si la respuesta fue `{ ok: true }`.
    - Manejo de errores en español y emisión de evento global `session-invalid` ante `invalid_session` (401 o callback de socket).
  - `frontend/src/teamChat/TeamChatButton.tsx` (**creado**):
    - Botón flotante circular (50x50 px) ubicado en `bottom: 72px; right: 86px;` (a la izquierda de `AiChatButton` sin solapamiento).
    - Icono de equipo/colaboración, estado abierto con "X", y badge rojo de mensajes no leídos (`!isOpen && unreadCount > 0`).
  - `frontend/src/teamChat/TeamChatPanel.tsx` (**creado**):
    - Panel emergente (360x480 px) ubicado en `bottom: 132px; right: 400px;` (a la izquierda de `AiChatPanel` sin solapamiento, permitiendo ambos abiertos a la vez).
    - Cabecera con título "Chat del equipo", indicador de conexión con viñeta de estado ("En línea", "Reconectando…" o "Conectando…"), slot reservado para el futuro selector de modelo IA (`id="team-chat-model-selector-slot"`), y botón de cierre.
    - Lista de mensajes con scroll automático inteligente (se desplaza al fondo ante nuevos mensajes salvo si el usuario subió el scroll manualmente).
    - Formateo de fecha `HH:mm`, diferenciación de autor propio (`.team-chat-msg--own` alineado a la derecha con fondo azul) frente a otros participantes, mensajes de IA (`role === "ai"`) y mensajes de sistema (`role === "system"`).
    - Caja de entrada con textarea multilínea (Enter envía, Shift+Enter inserta salto de línea), contador `{text.length}/2000`, botón de enviar deshabilitado si está vacío o supera 2000 caracteres, y banner visible de error con botón de descarte.
  - `frontend/src/teamChat/TeamChat.scss` (**creado**):
    - Estilos coincidentes con la paleta de la aplicación y variables CSS (`--island-bg`, `--dialog-border-color`, `--color-on-surface`, `--ui-font`).
    - Posicionamiento absoluto/fijo coordinado y reglas responsivas.
  - `frontend/src/teamChat/index.ts` (**creado**):
    - Barrel export para componentes, hook y tipos.
  - `frontend/excalidraw-app/App.tsx` (**modificado**):
    - Montaje de `teamChat = useTeamChat({ diagramId: currentDiagramId || getActiveDiagramId() })` dentro de `ExcalidrawWrapper`.
    - Renderizado de `<TeamChatButton>` y `{teamChat.isOpen && <TeamChatPanel>}` como hermanos de `AiChatButton` y `AiChatPanel`.
- **Archivos NO Modificados**:
  - `AiChatPanel.tsx`, `AiChat.scss`, sincronización de elementos del lienzo, `joinDiagramRoom`/`leaveDiagramRoom` y backend permanecieron intactos.
- **Pruebas Ejecutadas**:
  - `npm --prefix frontend run test:typecheck`: 0 errores TypeScript en frontend (`tsc` completado exitosamente).
  - `npm --prefix backend test`: 28/28 tests aprobados en backend (código 0).

---

### [RES-068] Investigación Técnica de Selección de Proveedores y Fallback (CU24)
- **Fecha**: 2026-11-06
- **Tarea Asociada**: TSK-068
- **Entregables Producidos**:
  - Informe técnico de discrepancia entre el requisito funcional de CU24 (permitir seleccionar modelos no disponibles) y la respuesta HTTP 409 `PROVIDER_UNAVAILABLE` en `PUT /ai/providers/active`.
  - Análisis del flujo de ejecución de fallback en `providerManager.ts:editWithFallback` y comprobación de seguridad ante selección de proveedores inactivos.
  - Propuesta técnica aprobada para la corrección de `aiProviderRoutes.ts` y la circularidad de la cadena `getFallbackChain`.

---

### [RES-069] Corrección de Selección de Proveedores IA y Cadena de Fallback (CU24)
- **Fecha**: 2026-11-06
- **Tarea Asociada**: TSK-069
- **Entregables Producidos**:
  - `backend/src/routes/aiProviderRoutes.ts` (**modificado**):
    - En `PUT /ai/providers/active`, se eliminó la comprobación bloqueante `checkProviderHealth(id, true)` que respondía 409 `PROVIDER_UNAVAILABLE`.
    - Se mantiene estrictamente el middleware de sesión `requireUserSession` (401 ante falta o invalidez de sesión) y la validación de identificador (400 `INVALID_INPUT` si no es `local`, `groq` o `gemini`).
    - Ahora ejecuta `setActiveProviderId(id)` y responde 200 `{ ok: true, active: id }` incluso si el proveedor no está disponible.
  - `backend/src/ai/providers/providerManager.ts` (**modificado**):
    - Corregida la función `getFallbackChain(active)` exportada: ante cualquier proveedor activo, intenta primero el activo y luego los otros dos en el orden base `["local", "groq", "gemini"]` sin duplicados (`[active, ...baseOrder.filter(id => id !== active)]`).
    - Cobertura completa de casos: `local -> groq -> gemini`, `groq -> local -> gemini`, `gemini -> local -> groq`.
  - `backend/src/ai/providers/aiProviders.test.ts` (**creado**):
    - Suite automatizada con 14 tests evaluando: orden de `getFallbackChain` para cada proveedor; rechazos 401 y 400 en `PUT /active`; selección de Local offline (200), Groq (200) y Gemini (200); resolución con fallback ante Local o Gemini no disponibles; error `AI_ALL_PROVIDERS_FAILED` y respuesta HTTP 503 `AI_SERVICE_UNAVAILABLE` en `POST /diagrams/:id/ai-edit`.
  - `backend/package.json` (**modificado**):
    - Inclusión de `src/ai/providers/aiProviders.test.ts` en el comando `npm test`.
- **Archivos NO Modificados**:
  - `frontend/src/teamChat/TeamModelSelector.tsx`, `AiChatPanel.tsx`, `socket.ts`, autenticación y configuraciones de proveedores permanecieron 100% intactos.
- **Verificación Realizada**:
  - `npm --prefix backend run build`: 0 errores TypeScript (`tsc` completado exitosamente).
  - `npm --prefix frontend run test:typecheck`: 0 errores TypeScript (`tsc` completado exitosamente).
  - `npm --prefix backend test`: 42/42 tests aprobados (9 suites completas, 0 fallos).

---

### [RES-070] Funciones puras de mención @ia y formateo con nombre (CU19 Fase 1A)
- **Fecha**: 2026-11-06
- **Tarea Asociada**: TSK-070
- **Entregables Producidos**:
  - `backend/src/chat/aiChatHelpers.ts`: `parseMention(text)` y `ensureAddressedByName(response, name)`.
  - `backend/src/chat/aiChatHelpers.test.ts`: Suite con 16 pruebas unitarias con `node:test`.
- **Verificación Realizada**:
  - `npx tsx --test backend/src/chat/aiChatHelpers.test.ts`: 16/16 tests pasados.

---

### [RES-071] Serialización compacta y construcción de contexto de chat (CU19 Fase 1B)
- **Fecha**: 2026-11-06
- **Tarea Asociada**: TSK-071
- **Entregables Producidos**:
  - `backend/src/chat/chatContext.ts`: `formatModelCompact(model)` y `buildChatContext(...)`.
  - `backend/src/chat/chatContext.test.ts`: Suite con 7 pruebas unitarias con `node:test`.
- **Verificación Realizada**:
  - `npx tsx --test backend/src/chat/chatContext.test.ts`: 7/7 tests pasados.

---

### [RES-072] Implementación aditiva de chatReply en capa de proveedores (CU19 Fase 2)
- **Fecha**: 2026-11-06
- **Tarea Asociada**: TSK-072
- **Entregables Producidos**:
  - `backend/src/ai/providers/types.ts`: `ChatReplyOptions` y método `chatReply` en `ModelProvider`.
  - `backend/src/ai/providers/localProvider.ts`, `groqProvider.ts`, `geminiProvider.ts`: `chatReply`.
  - `backend/src/ai/providers/providerManager.ts`: `chatWithFallback(...)`.
  - `backend/src/scripts/testChatReply.ts`: Script de prueba manual de texto libre.
- **Verificación Realizada**:
  - `npm --prefix backend test`: 42/42 tests aprobados.

---

### [RES-073] Servicio de chat de IA con cola FIFO y dependencias inyectables (CU19 Fase 3A)
- **Fecha**: 2026-11-06
- **Tarea Asociada**: TSK-073
- **Entregables Producidos**:
  - `backend/src/chat/aiChatHelpers.ts`: `trimToLastSentence(text)`.
  - `backend/src/chat/aiChatService.ts`: `createAiChatService`, `AiBusyError`, `AiUnavailableError`, `TEAM_AI_SYSTEM_PROMPT`.
  - `backend/src/chat/aiChatService.test.ts`: Suite con 8 tests unitarios.
- **Verificación Realizada**:
  - `npx tsx --test backend/src/chat/aiChatHelpers.test.ts`: 24/24 tests pasados.
  - `npx tsx --test backend/src/chat/aiChatService.test.ts`: 8/8 tests pasados.

---

### [RES-074] Conexión de aiChatService a Socket.IO y Repositorio de Chat (CU19 Fase 3B)
- **Fecha**: 2026-11-06
- **Tarea Asociada**: TSK-074
- **Entregables Producidos**:
  - `backend/src/chat/chatRepository.ts`: Soporte de `replyTo`, `addressedTo` y auto-detección de `mentions: ["ia"]`.
  - `backend/src/socket.ts`: Hook en `chat-message` con `ai-status` ("thinking"/"idle"), invocación de `answerInRoom`, persistencia y broadcast.
  - `backend/src/scripts/testTeamChatAi.ts`: Script de prueba de integración Socket.IO con dos clientes (5 escenarios).
- **Verificación Realizada**:
  - `npx tsx backend/src/scripts/testTeamChatAi.ts`: 5/5 pruebas aprobadas.

---

### [RES-075] Verificación Integral de CU19 antes de la Fase 4
- **Fecha**: 2026-11-06
- **Tarea Asociada**: TSK-075
- **Entregables Producidos**:
  - `backend/package.json`: Inclusión de `aiChatHelpers.test.ts`, `chatContext.test.ts` y `aiChatService.test.ts` en script `"test"`.
  - `backend/src/scripts/testTeamChatAi.ts` y `backend/scripts/testTeamChatAi.ts`: Ampliación a 7 escenarios de integración:
    1. Verificación de secuencia `ai-status` thinking/idle con `askerName: "Ana"`.
    2. Consulta `@ia` a secas.
    3. Mensaje normal sin activación de IA.
    4. Dos consultas concurrentes resueltas en orden FIFO.
    5. Historial `GET /diagrams/:id/chat` con mensajes de IA y metadatos.
    6. Saturación de cola con 6 consultas rápidas (1 activa + 5 en espera + 6ª rechazada con `AiBusyError`).
    7. Fallo de proveedores simulado con `AiUnavailableError` emitiendo mensaje de reintento.
  - Análisis forense de suplantación de identidad para `role: "ai"` y `authorName: "IA"`.
- **Verificación Realizada**:
  - `npm --prefix backend run typecheck`: 0 errores.
  - `npm --prefix backend test`: 81/81 pruebas aprobadas (17 suites completas).
  - `npx tsx backend/scripts/testTeamChatAi.ts`: 7/7 pruebas de integración aprobadas (exit code 0).

---

### [RES-076] Cierre de Verificación de CU19 y Mitigación de Suplantación
- **Fecha**: 2026-11-06
- **Tarea Asociada**: TSK-076
- **Entregables Producidos**:
  - `backend/src/socket.ts` (**modificado**): En `chat-join`, normalización de `session.username` (`trim().toLowerCase() === "ia"`); si coincide, asigna `authorName: "IA (usuario)"` sin rechazar la conexión.
  - `backend/src/chat/chatRepository.ts` (**modificado**): En `saveMessage`, validación estricta de que si `role === "ai"`, `authorSessionId` debe ser forzosamente `"ai"` (rechaza cualquier otro valor con `ChatValidationError`).
  - `backend/src/chat/chatRepository.test.ts` (**modificado**): Agregada prueba 9 verificando el rechazo de `role: "ai"` con sesiones de usuario y aceptación con `"ai"`.
  - `backend/src/chat/socketChatEvents.test.ts` (**modificado**): Agregada prueba 8 verificando la transformación de `username: "  Ia  "` a `authorName: "IA (usuario)"` en `chat-join`.
  - Unificación de scripts: eliminado el archivo puente `backend/scripts/testTeamChatAi.ts`, manteniendo la única copia autoritativa en `backend/src/scripts/testTeamChatAi.ts` y `testChatReply.ts` en `backend/src/scripts/testChatReply.ts`.
- **Verificación Realizada**:
  - `npm --prefix backend run typecheck`: 0 errores TypeScript.
  - `npm --prefix backend test`: 83/83 pruebas aprobadas (17 suites completas).
  - `npx tsx backend/src/scripts/testTeamChatAi.ts`: 7/7 pruebas de integración aprobadas exitosamente.

---

### [RES-077] Identidad y Nombre Propio "Codia" para la IA del Equipo (CU19)
- **Fecha**: 2026-11-06
- **Tarea Asociada**: TSK-077
- **Entregables Producidos**:
  - `backend/src/chat/aiChatHelpers.ts` (**modificado**):
    - Exportadas las constantes `AI_DISPLAY_NAME = "Codia"` y `AI_MENTION_ALIASES = ["ia", "codia"]`.
    - `parseMention` actualizado para detectar `@ia` y `@codia` de forma insensible a mayúsculas como palabra completa (`/(?<=^|\s)@(?:ia|codia)(?=[\s\p{P}]|$)/iu`).
  - `backend/src/socket.ts` (**modificado**):
    - Reemplazo de `authorName: "IA"` por `authorName: AI_DISPLAY_NAME` en las respuestas de la IA, mensajes de IA ocupada (`AiBusyError`) y mensajes de indisponibilidad (`AiUnavailableError`).
    - En `chat-join`, normalización de usuario: si `normalizedUser === "ia" || normalizedUser === "codia"`, asigna `authorName: "{nombre} (usuario)"` (`"IA (usuario)"` o `"Codia (usuario)"`).
  - `backend/src/chat/aiChatService.ts` (**modificado**):
    - Actualizado `TEAM_AI_SYSTEM_PROMPT` con la directiva: *"Te llamas Codia. Eres la desarrolladora senior y mentora del equipo. Si te preguntan quién eres, te presentas como Codia, la desarrolladora senior y mentora del equipo."*
  - `backend/src/chat/aiChatHelpers.test.ts` (**modificado**): Pruebas añadidas para `AI_DISPLAY_NAME`, `AI_MENTION_ALIASES`, menciones `@codia`, `@Codia`, `@ia`, y no activación ante `@codiax` o correos.
  - `backend/src/chat/socketChatEvents.test.ts` (**modificado**): Prueba 9 añadida para `username: "  Codia  "` transformado a `"Codia (usuario)"`.
  - `backend/src/chat/chatRepository.test.ts` (**modificado**): Prueba 9 ajustada con `AI_DISPLAY_NAME`.
  - `backend/src/scripts/testTeamChatAi.ts` (**modificado**): Integración adaptada para validar `authorName: AI_DISPLAY_NAME` ("Codia") en los 7 escenarios.
- **Archivos NO Modificados**:
  - `diagramRoutes.ts`, `ai-edit`, `applyAiOperations`, `operationValidator`, lienzo, panel personal y frontend permanecieron estrictamente intactos.
- **Verificación Realizada**:
  - `npm --prefix backend run typecheck`: 0 errores TypeScript.
  - `npm --prefix backend test`: 88/88 pruebas aprobadas (17 suites completas).
  - `npx tsx backend/src/scripts/testTeamChatAi.ts`: 7/7 pruebas de integración aprobadas (exit code 0).

---

### [RES-078] Soporte Visual, Menciones y Auto-scroll de Codia en el Chat del Equipo (CU19 Fase 4A Frontend)
- **Fecha**: 2026-11-06
- **Tarea Asociada**: TSK-078
- **Entregables Producidos**:
  - `frontend/src/teamChat/types.ts` (**modificado**):
    - Exportada constante `AI_DISPLAY_NAME = "Codia"`.
    - Ampliado `PublicChatMessage` con `role: "user" | "ai" | "system" | string`, y campos opcionales `replyTo?: string` y `addressedTo?: string`.
  - `frontend/src/teamChat/mentionHelper.ts` (**creado**):
    - Función pura `formatMessageSegments(text: string): MessageSegment[]` para segmentar mensajes separando de forma segura menciones `@ia` y `@codia` (case-insensitive como palabra completa) sin usar `dangerouslySetInnerHTML`.
  - `frontend/src/teamChat/mentionHelper.test.ts` (**creado**):
    - Suite de 10 pruebas unitarias con Vitest cubriendo menciones al inicio, medio, fin con puntuación, case-insensitivity, no activación en correos o palabras compuestas, mensajes de una sola mención y saltos de línea.
  - `frontend/src/teamChat/TeamChatPanel.tsx` (**modificado**):
    - Decisión estricta de burbuja IA por `msg.role === "ai"` (nunca por nombre).
    - En mensajes de IA: renderizado de autor como `msg.authorName || AI_DISPLAY_NAME`, badge `<span className="team-chat-msg-badge-ai">IA</span>`, y si existe `addressedTo`: `<span className="team-chat-msg-addressed">para {msg.addressedTo}</span>`.
    - Texto de la IA renderizado como texto plano con saltos de línea preservados (`white-space: pre-wrap`), sin interpretar HTML ni Markdown.
    - En mensajes humanos (`role !== "ai"`): formateo con `formatMessageSegments` resaltando menciones en `<strong className="team-chat-mention">`.
  - `frontend/src/teamChat/TeamChat.scss` (**modificado**):
    - Estilo de burbuja `.team-chat-msg--ai` diferenciado con fondo lavanda/violeta `#f3e8ff`, texto `#3b0764`, borde `#d8b4fe`, alineado a la izquierda.
    - Badge IA `.team-chat-msg-badge-ai` en fondo violeta `#7e22ce` y texto blanco.
    - Estilo de mención `.team-chat-mention` en negrita violeta (con ajuste de alto contraste en mensajes propios y en modo oscuro).
    - Soporte completo para `.theme--dark` y `[data-theme="dark"]` con fondo `#2e1065`, texto `#f3e8ff`, borde `#7e22ce` y menciones `#c084fc`.
- **Archivos NO Modificados**:
  - Lienzo y sincronización de Excalidraw, panel de IA personal (`AiChatPanel.tsx`, `AiChatButton.tsx`), `realtimeSync.ts` y rutas del backend permanecieron estrictamente intactos.
- **Verificación Realizada**:
  - `yarn --cwd frontend test:app src/teamChat/mentionHelper.test.ts --run`: 10/10 pruebas unitarias aprobadas.
  - `yarn --cwd frontend test:typecheck`: 0 errores TypeScript (`tsc` exit code 0).
  - `npm --prefix backend test`: 88/88 pruebas aprobadas (17 suites completas).

---

### [RES-079] Indicador de Estado "Codia está pensando" y Autocompletado @Codia (CU19 Fase 4B Frontend)
- **Fecha**: 2026-11-06
- **Tarea Asociada**: TSK-079
- **Entregables Producidos**:
  - `frontend/src/teamChat/mentionHelper.ts` (**modificado**):
    - Añadida la función pura `getMentionSuggestionMatch(text: string, cursorPos: number): MentionSuggestionMatch | null` para detectar si la palabra que se está escribiendo es un prefijo incompleto de `@Codia` o `@ia` (case-insensitive: `@`, `@c`, `@co`, `@cod`, `@codi`, `@i`). Retorna `null` si ya está completa (`@codia`, `@ia`), si no empieza por `@` (`correo@c`) o si es otro prefijo (`@xyz`).
  - `frontend/src/teamChat/mentionHelper.test.ts` (**modificado**):
    - Ampliada la suite con 8 pruebas adicionales para `getMentionSuggestionMatch` (18 pruebas en total), todas aprobadas.
  - `frontend/src/teamChat/TeamChatPanel.tsx` (**modificado**):
    - Escucha del evento `ai-status` en Socket.IO con limpieza al desmontar (`socket.off("ai-status")`).
    - Ignora eventos de otro `diagramId`.
    - Conteo por `askerName`: `thinking` suma 1, `idle` resta 1 (mínimo 0).
    - Timeout de seguridad de 60 s que limpia automáticamente el estado si no llega `idle`.
    - Reseteo completo de contadores al cambiar de diagrama (`diagramId`) o al reconectar el socket (`socket.on("connect")`).
    - Renderizado accesible con `aria-live="polite"` del bloque: `"Codia IA está pensando… ({askers})"` con puntos animados y lista de personas esperando.
    - Actualizado placeholder del textarea: `"Escribe un mensaje o usa @Codia para consultar a la IA"`.
    - Barra flotante de sugerencia clicable `"@Codia — Consultar a la IA"` al escribir `@...`; reemplaza la palabra incompleta por `"@Codia "` y reenfoca el textarea.
    - Cuadro de texto y botón de envío completamente no bloqueantes mientras la IA piensa (las personas pueden seguir conversando).
  - `frontend/src/teamChat/TeamChat.scss` (**modificado**):
    - Estilos para `.team-chat-thinking-indicator`: burbuja lavanda/violeta con autor `Codia`, badge `IA`, puntos con animación `@keyframes team-chat-dot-bounce`, y texto de espera cursivo.
    - Estilos para `.team-chat-suggestion-bar`: popup flotante encima del cuadro de texto con sombra y hover acentuado.
    - Soporte completo en tema claro y oscuro (`.theme--dark`, `[data-theme="dark"]`).
  - `frontend/src/teamChat/useTeamChat.ts` (**modificado**): Exposición de `diagramId` en el objeto retornado.
  - `frontend/excalidraw-app/App.tsx` (**modificado**): Paso explícito de `diagramId={teamChat.diagramId}` a `TeamChatPanel`.
- **Archivos NO Modificados**:
  - Lienzo y sincronización de Excalidraw, panel de IA personal (`AiChatPanel.tsx`, `AiChatButton.tsx`), `realtimeSync.ts` y backend permanecieron estrictamente intactos.
- **Verificación Realizada**:
  - `yarn --cwd frontend test:app src/teamChat/mentionHelper.test.ts --run`: 18/18 pruebas aprobadas (100% éxito).
  - `yarn --cwd frontend test:typecheck`: 0 errores TypeScript (`tsc` exit code 0).
  - `yarn --cwd frontend build`: Build de Vite completado exitosamente con código de salida 0.

---

### [RES-080] Ajuste Fino del Indicador ai-status y Ampliación de Timeout a 180s (CU19 Frontend)
- **Fecha**: 2026-11-07
- **Tarea Asociada**: TSK-080
- **Entregables Producidos**:
  - `frontend/src/teamChat/TeamChatPanel.tsx` (**modificado**):
    - Retirada la etiqueta/badge "IA" del indicador de estado `ai-status` en `.team-chat-thinking-bubble`, dejándola exclusivamente en las cabeceras de los mensajes de Codia.
    - El indicador muestra exactamente `{AI_DISPLAY_NAME} está pensando…` junto con los puntos animados y los nombres de quienes esperan entre paréntesis `(Ana, Luis)`.
    - Ampliado el temporizador de seguridad de 60 s a 180 s (`180000` ms) para permitir respuestas extensas de proveedores sin que el indicador se limpie prematuramente si el evento `idle` demora.
- **Archivos NO Modificados**:
  - Lienzo y sincronización de Excalidraw, panel de IA personal (`AiChatPanel.tsx`, `AiChatButton.tsx`), `realtimeSync.ts`, rutas y lógica de backend permanecieron estrictamente intactos.
- **Verificación Realizada**:
  - `yarn --cwd frontend test:app src/teamChat/mentionHelper.test.ts --run`: 18/18 pruebas aprobadas (100% éxito).
  - `yarn --cwd frontend test:typecheck`: 0 errores TypeScript (`tsc` exit code 0).
  - `yarn --cwd frontend build`: Build de Vite completado exitosamente con código de salida 0.

---

### [RES-081] Ajustes de Backend en CU19: Prompt UML de Codia y Minúscula Contextual en ensureAddressedByName
- **Fecha**: 2026-11-07
- **Tarea Asociada**: TSK-081
- **Entregables Producidos**:
  - `backend/src/chat/aiChatService.ts` (**modificado**):
    - Actualizado `TEAM_AI_SYSTEM_PROMPT`:
      - Longitud fijada en unas 120 palabras (salvo solicitud explícita de mayor detalle).
      - Formato: solo texto plano, permitiendo únicamente **negrita** puntual y `código en línea`, sin encabezados (`#`) ni tablas, y bloques de código ` ``` ` exclusivamente si el usuario pide código de forma explícita.
      - Directiva estricta de no asumir lenguaje ni tecnología (no dar Java, SQL ni JPA sin petición explícita), respondiendo en términos de UML y del diagrama del equipo.
      - Notas de notación UML: atributo derivado con `/` antes del nombre (ej. `/edad`), composición con rombo relleno en el lado del todo (partes no existen sin el todo), agregación con rombo vacío (partes independientes) y multiplicidades `1`, `0..1`, `*`, `1..*`.
  - `backend/src/chat/aiChatHelpers.ts` (**modificado**):
    - En `ensureAddressedByName`: cuando se antepone `"{nombre}, "`, se pasa a minúscula la primera letra de la respuesta original mediante `lowerFirstIfNotAcronym`, salvo que la primera palabra sea una sigla o nombre en mayúsculas (detectado al tener también su segunda letra en mayúsculas, ej. `"UML"`, `"SQL"`, `"DTO"`).
  - `backend/src/chat/aiChatHelpers.test.ts` (**modificado**):
    - Agregadas pruebas unitarias para `"Para asociar" → "Ana, para asociar"`, `"UML es" → "Ana, UML es"`, `"SQL es" → "Ana, SQL es"` y `"Ana, hola"` inalterado.
  - `backend/src/chat/aiChatService.test.ts` (**modificado**):
    - Actualizadas aserciones de respuesta para reflejar la minúscula inicial (`"Davico, veo dos clases..."`, `"Ana, la relación..."`).
    - Añadidas aserciones que validan las directivas y notas de notación UML en `TEAM_AI_SYSTEM_PROMPT`.
    - Agregada prueba 11 comprobando conservación de mayúsculas en siglas al inicio de la respuesta en `answerInRoom`.
- **Archivos NO Modificados**:
  - `diagramRoutes.ts`, `ai-edit`, UC7/8/9/17, `applyAiOperations`, `operationValidator`, lienzo, panel de IA personal y frontend permanecieron estrictamente intactos.
- **Verificación Realizada**:
  - `npm --prefix backend run typecheck`: 0 errores TypeScript (`tsc --noEmit`).
  - `npm --prefix backend test`: 92/92 pruebas aprobadas (17 suites completas).
  - `npx tsx backend/src/scripts/testTeamChatAi.ts`: 7/7 escenarios de integración aprobados (exit code 0).

---

### [RES-082] Formateador Ligero para Respuestas de Codia y Ajustes de UI en Team Chat (CU19 Frontend)
- **Fecha**: 2026-11-07
- **Tarea Asociada**: TSK-082
- **Entregables Producidos**:
  - `frontend/src/teamChat/aiTextFormatter.tsx` (**creado**):
    - Módulo puro para segmentación y renderizado seguro de respuestas de la IA.
    - Exporta tipos `AiTextSegment` y funciones `parseAiTextSegments(text: string): AiTextSegment[]` y `renderAiFormattedText(text: string): React.ReactNode`.
    - Soporta exclusivamente:
      1. Bloques de código con ```lenguaje ... ``` (mapeados a `<pre className="team-chat-code-block" data-language={lang}><code className="team-chat-code-content">{code}</code></pre>`).
      2. Código en línea con `...` (mapeado a `<code className="team-chat-inline-code">{code}</code>`).
      3. Negrita puntual con **...** (delimitadores CommonMark, mapeado a `<strong className="team-chat-bold">{text}</strong>`).
    - Cero uso de `dangerouslySetInnerHTML`: todo HTML inyectado o escrito por el modelo es escapado y renderizado como texto plano.
    - Bloques de código no cerrados (``` sin cierre) y asteriscos sueltos (`*item*`, `**incompleto`, `2 * 3 = 6`) se tratan estrictamente como texto plano.
  - `frontend/src/teamChat/aiTextFormatter.test.ts` (**creado**):
    - Suite exhaustiva con 11 pruebas unitarias cubriendo los 8 casos exigidos más validación de elementos React y robustez ante cadenas vacías/nulas.
  - `frontend/src/teamChat/TeamChatPanel.tsx` (**modificado**):
    - Sugerencia de mención al escribir "@": simplificada para mostrar únicamente `@Codia` (eliminado el texto `— Consultar a la IA`).
    - Placeholder del cuadro de texto actualizado a `"Escribe un mensaje o usa @Codia para consultarle"`.
    - Renderizado del cuerpo del mensaje: aplica `renderAiFormattedText(msg.text)` únicamente a mensajes con `role === "ai"`, manteniendo intacto `formatMessageSegments` para los mensajes de usuarios.
  - `frontend/src/teamChat/TeamChat.scss` (**modificado**):
    - Estilos específicos para `.team-chat-code-block`, `.team-chat-code-content`, `.team-chat-inline-code` y `.team-chat-bold`.
    - Tema claro: bloques con fondo `#faf5ff`, borde `#d8b4fe`, color `#3b0764`, fuente monospace y scroll horizontal (`overflow-x: auto`) para evitar ensanchar el panel.
    - Tema oscuro: bloques con fondo `#18092e`, borde `#581c87`, color `#f3e8ff`.
  - `frontend/src/teamChat/index.ts` (**modificado**):
    - Exporta `aiTextFormatter`.
- **Archivos NO Modificados**:
  - Lienzo y su sincronización, `realtimeSync.ts`, panel de IA personal (`AiChatPanel.tsx`, `AiChatButton.tsx`) y backend se mantuvieron estrictamente intactos.
- **Verificación Realizada**:
  - `yarn --cwd frontend test:app src/teamChat --run`: 29/29 pruebas aprobadas (18 en `mentionHelper.test.ts` y 11 en `aiTextFormatter.test.ts`).
  - `yarn --cwd frontend test:typecheck`: 0 errores TypeScript (`tsc` exit code 0).
  - `yarn --cwd frontend build`: Compilación de producción con Vite completada exitosamente con código de salida 0.

---

### [RES-083] Refinamiento de Directrices en TEAM_AI_SYSTEM_PROMPT para Codia (CU19 Backend)
- **Fecha**: 2026-11-07
- **Tarea Asociada**: TSK-083
- **Entregables Producidos**:
  - `backend/src/chat/aiChatService.ts` (**modificado**):
    - Actualizado `TEAM_AI_SYSTEM_PROMPT` con las directrices estrictas solicitadas:
      1. *Ejemplos conceptuales*: Explicación mediante ejemplo simple y genérico (ej. Persona con `/edad`), utilizando el diagrama del equipo solo si el concepto encaja de verdad con sus clases sin forzar el ejemplo.
      2. *Fidelidad al diagrama*: Prohibición estricta de inventar clases, atributos o relaciones como si existieran; si propone algo nuevo, debe señalar explícitamente que es una sugerencia.
      3. *Honestidad intelectual*: Declarar abiertamente si no está segura de algo en lugar de inventar.
      4. *Formato de énfasis*: Prohibición de cursiva con asterisco simple; uso exclusivo de **negrita** para énfasis.
      5. *Relaciones UML puras*: Explicación de relaciones basada en asociación y multiplicidad, sin proponer claves foráneas ni atributos tipo `productoId` salvo consulta explícita sobre base de datos.
  - `backend/src/chat/aiChatService.test.ts` (**modificado**):
    - Incorporadas aserciones que validan la presencia de las nuevas reglas en `TEAM_AI_SYSTEM_PROMPT`:
      - `/No uses cursiva con asterisco simple/i`
      - `/En preguntas conceptuales, explica con un ejemplo simple y genérico/i`
      - `/Nunca inventes clases, atributos ni relaciones/i`
      - `/Si no estás segura de algo, dilo en vez de inventar/i`
      - `/habla de la asociación y su multiplicidad; no propongas claves foráneas/i`
- **Archivos NO Modificados**:
  - Ningún otro archivo del backend ni del frontend fue alterado.
- **Verificación Realizada**:
  - `npm --prefix backend run typecheck`: 0 errores TypeScript (`tsc --noEmit`).
  - `npm --prefix backend test`: 92/92 pruebas aprobadas (17 suites completas).
  - `npx tsx backend/src/scripts/testTeamChatAi.ts`: 7/7 escenarios de integración aprobados (exit code 0).

---

### [RES-084] Corrección de Truncamiento por Límite en chatReply para Proveedores Gemini, Groq y Local (CU19 Backend)
- **Fecha**: 2026-11-07
- **Tarea Asociada**: TSK-084
- **Entregables Producidos**:
  - `backend/src/ai/providers/types.ts` (**modificado**):
    - Exporta `SENTENCE_CLOSING_PUNCTUATION = /[.!?\)»"]/`.
    - Exporta la función utilitaria `checkTruncatedResponse(text: string, isLimitCut: boolean): void`. Si hubo corte por límite (`MAX_TOKENS` o `length`) y el texto tiene menos de 200 caracteres o no contiene signos de cierre de oración, lanza un error controlado `Error("TRUNCATED_RESPONSE")` con propiedad `code: "TRUNCATED_RESPONSE"`. Si tiene >= 200 caracteres y signos de puntuación de cierre, se preserva.
  - `backend/src/ai/providers/geminiProvider.ts` (**modificado**):
    - En `chatReply`, añade `thinkingConfig: { thinkingBudget: 0 }` en la configuración de llamada a `generateContent`, manteniendo `maxOutputTokens: 400`.
    - Detecta si `candidate.finishReason === "MAX_TOKENS"` y ejecuta `checkTruncatedResponse`.
  - `backend/src/ai/providers/groqProvider.ts` (**modificado**):
    - En `chatReply`, detecta si `choice.finish_reason === "length"` y ejecuta `checkTruncatedResponse`.
  - `backend/src/ai/providers/localProvider.ts` (**modificado**):
    - En `chatReply`, detecta si `choice.finish_reason === "length"` y ejecuta `checkTruncatedResponse`.
  - `backend/src/ai/providers/providerManager.ts` (**modificado**):
    - En `chatWithFallback`, detecta explícitamente `err.message === "TRUNCATED_RESPONSE" || err.code === "TRUNCATED_RESPONSE"`.
    - Evita reintentos inútiles en el mismo proveedor e inmediatamente pasa al siguiente proveedor en la cadena de respaldo circular.
  - `backend/src/ai/providers/aiProviders.test.ts` (**modificado**):
    - Añadida suite `CU19 — Manejo de respuestas truncadas en chatReply` con 7 pruebas unitarias:
      1. `checkTruncatedResponse` no lanza si no hubo corte por límite.
      2. `checkTruncatedResponse` lanza ante corte por límite con texto corto (<200 chars).
      3. `checkTruncatedResponse` lanza ante corte por límite con texto >=200 chars sin signos de cierre.
      4. `checkTruncatedResponse` conserva la respuesta si >=200 chars y tiene signos de cierre.
      5. `chatWithFallback`: Gemini con MAX_TOKENS y texto corto cae al siguiente proveedor (Groq) sin reintentos inútiles.
      6. `chatWithFallback`: Gemini con MAX_TOKENS y texto largo con puntuación se conserva.
      7. `chatWithFallback`: Gemini con respuesta normal se conserva.
- **Archivos NO Modificados**:
  - `editDiagramByInstruction`, servicios de edición de UC7/8/9/17 (`gemini.ts`, `groq.ts`), rutas de diagramas, lienzo y frontend se mantuvieron estrictamente intactos.
- **Verificación Realizada**:
  - `npm --prefix backend run typecheck`: 0 errores TypeScript (`tsc --noEmit`).
  - `npm --prefix backend test`: 99/99 pruebas aprobadas (18 suites completas).
  - `npx tsx backend/src/scripts/testTeamChatAi.ts`: 7/7 escenarios de integración aprobados (exit code 0).
  - Script desechable en Temp ejecutando `chatReply` real de Gemini 3 veces con `thinkingBudget: 0`:
    - Ejecución 1: finishReason `STOP`, 685 caracteres (157 tokens visibles, 0 tokens de pensamiento), puntuación válida.
    - Ejecución 2: finishReason `STOP`, 795 caracteres (162 tokens visibles, 0 tokens de pensamiento), puntuación válida.
    - Ejecución 3: finishReason `STOP`, 721 caracteres (175 tokens visibles, 0 tokens de pensamiento), puntuación válida.

---

### [RES-085] Contexto Conversacional Estricto, Rotulación y Métricas de Latencia en CU19 (Backend)
- **Fecha**: 2026-11-07
- **Tarea Asociada**: TSK-085
- **Entregables Producidos**:
  - `backend/src/chat/aiChatService.ts` (**modificado**):
    - En `TEAM_AI_SYSTEM_PROMPT`, se agregó la directriz explícita: *"La conversación reciente es solo contexto; responde únicamente a la pregunta actual, que es la última línea ("Pregunta de ..."); no repitas ni continúes respuestas anteriores salvo que la pregunta lo pida; si la pregunta nombra conceptos distintos a los de la conversación anterior, responde sobre los conceptos de la pregunta actual."*
  - `backend/src/chat/aiChatService.test.ts` (**modificado**):
    - Añadidas aserciones para verificar la directriz de contexto y foco exclusivo en la pregunta actual en el prompt del sistema.
  - `backend/src/chat/chatContext.ts` (**modificado**):
    - `buildChatContext`: rotula el bloque como `"Conversación reciente (solo contexto):"`.
    - Reduce la ventana de mensajes a los últimos 6 (antes 10) y recorta cada mensaje a 250 caracteres (antes 300).
    - Separa claramente la línea `"Pregunta de {nombre}: {texto}"` con una línea en blanco (`\n\n`) antes.
  - `backend/src/chat/chatContext.test.ts` (**modificado**):
    - Actualizadas las pruebas unitarias para validar el límite de 6 mensajes, el truncamiento a 250 caracteres, el nuevo encabezado de bloque y la separación con línea en blanco.
  - `backend/src/ai/providers/providerManager.ts` (**modificado**):
    - En `chatWithFallback`, mide la latencia de resolución en milisegundos (`latencyMs`) y recopila los motivos de salto de proveedores no disponibles o con errores (`skipReasons`).
    - Cada vez que una consulta es resuelta exitosamente, emite exactamente una línea en consola:
      `[AI-CHAT] proveedor: {id}, respaldo: {true|false}, latencia: {ms}ms[, motivo: {motivos}]`
      garantizando cero registro de contenido de mensajes y cero nombres de usuario.
- **Archivos NO Modificados**:
  - Frontend, lienzo, sincronización, `realtimeSync.ts`, endpoints y servicios de edición de UC7/8/9/17 (`gemini.ts`, `groq.ts`) se mantuvieron estrictamente intactos.
- **Verificación Realizada**:
  - `npm --prefix backend run typecheck`: 0 errores TypeScript (`tsc --noEmit`).
  - `npm --prefix backend test`: 99/99 pruebas aprobadas (18 suites completas).
  - `npx tsx backend/src/scripts/testTeamChatAi.ts`: 7/7 escenarios de integración aprobados, verificando la emisión de la línea de métricas de `[AI-CHAT]` en tiempo real.

---

### [RES-086] Supresión de Preámbulo de Saludo/Presentación y Calibración de Tokens por Proveedor en CU19 (Backend)
- **Fecha**: 2026-11-07
- **Tarea Asociada**: TSK-086
- **Entregables Producidos**:
  - `backend/src/chat/aiChatHelpers.ts` (**modificado**):
    - Implementada y exportada la función pura `stripGreetingPreamble(text: string): string`, que quita al inicio del texto (hasta 2 veces, en cualquier orden) saludos cortos (`Hola…`, `¡Hola…!`, `Buenas…` hasta su signo de cierre o salto de línea, máx. 60 caracteres) y presentaciones (`Soy Codia…`, `Me llamo Codia…` hasta su punto o cierre, máx. 100 caracteres) sin alterar el resto ni la mayúscula/minúscula de la primera letra resultante. Preserva frases largas que empiezan con "Hola" como parte del contenido.
  - `backend/src/chat/aiChatService.ts` (**modificado**):
    - `TEAM_AI_SYSTEM_PROMPT`: sustituidas frases ambiguas de presentación por la regla estricta: *"Tu nombre es Codia. No saludes (nada de 'Hola' ni '¡Hola!') ni te presentes; empieza directamente con la respuesta. No escribas el nombre de quien pregunta: el sistema lo antepone. Solo di tu nombre o tu rol si te preguntan explícitamente quién eres. Ejemplo de inicio correcto: 'Una clase abstracta es…'. Ejemplo incorrecto: 'Hola, Ana. Soy Codia, la desarrolladora senior…'".* Reforzada brevedad con *"Longitud: máximo unas 120 palabras, sin listas largas, salvo que pidan más detalle."*
    - `answerInRoom`: aplica `stripGreetingPreamble` a la respuesta del modelo antes de `trimToLastSentence` y `ensureAddressedByName`, salvo que la pregunta pida explícitamente presentarse (`qui[eé]n eres`, `c[oó]mo te llamas`, `pres[eé]ntate`).
    - Deja de imponer `maxTokens: 400`, delegando el límite a los valores por defecto de cada proveedor.
  - `backend/src/chat/chatContext.ts` (**modificado**):
    - `ChatMessageSummary`: ampliado con `role?: string` y `addressedTo?: string`.
    - `buildChatContext`: para respuestas previas de la IA (`role === "ai"` o `author === "Codia"`), retira el prefijo `{addressedTo}, ` y aplica `stripGreetingPreamble` antes de integrarlas al historial, evitando que el modelo aprenda y replique el patrón en contexto.
  - `backend/src/socket.ts` (**modificado**):
    - `listRecentMessages`: mapea y entrega `role: d.role` y `addressedTo: d.addressedTo` desde MongoDB.
  - `backend/src/ai/providers/groqProvider.ts` (**modificado**):
    - `DEFAULT_MAX_TOKENS`: elevado a 700.
    - Envía `reasoning_effort: "low"` en el payload JSON hacia `https://api.groq.com/openai/v1/chat/completions` (verificado con respuesta 200 OK y reducción drástica de tokens de razonamiento).
  - `backend/src/ai/providers/localProvider.ts` (**modificado**):
    - `DEFAULT_MAX_TOKENS`: elevado a 550.
  - `backend/src/ai/providers/geminiProvider.ts` (**intacto**):
    - Conserva `DEFAULT_MAX_TOKENS = 400` y `thinkingBudget: 0`.
  - `backend/src/scripts/testTeamChatAi.ts` (**modificado**):
    - Simulación controlada sin invocar API real de Gemini ni agotar llamadas a Groq; mapeo de `role` y `addressedTo`.
  - Pruebas unitarias actualizadas y ampliadas:
    - `backend/src/chat/aiChatHelpers.test.ts`: suite completa de 11 casos para `stripGreetingPreamble` (saludo solo, presentación sola, ambos órdenes, negrita, no saludo, frase larga que inicia con "Hola", preservación de primera letra).
    - `backend/src/chat/aiChatService.test.ts`: validación del nuevo prompt, opciones sin `maxTokens: 400`, stripping en preguntas normales y excepción en "¿quién eres?".
    - `backend/src/chat/chatContext.test.ts`: validación de limpieza de `{addressedTo}, ` y preámbulos en respuestas de la IA.
    - `backend/src/ai/providers/aiProviders.test.ts`: aserciones de `max_tokens: 700` y `reasoning_effort: "low"` en Groq, y `max_tokens: 550` en Local.
- **Archivos NO Modificados**:
  - Frontend, lienzo, sincronización, `editDiagramByInstruction` y servicios de edición de diagramas se mantuvieron 100% intactos.
- **Verificación Realizada**:
  - `npm --prefix backend run typecheck`: 0 errores TypeScript (`tsc --noEmit`).
  - `npm --prefix backend test`: 115/115 pruebas unitarias aprobadas (19 suites completas).
  - `npx tsx backend/src/scripts/testTeamChatAi.ts`: 7/7 escenarios de integración aprobados con simulación (cero consumo de cuota de Gemini).

---

### [RES-087] Implementación de Funciones Puras para Fase 1 de CU20 (Backend)
- **Fecha**: 2026-11-07
- **Tarea Asociada**: TSK-087
- **Entregables Producidos**:
  - `backend/src/chat/modificationHelpers.ts` (**nuevo**):
    - `classifyIntent(text)`: normaliza (@Codia/@ia, ¿/¡, tildes, minúsculas, espacios, "por favor" inicial) y clasifica en "query" o "modification" siguiendo la jerarquía estricta de reglas.
    - `spanishConjunction(word)`: función auxiliar para resolver conjunciones copulativas "y" / "e" en español (ej. "entre X e Y").
    - `summarizeOperations(operations, warnings)`: plantilla pura para resúmenes legibles en minúscula inicial combinando múltiples operaciones y anexando avisos de descartes.
    - `checkOperationLimit(operations, max)` y `MAX_OPERATIONS = 10`: control de tope máximo de operaciones por solicitud.
  - `backend/src/chat/modificationHelpers.test.ts` (**nuevo**):
    - Suite completa con 46 pruebas en `node:test` cubriendo normalización, los 6 casos expresamente requeridos por el usuario, fórmulas de cortesía, verbos de modificación, preguntas con verbos de acción, resúmenes individuales/múltiples/con avisos y límites de 10 vs 11 operaciones.
- **Archivos Preexistentes NO Modificados**:
  - Cero modificaciones en `diagramRoutes.ts`, `aiChatService.ts`, `socket.ts`, `operationValidator.ts` ni ningún otro archivo de código preexistente.
- **Verificación Realizada**:
  - `npx --prefix backend tsx --test backend/src/chat/modificationHelpers.test.ts`: 46/46 pruebas unitarias aprobadas (5 suites completas, 0 fallos).
  - `npm --prefix backend test`: 115/115 pruebas unitarias del backend aprobadas (19 suites completas).
  - `npm --prefix backend run typecheck`: 0 errores de TypeScript (`tsc --noEmit`).
- **Notas y Observaciones**:

### [RES-088] Enganche del Servicio de Modificación al Chat del Equipo (CU20 Fase 2B)
- **Fecha**: 2026-11-07
- **Tarea Asociada**: TSK-088
- **Entregables Producidos**:
  - `backend/src/chat/aiChatService.ts` (modificado):
    - Parámetro opcional `onOperations` en `AnswerInRoomParams`.
    - Clasificación con `classifyIntent` y bifurcación a `requestDiagramEdit` dentro de `executeTask` (mantiene el turno de cola FIFO durante todo el ciclo de edición y confirmación).
    - Manejo de estados: `ready` (invoca `onOperations`, formatea con `summarizeOperations`, añade advertencias y conteo de fallidos si hubo), `onlyWarnings` (avisos en español natural), `noChanges` (cae a `chatReply`), `tooMany` (mensaje de división), `diagramNotFound`.
    - Retorno con `kind: "modification" | "answer"` y `operations` (vacío salvo que kind sea "modification").
  - `backend/src/socket.ts` (modificado):
    - Export de constante `CODIA_ACK_TIMEOUT_MS` (15s por defecto) y función `getCodiaAckTimeoutMs()`.
    - En el manejador `chat-message`, definición de callback `onOperations` con `socket.timeout(timeoutMs).emitWithAck("ai-operations", ...)`.
    - Verificación defensiva del acknowledgement `{ applied, failed }` y captura de timeout/desconexión retornando `null`.
    - Persistencia en Mongo con `saveMessage` incluyendo `kind`, `operations` y `warnings`, y difusión mediante `chat-message` con `toPublicChatMessage`.
  - `backend/src/chat/chatRepository.ts` (modificado):
    - Campos opcionales `kind`, `operations` y `warnings` en `ChatMessageInput`, `ChatMessageDocument` y `MongoChatMessageDoc`.
    - `toPublicChatMessage` propaga `kind` al cliente pero omite estrictamente `operations` y `warnings` internos.
  - `backend/src/chat/aiChatServiceCu20.test.ts` (nuevo):
    - 11 pruebas unitarias cubriendo consulta sin cambios (CU19), modificación aplicada (kind "modification"), fallo/timeout de ack (kind "answer"), fallos parciales, `noChanges`, `onlyWarnings`, `tooMany`, `diagramNotFound`, bloqueo de turno en cola FIFO y funcionamiento idéntico a CU19 sin `onOperations`.
  - `backend/scripts/cu20-socket-smoke.ts` (nuevo):
    - Script de Socket.IO para simulación de escenarios manuales A (ack exitoso), B (timeout del cliente) y C (desconexión inmediata).
  - `backend/package.json` (modificado):
    - Script `test` actualizado integrando las 3 suites de CU20 (`modificationHelpers.test.ts`, `diagramAiEditService.test.ts`, `aiChatServiceCu20.test.ts`).
- **Archivos Preexistentes NO Modificados**:
  - `diagramRoutes.ts`, ruta `ai-edit`, `operationValidator.ts`, lienzo, paneles personales y casos CU7/8/9/17 intactos.
- **Verificación Realizada**:
  - `npm --prefix backend test`: 181/181 pruebas en verde (26 suites completas, 0 fallos).
  - `npm --prefix backend run typecheck`: 0 errores de TypeScript (`tsc --noEmit`).
  - Pruebas de CU19 100% intactas y en verde.

### [RES-089] Fase 3 de CU20: Enganche de ai-operations y Sincronización Previa en Frontend
- **Fecha**: 2026-11-07
- **Tarea Asociada**: TSK-089
- **Entregables Producidos**:
  - `frontend/src/teamChat/aiOperationsHandler.ts` (**nuevo**):
    - `BoundedSet<T>`: estructura FIFO acotada a 100 elementos para deduplicar `messageId`.
    - `validateAiOperations`: función pura que valida precondiciones y genera ack adecuado (`already_processed`, `diagram_mismatch`, `no_api`, `invalid_operations`, `canApply`).
    - `calculateOperationCounts`: función pura que totaliza `applied` (resultados != `skipped`) y `failed`.
    - `hasCodiaMention`: función pura que detecta mención a `@Codia` / `@ia` (case-insensitive) como palabra completa o con puntuación circundante.
    - `saveDiagramWithTimeout`: función que corre el guardado contra un límite de tiempo para no sobrepasar el timeout del servidor.
  - `frontend/src/teamChat/aiOperationsHandler.test.ts` (**nuevo**):
    - 20 pruebas unitarias con Vitest cubriendo BoundedSet, validación de precondiciones, conteo de operaciones, detección de menciones y guardado con timeout.
  - `frontend/src/teamChat/useTeamChat.ts` (**modificado**):
    - Recibe `excalidrawAPI` en `UseTeamChatOptions` y mantiene referencia activa en `excalidrawAPIRef`.
    - Listener del evento `ai-operations` en `socket`, permanente a nivel del hook (activo aunque el panel esté cerrado), con limpieza al desmontar y ack garantizado exactamente una vez bajo try/catch y tope `Math.max(1000, timeoutMs - 3000)`.
    - Invocación de `applyAiOperations(operations, excalidrawAPI)`, cancelación de guardado diferido (`LocalData.cancelSave()`) y guardado forzado a backend (`saveDiagramToBackend`).
    - En `sendMessage`, detección de mención a Codia/IA e inicio de guardado previo con `LocalData.cancelSave()` y `saveDiagramToBackend` dentro de try/catch.
  - `frontend/excalidraw-app/App.tsx` (**modificado**):
    - Pasa `excalidrawAPI` a `useTeamChat` (dentro de `ExcalidrawWrapper`) y opcionalmente a `TeamChatPanel`.
  - `frontend/src/teamChat/TeamChatPanel.tsx` (**modificado**):
    - Añadido `excalidrawAPI?: any;` en `TeamChatPanelProps`.
  - `frontend/src/teamChat/types.ts` (**modificado**):
    - Añadido `kind?: string;` opcional a `PublicChatMessage`.
- **Archivos Preexistentes NO Modificados**:
  - `applyAiOperations.ts`, `useAiChat.ts`, `AiChatPanel`, `LocalData.ts`, `backendSync.ts`, `realtimeSync.ts`, lienzo, UC7/8/9/17 intactos.
- **Verificación Realizada**:
  - `yarn --cwd frontend vitest run src/teamChat`: 49/49 pruebas en verde (3 suites: `aiOperationsHandler.test.ts`, `mentionHelper.test.ts`, `aiTextFormatter.test.ts`).

### [RES-090] Corrección de CU20: Detección preventiva de pedidos no soportados por UC7 (eliminación y renombrado de atributos/métodos)
- **Fecha**: 2026-11-07
- **Tarea Asociada**: TSK-090
- **Entregables Producidos**:
  - `backend/src/chat/modificationHelpers.ts` (**modificado**):
    - Implementada función pura `detectUnsupportedAttributeRequest(texto: string): "delete" | "rename" | null`.
    - Normalización idéntica a `classifyIntent` (remueve menciones `@Codia`/`@ia`, acentos, signos de puntuación inicial/final, espacios redundantes, minúsculas).
    - Verbos de borrado: `elimina`, `eliminar`, `eliminale`, `borra`, `borrar`, `borrale`, `quita`, `quitar`, `quitale`, `remueve`, `remover`, `remuevele`, `saca`, `sacar`, `sacale`, `suprime`, `suprimir`, `suprimele`.
    - Verbos/patrones de renombrado: `renombra`, `renombrar`, `renombrale`, o secuencias de cambio de nombre (`cambia/cambiar/cambiale el nombre`).
    - Sustantivos objetivo: `atributo`, `atributos`, `metodo`, `metodos`, `campo`, `campos`, `propiedad`, `propiedades`, `funcion`, `funciones`.
    - Detección basada en proximidad: hasta 2 palabras de relleno (`el`, `la`, `los`, `las`, `un`, `una`, `todos`, `todas`, `sus`, `del`, `de`, `al`, `a`).
    - Exclusiones estrictas: borrado de clases/relaciones ("elimina la clase Pedido y sus atributos", "elimina la relacion..."), renombrado de clases ("renombra la clase Cliente a Usuario") y modificación de tipo ("cambia el tipo del atributo edad a Integer").
  - `backend/src/chat/modificationHelpers.test.ts` (**modificado**):
    - 32 casos de prueba dedicados a `detectUnsupportedAttributeRequest` cubriendo borrado, renombrado, fórmulas de cortesía, plurales, exclusiones de clases/relaciones y cambio de tipos. Total suite: 77 pruebas.
  - `backend/src/chat/diagramAiEditService.ts` (**modificado**):
    - Inyectado `detectUnsupportedAttributeRequest` en `DiagramAiEditDeps` (con valor por defecto).
    - Intercepción temprana antes de `editWithFallback`: si se detecta `"delete"` o `"rename"`, retorna de inmediato `status: "onlyWarnings"` con aviso personalizado en primera persona referenciando la interfaz real (`"Editar Clase UML"`), consumiendo 0 tokens de IA.
  - `backend/src/chat/diagramAiEditService.test.ts` (**modificado**):
    - 2 pruebas agregadas (test 7 y test 8) validando que para solicitudes de eliminar o renombrar atributos no se invoca `editWithFallback` y se retorna `status: "onlyWarnings"` con el mensaje correcto. Total suite: 8 pruebas.
- **Verificación Realizada**:
  - `npm --prefix backend run typecheck`: 0 errores en TypeScript (`tsc --noEmit`).
  - `npm --prefix backend test`: 215/215 pruebas en verde (11 suites de prueba del backend).
- **Notas y Observaciones**:
  - No se modificó ningún archivo prohibido (`applyAiOperations.ts`, `operationValidator.ts`, `diagramRoutes.ts`, ruta `ai-edit`, lienzo, UC7/8/9/17).

### [RES-091] Correcciones de CU20 por fallos del modelo local: conversión preventiva createClass->updateClass y tratamiento de noChanges
- **Fecha**: 2026-11-07
- **Tarea Asociada**: TSK-091
- **Entregables Producidos**:
  - `backend/src/chat/modificationHelpers.ts` (**modificado**):
    - `normalizeClassName(name: unknown): string`: función pura que normaliza cadenas (minúsculas, diacríticos removidos con NFD, espacios colapsados y recortados).
    - `convertExistingCreateToUpdate(operations, existingClasses)`: función pura que convierte operaciones `createClass` en `updateClass` cuando `className` coincide con una clase existente en el diagrama, conservando atributos y métodos y usando el nombre real de la clase en el diagrama. Excepción: si hubo un `deleteClass` previo de esa misma clase en el lote, se mantiene como `createClass`.
  - `backend/src/chat/modificationHelpers.test.ts` (**modificado**):
    - 8 pruebas agregadas para `convertExistingCreateToUpdate` y `normalizeClassName` cubriendo: conservación de atributos/métodos, insensibilidad a tildes/capitalización, clase inexistente sin cambios, deleteClass previo sin cambios, deleteClass posterior permitiendo conversión previa, salida esperada en `summarizeOperations` ("actualicé la clase X") y manejo defensivo. Total suite: 85 pruebas.
  - `backend/src/chat/diagramAiEditService.ts` (**modificado**):
    - Añadido `convertExistingCreateToUpdate` a `DiagramAiEditDeps` y `defaultDeps`.
    - Antes de llamar a `validateAndResolveOperations`, se aplica `convertExistingCreateToUpdate(result.operations, classes)` sobre las operaciones recibidas del proveedor IA.
  - `backend/src/chat/diagramAiEditService.test.ts` (**modificado**):
    - Prueba 9 agregada verificando la conversión e integración de `createClass` a `updateClass` antes de la validación. Total suite: 9 pruebas.
  - `backend/src/chat/aiChatService.ts` (**modificado**):
    - En la rama de modificación, cuando `editResult.status === "noChanges"`:
      - Si el texto original NO contiene signos de interrogación (`?` o `¿`), responde directamente con mensaje natural en primera persona pidiendo reformular o ser más específico con el nombre de la clase o atributo (`kind: "answer"`, `operations: []`), sin invocar `chatReply` ni consumir cuota.
      - Si contiene `?` o `¿`, mantiene el comportamiento anterior derivando al camino de consulta con `chatReply`.
  - `backend/src/chat/aiChatServiceCu20.test.ts` (**modificado**):
    - Pruebas 6a y 6b añadidas validando ambos caminos de `noChanges` (sin `?` y con `?`). Total suite: 12 pruebas.
- **Verificación Realizada**:
  - `npm --prefix backend run typecheck`: 0 errores en TypeScript (`tsc --noEmit`).
  - `npm --prefix backend test`: 225/225 pruebas en verde (11 suites del backend).
- **Notas y Observaciones**:
  - Cero modificaciones a UC7, `applyAiOperations.ts`, `operationValidator.ts`, `diagramRoutes.ts`, ruta `ai-edit` ni archivos de proveedores.

### [RES-092] Conversión preventiva createClass->updateClass en editWithFallback (UC7/UC8/CU20) y Diagnóstico de Intención (TAREA B)
- **Fecha**: 2026-11-08
- **Tarea Asociada**: TSK-092
- **Entregables Producidos**:
  - `backend/src/ai/providers/operationNormalizer.ts` (**nuevo**):
    - Exporta `normalizeClassName` y `convertExistingCreateToUpdate` como utilidades puras y neutras, desacopladas del módulo de chat.
  - `backend/src/providers/operationNormalizer.ts` (**nuevo**):
    - Reexporta `* from "../ai/providers/operationNormalizer"` para interoperabilidad de rutas.
  - `backend/src/chat/modificationHelpers.ts` (**modificado**):
    - Reexporta `normalizeClassName` y `convertExistingCreateToUpdate` desde `../ai/providers/operationNormalizer`, manteniendo intacta la compatibilidad hacia atrás.
  - `backend/src/ai/providers/providerManager.ts` (**modificado**):
    - En `editWithFallback`: aplica `convertExistingCreateToUpdate` sobre `result.operations` utilizando `currentModel.classes` antes de construir y devolver `FallbackResult`.
  - `backend/src/ai/providers/aiProviders.test.ts` (**modificado**):
    - 7 pruebas agregadas para `editWithFallback`: conversión de `createClass` existente a `updateClass`, conservación de clases nuevas como `createClass`, respeto de `deleteClass` previo, verificación individual con proveedores `local`, `groq`, `gemini` y con fallback activado.
  - Verificación de rutas de edición y visión:
    - Se constató que `POST /diagrams/:id/ai-edit` atiende tanto texto (UC7) como voz (UC8) llamando directamente a `editWithFallback`, quedando ambos protegidos contra clases duplicadas.
    - Se confirmó que UC9 (`ai-from-image`) utiliza `diagramFromImage` y no pasa por `editWithFallback`.
- **Verificación Realizada**:
  - `npm --prefix backend run typecheck`: 0 errores en TypeScript (`tsc --noEmit`).
  - `npm --prefix backend test`: 232/232 pruebas en verde (11 suites del backend).
- **Notas y Observaciones**:
  - Cero modificaciones a UC7, UC8, UC9, UC17, `diagramRoutes.ts`, ruta `ai-edit`, `applyAiOperations.ts`, `operationValidator.ts` ni proveedores individuales.

### [RES-093] Ajuste de classifyIntent en CU20 para verbos de modificación no iniciales
- **Fecha**: 2026-11-08
- **Tarea Asociada**: TSK-093
- **Entregables Producidos**:
  - `backend/src/chat/modificationHelpers.ts` (**modificado**):
    - Regla 2b en `classifyIntent`: si la oración no tiene signos `?` ni `¿`, no contiene palabras interrogativas ni de explicación en ninguna posición (como palabra completa), y contiene un verbo de modificación de la lista de la regla 2 en las primeras 8 palabras, se clasifica como `"modification"`.
    - Mantiene intacta la precedencia estricta de las reglas previas (Reglas 1, 1b y 2).
  - `backend/src/chat/modificationHelpers.test.ts` (**modificado**):
    - 20 pruebas agregadas para la Regla 2b cubriendo: preposiciones iniciales (`en`, `a`, `sobre`, `para`, `entre`), oraciones con interrogación, palabras interrogativas en cualquier posición, verbos más allá de la palabra 8, y compatibilidad con `detectUnsupportedAttributeRequest`. Total suite: 89 pruebas.
  - Saneamiento de `operationNormalizer.ts`:
    - Eliminado el archivo espejo `backend/src/providers/operationNormalizer.ts`.
    - Se constata la existencia de un único archivo: `backend/src/ai/providers/operationNormalizer.ts`.
- **Verificación Realizada**:
  - `npm --prefix backend run typecheck`: 0 errores en TypeScript (`tsc --noEmit`).
  - `npm --prefix backend test`: 236/236 pruebas en verde (11 suites del backend).
- **Notas y Observaciones**:
  - Solo se modificaron los archivos permitidos `modificationHelpers.ts` y `modificationHelpers.test.ts`.

### [RES-094] Implementación de reviewModel y Reglas de Revisión de Diagramas (CU21 Fase 1A)
- **Fecha**: 2026-11-08
- **Tarea Asociada**: TSK-094
- **Entregables Producidos**:
  - `backend/src/chat/diagramReview.ts` (**nuevo**):
    - Función pura `reviewModel(model: UmlModel): Finding[]` que evalúa 10 reglas del servidor (R1 a R10).
    - Tipado estricto con los tipos reales del modelo UML (`UmlModel`, `UmlClass`, `UmlRelation`, `UmlAttribute`) de `backendGenerator/types.ts`.
    - Reglas implementadas:
      - R1 (recomendado): Clase sin atributos que no es hija de otra. Sugiere en el fix `@Codia agrega el atributo id a X` si es una clase, o remite a editar cada una si son varias.
      - R2 (importante): Clase no hija con al menos 1 atributo cuyo primer atributo no parece identificador (nombre normalizado sin tildes/minúsculas no es "id" ni empieza con "id"/"cod"). Mensaje indica que el backend toma el primer atributo como PK; fix indica editar con doble clic y ubicar el identificador como primer atributo (sin comando de chat).
      - R3 (recomendado): Clase aislada (sin relaciones) cuando hay al menos 2 clases.
      - R4 (recomendado): Relación que no sea herencia con multiplicidad vacía (`""`).
      - R5 (recomendado): Relación `manyToMany` o con `*` en ambos extremos sin clase intermedia; fix con pedido válido de chat para crear la clase intermedia (`@Codia crea la clase ...`).
      - R6: Nombres duplicados (importante) o pares singular/plural (recomendado).
      - R7 (importante): Atributos repetidos dentro de una clase (ignorando mayúsculas y tildes); fix indica doble clic para revisar y corregir (sin sugerir quitar ni renombrar atributos).
      - R8 (recomendado): Nombres de clase que no empiezan con mayúscula o llevan espacios en una sola Finding.
      - R9 (importante): Clases hijas con más de un padre o ciclos en la jerarquía de herencia (detectados vía DFS).
      - R10 (recomendado): Relaciones duplicadas entre el mismo par de clases y del mismo tipo.
    - Acotado a un máximo de 6 Finding, ordenadas con severidad `"importante"` antes que `"recomendado"`.
    - Mensajes y fixes redactados en español en texto plano sin markdown.
  - `backend/src/chat/diagramReview.test.ts` (**nuevo**):
    - Suite de 34 pruebas automatizadas con `node:test` y `node:assert/strict`.
    - Casos positivos y negativos para cada regla (R1 a R10).
    - Caso específico de clase hija que no dispara R1 ni R2.
    - Caso de diagrama sano que devuelve `[]`.
    - Caso de modelo vacío o sin clases que devuelve `[]`.
    - Verificación del límite de 6 hallazgos.
    - Verificación del orden por severidad (`"importante"` antes de `"recomendado"`).
    - Verificación de que ningún fix sugiere quitar ni renombrar atributos.
    - Verificación de ausencia de markdown en `message` y `fix`.
- **Verificación Realizada**:
  - `npx tsx --test backend/src/chat/diagramReview.test.ts`: 34/34 pruebas en verde.
  - `npm --prefix backend test`: 236/236 pruebas en verde (suites completas del backend).
  - `npm --prefix backend run typecheck`: 0 errores de tipado TypeScript (`tsc --noEmit`).
  - `git status --short`: Cero modificaciones en archivos preexistentes del backend o frontend.
- **Notas y Observaciones**:
  - Preparado para su integración en el enrutador de `aiChatService.ts` en la siguiente fase (Fase 1B).

### [RES-095] Formateadores de Revisión para Prompt y Fallback (CU21 Fase 1B)
- **Fecha**: 2026-11-08
- **Tarea Asociada**: TSK-095
- **Entregables Producidos**:
  - `backend/src/chat/diagramReview.ts` (**modificado**):
    - `formatFindingsForPrompt(findings: Finding[]): string`: Formatea las observaciones como lista numerada en texto plano (`"1. [importante] Clases: A, B. <message> Frase sugerida: <fix>"` si empieza con `@Codia`, o `"Qué hacer: <fix>"` si no). Sin markdown.
    - `formatFindingsFallback(findings: Finding[], askerName: string): string`: Texto que se publica cuando ningún proveedor responde, dirigido por nombre (`"Ana, revisé el diagrama y encontré N observaciones:"`), lista numerada con message y fix, invitación final a pedir cambios a Codia, y acotado al límite máximo de 2000 caracteres (`MAX_CHAT_MESSAGE_LENGTH`) garantizando no desbordar `chatRepository` ni `socket.ts`.
    - `formatNoFindingsMessage(askerName: string): string`: Mensaje breve y cercano (`"Ana, revisé el diagrama y no encontré problemas de estructura."` o sin nombre) sin saludos ni presentaciones.
    - `formatEmptyDiagramMessage(askerName: string): string`: Informa que el diagrama está vacío y no hay elementos para revisar.
    - Constante exportada `MAX_CHAT_MESSAGE_LENGTH = 2000`.
  - `backend/src/chat/diagramReview.test.ts` (**modificado**):
    - Suite de 18 pruebas nuevas para formateadores (totalizando 52 pruebas en el archivo).
    - Verificación de formato exacto de prompt y fallback, casos con y sin nombre de usuario, tratamiento de singular (`1 observación`) y plural.
    - Verificación estricta de ausencia de cualquier marca markdown (asteriscos `*`, almohadillas `#`, comillas invertidas `` ` ``, guiones de lista `- `).
    - Verificación del peor caso con 6 observaciones extensas garantizando `<= 2000` caracteres.
- **Verificación Realizada**:
  - `npx tsx --test backend/src/chat/diagramReview.test.ts`: 52/52 pruebas en verde.
  - `npm --prefix backend test`: 236/236 pruebas en verde (suites completas del backend).
  - `npm --prefix backend run typecheck`: 0 errores de compilación TypeScript (`tsc --noEmit`).
  - `git status --short`: Cero modificaciones en código preexistente del backend o frontend.
- **Notas y Observaciones**:
  - Todo el subsistema de análisis y formateo de CU21 está listo para conectarse al flujo del chat en la siguiente etapa.

### [RES-096] Ampliación de classifyIntent con Intención "review" (CU21 Fase 1C)
- **Fecha**: 2026-11-08
- **Tarea Asociada**: TSK-096
- **Entregables Producidos**:
  - `backend/src/chat/modificationHelpers.ts` (**modificado**):
    - Tipo de retorno de `classifyIntent(text)` ampliado a `"query" | "modification" | "review"`.
    - Regla 1c ("review"):
      - Verbos de revisión (`revisa`, `evalua`, `valida`, `analiza`, `audita`, `verifica`, `chequea`) junto a objetos de revisión (`diagrama`, `modelo`, `clases`, `relaciones`, `esquema`, `diseno`, `estructura`, `entidades`).
      - Frases clave de revisión (`"que le falta"`, `"que mejorarias"`, `"sugerencias"`, `"mejoras"`, `"esta bien"`, `"tiene errores"`, `"feedback"`).
      - Mejora u optimización general aplicada al diagrama o modelo (`"mejora el diagrama"`, `"optimiza el modelo"`).
    - Jerarquía de prioridades estricta:
      - Preguntas de explicación conceptual (`"¿qué es una clave primaria?"`, `"explícame qué es una relación..."`) se mantienen como `"query"` en Regla 1 / 1b.
      - Preguntas con verbos de revisión que preguntan "cómo hacerlo" (`"¿cómo reviso el diagrama?"`) se mantienen como `"query"`.
      - Pedidos con objetivo concreto de modificación (`"agrega..."`, `"crea..."`, `"mejora la clase Cliente agregando nombre"`, `"mejora la clase Cliente"`) prevalecen como `"modification"`.
    - Comportamiento de `aiChatService.ts` intacto: compila sin errores sin modificar código.
  - `backend/src/chat/modificationHelpers.test.ts` (**modificado**):
    - Se conservaron el 100% de las 93 pruebas de regresión previas sin alterar.
    - Se añadieron 13 pruebas unitarias nuevas para cubrir:
      - 5 casos requeridos de review: `"@Codia revisa el diagrama"`, `"@Codia ¿qué le falta a mi diagrama?"`, `"@Codia dame sugerencias de mejora"`, `"@Codia mejora el diagrama"`, `"@Codia valida las relaciones"`.
      - 4 casos requeridos que no son review: `"@Codia agrega el atributo id a Cliente"`, `"@Codia mejora la clase Cliente agregando nombre"`, `"@Codia ¿qué es una clave primaria?"`, `"@Codia explícame qué es una relación muchos a muchos"`.
      - Casos adicionales de verbos de revisión, frases clave, mejora general vs específica y preguntas de explicación con verbos de revisión.
      - Total suite: 106 pruebas pasadas.
- **Verificación Realizada**:
  - `npm --prefix backend test`: 249/249 pruebas en verde (suites completas del backend).
  - `npx tsx --test backend/src/chat/diagramReview.test.ts`: 52/52 pruebas en verde.
  - `npm --prefix backend run typecheck`: 0 errores de tipado TypeScript (`tsc --noEmit`).
  - `git status --short`: Solo modificados `modificationHelpers.ts` y su archivo de pruebas.
- **Notas y Observaciones**:
  - Cero fallos en llamadores existentes; `aiChatService.ts` no requirió cambios de código para typecheck.

### [RES-097] Corrección y Completitud de CU21 Fase 2B
- **Fecha**: 2026-11-08
- **Tarea Asociada**: TSK-097
- **Entregables Producidos**:
  - `backend/src/chat/diagramReviewService.ts` (**modificado**): Envuelta la llamada por defecto a `chatWithFallback` para extraer `.text` resolviendo TS2322.
  - `backend/src/chat/modificationHelpers.ts` (**modificado**): Eliminada la regla `/\bcomo\s+(?:lo\s+)?ves\b/` para que preguntas como `"¿Cómo ves el modelo?"` se clasifiquen como `"query"`.
  - `backend/src/chat/modificationHelpers.test.ts` (**modificado**): Eliminada la aserción dependiente de esa frase (`"¿cómo ves el diagrama?"`), manteniendo 105 pruebas activas en verde.
  - `backend/src/chat/chatRepository.ts` (**modificado**): Inclusión de `findings` en `docToInsert`, en el retorno de `saveMessage` y en el mapeo de `listMessages`. Confirmado que `toPublicChatMessage` no expone `findings`.
  - `backend/src/chat/aiChatService.ts` (**modificado**): Agregado `findings?: any[]` en `AnswerInRoomResult` y propagado `findings: reviewResult.findings` en el `resolve` de la rama `review`.
  - `backend/src/socket.ts` (**modificado**): Propagado `findings: result.findings` a `saveMessage`.
- **Verificación Realizada**:
  - `npm --prefix backend run typecheck`: 0 errores de compilación (`tsc --noEmit`).
  - `npm --prefix backend test`: 301/301 pruebas pasadas (12 suites, 0 fallos), incluyendo la prueba 4 de `aiChatService.test.ts` (CU19).
- **Notas y Observaciones**:
  - La rama `review` preserva la cola FIFO y retén de turno sin fugas.

### [RES-098] Implementación de CU21 Fase 2C (Alineación de Tokens, Pruebas y Smoke Script)
- **Fecha**: 2026-11-08
- **Tarea Asociada**: TSK-098
- **Entregables Producidos**:
  - `backend/src/chat/diagramReviewService.ts` (**modificado**): Se removió el parámetro fijo `maxTokens: 400` de `chatFn`, permitiendo que cada proveedor aplique sus límites y configuraciones por defecto (Groq 700 con low reasoning, Local 550, Gemini 400 sin razonamiento), alineado idénticamente con CU19.
  - `backend/src/chat/diagramReviewService.test.ts` (**nuevo**): 6 pruebas unitarias (`node:test`) para modelo vacío, sin observaciones, con observaciones, fallo de IA, IA vacía y tope de 2000 caracteres.
  - `backend/src/chat/aiChatServiceCu21.test.ts` (**nuevo**): 5 pruebas unitarias (`node:test`) de enrutamiento en `answerInRoom` para `review`, `query`, `modification` con y sin `onOperations`, y ausencia de mutación en `review`.
  - `backend/src/scripts/cu21-socket-smoke.ts` (**nuevo**): Script de smoke test por Socket.IO que se conecta, envía `"@Codia revisa el diagrama"` y reporta texto, destinatario y latencia.
  - `backend/package.json` (**modificado**): Incorporadas las dos suites nuevas a `test` y scripts `"smoke:cu20"` y `"smoke:cu21"`.
- **Verificación Realizada**:
  - `npm --prefix backend run typecheck`: 0 errores de compilación (`tsc --noEmit`).
  - `npm --prefix backend test`: 312/312 pruebas en verde a través de 14 suites completas (100% éxito).
- **Notas y Observaciones**:
  - No se modificó ninguna prueba preexistente. Totalmente compatible hacia atrás con CU19 y CU20.

### [RES-099] Ajuste del Prompt de Revisión y Contenido de Usuario (CU21)
- **Fecha**: 2026-11-09
- **Tarea Asociada**: TSK-099
- **Entregables Producidos**:
  - `backend/src/chat/diagramReviewService.ts` (**modificado**):
    - `REVIEW_SYSTEM_PROMPT` reescrito para eliminar menciones a "Idea:" e ideas de dominio; exige hablar solo de las observaciones entregadas (ni una más ni una menos); prohíbe tipos de datos, enumeraciones, convenciones o ejemplos inventados; exige párrafos cortos en español natural sin listas numeradas ni etiquetas de entrada (`[importante]`, `[recomendado]`, `Clases:`, `Frase sugerida:`, `Qué hacer:`); prioriza importantes y agrupa si son más de 4; copia frases `@Codia` literales o usa palabras de la observación sin inventar pasos; máximo 150 palabras, sin saludo/presentación/markdown; cierre con pregunta corta sin instrucción copiable literal.
    - `userContent` modificado para anteponer `Hay exactamente N observaciones.` antes de la lista.
  - `backend/src/chat/diagramReviewService.test.ts` (**modificado**): Aserciones actualizadas para comprobar la línea `Hay exactamente N observaciones.` y la eliminación de `Idea:`.
- **Verificación Realizada**:
  - `npm --prefix backend run typecheck`: 0 errores de compilación (`tsc --noEmit`).
  - `Set-Location backend; npm test`: 312/312 pruebas en verde en las 14 suites (100% éxito).
- **Notas y Observaciones**:
  - Se previno el copiado de etiquetas y alucinaciones de dominio en proveedores con menor razonamiento (Groq).
































