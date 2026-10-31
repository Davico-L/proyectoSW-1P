// Validador en Dart puro (sin dependencias de Flutter ni plugins).

class Resultado {
  final String? accion;
  final String? clase;
  final Map<String, dynamic> campos;
  final List<String> faltantes;
  final List<String> descartados;
  final String? q;
  final String? p;
  final String? error;

  Resultado({
    this.accion,
    this.clase,
    this.campos = const {},
    this.faltantes = const [],
    this.descartados = const [],
    this.q,
    this.p,
    this.error,
  });

  factory Resultado.conError(String error) {
    return Resultado(
      campos: const {},
      faltantes: const [],
      descartados: const [],
      error: error,
    );
  }

  bool get esValido => error == null;
  bool get tieneError => error != null;

  @override
  String toString() {
    if (tieneError) return 'Resultado(error: $error)';
    return 'Resultado(accion: $accion, clase: $clase, campos: $campos, faltantes: $faltantes, descartados: $descartados, q: $q, p: $p)';
  }
}

String normalizar(String texto) {
  var s = texto.toLowerCase();
  const Map<String, String> acentos = {
    'á': 'a',
    'é': 'e',
    'í': 'i',
    'ó': 'o',
    'ú': 'u',
    'ü': 'u',
    'ñ': 'n',
    'Á': 'a',
    'É': 'e',
    'Í': 'i',
    'Ó': 'o',
    'Ú': 'u',
    'Ü': 'u',
    'Ñ': 'n',
  };
  acentos.forEach((k, v) {
    s = s.replaceAll(k, v);
  });
  return s;
}

const Set<String> _palabrasIgnoradas = {
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'un',
  'una',
  'y',
  'a',
  'en',
  'con',
  'para',
};

bool contieneTexto(String fraseNorm, String valor) {
  final vNorm = normalizar(valor).trim();
  if (vNorm.isEmpty) return false;

  // 1. Subcadena directa
  if (fraseNorm.contains(vNorm)) return true;

  // Limpiar puntuación periférica del valor por si viene con comas o puntos
  final vClean = vNorm.replaceAll(RegExp(r'^[^a-z0-9]+|[^a-z0-9]+$'), '');
  if (vClean.isNotEmpty && fraseNorm.contains(vClean)) return true;

  // 2. Coincidencia de texto por palabras:
  // Cada palabra significativa del valor debe tener en la frase alguna palabra
  // que comparta con ella sus primeros 4 caracteres (o la palabra completa si mide menos de 4).
  final palabrasFrase = fraseNorm
      .split(RegExp(r'[^a-z0-9]+'))
      .where((w) => w.isNotEmpty)
      .toList();

  final baseValor = vClean.isNotEmpty ? vClean : vNorm;
  final palabrasValor = baseValor
      .split(RegExp(r'[^a-z0-9]+'))
      .where((w) => w.isNotEmpty)
      .toList();

  final palabrasSignificativas = palabrasValor
      .where((w) => !_palabrasIgnoradas.contains(w))
      .toList();

  if (palabrasSignificativas.isEmpty) {
    return false;
  }

  for (final wVal in palabrasSignificativas) {
    final prefixLen = wVal.length < 4 ? wVal.length : 4;
    final prefix = wVal.substring(0, prefixLen);

    final tieneMatch = palabrasFrase.any((wFrase) {
      if (wFrase.length < prefixLen) return false;
      return wFrase.substring(0, prefixLen) == prefix;
    });

    if (!tieneMatch) {
      return false;
    }
  }

  return true;
}

bool contieneNumero(String frase, dynamic valor) {
  num? target;
  if (valor is num) {
    target = valor;
  } else if (valor is String) {
    final vNorm = valor.trim().replaceAll(',', '.');
    target = num.tryParse(vNorm);
  }
  if (target == null) return false;

  final regex = RegExp(r'\b\d+(?:[.,]\d+)?\b');
  final matches = regex.allMatches(frase);
  for (final m in matches) {
    final token = m.group(0)!.replaceAll(',', '.');
    final n = num.tryParse(token);
    if (n != null && (n - target).abs() < 0.0001) {
      return true;
    }
  }
  return false;
}

const Set<String> _tiposNumericos = {
  'int',
  'double',
  'num',
  'number',
  'numeric',
  'float',
  'numero',
};

String _raiz5(String s) {
  final n = normalizar(s).trim();
  return n.length >= 5 ? n.substring(0, 5) : n;
}

Set<String> obtenerRaicesDominio(Map<String, Map<String, String>> esquema) {
  final raices = <String>{
    'atend',
    'cobr',
    'gan',
    'ingres',
    'total',
    'pag',
    'diner',
    'plata',
    'entr',
    'regist',
    'agreg',
    'anot',
    'guard',
    'inscrib',
    'anad',
    'añad',
  };

  for (final entry in esquema.entries) {
    final rClase = _raiz5(entry.key);
    if (rClase.isNotEmpty) raices.add(rClase);
    for (final campo in entry.value.keys) {
      final rCampo = _raiz5(campo);
      if (rCampo.isNotEmpty) raices.add(rCampo);
    }
  }

  return raices;
}

num? extraerNumeroMoneda(String frase) {
  // Orden 1: número seguido de moneda (ej: "10 bolivianos", "10,5 bs", "10bs")
  final regex1 = RegExp(
    r'(?<![a-zA-Z])(\d+(?:[.,]\d+)?)\s*(?:bolivianos|boliviano|bs)(?![a-zA-Z])',
    caseSensitive: false,
  );
  final match1 = regex1.firstMatch(frase);
  if (match1 != null) {
    final token = match1.group(1)!.replaceAll(',', '.');
    final parsed = num.tryParse(token);
    if (parsed != null) {
      return parsed.toInt() == parsed ? parsed.toInt() : parsed;
    }
  }

  // Orden 2: moneda seguida de número (ej: "bs 10", "bs. 10", "bolivianos 10,5")
  final regex2 = RegExp(
    r'(?<![a-zA-Z])(?:bolivianos|boliviano|bs)\.?\s*(\d+(?:[.,]\d+)?)(?![a-zA-Z])',
    caseSensitive: false,
  );
  final match2 = regex2.firstMatch(frase);
  if (match2 != null) {
    final token = match2.group(1)!.replaceAll(',', '.');
    final parsed = num.tryParse(token);
    if (parsed != null) {
      return parsed.toInt() == parsed ? parsed.toInt() : parsed;
    }
  }

  return null;
}

bool mencionaMoneda(String fraseNorm) {
  final regex = RegExp(r'(?:^|[^a-z0-9])(bolivianos|boliviano|bs)(?:[^a-z0-9]|$)');
  return regex.hasMatch(fraseNorm);
}

String? buscarClaseMonetariaUnica(Map<String, Map<String, String>> esquema) {
  const camposMoneda = {'monto', 'precio', 'total', 'costo'};

  final candidatas = <String>[];
  for (final entry in esquema.entries) {
    final campos = entry.value;
    final tieneCampo = campos.entries.any((c) {
      final nom = normalizar(c.key);
      final tipo = normalizar(c.value);
      return camposMoneda.contains(nom) && _tiposNumericos.contains(tipo);
    });
    if (tieneCampo) {
      candidatas.add(entry.key);
    }
  }
  if (candidatas.length == 1) {
    return candidatas.first;
  }
  return null;
}

bool _contieneTelefonoEnFrase(String fraseNorm, String valStr) {
  final fDigits = fraseNorm.replaceAll(RegExp(r'[\s\-]'), '');
  final vDigits = valStr.replaceAll(RegExp(r'[\s\-]'), '');
  return vDigits.isNotEmpty && fDigits.contains(vDigits);
}

Resultado validar(
  String frase,
  Map<String, dynamic> salidaModelo,
  Map<String, Map<String, String>> esquema,
) {
  final fraseNorm = normalizar(frase);

  // Extraer accion y clase admitiendo claves extendidas ("accion", "clase") o compactas ("a", "c")
  final rawAccion = (salidaModelo['accion'] ?? salidaModelo['a'])?.toString().trim();
  final rawClase = (salidaModelo['clase'] ?? salidaModelo['c'])?.toString().trim();

  if (rawAccion == null || rawAccion.isEmpty) {
    return Resultado.conError('Acción no especificada');
  }

  final accionNorm = normalizar(rawAccion);
  if (accionNorm != 'crear' && accionNorm != 'consultar') {
    return Resultado.conError('Acción inválida: $rawAccion');
  }

  // (3) si la frase menciona "bolivianos", "bs" o "boliviano" y hay una única clase del esquema
  // con un campo numérico llamado monto, precio, total o costo, la clase pasa a ser esa,
  // aunque el modelo haya dicho otra;
  String? claseTarget;
  final claseMoneda = mencionaMoneda(fraseNorm) ? buscarClaseMonetariaUnica(esquema) : null;

  if (claseMoneda != null) {
    claseTarget = claseMoneda;
  } else {
    if (rawClase == null || rawClase.isEmpty) {
      return Resultado.conError('Clase no especificada');
    }
    for (final k in esquema.keys) {
      if (normalizar(k) == normalizar(rawClase)) {
        claseTarget = k;
        break;
      }
    }
    if (claseTarget == null) {
      return Resultado.conError('Clase no existe en el esquema: $rawClase');
    }
  }

  // Regla (2) Clase en consultas: si la acción es consultar y la frase contiene la raíz
  // de una clase del esquema y no contiene la raíz de ninguna otra clase ni las raíces
  // atend, cobr, gan, ingres, bolivianos, bs, la clase pasa a ser esa; si la frase contiene
  // raíces de dos o más clases, o ninguna, se respeta la del modelo.
  if (accionNorm == 'consultar') {
    final clasesPresentes = esquema.keys.where((k) => fraseNorm.contains(_raiz5(k))).toList();
    const raicesExcluidas = {'atend', 'cobr', 'gan', 'ingres', 'bolivianos', 'bs'};
    final tieneExcluida = raicesExcluidas.any((r) => fraseNorm.contains(r));

    if (clasesPresentes.length == 1 && !tieneExcluida) {
      claseTarget = clasesPresentes.first;
    }
  }

  // Campos de entrada admitiendo "campos" o "f"
  final camposRaw = salidaModelo['campos'] ?? salidaModelo['f'];
  final Map<String, dynamic> camposEntrada = {};
  if (camposRaw is Map) {
    camposRaw.forEach((k, v) {
      if (k != null) {
        camposEntrada[k.toString()] = v;
      }
    });
  }

  // Mapeo de alias semánticos si se reclasificó (ej: nombre <-> cliente)
  final camposEsquema = esquema[claseTarget]!;
  if (camposEsquema.containsKey('cliente') && !camposEsquema.containsKey('nombre')) {
    if (!camposEntrada.containsKey('cliente') && camposEntrada.containsKey('nombre')) {
      camposEntrada['cliente'] = camposEntrada.remove('nombre');
    }
  } else if (camposEsquema.containsKey('nombre') && !camposEsquema.containsKey('cliente')) {
    if (!camposEntrada.containsKey('nombre') && camposEntrada.containsKey('cliente')) {
      camposEntrada['nombre'] = camposEntrada.remove('cliente');
    }
  }

  final Map<String, dynamic> camposValidados = {};
  final List<String> descartados = [];

  // (1) si algún campo de salidaModelo no existe en esa clase del esquema, se descarta;
  // (2) un campo de texto se conserva solo si su valor normalizado aparece dentro de la frase normalizada;
  //     un campo numérico solo si ese número aparece como número en la frase;
  //     si no, se descarta y se anota en descartados;
  for (final entry in camposEntrada.entries) {
    final key = entry.key;
    final val = entry.value;

    String? keyEsquema;
    for (final k in camposEsquema.keys) {
      if (normalizar(k) == normalizar(key)) {
        keyEsquema = k;
        break;
      }
    }

    if (keyEsquema == null) {
      descartados.add(key);
      continue;
    }

    if (val == null) {
      descartados.add(key);
      continue;
    }

    final valStr = val.toString();
    final valNorm = normalizar(valStr).trim();

    // Regla (4): Un valor de texto igual a la frase completa normalizada se descarta
    // y se anota en descartados, para cualquier campo.
    if (valNorm.isNotEmpty && valNorm == fraseNorm.trim()) {
      descartados.add(key);
      continue;
    }

    final tipo = normalizar(camposEsquema[keyEsquema]!);

    if (_tiposNumericos.contains(tipo)) {
      if (contieneNumero(fraseNorm, val)) {
        final num? n = (val is num)
            ? val
            : num.tryParse(val.toString().trim().replaceAll(',', '.'));
        camposValidados[keyEsquema] = n ?? val;
      } else {
        descartados.add(key);
      }
    } else {
      final keyNorm = normalizar(keyEsquema);
      final esTelefono = keyNorm.contains('tel') || keyNorm.contains('cel');

      // Regla (3): Campos de teléfono: en cualquier campo de texto cuyo nombre contenga "tel" o "cel",
      // el valor solo se conserva si tiene al menos 7 dígitos (ignorando espacios y guiones);
      // si no, se descarta y se anota en descartados.
      if (esTelefono) {
        final soloDigitos = valStr.replaceAll(RegExp(r'[\s\-]'), '');
        final numDigitos = RegExp(r'\d').allMatches(soloDigitos).length;
        if (numDigitos < 7) {
          descartados.add(key);
          continue;
        }
      }

      if (contieneTexto(fraseNorm, valStr) ||
          (esTelefono && _contieneTelefonoEnFrase(fraseNorm, valStr))) {
        camposValidados[keyEsquema] = val;
      } else {
        descartados.add(key);
      }
    }
  }

  // Regla (4): Si la acción es crear, la clase final es la que tiene un campo numérico
  // de monto, precio, total o costo, ese campo no quedó con valor y la frase tiene un
  // número pegado a bolivianos, boliviano o bs (en cualquiera de los dos órdenes,
  // aceptando coma decimal), toma ese número como valor del campo.
  if (accionNorm == 'crear') {
    const camposMoneda = {'monto', 'precio', 'total', 'costo'};
    String? campoMoneda;
    for (final entry in camposEsquema.entries) {
      final nom = normalizar(entry.key);
      final tipo = normalizar(entry.value);
      if (camposMoneda.contains(nom) && _tiposNumericos.contains(tipo)) {
        campoMoneda = entry.key;
        break;
      }
    }

    if (campoMoneda != null && (!camposValidados.containsKey(campoMoneda) || camposValidados[campoMoneda] == null)) {
      final numRecuperado = extraerNumeroMoneda(frase);
      if (numRecuperado != null) {
        camposValidados[campoMoneda] = numRecuperado;
        descartados.remove(campoMoneda);
      }
    }
  }

  // Regla (1) Dominio: si la frase normalizada no contiene ninguna de las raíces de dominio,
  // devuelve error "no entendí" para consultar.
  // Regla (2): En crear, si la frase normalizada no contiene ninguna raíz de dominio
  // (ni de clases, ni de campos, ni fijas), el crear solo se acepta si quedó validado
  // el primer campo del esquema de la clase final; si no, devuelve error "no entendí".
  // Esta regla va antes de la de "ningún campo con valor".
  final raicesDominio = obtenerRaicesDominio(esquema);
  final tieneRaizDominio = raicesDominio.any((r) => fraseNorm.contains(r));
  if (!tieneRaizDominio) {
    if (accionNorm == 'consultar') {
      return Resultado.conError('no entendí');
    }
    if (accionNorm == 'crear') {
      final primerCampo = camposEsquema.keys.first;
      final primerCampoValidado =
          camposValidados.containsKey(primerCampo) && camposValidados[primerCampo] != null;
      if (!primerCampoValidado) {
        return Resultado.conError('no entendí');
      }
    }
  }

  // Además: si al crear no queda ningún campo con valor tras validar, devuelve error.
  if (accionNorm == 'crear' && camposValidados.isEmpty) {
    return Resultado.conError('No se pudo validar ningún campo para crear');
  }

  // (4) para crear, todo campo del esquema que no quedó con valor va a faltantes;
  final List<String> faltantes = [];
  if (accionNorm == 'crear') {
    for (final k in camposEsquema.keys) {
      if (!camposValidados.containsKey(k)) {
        faltantes.add(k);
      }
    }
  }

  // (5) para consultar, q solo puede ser lista, conteo o suma, y p solo hoy o todo, con estos reemplazos por la frase:
  // conteo solo si contiene "cuantos", "cuantas", "cantidad" o "numero de";
  // suma solo si contiene "cuanto", la palabra completa "cuanta" (sin activar con "cuantas"),
  // "plata" o "dinero" junto con "cuanto"/"cuanta", "total" o "suma";
  // en cualquier otro caso q=lista;
  // p=hoy solo si contiene "hoy", si no p=todo.
  String? q;
  String? p;
  if (accionNorm == 'consultar') {
    final tieneCuanta = RegExp(r'\bcuanta\b').hasMatch(fraseNorm);
    final tieneDineroOPlata = fraseNorm.contains('plata') || fraseNorm.contains('dinero');
    final tieneCuanto = fraseNorm.contains('cuanto');

    if (fraseNorm.contains('cuantos') ||
        fraseNorm.contains('cuantas') ||
        fraseNorm.contains('cantidad') ||
        fraseNorm.contains('numero de')) {
      q = 'conteo';
    } else if (tieneCuanto ||
        tieneCuanta ||
        (tieneDineroOPlata && (tieneCuanto || tieneCuanta)) ||
        fraseNorm.contains('total') ||
        fraseNorm.contains('suma')) {
      q = 'suma';
    } else {
      q = 'lista';
    }

    if (fraseNorm.contains('hoy')) {
      p = 'hoy';
    } else {
      p = 'todo';
    }

    // Regla (3): Si q es suma y la clase final no tiene ningún campo numérico, q pasa a conteo.
    if (q == 'suma') {
      final camposClase = esquema[claseTarget]!;
      final tieneCampoNumerico = camposClase.values.any(
        (t) => _tiposNumericos.contains(normalizar(t)),
      );
      if (!tieneCampoNumerico) {
        q = 'conteo';
      }
    }
  }

  return Resultado(
    accion: accionNorm,
    clase: claseTarget,
    campos: camposValidados,
    faltantes: faltantes,
    descartados: descartados,
    q: q,
    p: p,
  );
}
