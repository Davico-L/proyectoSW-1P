# Registro de Decisiones de Arquitectura (ADR)

## ADR 001: Estructura del Backend con Node.js, Express y TypeScript

- **Estado**: Aceptado
- **Fecha**: 2026-09-08
- **Contexto**: Se requiere un backend modular y tipado para servir como API central del proyecto (comunicación con el frontend Excalidraw y mobile).
- **Decisión**:
  - Utilizar **Node.js** con **Express** y **TypeScript**.
  - Estructuración modular: `/src/routes` (controladores y rutas HTTP), `/src/services` (lógica de negocio y dominio) y `/src/db` (conexión y pools a base de datos).
  - Uso de `tsx` para ejecución y recarga en desarrollo sin sobrecoste de transpilación previa.
- **Consecuencias**: Mantiene un flujo de desarrollo rápido, fuertemente tipado y desacoplado entre capas.

## ADR 002: Conectividad a Base de Datos PostgreSQL (Neon / Supabase)

- **Estado**: Aceptado
- **Fecha**: 2026-09-08
- **Contexto**: Se necesita persistencia centralizada compatible con proveedores serverless / cloud como Neon y Supabase.
- **Decisión**:
  - Implementar pool de conexiones mediante la librería nativa `pg` (`pg.Pool`).
  - Configurar soporte SSL con `rejectUnauthorized: false` para conexiones a instancias administradas en la nube.
  - Exponer endpoint de salud `/health` con sondeo activo `SELECT 1` que no bloquea ni tumba el servidor si la base de datos se encuentra temporalmente inaccesible.
- **Consecuencias**: Alta compatibilidad tanto para desarrollo local como para despliegues serverless en Neon o Supabase.

## ADR 003: Gestión Ligera de Sesión (Sin Autenticación Completa)

- **Estado**: Aceptado
- **Fecha**: 2026-09-08
- **Contexto**: Para las fases iniciales del proyecto y pruebas de integración con el lienzo, no se requiere un sistema de login/contraseñas complejo.
- **Decisión**:
  - Implementar endpoint `POST /session` que acepta únicamente `{ username }` y genera un identificador de sesión único (`UUID v4`).
  - Almacenamiento en memoria extensible para tracking de actividad rápida.
- **Consecuencias**: Reduce la fricción de autenticación en etapas tempranas mientras sienta las bases para asociar diagramas a sesiones.

## ADR 004: Base Móvil con Flutter, SQLite (`sqflite`) y Reconocimiento de Voz (`speech_to_text`)

- **Estado**: Aceptado
- **Fecha**: 2026-09-08
- **Contexto**: Se requiere una base móvil multiplataforma preparada para persistencia offline y comandos/asistencia por voz en el dispositivo.
- **Decisión**:
  - Inicializar la plantilla móvil en **Flutter** (`mobile-template`).
  - Integrar las dependencias `sqflite` (persistencia local embebida) y `speech_to_text` (reconocimiento nativo de voz) a nivel de manifiesto (`pubspec.yaml`), validando su compatibilidad y compilación completa en Android (`assembleDebug`).
  - Proveer una pantalla única de presentación y estado sin implementar aún la lógica de negocio ni llamadas a IA.
- **Consecuencias**: El proyecto móvil queda verificado para despliegue y desarrollo sin dependencias rotas a nivel nativo.

## ADR 005: Persistencia de Diagramas Excalidraw en PostgreSQL con JSONB

- **Estado**: Aceptado
- **Fecha**: 2026-09-10
- **Contexto**: Se debe reemplazar el almacenamiento local (`localStorage`) del frontend de Excalidraw por persistencia centralizada en el backend, asociando los diagramas a las sesiones activas.
- **Decisión**:
  - Crear tabla `diagrams` en PostgreSQL con `id` (UUID), `session_id` (FK a `sessions(id)`), `name` (VARCHAR), `data` (JSONB), `created_at` y `updated_at`.
  - El campo `data` de tipo `JSONB` permite guardar la estructura nativa y dinámica de Excalidraw (`elements`, `appState`, `files`) sin pérdida de fidelidad ni sobrecoste de serialización.
  - Implementar script de migración SQL (`backend/src/db/init.sql` y `backend/src/db/migrate.ts`) ejecutable vía `npm run migrate` y de verificación automática al conectar la base de datos.
  - Exponer endpoints REST en `/src/routes/diagramRoutes.ts`: `POST /diagrams`, `GET /diagrams/:id` y `PUT /diagrams/:id`, validando la existencia del `session_id` sin requerir autenticación pesada.
  - Habilitar CORS explícito para el frontend (`http://localhost:3001`).
- **Consecuencias**: El frontend de Excalidraw puede guardar y recuperar diagramas completos mediante llamadas HTTP directas con soporte multiusuario ligero.



## ADR 006: Desactivación de sincronización nativa de Excalidraw entre pestañas

**Fecha:** 2026-09-10
**Contexto:** Fase Elaboración — Conexión 1 (Frontend ↔ Backend)

**Problema detectado:**
Al conectar la persistencia del frontend al backend propio (reemplazando 
localStorage), se descubrió un bug: al cambiar de aplicación/pestaña y 
volver al navegador, el diagrama dibujado se borraba y la herramienta 
activa cambiaba a "borrador".

**Causa raíz:**
Excalidraw trae de fábrica una función (`syncData()` en App.tsx) que 
sincroniza el lienzo entre pestañas del mismo navegador usando localStorage 
como mensajero, comparando timestamps para decidir cuál pestaña tiene el 
estado "más reciente". Como localStorage quedó con un estado viejo/vacío 
de pruebas anteriores, al recuperar el foco la función interpretaba ese 
estado viejo como más nuevo y sobreescribía el diagrama real (que ya vivía 
en el backend) mediante `excalidrawAPI.updateScene()`.

**Decisión:**
Se desactivó `syncData()` (la sincronización entre pestañas basada en 
localStorage), ya que el backend es ahora la fuente de verdad del diagrama, 
no localStorage. Se mantuvo intacto `flushSave()` (guardado de respaldo 
local en blur/hidden) y la carga inicial vía GET /diagrams/:id.

**Consecuencias:**
- Ya no hay sincronización automática entre dos pestañas del mismo diagrama 
  abiertas a la vez en el mismo navegador — no es un caso de uso contemplado 
  para el demo, así que no representa una pérdida funcional relevante.
- La fuente de verdad del estado del diagrama queda claramente centralizada 
  en el backend/Postgres, consistente con el resto de la arquitectura 
  (colaboración en tiempo real futura dependerá de esta misma fuente).

**Estado de Conexión 1 (Frontend ↔ Backend):** ✅ Completa y verificada 
manualmente (persistencia real en Supabase, carga tras recarga y cierre 
de navegador, sin pérdida de datos al cambiar de foco).