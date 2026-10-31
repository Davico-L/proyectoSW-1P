import 'dart:convert';
import 'package:mobile_template/esquema/esquema.dart';

class _EjemploPrompt {
  final String frase;
  final Map<String, dynamic> json;

  _EjemploPrompt(this.frase, this.json);

  String render() => '$frase\n${jsonEncode(json)}';
}

/// Construye dinámicamente el prompt de sistema para el LLM a partir de un [Esquema].
///
/// Cumple con las siguientes reglas:
/// 1. Encabezado genérico ("intérprete de una app de gestión").
/// 2. Lista las clases y campos según `paraValidador()`, marcando el campo numérico.
/// 3. Reglas de fidelidad ("pon solo lo que el usuario dijo", "nunca inventes datos...").
/// 4. Ejemplos automáticos con datos neutros (crear completo, crear sin número, consultas).
/// 5. Máximo 4 clases (padres antes que hijos) y máximo 10 ejemplos en total.
/// 6. Regla genérica de monto/cobro para la clase con campo numérico.
String construirPrompt(Esquema esquema) {
  // Regla 5: Usar hasta 4 clases en orden de padres antes que hijos
  final clasesJerarquia = esquema.ordenarClasesPorJerarquia();
  final clases = clasesJerarquia.take(4).toList();
  final pv = esquema.paraValidador();

  final buffer = StringBuffer();

  // Regla 1: Primera línea genérica
  buffer.writeln(
    'Eres el intérprete de una app de gestión. Respondes solo un JSON compacto, sin texto adicional.',
  );

  // Regla 2: Clases con sus campos de paraValidador(), marcando el numérico
  final clasesDesc = <String>[];
  ClaseEsq? claseConNumero;
  ClaseEsq? claseHija;

  for (final c in clases) {
    final camposMap = pv[c.nombre] ?? {};
    final camposTokens = <String>[];

    for (final entry in camposMap.entries) {
      if (entry.value == 'numero') {
        camposTokens.add('${entry.key} numérico');
        claseConNumero ??= c;
      } else {
        camposTokens.add(entry.key);
      }
    }

    if (c.campos.any((f) => f.tipo == 'ref')) {
      claseHija ??= c;
    }

    clasesDesc.add('${c.nombre}(${camposTokens.join(', ')})');
  }

  claseHija ??= claseConNumero ?? (clases.length > 1 ? clases.last : null);

  String textoClases = '';
  if (clasesDesc.length == 1) {
    textoClases = clasesDesc.first;
  } else if (clasesDesc.length == 2) {
    textoClases = '${clasesDesc[0]} y ${clasesDesc[1]}';
  } else {
    textoClases =
        '${clasesDesc.sublist(0, clasesDesc.length - 1).join(', ')} y ${clasesDesc.last}';
  }
  buffer.writeln('Clases: $textoClases.');

  // Regla 6: Regla de monto o cobro si existe clase con campo numérico
  if (claseConNumero != null) {
    buffer.writeln(
      'Si la frase menciona un monto o un cobro, es ${claseConNumero.nombre}.',
    );
  }

  // Regla 3: Fidelidad y no inventar datos
  buffer.writeln(
    'En "f" pon solo lo que el usuario dijo, y escribe el valor con las mismas palabras que usó. Nunca inventes datos ni pongas valores vacíos o ceros.',
  );

  // Regla 3: Consultas con q y p
  final nombresClases = clases.map((c) => c.nombre).join(' o ');
  final reglaSuma = claseConNumero != null
      ? ', y "suma" si pregunta cuánto o total'
      : '';
  buffer.writeln(
    'Para consultar, "c" es $nombresClases según lo que pregunta. "q" es "lista" si pide quiénes, cuáles o qué, "conteo" si pregunta cuántos o cuántas$reglaSuma. "p" es "hoy" solo si dice hoy; si no, "todo".',
  );

  // Regla 4 y 5: Ejemplos neutros (máximo 10)
  buffer.writeln('Ejemplos:');

  final listaEjemplos = <_EjemploPrompt>[];

  // 1. Un crear completo por clase (valores como "ejemplo uno", 10)
  for (final c in clases) {
    final camposMap = pv[c.nombre] ?? {};
    final f = <String, dynamic>{};
    final partesFrase = <String>[];
    int idxTexto = 1;

    for (final entry in camposMap.entries) {
      if (entry.value == 'numero') {
        f[entry.key] = 10;
        partesFrase.add('10');
      } else {
        final valTexto = idxTexto == 1 ? 'ejemplo uno' : 'ejemplo dos';
        f[entry.key] = valTexto;
        partesFrase.add(valTexto);
        idxTexto++;
      }
    }

    final frase = 'Registra ${c.nombre} ${partesFrase.join(', ')}';
    listaEjemplos.add(
      _EjemploPrompt(frase, {
        'a': 'crear',
        'c': c.nombre,
        'f': f,
      }),
    );
  }

  // 2. Un crear sin el campo numérico para la clase hija
  if (claseHija != null && claseConNumero != null) {
    final targetClass =
        claseHija.campos.any((f) => f.tipo == 'numero') ? claseHija : claseConNumero;
    final camposMap = pv[targetClass.nombre] ?? {};
    final fSinNumero = <String, dynamic>{};
    final partesFrase = <String>[];
    int idxTexto = 1;

    for (final entry in camposMap.entries) {
      if (entry.value != 'numero') {
        final valTexto = idxTexto == 1 ? 'ejemplo uno' : 'ejemplo dos';
        fSinNumero[entry.key] = valTexto;
        partesFrase.add(valTexto);
        idxTexto++;
      }
    }

    if (fSinNumero.isNotEmpty) {
      final frase = 'Registra ${targetClass.nombre} ${partesFrase.join(', ')}';
      listaEjemplos.add(
        _EjemploPrompt(frase, {
          'a': 'crear',
          'c': targetClass.nombre,
          'f': fSinNumero,
        }),
      );
    }
  }

  // 3. Consultas: conteo, suma (si existe campo numérico) y lista por clase
  for (final c in clases) {
    if (listaEjemplos.length >= 10) break;

    // Conteo
    listaEjemplos.add(
      _EjemploPrompt('Cuántos ${c.nombre} hoy', {
        'a': 'consultar',
        'c': c.nombre,
        'q': 'conteo',
        'p': 'hoy',
      }),
    );
    if (listaEjemplos.length >= 10) break;

    // Suma (solo si existe campo numérico en esa clase)
    final tieneNumero = (pv[c.nombre] ?? {}).values.any((t) => t == 'numero');
    if (tieneNumero) {
      listaEjemplos.add(
        _EjemploPrompt('Cuánto total de ${c.nombre} hoy', {
          'a': 'consultar',
          'c': c.nombre,
          'q': 'suma',
          'p': 'hoy',
        }),
      );
      if (listaEjemplos.length >= 10) break;
    }

    // Lista
    listaEjemplos.add(
      _EjemploPrompt('Lista de ${c.nombre}', {
        'a': 'consultar',
        'c': c.nombre,
        'q': 'lista',
        'p': 'todo',
      }),
    );
  }

  // Limitar estrictamente a 10 ejemplos
  final ejemplosFinales = listaEjemplos.take(10).toList();
  for (int i = 0; i < ejemplosFinales.length; i++) {
    buffer.write(ejemplosFinales[i].render());
    if (i < ejemplosFinales.length - 1) {
      buffer.write('\n');
    }
  }

  return buffer.toString();
}
