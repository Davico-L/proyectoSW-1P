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
- **Integración con Backend en Canvas**: Botones integrados en la barra de herramientas y menú principal para "Generar Backend", "Exportar a XMI", "Importar desde XMI", "Mis diagramas" y cierre de sesión.
- **Desactivación de Sincronización LocalStorage Inconsistente**: Cumplimiento del ADR 006 para evitar pérdida de datos al cambiar de pestaña.

---

## 2. Parcial (Implementado con Alcance o Limitaciones Específicas)

- **Selección de Proveedor de IA**: Se implementaron dos proveedores (Groq y Gemini), pero la alternancia se realiza estáticamente vía variable de entorno `AI_PROVIDER` en el backend; no existe fallback dinámico en tiempo de ejecución si el proveedor activo agota su cuota.
- **Módulo Móvil (`mobile-template`)**: El proyecto Flutter compila y contiene los plugins nativos `sqflite` y `speech_to_text` verificados en `pubspec.yaml`, pero solo dispone de una pantalla estática informativa (`SampleHomeScreen`) sin comunicación con la API backend ni representación de diagramas.

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
