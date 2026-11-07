# Tarea Actual: Coordinación de IA

Este documento refleja en tiempo real la tarea activa que está ejecutando el asistente de IA y su estado de avance.

---

## Tarea en Curso

- **Identificador**: TSK-090
- **Nombre**: Corrección de CU20: Detección preventiva de pedidos no soportados por UC7 (eliminación y renombrado de atributos/métodos)
- **Fecha de Inicio**: 2026-11-07
- **Estado**: Completada
- **Objetivo**: En `backend/`:
  (1) En `modificationHelpers.ts`, implementar función pura `detectUnsupportedAttributeRequest(texto)` que normaliza el texto y retorna `"delete"`, `"rename"` o `null`. Identifica verbos de borrado o renombrado a corta distancia (máximo 2 palabras de relleno) de palabras clave de atributos/métodos (`atributo`, `metodo`, `campo`, `propiedad`, `funcion`), excluyendo explícitamente borrado de clases/relaciones ("elimina la clase Pedido y sus atributos", "elimina la relación..."), renombrado de clases y cambios de tipo ("cambia el tipo del atributo edad a Integer").
  (2) En `diagramAiEditService.ts`, antes de llamar a `editWithFallback`, verificar si la instrucción solicita una operación no soportada. Si es así, devolver de inmediato `status: "onlyWarnings"` con un aviso en primera persona y lenguaje natural indicando la limitación y sugiriendo editar la clase en el lienzo, sin invocar proveedores de IA.
  (3) Agregar suite de pruebas exhaustiva (al menos 20 casos de detección positiva y negativa, y prueba de no invocación a `editWithFallback`).
  (4) Validar con `npm test` y `npm run typecheck`.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-089
- **Nombre**: Fase 3 de CU20: Enganche de ai-operations y sincronización previa en el frontend
- **Fecha de Inicio**: 2026-11-07
- **Estado**: Completada
- **Objetivo**: En `frontend/`:
  (1) Inspeccionar ciclo de vida de `useTeamChat.ts`, obtención de socket (`realtimeSync.ts`), punto de montaje en `App.tsx` / `TeamChatPanel.tsx`, envío de mensajes, guardado previo con `LocalData.cancelSave` / `saveDiagramToBackend`, e integración con `applyAiOperations`.
  (2) Implementar el listener de `ai-operations` en `useTeamChat.ts` (activo permanentemente aunque el panel esté cerrado), procesando operaciones con `applyAiOperations(operations, excalidrawAPI)`, deduplicando `messageId` con un Set con tope, calculando applied y failed, forzando guardado previo/posterior hacia el backend, y respondiendo el acknowledgement antes del timeout.
  (3) Guardado previo en envío de mensajes cuando hay mención a Codia/ia antes de emitir `chat-message`.
  (4) Asegurar soporte de `kind?: string` en mensajes sin romper visuales.
  (5) Validar con typecheck, build y pruebas correspondientes.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-088
- **Nombre**: Fase 2B de CU20: Enganche del servicio de modificación al chat del equipo (Backend)
- **Fecha de Inicio**: 2026-11-07
- **Estado**: Completada
- **Objetivo**: En `backend/`:
  (1) En `aiChatService.ts`: extender `AnswerInRoomParams` con `onOperations?: (operations: any[], warnings: string[]) => Promise<{ applied: number; failed: number } | null>`. Si no se pasa, mantener comportamiento idéntico a CU19. Si se pasa, dentro de `executeTask` (manteniendo el turno en la cola), clasificar intención con `classifyIntent`. Si es `"modification"`, invocar `requestDiagramEdit`. Manejar estados `"ready"` (invocando `onOperations`, formateando resumen con `summarizeOperations`, avisos y conteo de fallos si hubo), `"onlyWarnings"` (avisos en español natural), `"noChanges"` (fallback a `chatReply`), `"tooMany"` (mensaje para dividir) y `"diagramNotFound"`. Añadir `kind: "modification" | "answer"` y `warnings` al resultado.
  (2) En `socket.ts`: en el manejador de `chat-message`, definir el callback `onOperations` utilizando `socket.timeout(timeoutMs).emitWithAck("ai-operations", { messageId, diagramId, operations, warnings, timeoutMs })` con timeout por defecto de 15s configurable por `CODIA_ACK_TIMEOUT_MS`. Validar `{ applied, failed }` y pasar `onOperations` a `answerInRoom`. Guardar la respuesta con `kind`, `operations` y `warnings` en Mongo y emitir a la sala con `toPublicChatMessage`.
  (3) En `chatRepository.ts`: agregar campos opcionales `kind`, `operations` y `warnings` a `ChatMessageInput`, `ChatMessageDocument` y `MongoChatMessageDoc`. Incluir `kind` en `toPublicChatMessage` y omitir `operations` y `warnings` en mensajes públicos.
  (4) Pruebas automatizadas en `backend/src/chat/aiChatServiceCu20.test.ts` con `node:test` cubriendo los 11 escenarios requeridos.
  (5) Script de prueba manual en `backend/scripts/cu20-socket-smoke.ts` con Socket.IO cliente simulando los 3 escenarios (A: ack exitoso, B: timeout, C: desconexión).
  (6) Actualizar `package.json` test script e integrar suites de prueba sin romper CU19.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-087
- **Nombre**: Fase 1 de CU20: Funciones puras de clasificación de intención, resumen de operaciones y control de tope (Backend)
- **Fecha de Inicio**: 2026-11-07
- **Estado**: Completada
- **Objetivo**: En `backend/src/chat/`:
  (1) Crear el archivo nuevo `modificationHelpers.ts` sin tocar archivos preexistentes, implementando tres funciones puras:
      - `classifyIntent(text)`: normaliza (@Codia/@ia, ¿/¡, espacios, minúsculas, tildes, "por favor" inicial) y clasifica en "query" o "modification" siguiendo orden estricto de reglas (interrogativas/explicación primero -> cortesía/verbos de modificación -> query por defecto).
      - `summarizeOperations(operations, warnings)`: genera un resumen legible con plantilla en español (ej: "creé la clase Cliente con 2 atributos", "actualicé la clase Producto", "eliminé la relación entre X e Y"), combinando múltiples operaciones y anexando avisos de descartes al final, comenzando en minúscula.
      - `checkOperationLimit(operations, max)`: valida si el número de operaciones supera `MAX_OPERATIONS = 10` y genera mensaje descriptivo solicitando dividir en cambios más pequeños.
  (2) Crear `modificationHelpers.test.ts` con `node:test` cubriendo al menos 25 casos de `classifyIntent` con frases del equipo, casos de `summarizeOperations` (individuales, múltiples, con avisos) y validación de límites (10 vs 11).
  (3) Ejecutar `npm test` y `typecheck` en backend.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-086
- **Nombre**: Supresión de preámbulo de saludo/presentación y calibración de tokens por proveedor en CU19 (Backend)
- **Fecha de Inicio**: 2026-11-07
- **Estado**: Completada
- **Objetivo**: En `backend/`:
  (1) En `TEAM_AI_SYSTEM_PROMPT` (`aiChatService.ts`), sustituir frases ambiguas de presentación por directriz estricta ("Tu nombre es Codia. No saludes (nada de 'Hola' ni '¡Hola!') ni te presentes; empieza directamente con la respuesta. No escribas el nombre de quien pregunta: el sistema lo antepone. Solo di tu nombre o tu rol si te preguntan explícitamente quién eres...") y reforzar brevedad (máx ~120 palabras, sin listas largas);
  (2) Implementar función pura `stripGreetingPreamble(text)` en `aiChatHelpers.ts` para despojar saludos y presentaciones iniciales manteniendo la primera letra;
  (3) Aplicar `stripGreetingPreamble` en `answerInRoom` antes de `trimToLastSentence` y `ensureAddressedByName` (salvo preguntas que pidan explícitamente presentarse), y en `buildChatContext` sobre respuestas previas de la IA retirando además el prefijo `{addressedTo}, `;
  (4) Calibrar tokens por defecto en cada proveedor: Gemini 400 (thinkingBudget 0), Groq 700 con `reasoning_effort: "low"` en `openai/gpt-oss-20b` (verificado con llamada de prueba), Local 550; en `aiChatService.ts` dejar de imponer 400;
  (5) Pruebas unitarias para `stripGreetingPreamble`, excepción de "¿quién eres?" y limpieza de historial en tests; validar con pruebas (sin Gemini real, máx 10 llamadas reales a Groq), `typecheck` y `testTeamChatAi`.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-085
- **Nombre**: Contexto conversacional estricto, rotulación y métricas de latencia de fallback en CU19 (Backend)
- **Fecha de Inicio**: 2026-11-07
- **Estado**: Completada
- **Objetivo**: En `backend/`: (1) En `TEAM_AI_SYSTEM_PROMPT` (`aiChatService.ts`), agregar directriz explícita de que la conversación reciente es solo contexto, responder únicamente a la pregunta actual (última línea "Pregunta de ..."), no repetir ni continuar respuestas previas salvo petición explícita, y responder sobre los conceptos de la pregunta actual si difieren; (2) En `buildChatContext` (`chatContext.ts`), rotular como "Conversación reciente (solo contexto):", limitar a los últimos 6 mensajes recortados a 250 caracteres cada uno, y separar la pregunta final con una línea en blanco antes; (3) En `providerManager.ts` (`chatWithFallback`), emitir un log de una línea con proveedor que atendió, fallback (true/false), latencia en ms y motivo del salto si hubo, sin registrar contenido ni nombres de usuario; (4) Actualizar pruebas en `chatContext.test.ts` y validar con `npm test` (99/99), `typecheck` (0 errores) y `testTeamChatAi.ts` (7/7).

---

## Tarea Anterior (completada)

- **Identificador**: TSK-084
- **Nombre**: Corrección de truncamiento por límite en chatReply para proveedores Gemini, Groq y Local (CU19 Backend)
- **Fecha de Inicio**: 2026-11-07
- **Estado**: Completada
- **Objetivo**: En `backend/src/ai/providers/`: (1) En `geminiProvider.ts`, agregar `thinkingConfig: { thinkingBudget: 0 }` en `chatReply` manteniendo `maxOutputTokens: 400` (sin tocar `editDiagramByInstruction` ni UC7/8/9/17); (2) Implementar política común ante corte por límite (`finishReason: MAX_TOKENS` en Gemini, `finish_reason: "length"` en Groq y Local): si el texto tiene menos de 200 caracteres o no contiene signos de cierre de oración (`. ! ? ) » "`), lanzar error controlado `TRUNCATED_RESPONSE`; si es más largo y tiene cierre, devolverlo normalmente; (3) Verificar en `providerManager.ts` que `chatWithFallback` trate `TRUNCATED_RESPONSE` como fallo sin reintentos inútiles y continúe la cadena hasta `AiUnavailableError` si todos fallan; (4) Pruebas unitarias de corte y fallback en `aiProviders.test.ts`; (5) Probar script desechable en Temp con Gemini real 3 veces comprobando finishReason (STOP en las 3) y longitud (~700 chars); validar con `npm test` (99/99) y `typecheck` (0 errores).

---

## Tarea Anterior (completada)

- **Identificador**: TSK-083
- **Nombre**: Refinamiento de directrices en TEAM_AI_SYSTEM_PROMPT para Codia (CU19 Backend)
- **Fecha de Inicio**: 2026-11-07
- **Estado**: Completada
- **Objetivo**: En `backend/src/chat/aiChatService.ts`: incorporar o sustituir reglas en `TEAM_AI_SYSTEM_PROMPT` manteniendo el resto: (1) Preguntas conceptuales explicadas con ejemplos simples y genéricos (ej. Persona con /edad), usando el diagrama del equipo solo si encaja de verdad sin forzarlo; (2) Nunca inventar clases/atributos/relaciones como si ya existieran (indicar claramente si es sugerencia); (3) Decir honestamente si no está segura en vez de inventar; (4) No usar cursiva con asterisco simple, solo **negrita** para énfasis; (5) En relaciones UML, hablar de la asociación y su multiplicidad, no proponer FKs ni atributos tipo "productoId" salvo preguntas de BD. Actualizar pruebas en `aiChatService.test.ts`, validar con `npm test` (92/92) y `typecheck` (0 errores).

---

## Tarea Anterior (completada)

- **Identificador**: TSK-082
- **Nombre**: Formateador ligero para respuestas de Codia (código y negrita) y ajustes de UI en Team Chat (CU19 Frontend)
- **Fecha de Inicio**: 2026-11-07
- **Estado**: Completada
- **Objetivo**: En el frontend del Chat del Equipo: (1) Modificar la sugerencia flotante al teclear "@" para mostrar exclusivamente "@Codia"; (2) Actualizar el placeholder del textarea a "Escribe un mensaje o usa @Codia para consultarle"; (3) Crear `aiTextFormatter.tsx` con función pura para renderizar respuestas de la IA soportando bloques de código (```lenguaje ... ```), código en línea (`...`) y negrita (**...**) sin `dangerouslySetInnerHTML`, tratando bloques y asteriscos incompletos como texto plano, con HTML no interpretado y estilos CSS dedicados (fondo, fuente monospace, overflow-x: auto); (4) Suite de 11 pruebas unitarias con Vitest; validar con pruebas (29/29 en teamChat), typecheck (0 errores) y build exitoso.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-081
- **Nombre**: Ajustes de backend en CU19: prompt del sistema UML de Codia y minúscula contextual en ensureAddressedByName
- **Fecha de Inicio**: 2026-11-07
- **Estado**: Completada
- **Objetivo**: En el backend de CU19: (1) En `TEAM_AI_SYSTEM_PROMPT` (`aiChatService.ts`): ajustar longitud (~120 palabras), formato (solo texto plano con negrita puntual y código en línea, sin encabezados ni tablas, bloques de código solo si lo piden expresamente), no asumir lenguaje/tecnología (responder en UML/diagrama del equipo) y agregar notas de notación UML (atributos derivados `/nombre`, composición con rombo relleno, agregación con rombo vacío, multiplicidades 1, 0..1, *, 1..*); (2) En `ensureAddressedByName` (`aiChatHelpers.ts`): al anteponer `"{nombre}, "`, pasar a minúscula la primera letra salvo si la segunda letra también es mayúscula (siglas como "UML", "SQL"); (3) Actualizar y agregar pruebas en `aiChatHelpers.test.ts`, `aiChatService.test.ts`, ejecutar `npm test` (92/92), `typecheck` (0 errores) y `testTeamChatAi.ts` (7/7).

---

## Tarea Anterior (completada)

- **Identificador**: TSK-080
- **Nombre**: Ajuste fino del indicador ai-status y ampliación de timeout a 180s (CU19 Frontend)
- **Fecha de Inicio**: 2026-11-07
- **Estado**: Completada
- **Objetivo**: En `TeamChatPanel.tsx` (y `TeamChat.scss` si aplica): (1) Ajustar el indicador de `ai-status` para mostrar exactamente `{AI_DISPLAY_NAME} está pensando…` sin la etiqueta ni palabra "IA" junto al nombre, conservando puntos animados y la lista de nombres de quienes esperan entre paréntesis `(Ana, Luis)`, reservando la etiqueta "IA" exclusivamente para la cabecera de mensajes de Codia; (2) Incrementar el tiempo de seguridad del indicador de 60 s a 180 s (180000 ms). Validar con typecheck y build en frontend.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-079
- **Nombre**: Indicador de estado "pensando" y sugerencia de autocompletado @Codia en Frontend (CU19 Fase 4B)
- **Fecha de Inicio**: 2026-11-06
- **Estado**: Completada
- **Objetivo**: Implementar en el frontend (Chat del Equipo): (1) Escucha del evento "ai-status" ({ diagramId, state, askerName }) en TeamChatPanel con conteo por askerName ("thinking" +1, "idle" -1), ignorando otros diagramas, reseteo en reconexión/cambio de diagrama y timeout de seguridad de 60 s; renderizado accesible (aria-live="polite") de "Codia está pensando…" con animación de puntos y lista de espera "(Ana, Luis)"; (2) Placeholder "Escribe un mensaje o usa @Codia para consultar a la IA", detección de prefijo @, @c..., @i... mostrando popup/sugerencia clicable "@Codia — Consultar a la IA" que reemplaza la palabra por "@Codia " y reenfoca el textarea; (3) Garantizar que el textarea no se bloquee mientras la IA piensa. Validado con vitest (18/18), typecheck (0 errores) y build exitoso.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-078
- **Nombre**: Soporte visual y menciones de Codia en el Chat del Equipo en Frontend (CU19 Fase 4A)
- **Fecha de Inicio**: 2026-11-06
- **Estado**: Completada
- **Objetivo**: Implementar en el frontend el soporte para mensajes y menciones de la IA Codia en el Chat del Equipo: (1) Ampliar el tipo `PublicChatMessage` con `role: "user" | "ai" | "system" | string`, `replyTo?: string`, `addressedTo?: string`, y definir constante `AI_DISPLAY_NAME = "Codia"`; (2) Renderizado distintivo para `role === "ai"` (decidido estrictamente por rol, nunca por nombre, alineado a izquierda, fondo temático violeta `#f3e8ff` con texto `#3b0764` y border `#d8b4fe`, soporte dark mode `#2e1065`, badge "IA", texto "para {addressedTo}" si existe, `white-space: pre-wrap`); (3) Función pura `formatMessageSegments` en `mentionHelper.ts` para resaltar menciones `@ia` y `@codia` en negrita con color de acento de la IA en mensajes de personas sin usar `dangerouslySetInnerHTML`, con 10 pruebas unitarias en `mentionHelper.test.ts`; (4) Historial asegurado con deduplicación por `id` y orden cronológico en `useTeamChat.ts`; (5) Auto-scroll garantizado con respuestas de la IA. Validado con `vitest` (10/10), `test:typecheck` (0 errores) y `backend test` (88/88).

---

## Tarea Anterior (completada)

- **Identificador**: TSK-077
- **Nombre**: Asignación de identidad y nombre propio "Codia" a la IA del equipo (CU19)
- **Fecha de Inicio**: 2026-11-06
- **Estado**: Completada
- **Objetivo**: Incorporar el nombre propio "Codia" a la IA: (1) En `aiChatHelpers.ts`, exportar `AI_DISPLAY_NAME = "Codia"` y `AI_MENTION_ALIASES = ["ia", "codia"]`; (2) Adaptar `parseMention` para detectar `@ia` o `@codia` case-insensitive como palabra completa, preservando `mentions: ["ia"]` como identificador interno; (3) Reemplazar `authorName: "IA"` por `AI_DISPLAY_NAME` en las respuestas normales, aviso de ocupada y aviso de indisponibilidad en `socket.ts`; (4) En `TEAM_AI_SYSTEM_PROMPT`, indicar que su nombre es Codia y presentarse como la desarrolladora senior y mentora del equipo si preguntan quién es; (5) En `chat-join`, mitigar suplantación si el username normalizado es "ia" o "codia" transformándolo en `"{nombre} (usuario)"`; (6) Actualizar pruebas unitarias (`aiChatHelpers.test.ts`, `socketChatEvents.test.ts`, `chatRepository.test.ts`) agregando casos para `@codia`, `@Codia`, `@ia` y rechazo de `@codiax`, y actualizar `testTeamChatAi.ts`. Validar con `npm test` y `typecheck`.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-076
- **Nombre**: Cierre de verificación de CU19 y mitigación de suplantación de identidad
- **Fecha de Inicio**: 2026-11-06
- **Estado**: Completada
- **Objetivo**: Ejecutar los 4 pasos de cierre: (1) Revisar `git diff package-lock.json` confirmando adición de `socket.io-client` como nueva devDependency para tests; (2) Unificar scripts manuales en `backend/src/scripts/` eliminando el archivo puente de `backend/scripts/`; (3) Comparar y confirmar equivalencia en la cadena de fallback entre `chatWithFallback` y `editWithFallback`; (4) Aplicar arreglo de suplantación en `chat-join` (username "ia" -> "IA (usuario)") y en `saveMessage` (exigir authorSessionId "ai" para role "ai"); añadir pruebas unitarias específicas, verificar `npm test` (83 pruebas pasadas) y `typecheck` (0 errores).

---

## Tarea Anterior (completada)

- **Identificador**: TSK-075
- **Nombre**: Verificación integral de CU19 antes de la Fase 4
- **Fecha de Inicio**: 2026-11-06
- **Estado**: Completada
- **Objetivo**: Ejecutar las 4 verificaciones previas a la Fase 4: (1) Actualizar el script "test" en backend/package.json incorporando las suites de chat (aiChatHelpers, chatContext, aiChatService), correr npm test y reportar nuevo total (81 tests aprobados); (2) Ampliar testTeamChatAi.ts validando estados ai-status ("thinking" antes, "idle" después con askerName), prueba de concurrencia con 6 consultas rápidas (rechazo de la 6ta por cola llena con AiBusyError), y prueba de fallo de proveedores (AiUnavailableError con mensaje de reintento al usuario) pasando los 7 escenarios exitosamente; (3) Analizar si un cliente socket puede suplantar role "ai" o authorName "IA" en chat-message y proponer mitigación mínima sin aplicarla; (4) Ejecutar git status y git diff --stat verificando los archivos involucrados y garantizando que diagramRoutes.ts, ai-edit, lienzo y panel personal permanecen intactos.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-074
- **Nombre**: Conexión aditiva de aiChatService al chat del equipo con Socket.IO y persistencia (CU19 Fase 3B)
- **Fecha de Inicio**: 2026-11-06
- **Estado**: Completada
- **Objetivo**: Conectar `aiChatService` al chat del equipo de forma puramente aditiva: (1) En `chatRepository.ts`, agregar campos opcionales `replyTo` y `addressedTo` en tipos internos, Mongo y públicos (`toPublicChatMessage`), y registrar automáticamente `mentions: ["ia"]` si el texto incluye `@ia` con `parseMention`; (2) En `socket.ts`, tras emitir `chat-message` y responder al callback, enganchar en segundo plano la atención de IA si `role === "user"` y contiene `@ia`: emitir `ai-status` ("thinking"), invocar `answerInRoom`, persistir con role "ai", authorName "IA", replyTo y addressedTo, emitir a la sala y en `finally` resetear `ai-status` a "idle", con manejo específico de `AiUnavailableError` y `AiBusyError`; (3) Crear script de prueba de integración Socket.IO `testTeamChatAi.ts` con dos clientes (Ana y Luis) validando los 5 escenarios (consulta con respuesta dirigida, consulta vacía, mensaje sin mención, preguntas simultáneas en orden FIFO y consulta a `GET /diagrams/:id/chat` con mensajes de IA). Sin tocar ai-edit, lienzo ni diagramRoutes.ts.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-073
- **Nombre**: Servicio de chat de IA con cola FIFO y dependencias inyectables (CU19 Fase 3A)
- **Fecha de Inicio**: 2026-11-06
- **Estado**: Completada
- **Objetivo**: Implementar `trimToLastSentence` en `aiChatHelpers.ts` (con sus pruebas unitarias). Crear `backend/src/chat/aiChatService.ts` con fábrica `createAiChatService(deps)` con dependencias inyectadas (`getDiagramModel`, `listRecentMessages`, `chat`), errores exportados `AiBusyError` y `AiUnavailableError`, constante `TEAM_AI_SYSTEM_PROMPT` y método `answerInRoom` (operations siempre vacío, manejo de pregunta vacía, armado de contexto con exclusión de `askerMessageId`, pipeline de salida: trimToLastSentence, ensureAddressedByName y corte a 3000 caracteres; cola FIFO mono-ejecución con tope de 5 pendientes además de la activa y recuperación ante fallos). Crear suite exhaustiva `aiChatService.test.ts` con falsos cubriendo los 8 casos requeridos.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-072
- **Nombre**: Implementación aditiva de chatReply en la capa de proveedores IA (CU19 Fase 2)
- **Fecha de Inicio**: 2026-11-06
- **Estado**: Completada
- **Objetivo**: Agregar de forma puramente aditiva el método `chatReply(systemPrompt, userContent, options?)` a `ModelProvider` en `types.ts`, implementarlo en `localProvider.ts`, `groqProvider.ts` y `geminiProvider.ts` reutilizando configuración, cliente y manejo de errores de cada proveedor (45 s timeout en local), agregar `chatWithFallback()` en `providerManager.ts` con la misma cadena de respaldo que `editWithFallback`, crear el script manual `backend/src/scripts/testChatReply.ts` y actualizar los mocks del test existente `aiProviders.test.ts` para que incluyan `chatReply`. Sin modificar `editDiagramByInstruction`, `ai-edit`, ni el flujo UC7/UC8/UC9/UC17.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-071
- **Nombre**: Serialización compacta del modelo y construcción de contexto de chat (CU19 Fase 1B)
- **Fecha de Inicio**: 2026-11-06
- **Estado**: Completada
- **Objetivo**: Crear el nuevo módulo `backend/src/chat/chatContext.ts` con dos funciones puras exportadas: `formatModelCompact(model)` (resolución de ids a nombres de clase con Map, serialización con atributos, métodos breves y relaciones legibles con multiplicidades, límite de 40 clases con mención de omitidas, manejo de diagrama vacío y omisión de ids inexistentes) y `buildChatContext({ modelCompact, recentMessages, askerName, question })` (inclusión de últimos 10 mensajes recortados a 300 caracteres, bloque de diagrama actual, bloque de conversación reciente condicional y línea final con la pregunta del usuario). Crear su suite de pruebas unitarias `chatContext.test.ts` con `node:test` cubriendo los 7 casos requeridos. Sin modificar archivos existentes.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-070
- **Nombre**: Creación de funciones puras de soporte para mención @ia y formateo con nombre (CU19 Fase 1A)
- **Fecha de Inicio**: 2026-11-06
- **Estado**: Completada
- **Objetivo**: Crear el nuevo módulo `backend/src/chat/aiChatHelpers.ts` con dos funciones puras exportadas: `parseMention` (detección case-insensitive de @ia como palabra completa, exclusión de emails y palabras compuestas como @iab, extracción de la pregunta con espacios colapsados y recorte) y `ensureAddressedByName` (comprobación de presencia de nombre en primeros 40 caracteres y anteposición de nombre si no está presente). Crear su suite de pruebas unitarias `aiChatHelpers.test.ts` con `node:test` cubriendo todos los casos de posición, mayúsculas, cadenas vacías y exclusiones. Sin modificar ningún archivo existente de código.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-069
- **Nombre**: Corrección de selección de proveedores IA y cadena de fallback circular (CU24)
- **Fecha de Inicio**: 2026-11-06
- **Estado**: Completada
- **Objetivo**: Implementar la corrección en backend: (1) En `aiProviderRoutes.ts` permitir que `PUT /ai/providers/active` asigne el proveedor activo y responda 200 `{ ok: true, active: id }` aunque el proveedor no esté disponible, eliminando el rechazo HTTP 409 y manteniendo validación de id (400) y de sesión (401); (2) En `providerManager.ts` corregir `getFallbackChain(active)` para que siempre intente primero el activo y luego los otros dos en el orden base sin duplicados (local -> groq -> gemini; groq -> local -> gemini; gemini -> local -> groq); (3) Crear/actualizar pruebas automatizadas en backend verificando selección sin Colab (200), salto a fallback Groq, selección de Groq y Gemini, fallback desde Gemini no disponible, rechazos 400 y 401, y manejo 503 si todos fallan. Validar con build backend, typecheck frontend y tests de backend.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-068
- **Nombre**: Investigación técnica de selección de proveedores IA no disponibles y mecanismo de fallback (CU24)
- **Fecha de Inicio**: 2026-11-06
- **Estado**: Completada
- **Objetivo**: Investigar exhaustivamente en el backend (`aiProviderRoutes.ts`, `providerManager.ts` y flujo de ejecución IA) la discrepancia entre el requisito funcional (permitir seleccionar proveedores no disponibles confiando en el fallback) y el rechazo HTTP 409 `PROVIDER_UNAVAILABLE`. Determinar si es seguro permitir la selección, cómo opera el fallback al invocar la IA, y definir los cambios mínimos recomendados sin modificar código de producción.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-067
- **Nombre**: Corrección visual de encabezado en Chat del Equipo para evitar superposición (CU24 Fase 5)
- **Fecha de Inicio**: 2026-11-06
- **Estado**: Completada
- **Objetivo**: Corregir exclusivamente la distribución visual del encabezado en `TeamChatPanel.tsx` y `TeamChat.scss`. Reorganizar la estructura con un diseño flexible/adaptable (flex/grid) para que el título, el indicador de conexión ("En línea", "Reconectando", etc.), el selector de modelo de IA y el botón de cierre cuenten con espacios dedicados sin solaparse ni ocultarse en el ancho del panel (360px) ni en pantallas estrechas. Mantener intacta la lógica, el backend y `AiChatPanel`.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-066
- **Nombre**: Selector de Modelo de IA en Cabecera del Chat del Equipo (CU24 Fase 5)
- **Fecha de Inicio**: 2026-11-06
- **Estado**: Completada
- **Objetivo**: Implementar en el frontend el selector de modelo de IA dentro del espacio reservado en la cabecera de `TeamChatPanel.tsx` (`#team-chat-model-selector-slot`). Consumir los endpoints existentes `GET /ai/providers` y `PUT /ai/providers/active` (enviando `x-session-id`). Mostrar los tres proveedores (local, groq, gemini) con estado de disponibilidad (punto + texto corto "disponible"/"no disponible") y marcar el activo. Al seleccionar otro, enviar PUT, actualizar el activo y mostrar error discreto en español ante 400 o 409, redirigiendo a login ante 401 (`session-invalid`). Carga inicial al abrir el panel y botón pequeño para forzar refresco (`?refresh=1`) sin polling. Permitir seleccionar proveedores no disponibles respetando el respaldo automático del backend. Texto aclaratorio "Modelo activo del equipo". Sin modificar `AiChatPanel`, `socket.ts` ni backend.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-065
- **Nombre**: Diagnóstico y corrección de fallos en reconexión de chat y validación de índices fraccionarios (InvalidFractionalIndexError)
- **Fecha de Inicio**: 2026-11-05
- **Estado**: Completada
- **Objetivo**: Implementar correcciones mínimas para los dos fallos de la prueba 5: (1) En `realtimeSync.ts`, resetear `currentRoomId = null` en `disconnect` y forzar re-unión en `connect` para que `join-diagram` se emita siempre; (2) En `useTeamChat.ts`, sincronizar `attemptChatJoin()` con la confirmación de sala recibida en `diagram-state`, garantizando que `join-diagram` esté completado antes de intentar `chat-join`; (3) En `App.tsx:handleUmlModalConfirm`, envolver la escena con `syncInvalidIndices` de `@excalidraw/element` para asignar índices fraccionarios válidos y ascendentes a los elementos nuevos antes de `updateScene`, preservando intactas las validaciones de Excalidraw. Verificar con typecheck (0 errores) y suite de backend (28/28 tests aprobados). Pendiente validación manual de regresión por el usuario.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-064
- **Nombre**: Panel de Chat del Equipo en Frontend con sincronización Socket.IO y persistencia (CU18 Fase 4)
- **Fecha de Inicio**: 2026-11-05
- **Estado**: Completada
- **Objetivo**: Crear el componente "Chat del equipo" (`TeamChatPanel.tsx`, `TeamChatButton.tsx`, `useTeamChat.ts`, `TeamChat.scss`) hermano de `AiChatButton` y `AiChatPanel` en `ExcalidrawWrapper` dentro de `frontend/excalidraw-app/App.tsx`. Ubicar el botón y el panel para que no se solapen con los de la IA personal. Dejar espacio en cabecera para futuro selector de modelo. Mantener el hook/componente montado mientras el diagrama esté abierto para gestionar: (1) `chat-join` con reintento (hasta 5 veces cada 500ms ante `not_in_room`) en conexión, reconexión y cambio de diagrama; (2) carga y fusión de historial con `GET /diagrams/:id/chat?limit=50` sin duplicar; (3) recepción y renderizado de `chat-message` de la sala en tiempo real; (4) envío seguro con validación, mensajes de error en español, redirección ante `invalid_session` con `session-invalid`, scroll inteligente, badge de no leídos, soporte de enter/shift+enter y límite de 2000 caracteres. Sin tocar `AiChatPanel`, sincronización de lienzo, `joinDiagramRoom`/`leaveDiagramRoom` ni backend.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-063
- **Nombre**: Sanitización pública de mensajes de chat omitiendo authorSessionId (CU18 Ajuste de Seguridad)
- **Fecha de Inicio**: 2026-11-05
- **Estado**: Completada
- **Objetivo**: Crear una función compartida (por ejemplo en `chatRepository.ts`, `toPublicChatMessage`) que convierta un documento de mensaje interno a su forma pública exponiendo únicamente `{ id, diagramId, authorName, role, text, createdAt, mentions?, proposal? }` y excluyendo estrictamente `authorSessionId` (credencial de sesión). Aplicar esta conversión compartida en `socket.ts` (emisión de evento `chat-message`) y en `diagramRoutes.ts` (respuesta de `GET /diagrams/:id/chat`). Conservar `authorSessionId` en la base de datos MongoDB. Agregar/ajustar pruebas unitarias y de integración para asegurar que `authorSessionId` nunca se filtre hacia el cliente.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-062
- **Nombre**: Endpoint GET /diagrams/:id/chat para historial de mensajes (CU18 Fase 3 Paso 2)
- **Fecha de Inicio**: 2026-11-05
- **Estado**: Completada
- **Objetivo**: Implementar el endpoint `GET /diagrams/:id/chat?limit=50` en el router de diagramas. Exigir y validar el encabezado `x-session-id` contra `getSession` (401 si falta o no existe). Validar el parámetro opcional `limit`: por defecto 50, máx 100, y responder 400 si no es un número entero positivo. Verificar la existencia del diagrama siguiendo el patrón del router. Invocar `listMessages(id, limit)` de `chatRepository.ts` y responder 200 `{ messages: [...] }` en orden cronológico ascendente y formato idéntico al evento `chat-message`. Responder 503 `{ error: "chat_unavailable" }` ante `ChatUnavailableError`. Sin tocar `socket.ts`, frontend ni Postgres salvo lectura de sesión.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-061
- **Nombre**: Eventos de socket chat-join y chat-message con validación de sesión y persistencia (CU18 Fase 3 Paso 1)
- **Fecha de Inicio**: 2026-11-05
- **Estado**: Completada
- **Objetivo**: En `backend/src/socket.ts`, agregar los eventos `chat-join` y `chat-message` sin modificar los eventos existentes (`join-diagram`, `leave-diagram`, `diagram-update`, `diagram-state`). En `chat-join`: validar payload `{ diagramId, sessionId }` (bad_request si falta/no es string), validar sesión en Postgres con `getSession` (invalid_session si no existe), comprobar que el socket pertenezca a la sala `diagramId` en `socket.rooms` (not_in_room si no está). Si es válido, guardar en `socket.data` `{ diagramId, sessionId, authorName: session.username }` y responder al callback `{ ok: true }`. En `chat-message`: validar pertenencia previa en `socket.data` y `socket.rooms` (not_joined), revalidar sesión con `sessionExists` (invalid_session), extraer autor exclusivamente de `socket.data`, persistir con `saveMessage` en MongoDB con role "user" (errores controlados empty, too_long con ChatValidationError y unavailable con ChatUnavailableError), emitir a toda la sala con `io.to(diagramId).emit("chat-message", doc)` y responder al callback `{ ok: true }`. Sin tocar frontend ni Postgres salvo lectura de sesión.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-060
- **Nombre**: Repositorio de mensajes de chat en MongoDB y robustecimiento de getMongoDb (CU18 Fase 2)
- **Fecha de Inicio**: 2026-11-05
- **Estado**: Completada
- **Objetivo**: En `backend/src/db/mongo.ts`, asegurar que `getMongoDb` reintente conectar cuando la conexión inicial falló o no existe sin tumbar el proceso ni retener un cliente roto en caché, usando "classdraw" como base de datos por defecto si la URI no la especifica. Crear `backend/src/chat/chatRepository.ts` sobre la colección `chat_messages` con `saveMessage` (recorte de espacios, validación de vacío y máx 2000 caracteres, fecha createdAt, id como string) y `listMessages` (últimos mensajes en orden cronológico ascendente, límite por defecto 50 y máx 100). Creación idempotente del índice `{ diagramId: 1, createdAt: 1 }`. Lanzamiento de error controlado `ChatUnavailableError` ante indisponibilidad de Mongo. Pruebas exhaustivas con el framework de pruebas de backend (`node:test`) cubriendo guardado, listado, orden, límites, validaciones, separación por diagrama, error sin Mongo y limpieza de datos de prueba. Sin tocar `socket.ts`, rutas ni frontend.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-059
- **Nombre**: Conexión no bloqueante a MongoDB Atlas para chat de equipo (CU18 Fase 1)
- **Fecha de Inicio**: 2026-11-05
- **Estado**: Completada
- **Objetivo**: Instalar el paquete oficial `mongodb` en el backend. Crear el módulo `backend/src/db/mongo.ts` con cliente singleton reutilizable leyendo `MONGODB_URI`, exponiendo funciones para obtener la base de datos (`getMongoDb`), comprobar la conexión con ping (`checkMongoConnection` o `connectMongo`) y cierre ordenado (`closeMongoConnection`). Agregar `MONGODB_URI=` a `backend/.env.example`. En `backend/src/index.ts`, iniciar la comprobación/conexión a MongoDB de manera no bloqueante (sin afectar Postgres, Socket.IO ni el lienzo si falta la variable o Atlas no responde) y cerrar la conexión al apagar el servidor. No tocar `socket.ts` ni el frontend.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-058
- **Nombre**: Endpoints GET /ai/providers y PUT /ai/providers/active para listar y cambiar proveedor activo (CU24 Fase 4 Paso 2)
- **Fecha de Inicio**: 2026-11-04
- **Estado**: Completada
- **Objetivo**: En providerManager.ts dar soporte a forceRefresh en checkProviderHealth y función listProviders(). En aiProviderRoutes.ts implementar GET /ai/providers (devuelve [{ id, label, available, active, model }], available de health check 30s o refresh=1 forzado, sin URLs ni claves) y PUT /ai/providers/active (valida id, comprobación fresca de disponibilidad; si falla 409 PROVIDER_UNAVAILABLE dejando activo anterior, si responde actualiza activo y 200 { ok: true, active: id }). Ambos protegidos por middleware de sesión (401 si no hay sesión válida). No alterar POST /local/register ni otros archivos.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-057
- **Nombre**: Implementación de respaldo automático entre proveedores y conexión con ai-edit (CU24 Fase 4 Paso 1)
- **Fecha de Inicio**: 2026-11-03
- **Estado**: Completada
- **Objetivo**: Crear backend/src/ai/providers/providerManager.ts con estado en memoria del proveedor activo (inicializado según AI_PROVIDER: gemini, local o groq), health check con caché de 30s (ping con 3s a local; isConfigured() para groq y gemini), función editWithFallback(currentModel, instruction) con orden de respaldo local -> groq -> gemini (gemini solo si isConfigured()), reintento único ante INVALID_AI_RESPONSE o error de conexión, salto sin reintento ante AI_TIMEOUT de local, error AI_ALL_PROVIDERS_FAILED si todos fallan por indisponibilidad. En diagramRoutes.ts usar editWithFallback, añadir provider y fallback al JSON 200, y mapear AI_ALL_PROVIDERS_FAILED a 503 AI_SERVICE_UNAVAILABLE. No tocar helpAssistant.ts, visionDiagram.ts, groq.ts, gemini.ts, localProvider.ts ni aiProviderRoutes.ts.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-056
- **Nombre**: Endpoint de registro de modelo local POST /ai/providers/local/register (CU24 Fase 3 Paso 1)
- **Fecha de Inicio**: 2026-11-03
- **Estado**: Completada
- **Objetivo**: Crear backend/src/routes/aiProviderRoutes.ts con POST /ai/providers/local/register con autenticación por header x-registration-token usando crypto.timingSafeEqual, validación de url (https:// o http://localhost en dev) y model, probe de conectividad al modelo en 3s, registro con setLocalConfig y respuesta 200. Registrar el router en app.ts. Agregar AI_REGISTRATION_TOKEN y LOCAL_AI_TIMEOUT_MS a backend/.env.example. No tocar diagramRoutes.ts, helpAssistant.ts ni los proveedores existentes.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-055
- **Nombre**: Script de evaluación de modelo local backend/scripts/evalLocalModel.ts (CU24 Fase 2 Paso 2)
- **Fecha de Inicio**: 2026-11-03
- **Estado**: Completada
- **Objetivo**: Crear script de evaluación backend/scripts/evalLocalModel.ts ejecutable con npx tsx. Lee LOCAL_EVAL_URL y LOCAL_EVAL_MODEL, evalúa 12 instrucciones estructuradas sobre diagrama de ejemplo Cliente/Pedido con localProvider midiendo ms, validez de operaciones y tipos de error (INVALID_AI_RESPONSE / AI_TIMEOUT), evalúa 3 preguntas conversacionales senior midiendo idioma español y mención por nombre (Davico, Ana, Luis), imprime tabla resumen y totales, guarda detalle en backend/scripts/eval-results.json y agrega la ruta al .gitignore sin modificar otros archivos existentes.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-054
- **Nombre**: Implementación de LocalProvider para servidor local tipo Colab (CU24 Fase 2 Paso 1)
- **Fecha de Inicio**: 2026-11-03
- **Estado**: Completada
- **Objetivo**: Crear backend/src/ai/providers/localProvider.ts implementando ModelProvider (id "local", label "Local (Colab)") con mismo prompt y esquema que groq.ts, gestión de config en memoria (setLocalConfig/getLocalConfig/clearLocalConfig), llamada a POST {url}/v1/chat/completions con json_schema y fallback a json_object ante error 400, timeout LOCAL_AI_TIMEOUT_MS (default 45000), errores INVALID_AI_RESPONSE y AI_TIMEOUT. Registrarlo en index.ts. No tocar groq.ts, gemini.ts, diagramRoutes.ts ni otros archivos.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-053
- **Nombre**: Reemplazo de selección de proveedor en diagramRoutes.ts con getProvider (CU24 Fase 1 Paso 2)
- **Fecha de Inicio**: 2026-11-03
- **Estado**: Completada
- **Objetivo**: Actualizar la ruta POST /diagrams/:id/ai-edit en backend/src/routes/diagramRoutes.ts para resolver el proveedor con getProvider(providerId) de backend/src/ai/providers. Mantener regla: si AI_PROVIDER en minúsculas es "gemini" se usa gemini, caso contrario groq. Llamar a provider.editDiagramByInstruction(currentModel, instructionToSend). Quitar imports en desuso (editDiagramByInstruction y editDiagramByInstructionGroq), preservar isTimeoutError y no modificar bloques catch ni respuestas HTTP. Validar con chequeo de tipos (tsc) y mostrar diff.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-052
- **Nombre**: Implementación de la interfaz común ModelProvider y adaptadores Groq y Gemini (CU24 Fase 1 Paso 1)
- **Fecha de Inicio**: 2026-11-03
- **Estado**: Completada
- **Objetivo**: Crear la interfaz común ModelProvider en backend/src/ai/providers/types.ts con id ("local" | "groq" | "gemini"), label, isConfigured() y editDiagramByInstruction(currentModel, instruction) -> Promise<{ operations: any[] }>. Crear los adaptadores groqProvider.ts y geminiProvider.ts envolviendo las funciones existentes de backend/src/services/groq.ts y gemini.ts sin modificarlas. Crear index.ts exportando getProvider(id). No alterar diagramRoutes.ts, helpAssistant.ts ni visionDiagram.ts. Validar mediante chequeo de tipos (tsc --noEmit).

---

## Tarea Anterior (completada)

- **Identificador**: TSK-051
- **Nombre**: Omisión de atributo id en mobileGenerator y migración por firma de esquema en Repositorio
- **Fecha de Inicio**: 2026-10-31
- **Estado**: Completada
- **Objetivo**: Paso 0: diagnóstico de CU5 sobre tratamiento de atributos id (archivo y línea). Paso 1: omitir atributo id/ID en backend/src/mobileGenerator/converter.ts permitiendo campos vacíos sin fallar. Paso 2: cálculo y persistencia de firma de esquema en Repositorio.abrir(Esquema); si difiere o no hay firma pero sí base, rotar app.db a app_anterior_<timestamp>.db y recrear base. Paso 3: tests unitarios en backend y mobile-template, validando totales con flutter analyze y flutter test.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-050
- **Nombre**: Implementación del generador de app móvil (backend, mobile-template y frontend)
- **Fecha de Inicio**: 2026-10-30
- **Estado**: Completada
- **Objetivo**: Paso 0: diagnóstico de CU5 (endpoint, auth, frontend, librería zip). Paso 1: soporte de assets/esquema.json en mobile-template y carga dinámica en pantalla_voz con construirPrompt. Paso 2: convertidor UmlModel a esquema.json en backend/src/mobileGenerator/, empaquetador ZIP excluyendo temporales/GGUF con LEEME.txt y nuevo endpoint. Paso 3: botón en frontend de descarga y validación integral con tests de backend, flutter analyze y flutter test.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-049
- **Nombre**: Implementación de sincronización simple con backend Spring Boot en mobile-template
- **Fecha de Inicio**: 2026-10-30
- **Estado**: Completada
- **Objetivo**: Lectura en modo SOLO LECTURA de backend/src/backendGenerator/ para reglas de rutas y formato JSON; agregar dependencias http y connectivity_plus e INTERNET/usesCleartextTraffic en AndroidManifest; crear lib/sync/config_servidor.dart (persistencia URL con path_provider y validación http); crear lib/sync/sincronizador.dart con orden topológico, mapeo camelCase, timeout 10s, resolución de refs a id_servidor y bloqueo mono-ejecución; actualizar pantalla_voz con botón Sincronizar, diálogo de URL, estado "Sincronizado" y listener de conectividad; crear test/sincronizador_test.dart con MockClient; validar con flutter analyze, flutter test, git status y despliegue release.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-048
- **Nombre**: Corrección de propagación del prompt dinámico de Tienda al modelo en ServicioIa e Interprete
- **Fecha de Inicio**: 2026-10-30
- **Estado**: Completada
- **Objetivo**: Diagnóstico inicial (prompt de carga/calentamiento, inicios anticipados del servicio compartido, línea donde se arma el prompt de interpretar). Corrección para que el prompt seleccionado se use en carga, calentamiento e inferencia, y bloqueo con mensaje "Reinicia la app para cambiar de modo" si ya se cargó otro. Mostrar en Prueba de IA los primeros 80 caracteres del prompt cargado y nombre del esquema. Test unitario comprobando ausencia de Atencion/Cliente y retención de prompt en ServicioIa. Validación con flutter analyze, flutter test, git status y despliegue release.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-047
- **Nombre**: Sincronización del esquema para el validador con el selector de esquema en Prueba de IA
- **Fecha de Inicio**: 2026-10-30
- **Estado**: Completada
- **Objetivo**: Identificar la línea exacta donde se arma el esquema que va al validador; sincronizar el selector de esquema (Barbería / Tienda) en lib/pruebas/prueba_ia.dart para que pase el Esquema.paraValidador() correspondiente a Interprete.interpretar; añadir test en test/esquema_test.dart para comprobar Categoria y Producto sin Atencion; verificar con flutter analyze, flutter test, git status y compilar e instalar APK release.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-046
- **Nombre**: Generador dinámico de prompts de sistema desde Esquema (lib/ia/prompt_generado.dart) y selector en Prueba de IA
- **Fecha de Inicio**: 2026-10-30
- **Estado**: Completada
- **Objetivo**: Crear lib/ia/prompt_generado.dart (Dart puro) con construirPrompt(Esquema) respetando las 6 reglas (intérprete genérico, lista de campos de paraValidador con marca de campo numérico, reglas núcleo de veracidad, ejemplos neutros con límite de 10, máximo 4 clases en orden topológico, regla genérica de monto/cobro, y longitud < 1800 caracteres); adaptar servicio_ia e interprete para recibir prompt dinámico; añadir selector manual/generado y esquema Tienda en prueba_ia; crear test/prompt_generado_test.dart con 6 casos; verificar con flutter analyze, flutter test, git status y compilar e instalar APK release.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-045
- **Nombre**: Implementación de Asistente de Voz para Usuario Final (pantalla_voz, resumen, esquema_barberia) en mobile-template (CU13 Fase 3)
- **Fecha de Inicio**: 2026-10-30
- **Estado**: Completada
- **Objetivo**: Crear lib/esquema/esquema_barberia.dart con la definición JSON del esquema Cliente/Atencion; crear lib/ia/resumen.dart (Dart puro) con resumenCrear y respuestaConsulta sin tecnicismos; crear lib/pantallas/pantalla_voz.dart reutilizando ServicioVoz y ServicioIa, con confirmación editable de crear (validación primer campo no vacío y números válidos, detección de duplicados en clases sin ref, deshabilitación antidoble toque, guardado con Repositorio), consulta directa sin confirmación, contador inferior "N pendientes" e inicialización única de base de datos; añadir botón "Asistente" en lib/main.dart; crear test/resumen_test.dart con al menos 8 casos y dos esquemas; verificar con flutter analyze, flutter test, git status y compilar/instalar APK release.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-044
- **Nombre**: Implementación de reconocimiento de voz local (speech_to_text) y pantalla Prueba de Voz en mobile-template (CU13 Fase 3)
- **Fecha de Inicio**: 2026-10-30
- **Estado**: Completada
- **Objetivo**: Inspeccionar la prueba de voz en D:\pruebas_cu13; añadir RECORD_AUDIO y queries en AndroidManifest.xml de mobile-template; crear lib/ia/servicio_ia.dart (singleton/servicio compartido de Interprete) y adaptar lib/pruebas/prueba_ia.dart; crear lib/voz/servicio_voz.dart (speech_to_text es_US onDevice: true, manejo de errores y transcripción persistente); crear lib/pruebas/prueba_voz.dart con esquema Cliente/Atencion, botón grande de mic, métricas de tiempo y validación; añadir botón en lib/main.dart; verificar con flutter analyze, flutter test, git status y compilar e instalar APK release.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-043
- **Nombre**: Corrección definitiva de acceso al modelo GGUF con path_provider en mobile-template
- **Fecha de Inicio**: 2026-10-30
- **Estado**: Completada
- **Objetivo**: Integrar path_provider en mobile-template/pubspec.yaml, actualizar lib/ia/interprete.dart para resolver el directorio externo propio mediante getExternalStorageDirectory(), asegurar la creación automática de la subcarpeta models, buscar qwen2.5-1.5b-instruct-q4_k_m.gguf en dicha ruta, proteger rutas alternativas con try/catch, verificar con flutter analyze, flutter test, compilar APK release e inspeccionar la ruta en el dispositivo.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-042
- **Nombre**: Traslado del intérprete local con fcllama a mobile-template (CU13 Fase 3)
- **Fecha de Inicio**: 2026-10-30
- **Estado**: Completada
- **Objetivo**: Integrar fcllama en mobile-template (pubspec.yaml, AndroidManifest.xml largeHeap=true), copiar lib/ia/validador.dart desde llm_test, crear lib/ia/prompt_barberia.dart con el prompt vigente, crear lib/ia/interprete.dart con la clase Interprete (preparar, verificar existencia del GGUF, inferencia de calentamiento, interpretar con reintento y medición de Stopwatch), crear lib/pruebas/prueba_ia.dart con preparación, prueba interactiva y lote de 8 frases, añadir botón "Prueba de IA" en lib/main.dart, copiar test/validador_test.dart ajustando import, y verificar con flutter analyze, flutter test y compilación release.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-041
- **Nombre**: Implementación de Repositorio SQLite (lib/datos/repositorio.dart), Pantalla de Prueba (lib/pruebas/prueba_datos.dart) y test en mobile-template
- **Fecha de Inicio**: 2026-10-29
- **Estado**: Completada
- **Objetivo**: Crear lib/datos/repositorio.dart con operaciones abrir(Esquema), insertar (resolución y reutilización case/accent-insensitive de ref), listar (join/reemplazo de ref por nombre y filtro soloHoy) y consultar (lista, conteo, suma sobre primer campo numérico y filtro p: hoy/todo). Crear lib/pruebas/prueba_datos.dart con esquema Cliente y Atencion y botones "Escribir y leer" y "Solo leer". Agregar botón en lib/main.dart. Agregar test en test/esquema_test.dart para ref no primero en JSON devuelto primero en paraValidador. Validar con flutter analyze y flutter test.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-040
- **Nombre**: Creación de lib/esquema/esquema.dart y test/esquema_test.dart en mobile-template
- **Fecha de Inicio**: 2026-10-29
- **Estado**: Completada
- **Objetivo**: Crear lib/esquema/esquema.dart (Dart puro) con las clases Esquema, ClaseEsq, CampoEsq, constructor desdeJson, métodos nombreTabla, sentenciasCrearTablas (orden topológico padres antes que hijos) y paraValidador. Crear test/esquema_test.dart cubriendo dos esquemas y todos los casos requeridos. Validar con flutter analyze y flutter test.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-039
- **Nombre**: Diagnóstico y corrección de condición de carrera en initialMode / onboarding en App.tsx
- **Fecha de Inicio**: 2026-10-27
- **Estado**: Completada
