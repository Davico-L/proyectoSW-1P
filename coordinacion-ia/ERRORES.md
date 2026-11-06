# Registro de Errores e Incidentes: Coordinación de IA

Este documento registra los errores técnicos, bloqueos, problemas de integración o discrepancias encontradas durante la ejecución de tareas, junto con su causa raíz y la solución implementada.

---

## Estructura de Registro (Plantilla)

### [ERR-XXX] Título del Error o Incidente
- **Fecha**: AAAA-MM-DD
- **Componente / Módulo Afectado**: [Backend | Frontend | Mobile | Base de Datos | Documentación | DevOps]
- **Descripción**: Descripción detallada del síntoma o mensaje de error.
- **Causa Raíz**: Explicación técnica de la causa del fallo.
- **Solución / Mitigación**: Acciones implementadas para corregirlo o evitar su repetición.
- **Estado**: [Abierto | En Investigación | Resuelto | Mitigado]

---

## Historial de Errores

### [ERR-001] Incompatibilidad de tipos en thinkingLevel (TS2322)
- **Fecha**: 2026-10-17
- **Componente / Módulo Afectado**: Backend / `backend/src/services/visionDiagram.ts`
- **Descripción**: Error de compilación TypeScript `error TS2322: Type '{ thinkingLevel: string; }' is not assignable to type 'ThinkingConfig'. Type 'string' is not assignable to type 'ThinkingLevel | undefined'.`
- **Causa Raíz**: El SDK `@google/genai` expone `ThinkingLevel` como un TypeScript `enum` estricto (`ThinkingLevel.MINIMAL`, `ThinkingLevel.LOW`, etc.) y rechaza tipos `string` primitivos en `thinkingConfig.thinkingLevel`.
- **Solución / Mitigación**: Se importó `ThinkingLevel` directamente desde `@google/genai` y se tipó la función `getThinkingLevelForModel` devolviendo `ThinkingLevel | null` mapeando los strings permitidos hacia los valores correspondientes del enum.
- **Estado**: Resuelto

---

### [ERR-002] Bloqueo CORS en preflight para x-session-id en POST /help/ask
- **Fecha**: 2026-10-27
- **Componente / Módulo Afectado**: Backend / `backend/src/app.ts`
- **Descripción**: El navegador bloqueaba peticiones `POST /help/ask` desde el frontend (`http://localhost:3001`) con el error: `Request header field x-session-id is not allowed by Access-Control-Allow-Headers in preflight response`.
- **Causa Raíz**: La opción `allowedHeaders` en el middleware `cors(...)` de `backend/src/app.ts` solo incluía `["Content-Type", "Authorization"]`, omitiendo la cabecera personalizada `x-session-id` requerida por las rutas de sesión y ayuda.
- **Solución / Mitigación**: Se añadió `"x-session-id"` a la lista `allowedHeaders` en la configuración de CORS existente, conservando intactos los demás orígenes, credenciales, métodos y cabeceras.
- **Estado**: Resuelto

---

---

### [ERR-004] Corrupción de codificación UTF-8 en archivos Dart por lectura/escritura ANSI en PowerShell
- **Fecha**: 2026-10-30
- **Componente / Módulo Afectado**: Mobile / `mobile-template/test/validador_test.dart` y `mobile-template/lib/main.dart`
- **Descripción**: `flutter test` falló en 12 pruebas debido a cadenas con caracteres acentuados corrompidos en doble codificación/mojibake (ej. `'no entendÃ­'` en vez de `'no entendí'`, `'Plantilla MÃ³vil Inicial'` en vez de `'Plantilla Móvil Inicial'`).
- **Causa Raíz**: El comando `Get-Content` / `Set-Content` en PowerShell 5.1 utilizó por defecto la codificación del sistema (Windows-1252/ANSI) en lugar de UTF-8 sin BOM al copiar y modificar archivos Dart.
- **Solución / Mitigación**: Se reescribieron los archivos forzando explícitamente `System.Text.UTF8Encoding($false)` y copia directa de bytes binarios desde `llm_test`, logrando 54/54 tests pasando limpiamente.
- **Estado**: Resuelto

---

### [ERR-005] Desborde de RenderFlex en widget_test.dart por apilamiento de botones en SampleHomeScreen
- **Fecha**: 2026-10-30
- **Componente / Módulo Afectado**: Mobile / `mobile-template/lib/main.dart`
- **Descripción**: `flutter test` falló en `widget_test.dart: Sample screen renders smoke test` con `A RenderFlex overflowed by 55 pixels on the bottom` en `Column:file:///D:/proyectoSW-1P/mobile-template/lib/main.dart:41:18`.
- **Causa Raíz**: Al agregarse un tercer botón (`Prueba de voz`) en `Column` dentro de `Center(child: Padding(...))`, la altura requerida superó la ventana de renderizado predeterminada de las pruebas de widget (800x600 px).
- **Solución / Mitigación**: Se envolvió el contenido del cuerpo en `SingleChildScrollView(padding: const EdgeInsets.all(24.0), child: Column(...))` permitiendo desplazamiento elástico y eliminando desbordes en cualquier tamaño de pantalla.
- **Estado**: Resuelto

---

### [ERR-006] Fallo de re-unión a salas Socket.IO tras reconexión e InvalidFractionalIndexError en creación de clases UML
- **Fecha**: 2026-11-05
- **Componente / Módulo Afectado**: Frontend / `frontend/excalidraw-app/data/realtimeSync.ts`, `frontend/excalidraw-app/App.tsx` y `frontend/src/teamChat/useTeamChat.ts`
- **Descripción**: Durante la prueba de reconexión tras corte de red: (1) El panel de chat permanecía en «Conectando…» indefinidamente y el lienzo no sincronizaba entre pestañas; (2) Al crear una clase UML desde el modal, la consola arrojaba `InvalidFractionalIndexError` apuntando a `handleUmlModalConfirm -> replaceAllElements -> validateFractionalIndices`.
- **Causa Raíz**:
  1. En `realtimeSync.ts`, `currentRoomId` no se reseteaba a `null` ante el evento `"disconnect"`. Al reconectar, `joinDiagramRoom` encontraba `currentRoomId === diagramId` y retornaba anticipadamente sin emitir `join-diagram`. El backend nunca unía al nuevo socket a la sala, por lo que `chat-join` era rechazado con `not_in_room` y `diagram-update` no llegaba a las demás pestañas.
  2. En `App.tsx:handleUmlModalConfirm`, los elementos generados por `createUmlClassElement` tenían `index: null`. Al agregarse directamente a `updateScene`, `validateIndicesThrottled` ejecutaba `validateFractionalIndices`, arrojando `InvalidFractionalIndexError` por violación de índice fraccionario nulo y orden de texto vinculado.
- **Solución / Mitigación**:
  1. En `realtimeSync.ts`, se añadió escucha a `socket.on("disconnect")` reseteando `currentRoomId = null`, y en `socket.on("connect")` se forzó `currentRoomId = null` antes de invocar `joinDiagramRoom(diagramId)`.
  2. En `useTeamChat.ts`, se suscribió a `onDiagramState` para disparar `attemptChatJoin()` exactamente cuando el backend confirma `join-diagram` (emitiendo `diagram-state`), garantizando pertenencia a la sala antes del intento de chat.
  3. En `App.tsx:handleUmlModalConfirm`, se envolvieron los elementos con `syncInvalidIndices([...elements, container, text])` de `@excalidraw/element`, asignando claves fraccionarias válidas y ascendentes (`text.index > container.index`) antes de invocar `updateScene`, manteniendo las validaciones de Excalidraw 100% activas.
- **Estado**: Resuelto




