import 'package:mobile_template/esquema/esquema.dart';
import 'package:mobile_template/ia/validador.dart';

/// Formatea un valor primitivo para visualización humana sin decimales sobrantes.
String _formatearValor(dynamic v) {
  if (v == null) return '';
  if (v is double) {
    if (v == v.roundToDouble()) {
      return v.toInt().toString();
    }
  }
  return v.toString().trim();
}

/// Genera una frase legible en español para la acción de registrar un nuevo elemento.
///
/// Ejemplo: "Registrar Atencion: cliente Juan, servicio corte de barba, monto 10"
/// Utiliza únicamente los campos presentes en el esquema de la clase que tengan valor,
/// respetando el orden definido en el esquema.
String resumenCrear(Resultado resultado, Esquema esquema) {
  final nombreClase = resultado.clase ?? '';
  ClaseEsq? claseEsq;
  for (final c in esquema.clases) {
    if (c.nombre.toLowerCase() == nombreClase.toLowerCase()) {
      claseEsq = c;
      break;
    }
  }

  final partes = <String>[];
  if (claseEsq != null) {
    for (final campo in claseEsq.campos) {
      if (resultado.campos.containsKey(campo.nombre)) {
        final val = resultado.campos[campo.nombre];
        if (val != null) {
          final str = _formatearValor(val);
          if (str.isNotEmpty) {
            partes.add('${campo.nombre} $str');
          }
        }
      }
    }
  } else {
    for (final entry in resultado.campos.entries) {
      if (entry.value != null) {
        final str = _formatearValor(entry.value);
        if (str.isNotEmpty) {
          partes.add('${entry.key} $str');
        }
      }
    }
  }

  if (partes.isEmpty) {
    return 'Registrar $nombreClase';
  }
  return 'Registrar $nombreClase: ${partes.join(', ')}';
}

/// Genera una respuesta legible en español para una consulta (conteo, suma o lista).
///
/// - conteo: "Tienes N registros de {clase} hoy" (o "en total")
/// - suma: "El total de {primerCampoNumero} es X hoy" (o "en total")
/// - lista: una línea por registro usando sus campos con valor, o "No hay registros" si está vacía.
///
/// No utiliza palabras técnicas (clase, tabla, JSON).
String respuestaConsulta(
  String q,
  String p,
  String clase,
  dynamic datos, [
  Esquema? esquema,
]) {
  final modoQ = q.toLowerCase();
  final periodo = p.toLowerCase() == 'hoy' ? 'hoy' : 'en total';

  if (modoQ == 'conteo') {
    int n = 0;
    if (datos is num) {
      n = datos.toInt();
    } else if (datos is List) {
      n = datos.length;
    } else if (datos != null) {
      n = int.tryParse(datos.toString()) ?? 0;
    }
    return 'Tienes $n registros de $clase $periodo';
  }

  if (modoQ == 'suma') {
    num total = 0;
    if (datos is num) {
      total = datos;
    } else if (datos != null) {
      total = num.tryParse(datos.toString()) ?? 0;
    }

    String campoNumero = 'monto';
    if (esquema != null) {
      for (final c in esquema.clases) {
        if (c.nombre.toLowerCase() == clase.toLowerCase()) {
          for (final f in c.campos) {
            if (f.tipo == 'numero') {
              campoNumero = f.nombre;
              break;
            }
          }
          break;
        }
      }
    }

    final totalStr = _formatearValor(total);
    return 'El total de $campoNumero es $totalStr $periodo';
  }

  if (modoQ == 'lista') {
    if (datos == null || (datos is List && datos.isEmpty)) {
      return 'No hay registros';
    }

    if (datos is List) {
      final lineas = <String>[];
      ClaseEsq? claseEsq;
      if (esquema != null) {
        for (final c in esquema.clases) {
          if (c.nombre.toLowerCase() == clase.toLowerCase()) {
            claseEsq = c;
            break;
          }
        }
      }

      for (final fila in datos) {
        if (fila is! Map) continue;
        final partes = <String>[];

        if (claseEsq != null) {
          for (final campo in claseEsq.campos) {
            if (fila.containsKey(campo.nombre)) {
              final val = fila[campo.nombre];
              if (val != null) {
                final str = _formatearValor(val);
                if (str.isNotEmpty) {
                  partes.add('${campo.nombre} $str');
                }
              }
            }
          }
        } else {
          for (final entry in fila.entries) {
            final k = entry.key.toString();
            if (k == 'id_local' ||
                k == 'id_servidor' ||
                k == 'creado_en' ||
                k == 'sincronizado') {
              continue;
            }
            if (entry.value != null &&
                entry.value.toString().trim().isNotEmpty) {
              partes.add('$k ${_formatearValor(entry.value)}');
            }
          }
        }

        if (partes.isNotEmpty) {
          lineas.add(partes.join(', '));
        }
      }

      if (lineas.isEmpty) {
        return 'No hay registros';
      }
      return lineas.join('\n');
    }
  }

  return 'No hay registros';
}
