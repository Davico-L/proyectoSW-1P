import 'dart:convert';
import 'dart:io';
import 'package:fcllama/fllama.dart';
import 'package:path_provider/path_provider.dart';
import 'prompt_barberia.dart';
import 'validador.dart';

class MetricasPreparacion {
  final double segundosCarga;
  final double segundosCalentamiento;
  final String rutaModelo;

  MetricasPreparacion({
    required this.segundosCarga,
    required this.segundosCalentamiento,
    required this.rutaModelo,
  });

  double get segundosTotales => segundosCarga + segundosCalentamiento;
}

class ResultadoInterpretacion {
  final Resultado resultado;
  final double segundosPrimerIntento;
  final double? segundosReintento;
  final bool huboReintento;
  final String? rawJsonPrimerIntento;
  final String? rawJsonReintento;

  ResultadoInterpretacion({
    required this.resultado,
    required this.segundosPrimerIntento,
    this.segundosReintento,
    this.huboReintento = false,
    this.rawJsonPrimerIntento,
    this.rawJsonReintento,
  });

  double get segundosTotales =>
      segundosPrimerIntento + (segundosReintento ?? 0.0);
}

class Interprete {
  final String? rutaModelo;
  final int threads;

  double? _contextId;
  String? _rutaResuelta;

  Interprete({
    this.rutaModelo,
    this.threads = 4,
  });

  bool get estaListo => _contextId != null;
  String? get rutaResuelta => _rutaResuelta;

  static const String compactGbnf = r'''
root ::= ws "{" ws (crear-atencion | crear-cliente | consultar) ws "}" ws
crear-atencion ::= "\"a\"" ws ":" ws "\"crear\"" ws "," ws "\"c\"" ws ":" ws "\"Atencion\"" ws "," ws "\"f\"" ws ":" ws "{" ws f-atencion ws "}"
f-atencion ::= (campo-atencion (ws "," ws campo-atencion)*)?
campo-atencion ::= "\"cliente\"" ws ":" ws string | "\"servicio\"" ws ":" ws string | "\"monto\"" ws ":" ws number
crear-cliente ::= "\"a\"" ws ":" ws "\"crear\"" ws "," ws "\"c\"" ws ":" ws "\"Cliente\"" ws "," ws "\"f\"" ws ":" ws "{" ws f-cliente ws "}"
f-cliente ::= (campo-cliente (ws "," ws campo-cliente)*)?
campo-cliente ::= "\"nombre\"" ws ":" ws string | "\"telefono\"" ws ":" ws string
consultar ::= "\"a\"" ws ":" ws "\"consultar\"" ws "," ws "\"c\"" ws ":" ws ("\"Atencion\"" | "\"Cliente\"") ws "," ws "\"q\"" ws ":" ws q-val ws "," ws "\"p\"" ws ":" ws p-val
q-val ::= "\"lista\"" | "\"conteo\"" | "\"suma\""
p-val ::= "\"hoy\"" | "\"todo\""
ws ::= [ \t\n]*
string ::= "\"" char* "\""
char ::= [^"\\\x00-\x1f] | "\\" (["\\/bfnrt] | "u" [0-9a-fA-F]{4})
number ::= [0-9]+ ("." [0-9]+)?
''';

  static String _buildPrompt(String phrase) {
    return '<|im_start|>system\n$promptBarberia<|im_end|>\n'
        '<|im_start|>user\n$phrase<|im_end|>\n'
        '<|im_start|>assistant\n';
  }

  /// Busca el archivo del modelo utilizando getExternalStorageDirectory() como
  /// mecanismo principal, y alternativas protegidas exclusivamente como fallback.
  static Future<String?> resolverRutaModelo({String? sugerida}) async {
    // 1. Si se indicó una ruta sugerida explícita y existe, usarla
    if (sugerida != null) {
      try {
        if (File(sugerida).existsSync()) {
          return sugerida;
        }
      } catch (_) {}
    }

    // 2. Mecanismo principal oficial mediante path_provider
    try {
      final extDir = await getExternalStorageDirectory();
      final baseDir = extDir ?? await getApplicationDocumentsDirectory();
      final modelsDir = Directory('${baseDir.path}${Platform.pathSeparator}models');

      // Crear automáticamente el subdirectorio models si no existe
      if (!await modelsDir.exists()) {
        await modelsDir.create(recursive: true);
      }

      // Buscar el archivo exacto qwen2.5-1.5b-instruct-q4_k_m.gguf
      final archivoExacto = File(
        '${modelsDir.path}${Platform.pathSeparator}qwen2.5-1.5b-instruct-q4_k_m.gguf',
      );
      if (await archivoExacto.exists()) {
        return archivoExacto.path;
      }

      // Si tiene otro nombre, buscar cualquier archivo .gguf (priorizando 1.5b)
      final List<File> archivosModels = [];
      await for (final entity in modelsDir.list(followLinks: true)) {
        if (entity is File && entity.path.toLowerCase().endsWith('.gguf')) {
          archivosModels.add(entity);
        }
      }

      if (archivosModels.isNotEmpty) {
        final qwen1_5 = archivosModels.firstWhere(
          (f) => f.path.toLowerCase().contains('1.5b'),
          orElse: () => archivosModels.first,
        );
        return qwen1_5.path;
      }
    } catch (_) {}

    // 3. Rutas alternativas conservadas ÚNICAMENTE como fallback protegido con try/catch
    final candidatas = <String>[
      '/storage/emulated/0/Android/data/com.example.mobile_template/files/models/qwen2.5-1.5b-instruct-q4_k_m.gguf',
      '/storage/emulated/0/Android/data/com.example.llm_test/files/models/qwen2.5-1.5b-instruct-q4_k_m.gguf',
      '/sdcard/models/qwen2.5-1.5b-instruct-q4_k_m.gguf',
      '/storage/emulated/0/models/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    ];

    for (final ruta in candidatas) {
      try {
        if (File(ruta).existsSync()) {
          return ruta;
        }
      } catch (_) {}
    }

    final directorios = <String>[
      '/storage/emulated/0/Android/data/com.example.mobile_template/files/models',
      '/storage/emulated/0/Android/data/com.example.llm_test/files/models',
      '/sdcard/models',
    ];

    for (final dirPath in directorios) {
      try {
        final dir = Directory(dirPath);
        if (dir.existsSync()) {
          final archivos = dir.listSync().whereType<File>().where(
                (f) => f.path.toLowerCase().endsWith('.gguf'),
              );
          final archivo1_5 = archivos.firstWhere(
            (f) => f.path.toLowerCase().contains('1.5b'),
            orElse: () => archivos.isNotEmpty ? archivos.first : File(''),
          );
          if (archivo1_5.path.isNotEmpty && archivo1_5.existsSync()) {
            return archivo1_5.path;
          }
        }
      } catch (_) {}
    }

    return null;
  }

  /// (1) prepara el intérprete: verifica existencia del GGUF, carga el modelo
  /// y ejecuta la inferencia de calentamiento midiendo cada tiempo con Stopwatch.
  Future<MetricasPreparacion> preparar() async {
    String rutaEsperada;
    try {
      final extDir = await getExternalStorageDirectory();
      final baseDir = extDir ?? await getApplicationDocumentsDirectory();
      rutaEsperada =
          '${baseDir.path}${Platform.pathSeparator}models${Platform.pathSeparator}qwen2.5-1.5b-instruct-q4_k_m.gguf';
    } catch (_) {
      rutaEsperada =
          '/storage/emulated/0/Android/data/com.example.mobile_template/files/models/qwen2.5-1.5b-instruct-q4_k_m.gguf';
    }

    final ruta = await resolverRutaModelo(sugerida: rutaModelo);
    if (ruta == null) {
      throw Exception(
        'No se encontró el archivo del modelo GGUF en el dispositivo. '
        'Ruta esperada: $rutaEsperada. Asegúrese de copiar el archivo '
        'qwen2.5-1.5b-instruct-q4_k_m.gguf a esa carpeta.',
      );
    }

    _rutaResuelta = ruta;

    if (_contextId != null) {
      await FCllama.instance()?.releaseContext(_contextId!);
      _contextId = null;
    }

    // 1. Carga del modelo
    final swCarga = Stopwatch()..start();
    final initRes = await FCllama.instance()?.initContext(
      ruta,
      nCtx: 2048,
      nBatch: 512,
      nThreads: threads,
      nGpuLayers: 0,
      useMmap: true,
      useMlock: false,
    );
    swCarga.stop();

    final rawContextId = initRes?['contextId'];
    if (rawContextId == null) {
      throw Exception('Error al inicializar contexto nativo de fcllama: $initRes');
    }

    _contextId = (rawContextId as num).toDouble();
    final segCarga = swCarga.elapsedMilliseconds / 1000.0;

    // 2. Inferencia de calentamiento
    final swWarmup = Stopwatch()..start();
    final warmupPrompt = _buildPrompt('calentamiento inicial de prueba');
    await FCllama.instance()?.completion(
      _contextId!,
      prompt: warmupPrompt,
      grammar: '',
      temperature: 0.0,
      nThreads: threads,
      nPredict: 15,
      emitRealtimeCompletion: false,
    );
    swWarmup.stop();
    final segWarmup = swWarmup.elapsedMilliseconds / 1000.0;

    return MetricasPreparacion(
      segundosCarga: segCarga,
      segundosCalentamiento: segWarmup,
      rutaModelo: ruta,
    );
  }

  Future<Map<String, dynamic>> _ejecutarInferencia(String frase) async {
    if (_contextId == null) {
      throw StateError('El intérprete no ha sido preparado. Llame a preparar() primero.');
    }

    final prompt = _buildPrompt(frase);
    final sw = Stopwatch()..start();
    final res = await FCllama.instance()?.completion(
      _contextId!,
      prompt: prompt,
      grammar: compactGbnf,
      temperature: 0.0,
      nThreads: threads,
      nPredict: 60,
      emitRealtimeCompletion: false,
    );
    sw.stop();

    final rawOutput = res?['text']?.toString() ?? '';
    final textOutput = rawOutput.replaceAll('<|im_end|>', '').trim();
    final segundos = sw.elapsedMilliseconds / 1000.0;

    return {
      'text': textOutput,
      'segundos': segundos,
    };
  }

  static String _generarSegundaFrase(String fraseOriginal) {
    var s = fraseOriginal;
    s = s.replaceAll(RegExp(r'\bal\s+cliente\b', caseSensitive: false), 'a');
    s = s.replaceAll(RegExp(r'\bel\s+cliente\b', caseSensitive: false), '');
    s = s.replaceAll(RegExp(r'\bla\s+cliente\b', caseSensitive: false), 'a');
    s = s.replaceAll(RegExp(r'\bcliente\b', caseSensitive: false), '');
    s = s.replaceAll(RegExp(r'\s+'), ' ').trim();
    return s;
  }

  static bool _debeReintentar(Map<String, dynamic> rawJson, Resultado validado) {
    final rawClase = (rawJson['c'] ?? rawJson['clase'])?.toString().trim();
    final esClienteEnRaw = rawClase != null && normalizar(rawClase) == 'cliente';
    final esAtencionFinal = validado.clase == 'Atencion';
    final faltaServicio = validado.faltantes.contains('servicio');
    return esClienteEnRaw && esAtencionFinal && faltaServicio;
  }

  static Resultado _aplicarReintento(Resultado original, Resultado retry) {
    if (retry.esValido &&
        !retry.tieneError &&
        retry.clase == 'Atencion' &&
        retry.campos.containsKey('servicio') &&
        retry.campos['servicio'] != null) {
      final servicioVal = retry.campos['servicio'];
      final camposActualizados = Map<String, dynamic>.from(original.campos);
      camposActualizados['servicio'] = servicioVal;

      final faltantesActualizados = List<String>.from(original.faltantes)
        ..remove('servicio');
      final descartadosActualizados = List<String>.from(original.descartados)
        ..remove('servicio');

      return Resultado(
        accion: original.accion,
        clase: original.clase,
        campos: camposActualizados,
        faltantes: faltantesActualizados,
        descartados: descartadosActualizados,
        q: original.q,
        p: original.p,
        error: original.error,
      );
    }
    return original;
  }

  /// (2) interpretar(String frase, `Map<String, Map<String, String>>` esquemaValidador)
  /// que hace el primer intento, valida con validar(), aplica el mismo reintento
  /// que llm_test y devuelve el Resultado más los segundos de cada intento.
  Future<ResultadoInterpretacion> interpretar(
    String frase,
    Map<String, Map<String, String>> esquemaValidador,
  ) async {
    final res1 = await _ejecutarInferencia(frase);
    final text1 = res1['text'] as String;
    final seg1 = res1['segundos'] as double;

    Map<String, dynamic> rawJson1 = {};
    try {
      final d = jsonDecode(text1);
      if (d is Map) {
        rawJson1 = Map<String, dynamic>.from(d);
      }
    } catch (_) {}

    var validado = validar(frase, rawJson1, esquemaValidador);

    if (_debeReintentar(rawJson1, validado)) {
      final segundaFrase = _generarSegundaFrase(frase);
      final resRetry = await _ejecutarInferencia(segundaFrase);
      final textRetry = resRetry['text'] as String;
      final segRetry = resRetry['segundos'] as double;

      Map<String, dynamic> rawJsonRetry = {};
      try {
        final d = jsonDecode(textRetry);
        if (d is Map) {
          rawJsonRetry = Map<String, dynamic>.from(d);
        }
      } catch (_) {}

      final validadoRetry = validar(frase, rawJsonRetry, esquemaValidador);
      validado = _aplicarReintento(validado, validadoRetry);

      return ResultadoInterpretacion(
        resultado: validado,
        segundosPrimerIntento: seg1,
        segundosReintento: segRetry,
        huboReintento: true,
        rawJsonPrimerIntento: text1,
        rawJsonReintento: textRetry,
      );
    }

    return ResultadoInterpretacion(
      resultado: validado,
      segundosPrimerIntento: seg1,
      huboReintento: false,
      rawJsonPrimerIntento: text1,
    );
  }

  Future<void> liberar() async {
    if (_contextId != null) {
      await FCllama.instance()?.releaseContext(_contextId!);
      _contextId = null;
    }
  }
}
