# Directrices del Proyecto ClassDrawSW (Antigravity Coordination)

Este archivo define las reglas persistentes y el protocolo de coordinación obligatorios para Antigravity y cualquier agente de IA que opere en el repositorio `D:\proyectoSW-1P`.

---

## 1. Protocolo de Coordinación y Documentación Persistente

Para cualquier tarea de desarrollo, refactorización, depuración o documentación, se debe seguir este flujo sin necesidad de que el usuario lo solicite expresamente:

### A. Al iniciar una tarea
1. **Consulta de Contexto**: Revisar [`coordinacion-ia/CONTEXTO.md`](coordinacion-ia/CONTEXTO.md) y [`coordinacion-ia/ESTADO_ACTUAL.md`](coordinacion-ia/ESTADO_ACTUAL.md) cuando sean relevantes para comprender la arquitectura, dependencias y estado funcional de los componentes involucrados.
2. **Registro de Tarea**: Actualizar [`coordinacion-ia/TAREA_ACTUAL.md`](coordinacion-ia/TAREA_ACTUAL.md) con el identificador (`TSK-XXX`), nombre, objetivo específico y estado actual (`En progreso`).

### B. Durante el desarrollo
1. **Verificación Estricta**: No inventar pruebas, resultados ni funcionalidades que no hayan sido verificadas en código o ejecución.
2. **Seguridad y Confidencialidad**: Jamás registrar secretos, tokens, credenciales, claves API (`GEMINI_API_KEY`, `GROQ_API_KEY`, etc.), contraseñas ni contenidos de archivos `.env` o `.env.*`.
3. **No Destrucción**: No realizar operaciones destructivas, commits ni push no autorizados. Preservar comentarios y código existente no relacionado.

### C. Al finalizar una tarea
1. **Registro de Resultados**: Actualizar [`coordinacion-ia/RESULTADOS.md`](coordinacion-ia/RESULTADOS.md) con un nuevo bloque (`RES-XXX`) que liste archivos creados/modificados, pruebas ejecutadas, resultados y limitaciones encontradas.
2. **Gestión de Errores**: Si durante la tarea ocurrieron errores, fallos de compilación o discrepancias relevantes, registrarlos en [`coordinacion-ia/ERRORES.md`](coordinacion-ia/ERRORES.md) (`ERR-XXX`) con descripción, causa raíz y solución o mitigación aplicada (evitando entradas duplicadas).
3. **Actualización de Estado Funcional**: Si se implementaron o alteraron funcionalidades comprobadas, actualizar [`coordinacion-ia/ESTADO_ACTUAL.md`](coordinacion-ia/ESTADO_ACTUAL.md) clasificando rigurosamente entre *Implementado*, *Parcial*, *Pendiente* y *Desconocido*.
4. **Decisiones Arquitectónicas**: Modificar [`coordinacion-ia/DECISIONES.md`](coordinacion-ia/DECISIONES.md) únicamente cuando el usuario haya confirmado explícitamente una decisión técnica o de diseño.
5. **Contexto Global**: Actualizar [`coordinacion-ia/CONTEXTO.md`](coordinacion-ia/CONTEXTO.md) si se realizaron cambios arquitectónicos o de infraestructura verificados.
6. **Cierre de Tarea Activa**: Actualizar el estado en [`coordinacion-ia/TAREA_ACTUAL.md`](coordinacion-ia/TAREA_ACTUAL.md) a `Completada` o `Esperando Aprobación`.

---

## 2. Reglas de Mantenimiento de la Documentación

- **Trazabilidad Histórica**: Nunca sobrescribir ni borrar registros históricos anteriores en `RESULTADOS.md`, `ERRORES.md` ni `DECISIONES.md`. Emplear identificadores consecutivos y marcas de fecha (`AAAA-MM-DD`).
- **Concisión y Economía de Contexto**: Mantener las entradas claras, técnicas y sintéticas para evitar sobrecargar la ventana de contexto del agente.
- **Convivencia con Reglas Locales**: Al operar en el subdirectorio `frontend/`, respetar complementariamente las directrices específicas de DOM y tipado definidas en [`frontend/AGENTS.md`](frontend/AGENTS.md).
