import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:sqflite/sqflite.dart';
import 'package:mobile_template/datos/repositorio.dart';
import 'package:mobile_template/esquema/esquema.dart';
import 'package:mobile_template/sync/config_servidor.dart';

/// Resultado detallado de un proceso de sincronización.
class ResultadoSincronizacion {
  final int enviados;
  final int pendientes;
  final String mensaje;
  final bool exito;

  const ResultadoSincronizacion({
    required this.enviados,
    required this.pendientes,
    required this.mensaje,
    required this.exito,
  });

  @override
  String toString() =>
      'ResultadoSincronizacion(enviados: $enviados, pendientes: $pendientes, exito: $exito, mensaje: "$mensaje")';
}

/// Sincronizador de datos locales con el backend generado (Spring Boot).
class Sincronizador {
  final Esquema esquema;
  final Repositorio repositorio;
  final http.Client client;

  bool _sincronizando = false;
  bool get estaSincronizando => _sincronizando;

  Sincronizador(
    this.esquema,
    this.repositorio, [
    http.Client? client,
  ]) : client = client ?? http.Client();

  /// Convierte un texto a snake_case (ej: "Atencion" -> "atencion", "OrdenCompra" -> "orden_compra").
  static String toSnakeCase(String str) {
    if (str.isEmpty) return '';
    return str
        .replaceAllMapped(
            RegExp(r'([a-z0-9])([A-Z])'), (m) => '${m[1]}_${m[2]}')
        .replaceAll(RegExp(r'[^a-zA-Z0-9]+'), '_')
        .replaceAll(RegExp(r'^_+|_\+$'), '')
        .toLowerCase();
  }

  /// Convierte un texto a camelCase (ej: "fecha_nacimiento" -> "fechaNacimiento").
  static String toCamelCase(String str) {
    if (str.isEmpty) return '';
    final words = str
        .replaceAllMapped(
            RegExp(r'([a-z0-9])([A-Z])'), (m) => '${m[1]} ${m[2]}')
        .split(RegExp(r'[^a-zA-Z0-9]+'))
        .where((w) => w.isNotEmpty)
        .toList();
    if (words.isEmpty) return str.toLowerCase();
    final first = words.first.toLowerCase();
    final rest = words
        .skip(1)
        .map((w) => w[0].toUpperCase() + w.substring(1).toLowerCase())
        .join('');
    return '$first$rest';
  }

  /// Calcula la ruta REST para una clase según el generador de backend: /api/{plural en snake_case + "s"}
  static String rutaClase(String nombreClase) {
    final snake = toSnakeCase(nombreClase);
    return '/api/${snake}s';
  }

  /// Cuenta la cantidad total de registros con sincronizado = 0 en todas las tablas del esquema.
  Future<int> contarPendientes() async {
    int total = 0;
    for (final c in esquema.clases) {
      final t = esquema.nombreTabla(c);
      final count = Sqflite.firstIntValue(
        await repositorio.db
            .rawQuery('SELECT COUNT(*) FROM $t WHERE sincronizado = 0'),
      ) ?? 0;
      total += count;
    }
    return total;
  }

  /// Ejecuta la sincronización hacia el servidor.
  /// Si se omite [urlBase], se lee de [ConfigServidor.leerUrl].
  Future<ResultadoSincronizacion> sincronizar([String? urlBase]) async {
    // Regla de concurrencia: un solo sincronizar() a la vez.
    if (_sincronizando) {
      final p = await contarPendientes();
      return ResultadoSincronizacion(
        enviados: 0,
        pendientes: p,
        mensaje: 'Ya hay una sincronización en curso.',
        exito: false,
      );
    }

    _sincronizando = true;
    try {
      final url = urlBase ?? await ConfigServidor.leerUrl();
      if (url == null || !ConfigServidor.esValida(url)) {
        final p = await contarPendientes();
        return ResultadoSincronizacion(
          enviados: 0,
          pendientes: p,
          mensaje: 'Configura la dirección del servidor para sincronizar.',
          exito: false,
        );
      }

      final urlNormalizada = url.replaceAll(RegExp(r'/+$'), '');
      int totalEnviados = 0;

      // 1. Recorrer las clases en orden de padres antes que hijos
      final clasesOrdenadas = esquema.ordenarClasesPorJerarquia();

      for (final clase in clasesOrdenadas) {
        final tabla = esquema.nombreTabla(clase);
        final endpoint = '$urlNormalizada${rutaClase(clase.nombre)}';

        // 2. Tomar registros con sincronizado = 0
        final filasPendientes = await repositorio.db.query(
          tabla,
          where: 'sincronizado = 0',
          orderBy: 'id_local ASC',
        );

        for (final fila in filasPendientes) {
          final idLocal = fila['id_local'] as int;

          // Construir el cuerpo con nombres en camelCase
          final body = <String, dynamic>{};
          bool saltarRegistro = false;

          for (final campo in clase.campos) {
            final keyCamel = toCamelCase(campo.nombre);

            if (campo.tipo == 'ref') {
              final idLocalPadre = fila['${campo.nombre}_id'] as int?;
              if (idLocalPadre != null) {
                final destinoClase = esquema.clases.firstWhere(
                  (c) =>
                      c.nombre.toLowerCase() == campo.destino!.toLowerCase(),
                );
                final tablaDestino = esquema.nombreTabla(destinoClase);

                final padreRows = await repositorio.db.query(
                  tablaDestino,
                  columns: ['id_servidor'],
                  where: 'id_local = ?',
                  whereArgs: [idLocalPadre],
                );

                final idServidorPadre = padreRows.isNotEmpty
                    ? padreRows.first['id_servidor'] as int?
                    : null;

                // Si el padre aún no tiene id_servidor, ese registro se salta y queda pendiente
                if (idServidorPadre == null) {
                  saltarRegistro = true;
                  break;
                }

                body[keyCamel] = {'id': idServidorPadre};
              }
            } else if (campo.tipo == 'numero') {
              final val = fila[campo.nombre];
              if (val != null) {
                if (val is num) {
                  body[keyCamel] = val;
                } else {
                  final n = num.tryParse(val.toString());
                  if (n != null) body[keyCamel] = n;
                }
              }
            } else {
              // texto u otro
              final val = fila[campo.nombre];
              if (val != null) {
                final str = val.toString();
                if (str.isNotEmpty) {
                  body[keyCamel] = str;
                }
              }
            }
          }

          if (saltarRegistro) {
            continue;
          }

          // 3. Enviar con POST con timeout de 10 segundos
          http.Response response;
          try {
            response = await client
                .post(
                  Uri.parse(endpoint),
                  headers: {'Content-Type': 'application/json'},
                  body: jsonEncode(body),
                )
                .timeout(const Duration(seconds: 10));
          } catch (_) {
            // Si una petición falla o hay timeout, se detiene sin marcar nada más
            final p = await contarPendientes();
            return ResultadoSincronizacion(
              enviados: totalEnviados,
              pendientes: p,
              mensaje: totalEnviados > 0
                  ? 'Se enviaron $totalEnviados registros. No se pudo conectar con el servidor para los restantes.'
                  : 'No se pudo conectar con el servidor.',
              exito: false,
            );
          }

          if (response.statusCode >= 200 && response.statusCode < 300) {
            // Extraer id_servidor de la respuesta si viene disponible
            int? idServidor;
            try {
              final data = jsonDecode(response.body);
              if (data is Map) {
                if (data.containsKey('id') && data['id'] is num) {
                  idServidor = (data['id'] as num).toInt();
                } else {
                  for (final entry in data.entries) {
                    if (entry.key.toLowerCase().contains('id') &&
                        entry.value is num) {
                      idServidor = (entry.value as num).toInt();
                      break;
                    }
                  }
                }
              }
            } catch (_) {}

            // Guardar id_servidor y poner sincronizado = 1
            final updates = <String, Object?>{'sincronizado': 1};
            if (idServidor != null) {
              updates['id_servidor'] = idServidor;
            }
            await repositorio.db.update(
              tabla,
              updates,
              where: 'id_local = ?',
              whereArgs: [idLocal],
            );

            totalEnviados++;
          } else {
            // Si el servidor responde error, detener sin marcar nada más
            final p = await contarPendientes();
            return ResultadoSincronizacion(
              enviados: totalEnviados,
              pendientes: p,
              mensaje: totalEnviados > 0
                  ? 'Se enviaron $totalEnviados registros. El servidor rechazó los datos restantes.'
                  : 'El servidor no pudo procesar la solicitud.',
              exito: false,
            );
          }
        }
      }

      final restantes = await contarPendientes();
      final mensajeFinal = restantes == 0
          ? (totalEnviados > 0
              ? 'Se enviaron $totalEnviados registros. Todo sincronizado.'
              : 'Todo sincronizado.')
          : 'Se enviaron $totalEnviados registros. Quedan $restantes pendientes.';

      return ResultadoSincronizacion(
        enviados: totalEnviados,
        pendientes: restantes,
        mensaje: mensajeFinal,
        exito: restantes == 0,
      );
    } finally {
      _sincronizando = false;
    }
  }
}
