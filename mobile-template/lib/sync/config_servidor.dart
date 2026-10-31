import 'dart:io';
import 'package:path_provider/path_provider.dart';

/// Gestiona la lectura y persistencia de la URL base del servidor.
class ConfigServidor {
  static const String _nombreArchivo = 'servidor_url.txt';

  /// Valida si una URL es sintácticamente válida (no vacía y empieza con http).
  static bool esValida(String? url) {
    if (url == null) return false;
    final limpia = url.trim().toLowerCase();
    return limpia.startsWith('http://') || limpia.startsWith('https://');
  }

  /// Obtiene la referencia al archivo de configuración en la carpeta de documentos.
  static Future<File> _obtenerArchivo() async {
    final dir = await getApplicationDocumentsDirectory();
    final separador = Platform.pathSeparator;
    return File('${dir.path}$separador$_nombreArchivo');
  }

  /// Lee la URL base guardada. Retorna null si no existe o está vacía.
  static Future<String?> leerUrl() async {
    try {
      final archivo = await _obtenerArchivo();
      if (!await archivo.exists()) {
        return null;
      }
      final contenido = (await archivo.readAsString()).trim();
      if (contenido.isEmpty) return null;
      if (!esValida(contenido)) return null;
      return contenido;
    } catch (_) {
      return null;
    }
  }

  /// Guarda la URL base en el archivo de texto.
  /// Lanza [ArgumentError] si la URL no empieza con http.
  static Future<void> guardarUrl(String url) async {
    final limpia = url.trim();
    if (!esValida(limpia)) {
      throw ArgumentError(
        'La URL del servidor no es válida. Debe comenzar con http (ejemplo: http://192.168.1.10:8081).',
      );
    }
    // Normalizar eliminando barras diagonales finales
    final normalizada = limpia.replaceAll(RegExp(r'/+$'), '');
    final archivo = await _obtenerArchivo();
    await archivo.writeAsString(normalizada);
  }
}
