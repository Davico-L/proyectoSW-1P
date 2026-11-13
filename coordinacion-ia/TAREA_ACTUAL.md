# Tarea Actual: Coordinación de IA

Este documento refleja en tiempo real la tarea activa que está ejecutando el asistente de IA y su estado de avance.

---

## Tarea en Curso

- **Identificador**: TSK-121
- **Nombre**: Altura proporcional y espaciado vertical homogéneo en clases UML
- **Fecha de Inicio**: 2026-11-11
- **Estado**: Completada
- **Objetivo**: Estandarizar la altura de las clases UML para que el espaciado vertical entre compartimentos y bordes sea exactamente homogéneo (borde superior → título, título → línea, línea → primer atributo, etc.):
  (1) Identificar las fórmulas actuales de cálculo/estimación de altura en `createUmlClassElement.ts`, `updateUmlClassElement.ts`, `applyAiOperations.ts`, `importXmiToCanvas.ts` y `App.tsx`.
  (2) Implementar función auxiliar `computeUmlClassDimensions` o `computeUmlClassHeight(lineCount, fontSize)` que calcule: `alto = (lineCount + 1) * lineHeightPx`, asegurando que el sobrante vertical sea exactamente media línea arriba y media línea abajo.
  (3) Eliminar mínimos fijos de altura (`140px`) en creación y edición.
  (4) Usar la función compartida en `createUmlClassElement`, `updateUmlClassElement`, `applyAiOperations`, `importXmiToCanvas` y colocación de clases en `App.tsx`.
  (5) Validar comportamiento con `BOUND_TEXT_PADDING` y centrado vertical de Excalidraw.
  (6) Preservar dimensiones de clases ya guardadas al cargar (no modificar su altura en normalización de carga).
  (7) Ejecutar `yarn test:typecheck` y `yarn vitest run`.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-120
- **Nombre**: Líneas separadoras de borde a borde en el renderizado de clases UML (Opción C)
- **Fecha de Inicio**: 2026-11-11
- **Estado**: Completada
- **Objetivo**: Implementar la opción C para dibujar las dos líneas separadoras de las clases UML de borde a borde en el renderizado del rectángulo:
  (1) En `frontend/packages/element/src/renderElement.ts`: propagar `elementsMap` a `drawElementOnCanvas`. En `case "rectangle"`, si `element.customData?.type === "umlClass"`, obtener el texto vinculado con `getBoundTextElement(element, elementsMap)` con null-safety estricta, localizar renglones vacíos y calcular la coordenada local $y$ de cada línea según su índice y altura de línea real, dibujando de $x = 0$ a $x = \text{element.width}$ con estilos idénticos al rectángulo (respetando dark mode y roughness).
  (2) En `frontend/src/uml/types.ts`: actualizar `buildUmlClassLabel` para insertar `""` en los separadores en lugar de `"─"`.
  (3) En `createUmlClassElement.ts` y `updateUmlClassElement.ts`: desacoplar de `computeUmlSeparator`, calcular ancho ignorando renglones vacíos, y limpiar archivos y exports en desuso.
  (4) En la normalización de carga (`normalizeUmlClassCorners` / `normalizeUmlClasses`): limpiar `"─"` de clases antiguas regenerando el texto y forzando la invalidación de caché del contenedor con `newElementWith`.
  (5) Validar con `yarn test:typecheck` y `yarn vitest run`.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-119
- **Nombre**: Separadores dinámicos de compartimentos en clases UML (Opción A)
- **Fecha de Inicio**: 2026-11-11
- **Estado**: Completada
- **Objetivo**: Implementar separadores de compartimentos que lleguen casi de borde a borde en clases UML (1 rectángulo + 1 texto vinculado):
  (1) En `frontend/src/uml/types.ts`: permitir parámetro opcional `separator?: string` en `buildUmlClassLabel`, manteniendo el valor por defecto de 14 caracteres para retrocompatibilidad.
  (2) Crear función auxiliar compartida `computeUmlSeparator(containerWidth)` que use `BOUND_TEXT_PADDING` de Excalidraw, mida el carácter `"─"` con `measureText` y `getFontString` (Liberation Sans, 16px), calcule `N = Math.floor(availableWidth / charWidth) - 1` (con mínimo 14) y asegure que no desborde.
  (3) En `frontend/src/uml/createUmlClassElement.ts`: calcular `maxLineLength` excluyendo separadores, determinar el ancho final, calcular el separador dinámico y pasarlo a `buildUmlClassLabel`.
  (4) En `frontend/src/uml/updateUmlClassElement.ts`: usar la misma función compartida con el ancho final para regenerar el texto con el separador dinámico.
  (5) Validar con `yarn test:typecheck`, verificar que no existan saltos de línea indeseados en separadores y reportar métricas calculadas (ancho del carácter, valores de N para 220 px y 300 px).

---

## Tarea Anterior (completada)

- **Identificador**: TSK-118
- **Nombre**: Esquinas cuadradas para clases UML y normalización en carga/colaboración
- **Fecha de Inicio**: 2026-11-11
- **Estado**: Completada
- **Objetivo**: Implementar esquinas cuadradas (`roundness: null`) para rectángulos de clase UML (`customData.type === "umlClass"`):
  (1) En `frontend/src/uml/createUmlClassElement.ts`, cambiar `roundness: { type: 3 }` por `roundness: null`.
  (2) En `frontend/src/uml/updateUmlClassElement.ts`, agregar `roundness: null` explícito en `newElementWith(...)`.
  (3) Crear función auxiliar reutilizable `normalizeUmlClassCorners(elements)` que clone con `newElementWith(el, { roundness: null })` los elementos con `customData?.type === "umlClass"` y `roundness !== null`, dejando los demás intactos.
  (4) Identificar y aplicar la normalización en todos los caminos de carga/recepción de elementos al lienzo (restauración inicial en `initializeScene` de `App.tsx`, cambio de diagrama desde "Mis diagramas" y colaboración en tiempo real vía Socket.IO).
  (5) Verificar con `yarn test:typecheck` y documentar.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-117
- **Nombre**: CU22 Fase 3C-2 - Integración de ProposalCard en TeamChatPanel.tsx y pruebas
- **Fecha de Inicio**: 2026-11-09
- **Estado**: Completada
- **Objetivo**: En `frontend/src/teamChat/TeamChatPanel.tsx` y sus pruebas Vitest:
  (1) En el render de cada mensaje (`messages.map`), si `msg.proposal` existe, mostrar `ProposalCard` debajo del texto de Codia con: `proposal={msg.proposal}`, `connected={isConnected}`, `busy={Boolean(busyByMessageId?.[msg.id])}`, `error={errorByMessageId?.[msg.id] || undefined}`, y `onDecision={(decision) => decideProposal(msg.id, decision)}`.
  (2) Preservar sin cambios el render de todos los demás mensajes.
  (3) Implementar pruebas Vitest en `TeamChatPanel.test.tsx`:
      - Mensaje con proposal pendiente muestra la tarjeta con botones.
      - Mensaje con proposal aprobado muestra "Aprobada por X" sin botones.
      - Mensaje sin proposal no muestra tarjeta.
  (4) Correr pruebas del frontend y typecheck, y reportar resultados.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-116
- **Nombre**: CU22 Fase 3C-1 - Hook useTeamChat: decideProposal y proposal-updated
- **Fecha de Inicio**: 2026-11-09
- **Estado**: Completada
- **Objetivo**: En `frontend/src/teamChat/useTeamChat.ts` y sus pruebas Vitest:
  (1) Asegurar que el tipo del mensaje (`PublicChatMessage`) incluya `proposal?: PublicProposalData` con `{ id, status, summary, requestedBy, decidedBy?, decidedAt? }`.
  (2) Implementar `decideProposal(messageId, decision)` emitiendo `"proposal-decision"` `{ diagramId, proposalId: messageId, decision }` con ack y timeout; gestionar estado `busyByMessageId`; actualizar mensaje si el ack trae `proposal`; si trae error, guardar aviso en español en `errorByMessageId` (`already_decided`: "Otro integrante ya decidió", `stale`: "El diagrama cambió, la propuesta caducó", `apply_failed`: "No se pudo aplicar, intenta de nuevo", `not_joined`, `invalid_session`, `storage_error`).
  (3) Escuchar `"proposal-updated"` `{ diagramId, messageId, proposal }` y actualizar el `proposal` del mensaje correspondiente en `messages` (ignorando ids desconocidos o de otro diagrama), limpiando `busy` y aviso de error.
  (4) Exponer `busyByMessageId`, `errorByMessageId` y `decideProposal`.
  (5) No tocar el listener de `ai-operations`.
  (6) Implementar pruebas Vitest para decisión exitosa, error already_decided, proposal-updated e ignorar diagramId distinto.
  (7) Correr pruebas del frontend y typecheck, e informar si el hook recarga el historial al reconectar.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-115
- **Nombre**: CU22 Fase 3B - Componente ProposalCard y estilos
- **Fecha de Inicio**: 2026-11-09
- **Estado**: Completada
- **Objetivo**: En `frontend/src/teamChat/`:
  (1) Crear el componente presentacional `ProposalCard.tsx` con props `{ proposal, connected, busy, error?, onDecision }`.
  (2) Diseñar: línea superior "Propuesta de Codia" con etiqueta de estado a la derecha; lista del resumen con viñeta por elemento; si status es "pending", botones "Aprobar" (relleno) y "Rechazar" (solo borde) deshabilitados ante `busy` o `!connected` (con nota "Sin conexión"), y texto "Procesando…" cuando `busy`; si no está pendiente, mostrar estado definitivo ("Aprobada por X", "Rechazada por X", "Caducada: repite el pedido a Codia"); si hay error, línea de aviso.
  (3) Integrar estilos en `TeamChat.scss` con colores suaves (baja saturación: verde, gris, ámbar), excelente contraste y soporte para tema claro y oscuro.
  (4) Implementar pruebas Vitest en `ProposalCard.test.tsx` cubriendo todos los estados y comportamientos.
  (5) Correr pruebas del frontend (`test:app`) y typecheck (`test:typecheck`).

---

## Tarea Anterior (completada)

- **Identificador**: TSK-114
- **Nombre**: CU22 Fase 3A - Frontend TeamRoomSettingsSelector con modo approval
- **Fecha de Inicio**: 2026-11-09
- **Estado**: Completada
- **Objetivo**: En `frontend/src/teamChat/TeamRoomSettingsSelector.tsx` y `TeamRoomSettingsSelector.test.tsx`:
  (1) Añadir `"approval"` al tipo `RoomMode` local y a la validación de `res.settings.mode` / eventos entrantes.
  (2) Añadir un tercer radio `"Pide aprobación"` con descripción `"Codia propone los cambios y el equipo los aprueba o rechaza"`, conservando estilo y comportamiento de los radios existentes.
  (3) Mantener intactos los otros dos radios (`"Aplica los cambios"` y `"Solo aconseja"`).
  (4) Actualizar y agregar pruebas en Vitest: se muestra el tercer radio, seleccionarlo envía `mode: "approval"`, y se refleja el modo recibido del servidor.
  (5) Correr pruebas del frontend y typecheck (`tsc --noEmit`).

---

## Tarea Anterior (completada)

- **Identificador**: TSK-113
- **Nombre**: CU22 Ajuste en aiChatService.ts - proposal.summary por operación
- **Fecha de Inicio**: 2026-11-09
- **Estado**: Completada
- **Objetivo**: En `backend/src/chat/aiChatService.ts` (rama modo "approval"):
  (1) Cambiar `proposal.summary` para que sea un arreglo con un elemento por cada operación (reutilizando la lógica de `summarizeOperations` o su descripción por operación) con las advertencias como elementos aparte, en lugar de un único elemento con una línea larga.
  (2) Preservar el texto del mensaje (`buildProposalText(askerName, summaryText)`) exactamente igual que ahora.
  (3) Ajustar las pruebas en `aiChatServiceCu22.test.ts` y cualquier prueba relacionada.
  (4) Correr pruebas del backend (`npm test`) y typecheck (`npm run typecheck`), verificando que no haya regresiones.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-112
- **Nombre**: CU22 Fase 2B-3 - Script smoke:cu22 de integración Socket.IO
- **Fecha de Inicio**: 2026-11-09
- **Estado**: Completada
- **Objetivo**: Crear y ejecutar el script `smoke:cu22` (`backend/src/scripts/cu22-socket-smoke.ts`) con dos clientes Socket.IO (Ana y Luis) en la misma sala, usando Groq como proveedor para preservar la cuota de Gemini:
  (1) Configurar modo "approval" ("Pide aprobación").
  (2) Ana solicita "@Codia agrega la clase Factura": verificar propuesta pendiente sin operations y que ningún socket recibe ai-operations.
  (3) Luis rechaza: verificar emisión de proposal-updated ("rejected") y mensaje de sistema en chat.
  (4) Nuevo pedido (@Codia agrega la clase Cliente): Luis aprueba (respondiendo ack applied: 1), verificar proposal-updated ("approved") y mensaje de sistema.
  (5) Doble aprobación concurrente sobre nuevo pedido (@Codia agrega la clase Pedido): verificar que exactamente una gana y la otra recibe already_decided.
  (6) Registrar script en `backend/package.json` y verificar salida con código 0.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-111
- **Nombre**: CU22 Fase 2B-2 - Rama approve en proposal-decision de socket.ts
- **Fecha de Inicio**: 2026-11-09
- **Estado**: Completada
- **Objetivo**: En `backend/src/socket.ts`:
  (1) Implementar la rama `"approve"` en el listener `"proposal-decision"`:
      - Reclamar la propuesta vía `claimProposal` (errores `already_decided` y `not_found` igual que en `reject`).
      - Validar el diagrama actual con `getDiagramById`, `extractUmlModel` y `validateAndResolveOperations` (reutilizándolos).
      - Si el diagrama no existe o alguna operación ya no es aplicable (válidas < guardadas): `settleProposal("expired")` sin `decidedBy`, guardar mensaje de sistema `"La propuesta de Codia caducó porque el diagrama cambió. Repite el pedido a Codia."`, emitir `"proposal-updated"` y mensaje de sistema a la sala, y responder ack `{ ok: false, error: "stale", proposal }`.
      - Si son válidas: emitir con ack al socket de quien aprueba (`approverSocket.timeout(timeoutMs).emitWithAck("ai-operations", { messageId: \`\${id}:\${Date.now()}\`, diagramId, operations, warnings, timeoutMs })`).
      - Si ack devuelve `applied > 0`: `settleProposal("approved", decidedBy)`, mensaje de sistema `"<Nombre> aprobó la propuesta de Codia"`, emitir `"proposal-updated"` y mensaje de sistema a la sala, y responder ack `{ ok: true, proposal }`.
      - Si ack falla, timeout o applied === 0: `settleProposal("pending")` y responder ack `{ ok: false, error: "apply_failed", proposal }`.
      - Excepciones de Mongo posteriores al claim: intentar revertir a `"pending"` y responder `{ ok: false, error: "storage_error" }`.
  (2) Implementar pruebas automatizadas en `socketProposalEvents.test.ts`:
      - Aprobación exitosa (`ai-operations` solo al aprobador, no a otros).
      - Doble aprobación concurrente (se aplica una sola vez).
      - Propuesta caducada tras borrar/cambiar clase (`stale`).
      - Ack con fallo/timeout vuelve a pending y se puede reintentar.
      - Aprobar su propia propuesta (permitido a cualquier integrante unido).
      - Aprobar propuesta ya rechazada devuelve `already_decided`.
  (3) Ejecutar pruebas de backend (`npm test`) y typecheck (`npm run typecheck`).

---

## Tarea Anterior (completada)

- **Identificador**: TSK-110
- **Nombre**: CU22 Fase 2B-1 - Listener proposal-decision en socket.ts (flujo reject)
- **Fecha de Inicio**: 2026-11-09
- **Estado**: Completada
- **Objetivo**: En `backend/src/socket.ts`:
  (1) Crear el listener Socket.IO `"proposal-decision"` con payload `{ diagramId, proposalId, decision: "approve" | "reject" }` y acknowledgement `{ ok: boolean, error?: string, proposal?: PublicProposal }`.
  (2) Reutilizar la verificación de sala unida (`socket.rooms.has(diagramId)` y `socket.data.diagramId`) y verificación de sesión en Postgres (`sessionExists`), asegurando que el nombre de quien decide provenga estrictamente de la sesión (`socket.data.authorName`).
  (3) Manejar errores de acceso y validación: `not_joined`, `invalid_session`, `not_found` (para payload mal formado o propuesta inexistente).
  (4) Flujo `"reject"`: invocar `claimProposal`, luego `settleProposal` con `"rejected"` y `decidedBy`. Si el claim falla con `already_decided`, responder `{ ok: false, error: "already_decided", proposal }`. Si el claim tiene éxito, guardar mensaje de sistema `"<Nombre> rechazó la propuesta de Codia"`, emitir a la sala `"proposal-updated"` `{ diagramId, messageId, proposal }` y el mensaje de sistema como `"chat-message"`, respondiendo el ack con `{ ok: true, proposal }`.
  (5) Rama `"approve"`: responder `{ ok: false, error: "apply_failed" }` sin reclamar nada (a implementar en Fase 2B-2).
  (6) Implementar pruebas automatizadas: rechazo exitoso, doble rechazo concurrente (uno gana), sin unirse a la sala, sesión inválida, propuesta inexistente.
  (7) Ejecutar pruebas de backend (`npm test`) y typecheck (`npm run typecheck`).

---

## Tarea Anterior (completada)

- **Identificador**: TSK-109
- **Nombre**: CU22 Fase 2A-2 - Flujo de chat-message en socket.ts para propuestas
- **Fecha de Inicio**: 2026-11-09
- **Estado**: Completada
- **Objetivo**: En `backend/src/socket.ts`:
  (1) En el flujo de `chat-message`, cuando `answerInRoom` devuelve `kind === "proposal"`:
      - Guardar la respuesta con `saveMessage` incluyendo `proposal: result.proposal` y `operations: result.operations` (las operaciones se persisten en MongoDB).
      - Emitir el mensaje a la sala con `toPublicChatMessage(aiDoc)` sin emitir `ai-operations`.
      - Preservar el guardado y emisión de los demás resultados (`apply`, `advise`, consultas) idéntico a hoy.
  (2) Agregar pruebas automatizadas en `socketChatEvents.test.ts` que validen:
      - En modo `approval`, un pedido de modificación guarda en Mongo un mensaje con `proposal` pendiente y `operations`, la sala recibe el mensaje público sin `operations`, y no se emite `ai-operations`.
      - En modo `apply`, se continúa emitiendo `ai-operations`.
  (3) Ejecutar pruebas de backend (`npm test`) y typecheck (`npm run typecheck`).

---

## Tarea Anterior (completada)

- **Identificador**: TSK-108
- **Nombre**: CU22 Fase 2A-1 - Integración del modo "approval" en aiChatService
- **Fecha de Inicio**: 2026-11-09
- **Estado**: Completada
- **Objetivo**: En `backend/src/chat/`:
  (1) En `aiChatService.ts`, en la rama de modificación con `status === "ready"` y `currentMode === "approval"`:
      - No invocar `params.onOperations`.
      - Reutilizar la lógica de resumen de `"advise"` con `summarizeOperations(validOps, warningsList)`.
      - Crear la propuesta con `createProposal({ summary: [cleanSummary], requestedBy: cleanAsker })`.
      - Retornar `{ kind: "proposal", message: buildProposalText(cleanAsker, cleanSummary), operations: validOps, warnings: warningsList, proposal }`.
      - Agregar el campo opcional `proposal?: Proposal` a `AnswerInRoomResult`.
      - Mantener idénticos los modos `"apply"`, `"advise"` y los demás estados (`tooMany`, `onlyWarnings`, `noChanges`, `diagramNotFound`).
  (2) Crear suite de pruebas exhaustivas en `aiChatServiceCu22.test.ts` (o agregar a tests de aiChatService) validando:
      - Modo `"approval"` con `"ready"` no llama a `onOperations` y devuelve `{ kind: "proposal", proposal, operations: validOps }`.
      - Modo `"approval"` con pedido no soportado o sin cambios responde como en CU20 sin generar propuesta.
      - Modos `"apply"` y `"advise"` sin cambios.
  (3) Ejecutar pruebas de backend (`npm test`) y typecheck (`npm run typecheck`).

---

## Tarea Anterior (completada)

- **Identificador**: TSK-107
- **Nombre**: CU22 Fase 1C - Métodos de propuesta y consulta en chatRepository
- **Fecha de Inicio**: 2026-11-09
- **Estado**: Completada
- **Objetivo**: En `backend/src/chat/chatRepository.ts`:
  (1) Implementar `getMessageById(diagramId, messageId)` que devuelve el documento completo (con `operations`) o `null` (id inválido devuelve `null`).
  (2) Implementar `claimProposal(diagramId, messageId, decidedBy)` con un único `findOneAndUpdate` atómico: filtro `_id`, `diagramId`, y `proposal.status === "pending"` o (`proposal.status === "applying"` con `applyingAt` > 60 s); asigna status `"applying"` y `applyingAt`. Devuelve `{ ok: true, message }` o `{ ok: false, reason: "not_found" | "already_decided", proposal: versión pública vigente }`.
  (3) Implementar `settleProposal(diagramId, messageId, outcome, decidedBy?)`: actúa solo si status es `"applying"`; para `"approved"`, `"rejected"` o `"expired"` guarda `decidedBy` y `decidedAt`; para `"pending"` quita `applyingAt`. Devuelve el documento actualizado o `null`.
  (4) Actualizar `toPublicChatMessage` para procesar `proposal` mediante `toPublicProposal`.
  (5) Agregar pruebas automatizadas en `chatRepository.test.ts` con MongoDB de pruebas.
  (6) Ejecutar pruebas y typecheck del backend y verificar cero regresiones.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-106
- **Nombre**: CU22 Fase 1B - Creación de proposalHelpers.ts en el backend
- **Fecha de Inicio**: 2026-11-09
- **Estado**: Completada
- **Objetivo**: En `backend/src/chat/`:
  (1) Crear `proposalHelpers.ts` con funciones puras y tipos:
      - `ProposalStatus` interno (`"pending"`, `"applying"`, `"approved"`, `"rejected"`, `"expired"`).
      - `PublicProposalStatus` público (`"pending"`, `"approved"`, `"rejected"`, `"expired"`).
      - `createProposal({ summary: string[], requestedBy: string })` -> `{ id: randomUUID(), status: "pending", summary, requestedBy }`.
      - `toPublicProposal(p)` -> `{ id, status, summary, requestedBy, decidedBy?, decidedAt? }`, mapeando `"applying"` a `"pending"` y omitiendo campos internos.
      - `buildProposalText(nombre, resumen)` -> `"<Nombre>, propongo: <resumen>. Queda pendiente de aprobación del equipo."`.
  (2) En `aiChatService.ts`, ampliar el tipo de `kind` en `AnswerInRoomResult` a `"answer" | "modification" | "proposal"`.
  (3) Crear `backend/src/chat/proposalHelpers.test.ts` con cobertura completa.
  (4) Ejecutar pruebas y typecheck en backend y frontend sin regresiones.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-105
- **Nombre**: CU22 Fase 1A - Modo "approval" en roomSettingsRepository
- **Fecha de Inicio**: 2026-11-09
- **Estado**: Completada
- **Objetivo**: En `backend/src/chat/roomSettingsRepository.ts`:
  (1) Ampliar el tipo `RoomMode`, `VALID_ROOM_MODES` y `MODE_LABELS` para incorporar el tercer modo `"approval"` con la etiqueta `"Pide aprobación"`.
  (2) Preservar el modo por defecto en `"apply"`.
  (3) No tocar `aiChatService` ni el frontend.
  (4) Agregar pruebas unitarias en el backend que verifiquen: aceptación de `"approval"`, rechazo de valores inválidos, y generación de anuncio con `formatSettingsAnnouncement` usando la nueva etiqueta.
  (5) Ejecutar las pruebas del backend (`npm test`) y el typecheck (`npm run typecheck`).

---

## Tarea Anterior (completada)

- **Identificador**: TSK-104
- **Nombre**: Corrección visual de recorte en panel de configuración de Codia (CU23 Fase 3)
- **Fecha de Inicio**: 2026-11-09
- **Estado**: Completada
- **Objetivo**: En `frontend/`:
  (1) Diagnosticar la causa del recorte del ~10% del desplegable de configuración de Codia.
  (2) Implementar posicionamiento robusto en `TeamRoomSettingsSelector.tsx` utilizando React Portal (`createPortal`) y coordenadas fijas calculadas respecto al botón y los límites del panel de chat/viewport (con margen de seguridad de 8 px, max-height y scroll interno).
  (3) Recalcular posición al abrir y ante eventos de `resize`/`scroll`.
  (4) Preservar cierre al hacer clic fuera (manejando nodo del portal y contenedor disparador) y con Escape.
  (5) Ajustar `TeamChat.scss` para soportar el dropdown en portal y modo oscuro.
  (6) Actualizar o agregar pruebas en `TeamRoomSettingsSelector.test.tsx` y verificar `tsc --noEmit`, `vitest` y `build`.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-103
- **Nombre**: Implementación de CU23 Fase 3 (Frontend: Selector de Configuración de Codia por sala)
- **Fecha de Inicio**: 2026-11-09
- **Estado**: Completada
- **Objetivo**: En `frontend/`:
  (1) Crear `frontend/src/teamChat/TeamRoomSettingsSelector.tsx` con botón de engranaje (tooltip "Codia") y panel con opciones de Modo ("Aplica los cambios" / "Solo asesora") y Estilo ("Directa" / "Mentora" / "Detallada").
  (2) Integrar en `TeamChatPanel.tsx` dentro de `.team-chat-header-sub` junto a `TeamModelSelector`.
  (3) Agregar estilos en `TeamChat.scss` respetando tipografías, colores, bordes y modo oscuro.
  (4) Crear pruebas unitarias con vitest en `frontend/src/teamChat/TeamRoomSettingsSelector.test.tsx`.
  (5) Validar con `tsc --noEmit`, `vitest` y `build`.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-102
- **Nombre**: Implementación de CU23 Fase 2B (Integración de configuración en aiChatService y diagramReviewService)
- **Fecha de Inicio**: 2026-11-09
- **Estado**: Completada
- **Objetivo**: En `backend/`:
  (1) En `aiChatService.ts`, inyectar y llamar `getRoomSettings(diagramId)` al inicio de `executeTask`.
  (2) En consulta de CU19, aplicar `buildSystemPrompt(TEAM_AI_SYSTEM_PROMPT, style)`.
  (3) En revisión de CU21, propagar `style` a `diagramReviewService.ts` y aplicar `buildSystemPrompt(REVIEW_SYSTEM_PROMPT, style)`.
  (4) En modificación de CU20, si el modo es `"advise"` y el estado es `"ready"`, omitir `onOperations` y responder con mensaje determinista de propuesta: `"Propongo: <summarizeOperations>. Para que lo aplique, pon mi modo en «Aplica los cambios» y repite el pedido, o hazlo manualmente."` sin operaciones.
  (5) Analizar compatibilidad de tokens en estilo `"detallada"` con proveedores y cobertura de `checkTruncatedResponse`.
  (6) Crear suite de pruebas exhaustivas en `backend/src/chat/aiChatServiceCu23.test.ts` y agregar a `npm test`.
  (7) Validar con `typecheck` y suite completa de pruebas.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-101
- **Nombre**: Implementación de CU23 Fase 2A (Socket: chat-join con settings y evento ai-settings-update)
- **Fecha de Inicio**: 2026-11-09
- **Estado**: Completada
- **Objetivo**: En `backend/`:
  (1) En `backend/src/socket.ts`, en el ack de `chat-join`, agregar `settings: await getRoomSettings(diagramId)`.
  (2) Implementar evento `ai-settings-update` con `{ diagramId, mode, style }` y acknowledgement (`{ ok: true, settings }` o `{ ok: false, error }` con errores `not_joined`, `invalid_session`, `invalid_value`, `storage_error`), validación de sesión/sala, resolución de autor desde servidor, no-op si no hay cambios, persistencia con `saveRoomSettings`, emisión de mensaje de sistema a la sala con `formatSettingsAnnouncement`, y difusión de `ai-settings-changed`.
  (3) Crear pruebas en `backend/src/chat/socketRoomSettingsEvents.test.ts` y agregarlas a `npm test`.
  (4) Crear `backend/src/scripts/cu23-socket-smoke.ts` y script `"smoke:cu23"` en `package.json`.
  (5) Validar con `typecheck` y `npm test`.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-100
- **Nombre**: Implementación de CU23 Fase 1 (Repositorio de configuración de sala y fragmentos de estilo)
- **Fecha de Inicio**: 2026-11-09
- **Estado**: Completada
- **Objetivo**: En `backend/`:
  (1) Crear `backend/src/chat/roomSettingsRepository.ts` con colección `ai_room_settings`, tipos `RoomMode` ("apply" | "advise") y `RoomStyle` ("directa" | "mentora" | "detallada"), validadores `isValidMode` e `isValidStyle`, defaults `{ mode: "apply", style: "mentora" }`, `getRoomSettings` tolerante a fallos, y `saveRoomSettings` con validación cerrada y upsert.
  (2) Crear `backend/src/chat/styleFragments.ts` con `buildSystemPrompt(basePrompt, style)` devolviendo fragmentos según estilo (mentora = base idéntico).
  (3) Crear `backend/src/chat/roomSettings.test.ts` con pruebas completas de defaults, validación, upsert idempotente, tolerancia a caída de Mongo y estilos.
  (4) Agregar la suite al script `test` de `backend/package.json`.
  (5) Validar con `typecheck` y `npm test`.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-099
- **Nombre**: Ajuste del prompt de revisión y contenido de usuario (CU21)
- **Fecha de Inicio**: 2026-11-09
- **Estado**: Completada
- **Objetivo**: En `backend/src/chat/diagramReviewService.ts`:
  (1) Actualizar `REVIEW_SYSTEM_PROMPT` para eliminar mención a ideas/dominio, exigir ceñirse exclusivamente a las observaciones entregadas, prohibir tipos de datos o convenciones inventadas, exigir redacción en párrafos cortos sin copiar etiquetas de entrada ni listas numeradas, priorizar importantes y agrupar si son > 4, copiar frases `@Codia` literales o explicar con palabras de la observación, límite 150 palabras, sin saludo/presentación/markdown y cierre con pregunta corta sin instrucción copiable literal.
  (2) En `userContent`, anteponer la línea `"Hay exactamente N observaciones."` antes de la lista de observaciones.
  (3) Si aplica, actualizar pruebas en `diagramReviewService.test.ts`.
  (4) Validar con `typecheck` y `npm test`.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-098
- **Nombre**: Implementación de CU21 Fase 2C (Alineación de tokens, pruebas y smoke test)
- **Fecha de Inicio**: 2026-11-08
- **Estado**: Completada
- **Objetivo**: En `backend/`:
  (1) En `diagramReviewService.ts`, alinear la llamada a `chat` con la rama de consulta de CU19 (no pasar `maxTokens` fijo para que los proveedores apliquen sus propios límites por defecto).
  (2) Crear `backend/src/chat/diagramReviewService.test.ts` con pruebas completas para modelo vacío, sin observaciones, con observaciones, fallo/vacío de IA y límite de 2000 caracteres.
  (3) Crear `backend/src/chat/aiChatServiceCu21.test.ts` con pruebas de enrutamiento de `answerInRoom` (review, query, modification con/sin onOperations, no mutación en review).
  (4) Agregar las dos suites a `test` en `package.json`.
  (5) Crear `backend/src/scripts/cu21-socket-smoke.ts` y su script en `package.json` siguiendo el patrón de CU20.
  (6) Validar con `typecheck` y `npm test`.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-097
- **Nombre**: Corrección y completitud de CU21 Fase 2B (Revisión de Diagrama en Chat)
- **Fecha de Inicio**: 2026-11-08
- **Estado**: Completada
- **Objetivo**: En `backend/`:
  (1) En `diagramReviewService.ts`, tipar la dependencia por defecto de chat para devolver `string` extrayendo `.text` de `chatWithFallback`.
  (2) En `modificationHelpers.ts`, remover la regla `/\bcomo\s+(?:lo\s+)?ves\b/` de review para que `"¿Cómo ves el modelo?"` vuelva a ser query, restableciendo la prueba 4 de `aiChatService.test.ts`. Ajustar pruebas de Fase 1C si alguna dependía de esa frase.
  (3) Propagar `findings` desde `reviewDiagramInRoom` hasta `saveMessage` en Mongo a través de `aiChatService.ts` y `socket.ts`, persistiendo en `chatRepository.ts` sin difundir a los clientes.
  (4) Verificar typecheck y la suite completa de pruebas.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-096
- **Nombre**: Ampliación de classifyIntent con intención "review" (CU21 Fase 1C)
- **Fecha de Inicio**: 2026-11-08
- **Estado**: Completada
- **Objetivo**: En `backend/`:
  (1) En `backend/src/chat/modificationHelpers.ts`, ampliar el tipo de retorno de `classifyIntent(text: string): "query" | "modification" | "review"`.
  (2) Implementar las reglas de clasificación para `"review"`:
      - Verbos de revisión (`revisa`, `evalua`, `valida`, `analiza`, `audita`, `verifica`, `chequea`, etc.) junto a objetos de revisión (`diagrama`, `modelo`, `clases`, `relaciones`, `esquema`, `diseno`).
      - Frases clave como `"que le falta"`, `"que mejorarias"`, `"sugerencias"`, `"mejoras"`, `"esta bien"`, `"tiene errores"`, `"feedback"`.
      - Verbos de mejora general aplicados al diagrama o modelo (`"mejora el diagrama"`, `"optimiza el modelo"`).
      - Respetar prioridades estrictas: pedidos concretos de modificación sobre clases/atributos (`"agrega..."`, `"crea..."`, `"mejora la clase X..."`) siguen siendo `"modification"`.
      - Interrogativos de explicación conceptual (`"qué es una clave primaria"`, `"explícame..."`) siguen siendo `"query"`.
  (3) Si algún llamador falla en typecheck por el nuevo tipo, aplicar el cambio mínimo sin alterar el comportamiento de `aiChatService.ts`.
  (4) En `backend/src/chat/modificationHelpers.test.ts`, mantener 100% de las pruebas existentes intactas y agregar pruebas nuevas para `"review"`, casos no-review y frases límite.
  (5) Validar con `npm test` y `npm run typecheck`.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-095
- **Nombre**: Implementación de formateadores de revisión para prompt y fallback (CU21 Fase 1B)
- **Fecha de Inicio**: 2026-11-08
- **Estado**: Completada
- **Objetivo**: En `backend/`:
  (1) En `backend/src/chat/diagramReview.ts`, agregar y exportar las funciones puras:
      - `formatFindingsForPrompt(findings: Finding[]): string`
      - `formatFindingsFallback(findings: Finding[], askerName: string): string` (respetando tope de 2000 caracteres del chat)
      - `formatNoFindingsMessage(askerName: string): string`
      - `formatEmptyDiagramMessage(askerName: string): string`
      Todas en texto plano sin markdown.
  (2) En `backend/src/chat/diagramReview.test.ts`, agregar pruebas unitarias exhaustivas con `node:test` y `node:assert/strict` para cada función, caso con y sin nombre, validación de ausencia de markdown (asteriscos, almohadillas, comillas invertidas, guiones de lista) y verificación del largo máximo en el peor caso.
  (3) No modificar ningún otro archivo.
  (4) Validar con `npm test` y `npm run typecheck`.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-094
- **Nombre**: Implementación de reviewModel y reglas de revisión de diagramas (CU21 Fase 1A)
- **Fecha de Inicio**: 2026-11-08
- **Estado**: Completada
- **Objetivo**: En `backend/`:
  (1) Crear `backend/src/chat/diagramReview.ts` con la función pura `reviewModel(model: UmlModel): Finding[]`, tipado estricto con los tipos reales de `backendGenerator/types.ts` y las 10 reglas R1 a R10 (máximo 6 Finding, ordenadas por severidad `"importante"` antes que `"recomendado"`, sin sugerir quitar/renombrar atributos, sin markdown en `message` ni `fix`).
  (2) Crear `backend/src/chat/diagramReview.test.ts` con suite completa usando `node:test` y `node:assert/strict`, cubriendo casos positivos y negativos por cada regla, clase hija que no dispara R1 ni R2, diagrama sano que devuelve `[]`, límite de 6 y orden por severidad.
  (3) No modificar ningún archivo existente de código ni configuración de sincronización/rutas.
  (4) Validar con `npm test` y `npm run typecheck`.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-093
- **Nombre**: Ajuste de classifyIntent en CU20 para verbos de modificación no iniciales
- **Fecha de Inicio**: 2026-11-08
- **Estado**: Completada
- **Objetivo**: En `backend/`:
  (1) En `modificationHelpers.ts`, implementar regla intermedia en `classifyIntent` (antes de la regla por defecto y después de las reglas 1, 1b y 2): si el texto original NO contiene signos `?` ni `¿`, NO contiene en ninguna posición una palabra interrogativa o de explicación (`como`, `que`, `por que`, `cual`, `cuales`, `cuando`, `donde`, `para que`, `explica`, `explicame`, `dime`, `diferencia`, `diferencias`), y contiene como palabra completa entre las primeras 8 palabras un verbo de modificación de la lista de la regla 2 (`agrega`, `agregale`, `anade`, `crea`, `creame`, `elimina`, `borra`, `quita`, `cambia`, `modifica`, `renombra`, `edita`, `actualiza`, `pon`, `relaciona`, `conecta`, `convierte`, `haz`), clasificar como `"modification"`.
  (2) En `modificationHelpers.test.ts`, agregar al menos 15 casos de prueba nuevos cubriendo las frases indicadas y manteniendo en verde todos los casos existentes.
  (3) Validar que la detección de pedidos no soportados (`detectUnsupportedAttributeRequest`) siga operando idénticamente para estas frases.
  (4) Validar con `npm test` y `npm run typecheck`.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-092
- **Nombre**: Conversión preventiva createClass->updateClass en editWithFallback (UC7/UC8/CU20) y diagnóstico de intención
- **Fecha de Inicio**: 2026-11-08
- **Estado**: Completada
- **Objetivo**: En `backend/`:
  (1) TAREA A: Mover `convertExistingCreateToUpdate` y `normalizeClassName` a un módulo neutro en `backend/src/ai/providers/operationNormalizer.ts` (reexportado también desde `backend/src/providers/operationNormalizer.ts`), reexportándolos desde `modificationHelpers.ts` para backward compatibility.
  (2) Integrar la conversión en `editWithFallback` de `providerManager.ts` sobre `result.operations` antes de devolver `FallbackResult`, usando `currentModel.classes` para saber qué clases existen en el diagrama. Mantener forma de `FallbackResult` y no tocar proveedores individuales.
  (3) Verificar que `ai-edit` (UC7) y la entrada de voz (UC8) usan `editWithFallback` quedando protegidos de clases duplicadas, y que UC9 no pasa por `editWithFallback`.
  (4) Suite de pruebas para `editWithFallback` con proveedores simulados (local, groq, gemini, fallback activo, createClass a updateClass, createClass nueva intacta, deleteClass previo respetado).
  (5) TAREA B: Diagnóstico de la frase del usuario, reglas de `classifyIntent`, comportamiento ante `noChanges`, causa de clasificación como `query` y propuesta de cambio con casos de prueba sin aplicarla.
  (6) Validación estricta con `npm test` y `npm run typecheck`.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-091
- **Nombre**: Correcciones de CU20 por fallos del modelo local: conversión preventiva createClass->updateClass y tratamiento de noChanges
- **Fecha de Inicio**: 2026-11-07
- **Estado**: Completada
- **Objetivo**: En `backend/`:
  (1) En `diagramAiEditService.ts` / `modificationHelpers.ts`: convertir `createClass` en `updateClass` antes de validar cuando `className` coincida (insensible a mayúsculas, tildes y espacios) con una clase existente en el diagrama, conservando atributos y métodos y usando el nombre real de la clase en el diagrama. Excepción: si hubo un `deleteClass` previo de esa misma clase en el lote, mantener como `createClass`.
  (2) En `aiChatService.ts`: en la rama `noChanges` de modificación, si el texto del usuario NO contiene signos de interrogación (`?` o `¿`), responder directamente con mensaje natural en primera persona pidiendo reformular o especificar el nombre de clase/atributo, sin invocar `chatReply` ni consumir cuota de chat. Si contiene `?` o `¿`, mantener fallback a `chatReply`.
  (3) Pruebas en `modificationHelpers.test.ts`, `diagramAiEditService.test.ts` y `aiChatServiceCu20.test.ts`.
  (4) Validación con `npm test` y `npm run typecheck`.

---

## Tarea Anterior (completada)

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
