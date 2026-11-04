# Tarea Actual: Coordinación de IA

Este documento refleja en tiempo real la tarea activa que está ejecutando el asistente de IA y su estado de avance.

---

## Tarea en Curso

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
