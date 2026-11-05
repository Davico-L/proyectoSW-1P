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







