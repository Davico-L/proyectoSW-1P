# Estado Actual del Sistema: ClassDrawSW

Este documento clasifica el estado de avance de las funcionalidades, subsistemas y componentes de **ClassDrawSW** a la fecha, basándose rigurosamente en la inspección del código fuente y configuraciones en `D:\proyectoSW-1P`.

---

## 1. Implementado (Completado y Verificado en Código)

### Backend
- **Infraestructura de Servidor**: Servidor HTTP en Express con TypeScript, CORS configurado para `http://localhost:3001` y `http://localhost:3000`, y middleware JSON con límite expandido (50 MB).
- **Endpoint de Salud**: `GET /health` que realiza un sondeo activo `SELECT 1` a PostgreSQL sin tumbar el proceso si la BD no está disponible.
- **Gestión Ligera de Sesiones**: `POST /session` que genera UUID v4 a partir de un `{ username }` y `GET /session/:id` para validar la sesión existente.
- **Persistencia de Diagramas**: `POST /diagrams`, `GET /diagrams` (filtrable por `session_id`), `GET /diagrams/:id` y `PUT /diagrams/:id` contra PostgreSQL en formato `JSONB`.
- **Migraciones de Base de Datos**: Scripts `src/db/init.sql` y `src/db/migrate.ts` para creación de tablas `sessions` y `diagrams` e índices `idx_diagrams_session_id` y `idx_diagrams_updated_at`.
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
- **Editor UML Integrado**: Modales y utilidades visuales en React (`src/uml/`) para clases UML con visibilidades (`+`, `-`, `#`), atributos tipados, métodos y tipos de relaciones UML.
- **Importador XMI 2.1 (CU11)**: Parser XML en cliente (`parseXmi.ts`), algoritmo de cálculo de layout en cuadrícula (`gridLayout.ts`) y volcado de clases y asociaciones al lienzo de Excalidraw (`importXmiToCanvas.ts`).
- **Panel de Chat de IA y Dictado por Voz (CU7 / CU8)**:
  - Componente de interfaz flotante `AiChatPanel.tsx` y botón `AiChatButton.tsx`.
  - Hook de gestión de mensajes `useAiChat.ts`.
  - Reconocimiento de voz mediante Web Speech API del navegador en `useSpeechRecognition.ts`.
  - Aplicador transaccional de operaciones sobre el lienzo de Excalidraw (`applyAiOperations.ts`) con actualización de enlaces y flechas.
- **Integración con Backend en Canvas**: Botones integrados en la barra de herramientas y menú principal para "Generar Backend", "Exportar a XMI", "Importar desde XMI" y cierre de sesión.
- **Desactivación de Sincronización LocalStorage Inconsistente**: Cumplimiento del ADR 006 para evitar pérdida de datos al cambiar de pestaña.

---

## 2. Parcial (Implementado con Alcance o Limitaciones Específicas)

- **Selección de Proveedor de IA**: Se implementaron dos proveedores (Groq y Gemini), pero la alternancia se realiza estáticamente vía variable de entorno `AI_PROVIDER` en el backend; no existe fallback dinámico en tiempo de ejecución si el proveedor activo agota su cuota.
- **Módulo Móvil (`mobile-template`)**: El proyecto Flutter compila y contiene los plugins nativos `sqflite` y `speech_to_text` verificados en `pubspec.yaml`, pero solo dispone de una pantalla estática informativa (`SampleHomeScreen`) sin comunicación con la API backend ni representación de diagramas.
- **Sistema de Autenticación de Usuarios**: Existe un flujo de inicio de sesión ligero (`POST /session`) que asigna un `session_id`, pero no implementa contraseñas, hashing, tokens JWT ni políticas de seguridad multiusuario (según ADR 003).

---

## 3. Pendiente (No Implementado o Planificado a Futuro)

- **Funcionalidad Completa de la Aplicación Móvil**: Conexión de la app Flutter al backend REST y WebSocket, visualización o edición de diagramas UML en pantalla táctil y envío de comandos de voz nativos.
- **Autenticación y Seguridad Robusta**: Sistema de cuentas de usuario con contraseñas seguras, autenticación basada en JWT y control de acceso basado en roles o propiedad de diagramas.
- **Control de Versiones y Deshacer Global**: Historial de versiones persistente en base de datos para recuperar estados previos del diagrama (actualmente la persistencia actualiza la fila existente en Postgres).
- **Tipos UML Avanzados**: Soporte en lienzo y en el generador de backend para interfaces (`<<interface>>`), clases abstractas, paquetes y enumeraciones.
- **Documentación de Especificación de Requisitos Formales**: Especificaciones completas de casos de uso (CU1 a CU11) en formato documental dentro de la carpeta `docs/`.

---

## 4. Desconocido (No Verificable en el Repositorio Local)

- **Entorno de Despliegue en la Nube**: No es posible determinar si existen instancias activas en producción (ej. servidores en Vercel, Render o instancias de PostgreSQL en Supabase/Neon).
- **Estado de Cuotas de APIs de IA**: Las claves y límites de crédito vigentes de Groq y Google Gemini no son verificables desde el código local.
- **Backlog y Planificación del Siguiente Hito**: No se dispone de backlog externo ni fechas límite de entrega específicas fuera de las notas históricas de commits y ADRs.
