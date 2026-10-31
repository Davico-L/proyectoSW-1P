import 'dart:async';
import 'interprete.dart';

enum EstadoServicioIa {
  noIniciado,
  preparando,
  listo,
  error,
}

/// Servicio singleton que gestiona una única instancia compartida de [Interprete].
///
/// Garantiza que la preparación del modelo GGUF y el calentamiento se realicen
/// una sola vez en toda la aplicación, manteniendo los estados:
/// preparando, listo o error (con su mensaje descriptivo).
class ServicioIa {
  static final ServicioIa _instancia = ServicioIa._interno();
  factory ServicioIa() => _instancia;
  ServicioIa._interno();

  static ServicioIa get instancia => _instancia;

  final Interprete interprete = Interprete();

  EstadoServicioIa _estado = EstadoServicioIa.noIniciado;
  String _mensajeEstado = 'No iniciado';
  String? _error;
  String? promptActivo;
  Map<String, Map<String, String>>? esquemaValidadorActivo;
  MetricasPreparacion? _metricas;
  Completer<MetricasPreparacion>? _completerPreparacion;

  EstadoServicioIa get estado => _estado;
  bool get estaPreparando => _estado == EstadoServicioIa.preparando;
  bool get estaListo => _estado == EstadoServicioIa.listo && interprete.estaListo;
  bool get tieneError => _estado == EstadoServicioIa.error;
  String get mensajeEstado => _mensajeEstado;
  String? get error => _error;
  MetricasPreparacion? get metricas => _metricas;

  /// Prepara el intérprete local con el prompt y esquema indicados.
  /// Si ya está listo y se solicita un prompt distinto, lanza una excepción
  /// avisando que hay que reiniciar la aplicación.
  Future<MetricasPreparacion> preparar([
    String? prompt,
    Map<String, Map<String, String>>? esquemaValidador,
  ]) async {
    if (esquemaValidador != null) {
      esquemaValidadorActivo = esquemaValidador;
    }
    if (estaListo && _metricas != null) {
      if (prompt != null && promptActivo != null && prompt != promptActivo) {
        throw StateError(
          'El modelo ya está cargado con otro prompt. Debe reiniciar la app para cambiar de prompt.',
        );
      }
      return _metricas!;
    }
    if (_completerPreparacion != null) {
      return _completerPreparacion!.future;
    }

    _completerPreparacion = Completer<MetricasPreparacion>();
    _estado = EstadoServicioIa.preparando;
    _mensajeEstado = 'Preparando asistente...';
    _error = null;

    try {
      if (prompt != null) {
        promptActivo = prompt;
      } else {
        promptActivo = interprete.promptSistema;
      }

      final m = await interprete.preparar(prompt: promptActivo);
      _metricas = m;
      _estado = EstadoServicioIa.listo;
      _mensajeEstado =
          'Asistente listo.\nCarga: ${m.segundosCarga.toStringAsFixed(2)} s | '
          'Calentamiento: ${m.segundosCalentamiento.toStringAsFixed(2)} s | '
          'Total: ${m.segundosTotales.toStringAsFixed(2)} s';
      _completerPreparacion!.complete(m);
      return m;
    } catch (e) {
      _estado = EstadoServicioIa.error;
      _error = e.toString();
      _mensajeEstado = 'Error en la preparación: $e';
      _completerPreparacion!.completeError(e);
      rethrow;
    } finally {
      _completerPreparacion = null;
    }
  }

  /// Ejecuta la interpretación de una frase con el esquema dado (o el activo).
  Future<ResultadoInterpretacion> interpretar(
    String frase, [
    Map<String, Map<String, String>>? esquemaValidador,
  ]) {
    final esquema = esquemaValidador ?? esquemaValidadorActivo ?? {};
    return interprete.interpretar(frase, esquema);
  }
}
