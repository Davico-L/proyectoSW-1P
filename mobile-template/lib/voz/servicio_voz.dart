import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:speech_to_text/speech_recognition_error.dart';
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:speech_to_text/speech_to_text.dart';

/// Servicio de reconocimiento de voz local que encapsula [SpeechToText].
///
/// Configurado con `onDevice: true` y `es_US`, replicando la inicialización
/// probada en `voz_test`. Evita que la transcripción se pierda al finalizar
/// la sesión de audio y traduce errores al español.
class ServicioVoz extends ChangeNotifier {
  final SpeechToText _speechToText = SpeechToText();

  bool _estaInicializado = false;
  String _localeId = 'es_US';
  String _textoParcial = '';
  String _textoFinal = '';
  String? _ultimoError;
  String _estado = 'no_iniciado';

  bool get estaInicializado => _estaInicializado;
  bool get estaEscuchando => _speechToText.isListening;
  String get localeId => _localeId;
  String get textoParcial => _textoParcial;
  String get textoFinal => _textoFinal;
  String? get ultimoError => _ultimoError;
  String get estado => _estado;

  /// Inicializa el motor de speech_to_text y busca el local `es_US`.
  Future<bool> inicializar() async {
    try {
      final disponible = await _speechToText.initialize(
        onError: (SpeechRecognitionError error) {
          _ultimoError = traducirError(error.errorMsg);
          _estado = 'error';
          notifyListeners();
        },
        onStatus: (String status) {
          _estado = status;
          // Preserva la transcripción cuando el estado pasa a inactivo o terminado
          if ((status == 'notListening' || status == 'done') &&
              _textoParcial.trim().isNotEmpty &&
              _textoFinal.trim().isEmpty) {
            _textoFinal = _textoParcial.trim();
          }
          notifyListeners();
        },
        debugLogging: true,
      );

      _estaInicializado = disponible;

      if (disponible) {
        final locales = await _speechToText.locales();
        final matchEsUs = locales.any((l) {
          final id = l.localeId.toLowerCase().replaceAll('-', '_');
          return id == 'es_us';
        });

        if (matchEsUs) {
          _localeId = locales.firstWhere((l) {
            final id = l.localeId.toLowerCase().replaceAll('-', '_');
            return id == 'es_us';
          }).localeId;
        } else {
          _localeId = 'es_US';
        }
      } else {
        _ultimoError = 'Permiso de micrófono no concedido o reconocedor no disponible.';
      }

      notifyListeners();
      return disponible;
    } catch (e) {
      _estaInicializado = false;
      _ultimoError = 'Excepción al inicializar reconocimiento de voz: $e';
      notifyListeners();
      return false;
    }
  }

  /// Inicia la escucha con `onDevice: true` y `es_US`.
  Future<void> iniciar() async {
    if (!_estaInicializado) {
      final ok = await inicializar();
      if (!ok) return;
    }

    _textoParcial = '';
    _textoFinal = '';
    _ultimoError = null;
    _estado = 'escuchando';
    notifyListeners();

    try {
      await _speechToText.listen(
        onResult: (SpeechRecognitionResult result) {
          // Previene que se borre la transcripción con resultados intermedios vacíos
          if (result.recognizedWords.trim().isNotEmpty) {
            _textoParcial = result.recognizedWords;
          }
          if (result.finalResult) {
            _textoFinal = result.recognizedWords.trim();
          }
          notifyListeners();
        },
        listenOptions: SpeechListenOptions(
          onDevice: true,
          partialResults: true,
          listenMode: ListenMode.dictation,
          cancelOnError: false,
          listenFor: const Duration(seconds: 30),
          pauseFor: const Duration(seconds: 4),
          localeId: _localeId,
        ),
      );
      notifyListeners();
    } catch (e) {
      _ultimoError = 'Excepción al iniciar escucha: $e';
      notifyListeners();
    }
  }

  /// Detiene la escucha y consolida el texto final. Devuelve la transcripción final.
  Future<String> detener() async {
    try {
      if (_speechToText.isListening) {
        await _speechToText.stop();
      }
    } catch (e) {
      _ultimoError = 'Excepción al detener: $e';
    }

    // Regla: si no hubo flag finalResult pero sí texto parcial, conservarlo como texto final
    if (_textoFinal.trim().isEmpty && _textoParcial.trim().isNotEmpty) {
      _textoFinal = _textoParcial.trim();
    }

    _estado = 'detenido';
    notifyListeners();
    return _textoFinal;
  }

  /// Traduce los errores nativos del reconocedor al español, incluyendo
  /// el caso de idioma offline no descargado o sin conexión a internet.
  static String traducirError(String errorMsg) {
    final err = errorMsg.toLowerCase();
    if (err.contains('language_unavailable') ||
        err.contains('language_not_supported') ||
        err.contains('network') ||
        err.contains('server') ||
        err.contains('offline')) {
      return 'El paquete de idioma español (es_US) no está disponible sin conexión a internet en el teléfono. '
          'Descárgalo en Ajustes de Android > Idiomas y entradas > Entrada de voz (Reconocimiento sin conexión).';
    }
    if (err.contains('no_match')) {
      return 'No se detectó ninguna palabra comprensible.';
    }
    if (err.contains('speech_timeout')) {
      return 'Tiempo de espera agotado sin detectar voz.';
    }
    if (err.contains('busy')) {
      return 'El reconocedor de voz está ocupado en otra aplicación.';
    }
    if (err.contains('permission') || err.contains('insufficient_permissions')) {
      return 'Permiso de micrófono no otorgado.';
    }
    if (err.contains('audio')) {
      return 'Error de captura de audio en el dispositivo.';
    }
    if (err.contains('client')) {
      return 'Error en el cliente de reconocimiento de voz ($errorMsg).';
    }
    return 'Error del reconocedor de voz: $errorMsg';
  }
}
