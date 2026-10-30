# Tarea Actual: Coordinación de IA

Este documento refleja en tiempo real la tarea activa que está ejecutando el asistente de IA y su estado de avance.

---

## Tarea en Curso

- **Identificador**: TSK-039
- **Nombre**: Diagnóstico y corrección de condición de carrera en initialMode / onboarding en App.tsx
- **Fecha de Inicio**: 2026-10-27
- **Estado**: Completada
- **Objetivo**: Diagnosticar por qué el panel se abre en "Editar" en vez de "Ayuda" al abrirse por primera vez. Analizar orden y ejecución de los useEffect en App.tsx (apertura vs reseteo cuando isAiChatOpen es false), uso de initialMode en AiChatPanel.tsx y persistencia en localStorage. Si se confirma el pisado de estado en el render inicial, corregir con wasOpenRef en App.tsx para que el reseteo ocurra únicamente en la transición true -> false.

---

## Tarea Anterior (completada)

- **Identificador**: TSK-038
- **Nombre**: CU-Ayuda Fase 13: Apertura automática de ayuda por primera vez (onboarding) en App.tsx
- **Fecha de Inicio**: 2026-10-27
- **Estado**: Completada
