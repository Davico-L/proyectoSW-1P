# Estado Actual del Sistema: ClassDrawSW

Este documento clasifica el estado de avance de las funcionalidades, subsistemas y componentes de **ClassDrawSW** a la fecha, basándose rigurosamente en la inspección del código fuente y configuraciones en `D:\proyectoSW-1P`.

---

## 1. Implementado (Completado y Verificado en Código)

### Backend
- **Infraestructura de Servidor**: Servidor HTTP en Express con TypeScript, CORS configurado para `http://localhost:3001` y `http://localhost:3000`, y middleware JSON con límite expandido (50 MB).
- **Endpoint de Salud**: `GET /health` que realiza un sondeo activo `SELECT 1` a PostgreSQL sin tumbar el proceso si la BD no está disponible.
- **Autenticación y Cuentas de Usuario**:
  - La tabla `sessions` opera como cuenta de usuario con columna `password_hash` (hasheo seguro con `bcryptjs`, costo 10).
  - Unicidad de nombre de usuario insensible a mayúsculas/minúsculas garantizada por el índice único `idx_sessions_username_lower` sobre `lower(username)`.
  - Endpoints `POST /auth/register` y `POST /auth/login` (ambos retornan `{ session_id, username }`).
  - Reclamo transparente de cuentas legacy sin contraseña: si un usuario previo sin contraseña inicia sesión con una contraseña válida de al menos 6 caracteres, se le asigna el hash de forma atómica.
  - Endpoint legado `POST /session` deprecado (responde HTTP 410 Gone indicando usar `/auth`), conservando `GET /session/:id` para validación activa de sesión.
  - Script de mantenimiento `src/db/deduplicateSessions.ts` con modo simulación y `--apply` para sanear cuentas duplicadas y aplicar el índice único.
- **Persistencia de Diagramas**: `POST /diagrams`, `GET /diagrams` (filtrable por `session_id`), `GET /diagrams/:id` y `PUT /diagrams/:id` contra PostgreSQL en formato `JSONB`.
- **Migraciones de Base de Datos**: Scripts `src/db/init.sql` y `src/db/migrate.ts` para creación y evolución de tablas `sessions` y `diagrams` e índices `idx_diagrams_session_id`, `idx_diagrams_updated_at` e `idx_sessions_username_lower`.
- **Sincronización en Tiempo Real**: Servidor Socket.io (`src/socket.ts`) con soporte de salas por diagrama (`join-diagram`, `leave-diagram`), retransmisión de elementos en vivo (`diagram-update`) y emisión de estado inicial desde BD (`diagram-state`).
- **Generador de Backend Spring Boot (CU5)**:
  - Extractor de modelo UML desde JSON de Excalidraw (`extractModel.ts`).
  - Generador de entidades Java con anotaciones JPA (`generateEntity.ts`).
  - Generador de repositorios Spring Data JPA (`generateRepository.ts`).
  - Generador de controladores REST con endpoints CRUD estándar (`generateController.ts`).
  - Generador de archivos de configuración de proyecto (`pom.xml`, `application.properties`, clase principal `Application.java`).
  - Generador de colección Postman v2.1 (`generatePostmanCollection.ts`).
  - Empaquetador `.zip` descargable mediante endpoint `POST /diagrams/:id/generate-backend`.
- **Generador de Aplicación Móvil Flutter (CU13)**:
  - Módulo conversor de `UmlModel` a `esquema.json` (`converter.ts`) con tipado estricto (`texto`, `numero`, `otro`, `ref`) y soporte de relaciones `association`/`composition`/`aggregation` con referencias primero.
  - Empaquetador ZIP en memoria (`buildMobileZip.ts`) con exclusión de artefactos de compilación (`build`, `.dart_tool`, `android/build`, `.gradle`, `.idea`, `node_modules`) y pesos GGUF, con sustitución dinámica de `assets/esquema.json` y generación de `LEEME.txt`.
  - Endpoint `POST /diagrams/:id/generate-mobile` con la misma autenticación y manejo de errores que CU5.
- **Exportador XMI 2.1 (CU10)**: Módulo de serialización a estándar XMI 2.1 (`src/xmiExporter/`) con soporte de clases, tipos primitivos mapeados y relaciones, expuesto en `POST /diagrams/:id/export-xmi`.
- **Motor de Edición por IA (CU7 / UC7)**:
  - Endpoint `POST /diagrams/:id/ai-edit`.
  - Integración con Groq API (`openai/gpt-oss-20b`) con JSON Schema estricto y reintentos ante error 429.
  - Integración con Google Gemini (`gemini-3.6-flash`) con schema estructurado y detección de timeout/sobrecarga.
  - Validador y resolutor semántico de operaciones (`operationValidator.ts`) que empareja nombres de clase contra el modelo existente y emite advertencias.
  - Soporte de robustez fonética para órdenes dictadas por voz (UC8) mediante prefijo contextual de normalización de tipos.

### Frontend
- **Autenticación y Control de Sesión**:
  - Pantalla interactiva de acceso (`LoginScreen.tsx`) con modos de inicio de sesión y registro de cuenta, validación de contraseñas y mensajes de error accesibles (`aria-live`).
  - Manejo estricto de sesión inválida: si no hay sesión o el backend responde 404 en `GET /session/:id`, se borran las claves y se emite el evento `session-invalid` para redirigir al login, eliminando por completo cualquier fallback silencioso a "usuario_web".
- **Gestión de Diagramas ("Mis diagramas" / DiagramsScreen)**:
  - Pantalla intermedia `DiagramsScreen.tsx` tras el login que permite crear diagramas explícitamente (`createEmptyDiagram`) y listar/abrir los diagramas del usuario (`GET /diagrams?session_id=...`).
  - Botón e ítem "Mis diagramas" en el menú principal del lienzo (`AppMainMenu.tsx`): permite regresar a la lista de diagramas guardando previamente los cambios en el backend, haciendo flush y abandono de la sala colaborativa, reseteando la escena y limpiando cachés locales sin cerrar la sesión del usuario.
- **Cierre de Sesión Seguro y Limpieza de Lienzo**:
  - Función `handleLogout` en `App.tsx` que cancela en orden estricto los envíos de socket y guardados diferidos pendientes (`debouncedSaveDiagramToBackend`, `LocalData.cancelSave`, `resetBackendSyncState`), resetea la escena de Excalidraw (`excalidrawAPI.resetScene()`), purga el almacenamiento IndexedDB de archivos binarios (`files-db`) y limpia las claves de `localStorage` antes de enviar al login.
- **Colaboración en Tiempo Real con Reconciliación No Destructiva**:
  - En `applyRemoteChange`, las actualizaciones remotas (`diagram-update` y `diagram-state`) se fusionan utilizando `reconcileElements(excalidrawAPI.getSceneElementsIncludingDeleted(), remoteElements, excalidrawAPI.getAppState())` en lugar de sobrescribir ciegamente la escena, preservando elementos dibujados concurrentemente y propagando elementos eliminados.
- **Editor UML Integrado**: Modales y utilidades visuales en React (`src/uml/`) para clases UML con visibilidades (`+`, `-`, `#`), atributos tipados, métodos y tipos de relaciones UML.
- **Importador XMI 2.1 (CU11)**: Parser XML en cliente (`parseXmi.ts`), algoritmo de cálculo de layout en cuadrícula (`gridLayout.ts`) y volcado de clases y asociaciones al lienzo de Excalidraw (`importXmiToCanvas.ts`).
- **Panel de Chat de IA y Dictado por Voz (CU7 / CU8)**:
  - Componente de interfaz flotante `AiChatPanel.tsx` y botón `AiChatButton.tsx`.
  - Hook de gestión de mensajes `useAiChat.ts`.
  - Reconocimiento de voz mediante Web Speech API del navegador en `useSpeechRecognition.ts`.
  - Aplicador transaccional de operaciones sobre el lienzo de Excalidraw (`applyAiOperations.ts`) con actualización de enlaces y flechas.
- **Panel de Chat del Equipo en Tiempo Real (CU18, CU20, CU22 y CU23 completados/avanzados)**:
  - Backend: Conexión no bloqueante a MongoDB Atlas (`src/db/mongo.ts`), repositorio `chatRepository.ts` (`saveMessage`, `listMessages`, índice compuesto `{ diagramId: 1, createdAt: 1 }` y función `toPublicChatMessage`), eventos Socket.IO `chat-join`, `chat-message` y `proposal-decision` en `src/socket.ts` con validación de sesión y sala, y endpoint HTTP `GET /diagrams/:id/chat?limit=50` en `diagramRoutes.ts`.
  - Frontend: Panel interactivo `TeamChatPanel.tsx` y botón flotante `TeamChatButton.tsx` en `src/teamChat/` con SCSS dedicado (`TeamChat.scss`), ubicados junto a los controles de IA personal sin solapamientos. Hook singleton `useTeamChat.ts` con reintentos automáticos (5 reintentos cada 500ms ante `not_in_room`), deduplicación por id, carga de historial al conectar/reconectar/cambiar de diagrama, soporte de Enter / Shift+Enter, contador de caracteres (máx 2000), badge de mensajes no leídos, scroll inteligente, slot libre en cabecera para selector de modelo, y soporte para el ciclo de vida de propuestas de CU22 (`decideProposal`, escucha de `proposal-updated`, `busyByMessageId` y `errorByMessageId`). Renderizado reactivo de `ProposalCard` debajo del texto de Codia en `TeamChatPanel.tsx` con manejo de estados pendiente, aprobado, ocupado y errores. Verificado con 80 pruebas en Vitest frontend y 374 tests en backend.
- **Configuración de Codia por Sala (CU23 y CU22 Fases 1A y 3A)**:
  - Colección MongoDB `ai_room_settings` con índice único por `diagramId`.
  - Repositorio `roomSettingsRepository.ts` con soporte de tres modos (`"apply"`, `"advise"`, `"approval"`) y tres estilos (`"directa"`, `"mentora"`, `"detallada"`), con valores por defecto `{ mode: "apply", style: "mentora" }`, etiquetas descriptivas (`MODE_LABELS` con `"Pide aprobación"` para approval), generador de anuncios de sistema `formatSettingsAnnouncement`, y operaciones idempotentes de lectura (`getRoomSettings`) y escritura (`saveRoomSettings`).
  - Eventos de Socket.IO `chat-join` (entrega settings activas en el ack) y `ai-settings-update` (valida contra lista cerrada, persiste en Mongo, difunde mensaje de sistema y emite `ai-settings-changed` a la sala).
  - Componente de frontend `TeamRoomSettingsSelector.tsx` con soporte integral para el modo `"approval"` ("Pide aprobación" con descripción "Codia propone los cambios y el equipo los aprueba o rechaza"), actualización reactiva y validación tipada. Verificado con 11 pruebas unitarias en Vitest.
- **Modo "Approval" ("Pide aprobación") en Backend (CU22 - Fases 1A, 1B, 1C, 2A-1, 2A-2, 2B-1, 2B-2 y 2B-3 completadas)**:
  - Definición de tipos y utilidades puras en `proposalHelpers.ts` (`createProposal`, `toPublicProposal`, `buildProposalText`, estados `pending`, `applying`, `approved`, `rejected`, `expired`).
  - Métodos transaccionales en `chatRepository.ts` (`getMessageById`, `claimProposal` atómico con timeout de 60s, `settleProposal` y filtrado estricto en `toPublicChatMessage` que oculta `operations` y credenciales).
  - Integración en `aiChatService.ts`: en modo `approval` no se invoca `onOperations`, se genera la propuesta con `createProposal` y se retorna `{ kind: "proposal", proposal, operations }`.
  - Integración en `socket.ts`:
    - Flujo `chat-message`: guarda la propuesta y operaciones en Mongo y difunde el mensaje público a la sala sin emitir `ai-operations` al socket del autor.
    - Flujo `proposal-decision`: listener de Socket.IO con validación de sala/sesión, rechazo atómico (`claimProposal` + `settleProposal` como `rejected`), mensaje de sistema del autor que decidió, difusión de `proposal-updated` a la sala y respuesta de ack (concurrencia controlada con `already_decided`).
    - Rama `approve` completa: revalidación de operaciones contra el diagrama actual con `validateAndResolveOperations`; caducidad a `expired` con aviso de sistema si el diagrama cambió (`stale`); emisión dirigida con acuse `ai-operations` exclusivamente al socket del aprobador; liquidación a `approved` si se aplicó con éxito o reversión a `pending` ante timeout/fallo; y manejo de excepciones con intento de reversión a `pending`.
  - Script de humo `smoke:cu22` (`backend/src/scripts/cu22-socket-smoke.ts`): prueba de integración con 2 clientes Socket.IO (Ana y Luis) evaluando los 5 escenarios con Groq (cambio a modo approval, propuesta pendiente sin ops, rechazo, aprobación con emisión dirigida al aprobador, y doble aprobación concurrente con control estricto de ganador único).
  - Verificado con 374 pruebas automatizadas en backend (100% en verde) y 0 errores de tipo.

### Frontend
- **Tarjeta de Propuesta de Modificación de Codia (CU22 Fase 3B)**: Componente presentacional desacoplado `ProposalCard.tsx` y estilos en `ProposalCard.scss` con soporte de temas claro/oscuro y paleta atenuada. Renderiza título con etiqueta de estado, lista con viñetas del resumen, botones interactivos "Aprobar" (relleno) y "Rechazar" (borde) en estado pendiente con soporte de estados de carga (`busy="Procesando…"`) y sin conexión (`"Sin conexión"`), banners de decisión definitiva ("Aprobada por X", "Rechazada por X", "Caducada: repite el pedido a Codia") y líneas de aviso de error. Verificado con 9 pruebas unitarias en Vitest.
- **Gestión Multi-proveedor de IA y Respaldo Automático (CU24)**: Arquitectura desacoplada con tres adaptadores (`local`, `groq`, `gemini`), health check periódico/caché de 30s, endpoint de registro local `POST /ai/providers/local/register`, endpoints `GET /ai/providers` y `PUT /ai/providers/active` (soporta selección de modelos no disponibles con HTTP 200 y validación de sesión/identificador), cadena de respaldo circular sin duplicados en `providerManager.ts` (`[active, ...otros]`), manejo controlado HTTP 503 ante caída total y selector de modelo interactivo con disponibilidad y refresco forzado en la cabecera del chat del equipo (`TeamModelSelector.tsx`). Verificado con suite automatizada de 49 pruebas en backend.
- **Asistente de IA en el Chat del Equipo "Codia" con mención @ia y @codia (CU19 - Fases 1A, 1B, 2, 3A, 3B, Verificación, 4A, 4B y Ajustes Frontend/Backend)**:
  - Backend: Funciones puras de parsing y nombrado (`aiChatHelpers.ts`), serializador de contexto compacto de diagrama y conversación reciente (`chatContext.ts` con rotulación "Conversación reciente (solo contexto):", últimos 6 mensajes recortados a 250 caracteres y separación con línea en blanco antes de la pregunta final), método de texto libre `chatReply` aditivo en `ModelProvider` y `providerManager.ts` con respaldo automático y log conciso de una línea (`[AI-CHAT] proveedor, respaldo, latencia, motivo`), servicio `aiChatService.ts` con cola FIFO mono-ejecución en memoria (máximo 5 en espera, desborde controlado con `AiBusyError` y fallos con `AiUnavailableError`), enganche asíncrono no bloqueante en el evento Socket.IO `chat-message` con estados `ai-status` ("thinking"/"idle"), identidad y nombre propio "Codia", prevención de suplantación de identidad en `chat-join` ("IA (usuario)", "Codia (usuario)"), persistencia con `replyTo` y `addressedTo`, prompt del sistema especializado en UML (~120 palabras, solo texto plano, prohibición de cursiva, contexto conversacional no intrusivo y respuesta enfocada únicamente en la pregunta actual, ejemplos conceptuales genéricos sin forzar el diagrama, fidelidad al diagrama, honestidad ante dudas, asociaciones y multiplicidades sin FKs relacionales, notas de notación UML), minúscula contextual en `ensureAddressedByName` preservando siglas, desactivación de tokens de pensamiento en Gemini (`thinkingBudget: 0`) y política común de truncamiento `checkTruncatedResponse` (`TRUNCATED_RESPONSE`) ante corte por límite sin signos de cierre o <200 caracteres con fallback inmediato al siguiente proveedor. Verificado con 99 tests automatizados en `npm test` y 7 escenarios de integración Socket.IO en `testTeamChatAi.ts`. Sin modificaciones en `diagramRoutes.ts`, `ai-edit`, lienzo ni panel personal.
  - Frontend: Ampliación de tipos en `types.ts` con `role: "user" | "ai" | "system" | string`, `replyTo`, `addressedTo` y `AI_DISPLAY_NAME = "Codia"`. Renderizado visual diferenciado de mensajes de IA por rol estricto (`role === "ai"`), burbuja lavanda/violeta de alto contraste (`#f3e8ff` light / `#2e1065` dark) alineada a la izquierda, etiqueta "IA" (exclusiva de cabecera de mensajes), texto opcional "para {addressedTo}". Formateador ligero y puro `aiTextFormatter.tsx` para mensajes de Codia que soporta bloques de código cercados con ` ``` ` (`pre/code` con scroll horizontal y fondo dedicado en temas claro y oscuro), código en línea con `...` (`code`) y negrita puntual con `**...**` (`strong`), preservando saltos de línea y renderizando HTML y bloques incompletos como texto plano sin `dangerouslySetInnerHTML`. Función pura `formatMessageSegments` en `mentionHelper.ts` para resaltado seguro de menciones `@ia` y `@codia` en mensajes humanos, deduplicación y orden cronológico en historial, y auto-scroll inteligente. Escucha de evento `ai-status` con conteo de concurrencia por asker, timeout de seguridad de 180 s, reseteo en reconexión/cambio de diagrama, indicador accesible `aria-live="polite"` de "Codia está pensando…" (sin etiqueta "IA") con animación de puntos y lista de espera. Placeholder `"Escribe un mensaje o usa @Codia para consultarle"`, botón flotante de sugerencia de mención al escribir "@" mostrando exclusivamente `"@Codia"`, y cuadro de texto no bloqueante durante el procesamiento de la IA. Verificado con 29/29 pruebas en Vitest (18 en `mentionHelper.test.ts` y 11 en `aiTextFormatter.test.ts`), 0 errores en `tsc` y build exitoso de Vite.

---

## 2. Parcial (Implementado con Alcance o Limitaciones Específicas)

- **Módulo Móvil (`mobile-template`)**: El proyecto Flutter contiene los plugins nativos `sqflite`, `speech_to_text: ^7.4.0`, `path_provider: ^2.1.6`, `fcllama: ^0.0.3`, `http: ^1.2.2` y `connectivity_plus: ^6.0.5` con `largeHeap="true"`, `usesCleartextTraffic="true"`, y permisos `RECORD_AUDIO` e `INTERNET`. Dispone de pantallas de inicio (`SampleHomeScreen`), prueba de datos SQLite (`PruebaDatosScreen`), prueba de IA local (`PruebaIaScreen`) con selector sincronizado de prompt y esquema, prueba de voz técnica (`PruebaVozScreen`) y asistente de voz para usuario final (`PantallaVoz`) con sincronización HTTP contra backend Spring Boot. Incluye motor de persistencia relacional con esquema DDL dinámico y migración por firma (`lib/datos/repositorio.dart`), módulo de sincronización simple con backend generado (`lib/sync/`), servicio singleton de IA local (`lib/ia/servicio_ia.dart`), generador dinámico de prompts (`lib/ia/prompt_generado.dart`), validador fonético-semántico (`lib/ia/validador.dart`), formateador de lenguaje natural (`lib/ia/resumen.dart`), ejecutor de inferencia GGUF (`lib/ia/interprete.dart`) y servicio reactivo de reconocimiento de voz offline (`lib/voz/servicio_voz.dart`), verificado con 83 pruebas unitarias.

---

## 3. Pendiente (No Implementado o Planificado a Futuro)

- **Funcionalidad Completa de la Aplicación Móvil**: Conexión de la app Flutter al backend REST y WebSocket, visualización o edición de diagramas UML en pantalla táctil y envío de comandos de voz nativos.
- **Tokens de Sesión / JWT**: Si bien la autenticación con usuario y contraseña hasheada en PostgreSQL está completamente operativa sobre la tabla `sessions`, la autorización avanzada mediante tokens JWT o expiración temporal automática permanece como mejora futura.
- **Control de Versiones y Deshacer Global**: Historial de versiones persistente en base de datos para recuperar estados previos del diagrama (actualmente la persistencia actualiza la fila existente en Postgres).
- **Tipos UML Avanzados**: Soporte en lienzo y en el generador de backend para interfaces (`<<interface>>`), clases abstractas, paquetes y enumeraciones.
- **Documentación de Especificación de Requisitos Formales**: Especificaciones completas de casos de uso (CU1 a CU11) en formato documental dentro de la carpeta `docs/`.

---

## 4. Desconocido (No Verificable en el Repositorio Local)

- **Entorno de Despliegue en la Nube**: No es posible determinar si existen instancias activas en producción (ej. servidores en Vercel, Render o instancias de PostgreSQL en Supabase/Neon).
- **Estado de Cuotas de APIs de IA**: Las claves y límites de crédito vigentes de Groq y Google Gemini no son verificables desde el código local.
- **Backlog y Planificación del Siguiente Hito**: No se dispone de backlog externo ni fechas límite de entrega específicas fuera de las notas históricas de commits y ADRs.
