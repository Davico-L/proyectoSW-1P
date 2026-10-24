# Contexto del Proyecto: ClassDrawSW

Este documento resume el contexto arquitectónico, técnico y funcional verificado en el repositorio `ClassDrawSW` (`D:\proyectoSW-1P`). Toda la información proviene exclusivamente de la inspección directa del código fuente, configuraciones y documentación existente.

---

## 1. Propósito General del Sistema

**ClassDrawSW** es una plataforma colaborativa para el modelado y edición de diagramas de clases UML asistida por Inteligencia Artificial y persistencia centralizada. Permite diseñar diagramas UML sobre un lienzo interactivo basado en Excalidraw, sincronizar cambios en tiempo real entre colaboradores, interpretar instrucciones en lenguaje natural (texto y voz) para manipular el modelo UML mediante IA, exportar e importar archivos XMI 2.1 (compatibles con herramientas CASE como Enterprise Architect), y generar automáticamente proyectos backend en Java con Spring Boot listos para producción junto a su colección de Postman.

---

## 2. Arquitectura Global y Componentes

El repositorio se organiza en tres subsistemas principales y un módulo de documentación:

```text
D:\proyectoSW-1P\
├── backend/          # API REST y WebSocket en Node.js, Express y TypeScript
├── frontend/         # Cliente Web SPA basado en Excalidraw, React y Vite
├── mobile-template/  # Plantilla cliente móvil en Flutter (Dart)
├── docs/             # Registro formal de decisiones de arquitectura (ADRs 001 - 006)
└── coordinacion-ia/  # Sistema de coordinación documental y control de IA
```

### 2.1. Backend (`/backend`)
- **Runtime y Lenguaje**: Node.js, TypeScript 5.7.3, ejecución en desarrollo con `tsx` 4.19.3.
- **Framework Web**: Express 4.21.2.
- **Comunicación en Tiempo Real**: Socket.io 4.8.3 montado sobre servidor HTTP nativo.
- **Persistencia**: PostgreSQL mediante driver `pg` 8.13.3 (soporta Neon, Supabase y Postgres local con SSL configurable).
- **Integraciones de IA**:
  - Proveedor principal/alternativo configurable vía variable de entorno `AI_PROVIDER` (`groq` o `gemini`).
  - Groq API vía llamada HTTP directa con JSON Schema estructurado (`openai/gpt-oss-20b`).
  - Google Gemini vía SDK oficial `@google/genai` 2.24.0 (`gemini-3.6-flash`).
- **Generador de Backend**: Módulo interno (`src/backendGenerator/`) que compila el modelo UML a código Java Spring Boot con JPA, repositorios, controladores REST y colección Postman v2.1 empaquetados en un archivo `.zip` usando `archiver` 7.0.1.
- **Exportador XMI**: Módulo interno (`src/xmiExporter/`) que serializa clases y relaciones a especificación XML/XMI 2.1.

### 2.2. Frontend (`/frontend`)
- **Arquitectura**: Monorepo estructurado con Yarn workspaces (`packages/` y `excalidraw-app/`), basado en un fork adaptado de Excalidraw.
- **Framework y Herramientas**: React 18, TypeScript, Vite para empaquetado y servidor de desarrollo (puerto por defecto 3001).
- **Extensiones Personalizadas**:
  - `src/uml/`: Creación y actualización de elementos visuales de clases UML y relaciones (asociación, herencia, composición, agregación, muchos a muchos) con modales interactivos (`UmlClassModal.tsx`, `UmlRelationModal.tsx`).
  - `src/aiEdit/`: Panel de chat interactivo (`AiChatPanel.tsx`) y botón flotante para enviar instrucciones en lenguaje natural al backend (`POST /diagrams/:id/ai-edit`) y aplicar las operaciones resultantes al lienzo de manera declarativa (`applyAiOperations.ts`).
  - `src/aiEdit/useSpeechRecognition.ts`: Soporte de reconocimiento de voz por Web Speech API del navegador para dictado de órdenes.
  - `src/xmiImporter/`: Parser de archivos XMI 2.1 (`parseXmi.ts`), cálculo de distribución en grilla (`gridLayout.ts`) e importación directa de clases y relaciones al lienzo Excalidraw (`importXmiToCanvas.ts`).
  - `excalidraw-app/data/backendSync.ts`: Capa de persistencia HTTP conectada con el backend en el puerto 4000.
  - `excalidraw-app/data/realtimeSync.ts`: Sincronización en tiempo real vía Socket.io para colaboración en salas por `diagramId`.

### 2.3. Mobile Template (`/mobile-template`)
- **Framework**: Flutter 3 / Dart.
- **Plataformas Soportadas**: Android (configurada compilación `assembleDebug`), iOS, Web, Desktop.
- **Dependencias Base Instaladas**:
  - `sqflite`: Base de datos SQLite local embebida.
  - `speech_to_text`: Reconocimiento nativo de voz a texto.
- **Estado**: Plantilla inicial con pantalla de presentación informativa; no cuenta con lógica de negocio ni llamadas de red al backend implementadas aún.

### 2.4. Base de Datos (PostgreSQL)
- **Tablas Principales**:
  - `sessions`: `id` (UUID, PK), `username` (VARCHAR(255)), `password_hash` (TEXT, bcryptjs), `created_at` (TIMESTAMP). Índice único `idx_sessions_username_lower` sobre `lower(username)` para garantizar nombres únicos case-insensitive. Script de deduplicación previo `src/db/deduplicateSessions.ts`.
  - `diagrams`: `id` (UUID, PK), `session_id` (UUID, FK a `sessions`), `name` (VARCHAR(255)), `data` (JSONB con `elements`, `appState`, `files`), `created_at`, `updated_at`.
- **Migraciones**: Script automatizado `src/db/migrate.ts` que ejecuta `src/db/init.sql` al arranque o por comando manual `npm run migrate`.

---

## 3. Catálogo de Endpoints Verificados (Backend API)

| Método | Endpoint | Descripción | Componente Responsable |
|---|---|---|---|
| `GET` | `/health` | Sondeo activo `SELECT 1` a PostgreSQL | `healthRoutes.ts` |
| `POST` | `/auth/register` | Registro de nuevo usuario con contraseña (devuelve `session_id` y `username`) | `authRoutes.ts` / `authService.ts` |
| `POST` | `/auth/login` | Inicio de sesión con contraseña o reclamo de cuenta previa (devuelve `session_id` y `username`) | `authRoutes.ts` / `authService.ts` |
| `POST` | `/session` | Deprecado (responde 410 Gone indicando usar `/auth`) | `sessionRoutes.ts` |
| `GET` | `/session/:id` | Consulta y validación de existencia de sesión | `sessionRoutes.ts` |
| `POST` | `/diagrams` | Creación y guardado de un nuevo diagrama | `diagramRoutes.ts` |
| `GET` | `/diagrams?session_id=UUID` | Listado de diagramas por sesión | `diagramRoutes.ts` |
| `GET` | `/diagrams/:id` | Recuperación de un diagrama por ID | `diagramRoutes.ts` |
| `PUT` | `/diagrams/:id` | Actualización de datos (`JSONB`) y nombre | `diagramRoutes.ts` |
| `POST` | `/diagrams/:id/generate-backend` | Extracción UML y descarga de ZIP Spring Boot | `diagramRoutes.ts` / `backendGenerator` |
| `POST` | `/diagrams/:id/export-xmi` | Extracción UML y descarga de archivo XMI 2.1 | `diagramRoutes.ts` / `xmiExporter` |
| `POST` | `/diagrams/:id/ai-edit` | Edición de diagrama por lenguaje natural (Groq/Gemini) | `diagramRoutes.ts` / `gemini.ts` / `groq.ts` |
| `WS` | Socket.io (`/socket.io`) | Eventos `join-diagram`, `leave-diagram`, `diagram-update`, `diagram-state` | `socket.ts` |

---

## 4. Fuentes de Verificación Consultadas

1. `README.md` (raíz del repositorio).
2. `docs/decisiones.md` (ADR 001 a ADR 006).
3. `backend/package.json` y `backend/tsconfig.json`.
4. `backend/src/app.ts`, `backend/src/index.ts`, `backend/src/socket.ts`.
5. `backend/src/db/init.sql` y `backend/src/db/migrate.ts`.
6. `backend/src/routes/diagramRoutes.ts`, `sessionRoutes.ts`, `healthRoutes.ts`.
7. `backend/src/services/gemini.ts`, `groq.ts`, `operationValidator.ts`.
8. `backend/src/backendGenerator/*` (`extractModel.ts`, `buildZip.ts`, `types.ts`, etc.).
9. `backend/src/xmiExporter/*` (`generateXmi.ts`, `generateXmiRelations.ts`, etc.).
10. `frontend/package.json`, `frontend/CLAUDE.md`, `frontend/AGENTS.md`.
11. `frontend/excalidraw-app/App.tsx`, `components/AppMainMenu.tsx`, `data/backendSync.ts`, `data/realtimeSync.ts`.
12. `frontend/src/uml/*` (`types.ts`, modales y factories de elementos).
13. `frontend/src/aiEdit/*` (`AiChatPanel.tsx`, `useAiChat.ts`, `applyAiOperations.ts`, `useSpeechRecognition.ts`).
14. `frontend/src/xmiImporter/*` (`parseXmi.ts`, `gridLayout.ts`, `importXmiToCanvas.ts`).
15. `mobile-template/pubspec.yaml`, `mobile-template/README.md`, `mobile-template/lib/main.dart`.
16. Historial de commits en `.git/logs/HEAD`.
