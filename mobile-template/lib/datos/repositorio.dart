import 'dart:io';
import 'package:sqflite/sqflite.dart';
import 'package:mobile_template/esquema/esquema.dart';

class Repositorio {
  final Esquema esquema;
  final Database db;

  Repositorio(this.esquema, this.db);

  /// Calcula una firma unívoca del esquema uniendo las sentencias DDL generadas.
  static String calcularFirma(Esquema esquema) {
    return esquema.sentenciasCrearTablas().join('\n');
  }

  /// (1) abrir(Esquema): abre o crea la base "app.db" con getDatabasesPath() de sqflite.
  /// Calcula la firma del esquema y la guarda en "esquema_firma.txt" junto a la base.
  /// Si la firma guardada es distinta de la actual (o si no había firma pero sí existía la base),
  /// mueve "app.db" a `app_anterior_<fecha y hora>.db` en la misma carpeta sin borrarla,
  /// crea una base nueva con las tablas del esquema y guarda la firma nueva.
  static Future<Repositorio> abrir(
    Esquema esquema, {
    String? directorioBases,
    Future<Database> Function(String path, {OnDatabaseCreateFn? onCreate})? abrirDbFn,
  }) async {
    final databasesPath = directorioBases ?? await getDatabasesPath();
    Directory(databasesPath).createSync(recursive: true);

    final path = '$databasesPath/app.db';
    final archivoDb = File(path);
    final archivoFirma = File('$databasesPath/esquema_firma.txt');

    final firmaActual = calcularFirma(esquema);
    final dbExiste = archivoDb.existsSync();
    final firmaExiste = archivoFirma.existsSync();

    bool rotarBase = false;

    if (dbExiste) {
      if (!firmaExiste) {
        // Si no existía firma pero sí base, trátalo como firma distinta
        rotarBase = true;
      } else {
        final firmaGuardada = archivoFirma.readAsStringSync().trim();
        if (firmaGuardada != firmaActual.trim()) {
          rotarBase = true;
        }
      }
    }

    if (rotarBase) {
      // Mueve app.db a app_anterior_<fecha y hora>.db en la misma carpeta (sin borrarla)
      final ahora = DateTime.now();
      final stamp = '${ahora.year.toString().padLeft(4, '0')}-'
          '${ahora.month.toString().padLeft(2, '0')}-'
          '${ahora.day.toString().padLeft(2, '0')}_'
          '${ahora.hour.toString().padLeft(2, '0')}-'
          '${ahora.minute.toString().padLeft(2, '0')}-'
          '${ahora.second.toString().padLeft(2, '0')}';
      var backupPath = '$databasesPath/app_anterior_$stamp.db';
      var counter = 1;
      while (File(backupPath).existsSync()) {
        backupPath = '$databasesPath/app_anterior_${stamp}_$counter.db';
        counter++;
      }

      try {
        archivoDb.renameSync(backupPath);
      } catch (_) {
        archivoDb.copySync(backupPath);
        archivoDb.deleteSync();
      }

      // Mover archivos auxiliares de SQLite si existen (-wal, -shm, -journal)
      for (final ext in ['-wal', '-shm', '-journal']) {
        final aux = File('$path$ext');
        if (aux.existsSync()) {
          try {
            aux.renameSync('$backupPath$ext');
          } catch (_) {
            aux.copySync('$backupPath$ext');
            aux.deleteSync();
          }
        }
      }
    }

    final Database db;
    if (abrirDbFn != null) {
      db = await abrirDbFn(
        path,
        onCreate: (Database db, int version) async {
          for (final sentencia in esquema.sentenciasCrearTablas()) {
            await db.execute(sentencia);
          }
        },
      );
    } else {
      db = await openDatabase(
        path,
        version: 1,
        onCreate: (Database db, int version) async {
          for (final sentencia in esquema.sentenciasCrearTablas()) {
            await db.execute(sentencia);
          }
        },
      );
    }

    // Ejecuta las sentencias para asegurar que las tablas existan siempre
    for (final sentencia in esquema.sentenciasCrearTablas()) {
      await db.execute(sentencia);
    }

    // Guarda la firma nueva en el archivo de texto junto a la base
    archivoFirma.writeAsStringSync(firmaActual);

    return Repositorio(esquema, db);
  }

  static String _normalizarTexto(String texto) {
    var res = texto.trim().toLowerCase();
    const conAcento = 'áàäâãéèëêíìïîóòöôõúùüûñ';
    const sinAcento = 'aaaaaeeeeiiiiooooouuuun';
    for (int i = 0; i < conAcento.length; i++) {
      res = res.replaceAll(conAcento[i], sinAcento[i]);
    }
    res = res.replaceAll(RegExp(r'\s+'), ' ');
    return res;
  }

  ClaseEsq _buscarClase(String nombreClase) {
    return esquema.clases.firstWhere(
      (c) => c.nombre.toLowerCase() == nombreClase.toLowerCase(),
      orElse: () => throw ArgumentError('Clase "$nombreClase" no encontrada en el esquema'),
    );
  }

  /// (2) insertar(String clase, `Map<String, dynamic>` campos): devuelve id_local.
  /// Pone creado_en con DateTime.now().toIso8601String() (hora local, sin Z), sincronizado 0.
  /// Para cada campo ref, el valor recibido es un nombre de texto: busca en la tabla destino
  /// un registro cuyo primer campo de texto coincida sin importar mayúsculas ni acentos;
  /// si existe lo reutiliza, si no crea uno nuevo con ese nombre; guarda su id_local en la columna {campo}_id.
  Future<int> insertar(String nombreClase, Map<String, dynamic> campos) async {
    final clase = _buscarClase(nombreClase);
    final tabla = esquema.nombreTabla(clase);
    final fila = <String, dynamic>{};

    final ahoraLocal = DateTime.now().toIso8601String().replaceAll('Z', '');
    fila['creado_en'] = ahoraLocal;
    fila['sincronizado'] = 0;

    for (final campo in clase.campos) {
      final valor = campos[campo.nombre];

      if (campo.tipo == 'ref') {
        if (valor == null) continue;

        final destinoClase = _buscarClase(campo.destino!);
        final tablaDestino = esquema.nombreTabla(destinoClase);
        final primerCampoTexto = destinoClase.campos.firstWhere(
          (c) => c.tipo == 'texto',
          orElse: () => throw ArgumentError(
            'La clase destino "${destinoClase.nombre}" no contiene campos de tipo texto',
          ),
        );

        final valorTexto = valor.toString().trim();
        final valorNorm = _normalizarTexto(valorTexto);

        final registrosDestino = await db.query(tablaDestino);
        int? idDestino;

        for (final reg in registrosDestino) {
          final valorExistente = reg[primerCampoTexto.nombre];
          if (valorExistente != null && _normalizarTexto(valorExistente.toString()) == valorNorm) {
            idDestino = reg['id_local'] as int?;
            break;
          }
        }

        if (idDestino == null) {
          final nuevaFilaDestino = <String, dynamic>{
            primerCampoTexto.nombre: valorTexto,
            'creado_en': DateTime.now().toIso8601String().replaceAll('Z', ''),
            'sincronizado': 0,
          };
          idDestino = await db.insert(tablaDestino, nuevaFilaDestino);
        }

        fila['${campo.nombre}_id'] = idDestino;
      } else if (campo.tipo == 'numero') {
        if (valor != null) {
          if (valor is num) {
            fila[campo.nombre] = valor;
          } else {
            fila[campo.nombre] = num.tryParse(valor.toString());
          }
        }
      } else {
        // 'texto' u 'otro'
        if (valor != null) {
          fila[campo.nombre] = valor.toString();
        }
      }
    }

    return await db.insert(tabla, fila);
  }

  /// (3) listar(String clase, {bool soloHoy=false}): devuelve filas como Map
  /// donde los campos ref aparecen con el nombre del registro destino en lugar del id;
  /// soloHoy compara substr(creado_en,1,10) con la fecha local de hoy.
  Future<List<Map<String, dynamic>>> listar(String nombreClase, {bool soloHoy = false}) async {
    final clase = _buscarClase(nombreClase);
    final tabla = esquema.nombreTabla(clase);

    String? where;
    List<dynamic>? whereArgs;

    if (soloHoy) {
      final hoy = DateTime.now().toIso8601String().replaceAll('Z', '').substring(0, 10);
      where = 'substr(creado_en, 1, 10) = ?';
      whereArgs = [hoy];
    }

    final filas = await db.query(tabla, where: where, whereArgs: whereArgs);
    final resultado = <Map<String, dynamic>>[];

    final camposRef = clase.campos.where((c) => c.tipo == 'ref').toList();

    for (final filaRaw in filas) {
      final fila = Map<String, dynamic>.from(filaRaw);

      for (final ref in camposRef) {
        final refId = fila.remove('${ref.nombre}_id');
        if (refId != null) {
          final destinoClase = _buscarClase(ref.destino!);
          final tablaDestino = esquema.nombreTabla(destinoClase);
          final primerCampoTexto = destinoClase.campos.firstWhere(
            (c) => c.tipo == 'texto',
          );

          final destRows = await db.query(
            tablaDestino,
            columns: [primerCampoTexto.nombre],
            where: 'id_local = ?',
            whereArgs: [refId],
          );

          if (destRows.isNotEmpty) {
            fila[ref.nombre] = destRows.first[primerCampoTexto.nombre];
          } else {
            fila[ref.nombre] = null;
          }
        } else {
          fila[ref.nombre] = null;
        }
      }

      resultado.add(fila);
    }

    return resultado;
  }

  /// (4) consultar(String clase, String q, String p): q es lista, conteo o suma;
  /// p es hoy o todo; suma opera sobre el primer campo numero de la clase y devuelve 0 si no hay.
  Future<dynamic> consultar(String nombreClase, String q, String p) async {
    final clase = _buscarClase(nombreClase);
    final tabla = esquema.nombreTabla(clase);
    final bool soloHoy = p.toLowerCase() == 'hoy';

    String? where;
    List<dynamic>? whereArgs;

    if (soloHoy) {
      final hoy = DateTime.now().toIso8601String().replaceAll('Z', '').substring(0, 10);
      where = 'substr(creado_en, 1, 10) = ?';
      whereArgs = [hoy];
    }

    final modoQ = q.toLowerCase();

    if (modoQ == 'lista') {
      return await listar(nombreClase, soloHoy: soloHoy);
    } else if (modoQ == 'conteo') {
      final whereClause = where != null ? 'WHERE $where' : '';
      final res = await db.rawQuery(
        'SELECT COUNT(*) as total FROM $tabla $whereClause',
        whereArgs,
      );
      return Sqflite.firstIntValue(res) ?? 0;
    } else if (modoQ == 'suma') {
      CampoEsq? primerNumero;
      for (final c in clase.campos) {
        if (c.tipo == 'numero') {
          primerNumero = c;
          break;
        }
      }

      if (primerNumero == null) {
        return 0;
      }

      final whereClause = where != null ? 'WHERE $where' : '';
      final res = await db.rawQuery(
        'SELECT SUM(${primerNumero.nombre}) as total FROM $tabla $whereClause',
        whereArgs,
      );

      final total = res.first['total'];
      if (total == null) return 0;
      if (total is num) return total;
      return num.tryParse(total.toString()) ?? 0;
    } else {
      throw ArgumentError('Operación q no permitida: "$q". Permitidos: lista, conteo, suma');
    }
  }
}
