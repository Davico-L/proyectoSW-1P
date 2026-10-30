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


