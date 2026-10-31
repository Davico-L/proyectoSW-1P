/// Representación de un campo en el esquema de una clase.
class CampoEsq {
  final String nombre;
  final String tipo;
  final String? destino;

  CampoEsq({
    required this.nombre,
    required this.tipo,
    this.destino,
  });

  static const Set<String> tiposValidos = {'texto', 'numero', 'ref', 'otro'};

  factory CampoEsq.desdeJson(Map<String, dynamic> json) {
    final nombreRaw = json['nombre'];
    if (nombreRaw == null || nombreRaw is! String || nombreRaw.trim().isEmpty) {
      throw const FormatException('El campo debe tener un "nombre" válido no vacío');
    }

    final tipoRaw = json['tipo'];
    if (tipoRaw == null || tipoRaw is! String || tipoRaw.trim().isEmpty) {
      throw FormatException('El campo "$nombreRaw" debe tener un "tipo" válido');
    }

    final tipo = tipoRaw.trim();
    if (!tiposValidos.contains(tipo)) {
      throw FormatException(
        'Tipo no permitido "$tipo" en el campo "$nombreRaw". Tipos permitidos: texto, numero, ref, otro',
      );
    }

    String? destino;
    if (tipo == 'ref') {
      final destinoRaw = json['destino'];
      if (destinoRaw == null || destinoRaw is! String || destinoRaw.trim().isEmpty) {
        throw FormatException('El campo ref "$nombreRaw" debe tener un "destino" válido no vacío');
      }
      destino = destinoRaw.trim();
    }

    return CampoEsq(
      nombre: nombreRaw.trim(),
      tipo: tipo,
      destino: destino,
    );
  }
}

/// Representación de una clase en el esquema.
class ClaseEsq {
  final String nombre;
  final List<CampoEsq> campos;

  ClaseEsq({
    required this.nombre,
    required this.campos,
  });

  String get nombreTabla => Esquema.sanitizarNombreTabla(nombre);

  factory ClaseEsq.desdeJson(Map<String, dynamic> json) {
    final nombreRaw = json['nombre'];
    if (nombreRaw == null || nombreRaw is! String || nombreRaw.trim().isEmpty) {
      throw const FormatException('La clase debe tener un "nombre" válido no vacío');
    }

    final camposRaw = json['campos'];
    if (camposRaw == null || camposRaw is! List) {
      throw FormatException('La clase "$nombreRaw" debe contener una lista "campos"');
    }

    final campos = <CampoEsq>[];
    for (int i = 0; i < camposRaw.length; i++) {
      final item = camposRaw[i];
      if (item == null || item is! Map) {
        throw FormatException(
          'El campo en la posición $i de la clase "$nombreRaw" debe ser un mapa JSON válido',
        );
      }
      campos.add(CampoEsq.desdeJson(Map<String, dynamic>.from(item)));
    }

    return ClaseEsq(
      nombre: nombreRaw.trim(),
      campos: campos,
    );
  }
}

/// Esquema completo de la aplicación.
class Esquema {
  final List<ClaseEsq> clases;

  Esquema({required this.clases});

  factory Esquema.desdeJson(Map<String, dynamic> json) {
    final clasesRaw = json['clases'];
    if (clasesRaw == null || clasesRaw is! List) {
      throw const FormatException('El esquema debe contener una lista "clases"');
    }

    final clases = <ClaseEsq>[];
    for (int i = 0; i < clasesRaw.length; i++) {
      final item = clasesRaw[i];
      if (item == null || item is! Map) {
        throw FormatException('El elemento $i de "clases" debe ser un mapa JSON válido');
      }
      clases.add(ClaseEsq.desdeJson(Map<String, dynamic>.from(item)));
    }

    return Esquema(clases: clases);
  }

  /// Sanitiza el nombre de la clase a minúsculas, sin acentos y con espacios a guion bajo.
  static String sanitizarNombreTabla(String texto) {
    var res = texto.trim().toLowerCase();
    const conAcento = 'áàäâãéèëêíìïîóòöôõúùüûñ';
    const sinAcento = 'aaaaaeeeeiiiiooooouuuun';
    for (int i = 0; i < conAcento.length; i++) {
      res = res.replaceAll(conAcento[i], sinAcento[i]);
    }
    res = res.replaceAll(RegExp(r'\s+'), '_');
    return res;
  }

  /// (1) nombreTabla(clase): minúsculas, sin acentos, espacios a guion bajo.
  /// Acepta ClaseEsq o String.
  String nombreTabla(dynamic clase) {
    if (clase is ClaseEsq) {
      return sanitizarNombreTabla(clase.nombre);
    } else if (clase is String) {
      return sanitizarNombreTabla(clase);
    } else {
      throw ArgumentError('Se esperaba una instancia de ClaseEsq o String');
    }
  }

  /// Ordena las clases en orden de padres antes que hijos.
  /// Una clase B es padre de A si A tiene un campo ref hacia B.
  /// Si hay ciclo, devuelve el orden de aparición original.
  List<ClaseEsq> ordenarClasesPorJerarquia() {
    final Map<String, ClaseEsq> classMap = {
      for (final c in clases) c.nombre: c,
    };

    final Map<String, Set<String>> dependencias = {};
    for (final c in clases) {
      final deps = <String>{};
      for (final campo in c.campos) {
        if (campo.tipo == 'ref' && campo.destino != null) {
          final destino = campo.destino!;
          if (destino != c.nombre && classMap.containsKey(destino)) {
            deps.add(destino);
          }
        }
      }
      dependencias[c.nombre] = deps;
    }

    final List<ClaseEsq> resultado = [];
    final Set<String> resueltos = {};
    final List<ClaseEsq> pendientes = List.of(clases);

    bool huboAvance = true;
    while (pendientes.isNotEmpty && huboAvance) {
      huboAvance = false;
      for (int i = 0; i < pendientes.length; i++) {
        final c = pendientes[i];
        final deps = dependencias[c.nombre]!;
        if (deps.every((d) => resueltos.contains(d))) {
          resultado.add(c);
          resueltos.add(c.nombre);
          pendientes.removeAt(i);
          huboAvance = true;
          break;
        }
      }
    }

    if (pendientes.isNotEmpty) {
      return List.unmodifiable(clases);
    }

    return resultado;
  }

  static String _columnaSql(CampoEsq campo) {
    switch (campo.tipo) {
      case 'ref':
        return '${campo.nombre}_id INTEGER';
      case 'numero':
        return '${campo.nombre} REAL';
      case 'texto':
      case 'otro':
      default:
        return '${campo.nombre} TEXT';
    }
  }

  /// (2) sentenciasCrearTablas(): lista de CREATE TABLE IF NOT EXISTS, una por clase,
  /// en orden de padres antes que hijos (una clase es padre de otra si esta tiene
  /// un campo ref hacia ella; sin ciclos infinitos: si hay ciclo, devuelve el orden de aparición).
  /// Columnas fijas: id_local INTEGER PRIMARY KEY AUTOINCREMENT, id_servidor INTEGER,
  /// creado_en TEXT NOT NULL, sincronizado INTEGER NOT NULL DEFAULT 0.
  /// Luego una columna por campo: texto y otro como TEXT, numero como REAL, ref como INTEGER con nombre {campo}_id.
  List<String> sentenciasCrearTablas() {
    final clasesOrdenadas = ordenarClasesPorJerarquia();
    final sentencias = <String>[];

    for (final c in clasesOrdenadas) {
      final tabla = nombreTabla(c);
      final columnas = <String>[
        'id_local INTEGER PRIMARY KEY AUTOINCREMENT',
        'id_servidor INTEGER',
        'creado_en TEXT NOT NULL',
        'sincronizado INTEGER NOT NULL DEFAULT 0',
      ];

      for (final campo in c.campos) {
        columnas.add(_columnaSql(campo));
      }

      sentencias.add('CREATE TABLE IF NOT EXISTS $tabla (${columnas.join(', ')})');
    }

    return sentencias;
  }

  /// (3) paraValidador(): devuelve `Map<String, Map<String, String>>` con clase -> {campo: 'texto' o 'numero'},
  /// donde los campos ref aparecen con su nombre y tipo 'texto' y van PRIMERO, los campos de tipo otro se omiten.
  Map<String, Map<String, String>> paraValidador() {
    final resultado = <String, Map<String, String>>{};

    for (final clase in clases) {
      final camposValidador = <String, String>{};

      // 1. Campos ref van PRIMERO, con su nombre y tipo 'texto'
      for (final campo in clase.campos) {
        if (campo.tipo == 'ref') {
          camposValidador[campo.nombre] = 'texto';
        }
      }

      // 2. Luego los campos texto y numero; los de tipo otro se omiten
      for (final campo in clase.campos) {
        if (campo.tipo == 'texto') {
          camposValidador[campo.nombre] = 'texto';
        } else if (campo.tipo == 'numero') {
          camposValidador[campo.nombre] = 'numero';
        }
      }

      resultado[clase.nombre] = camposValidador;
    }

    return resultado;
  }
}
