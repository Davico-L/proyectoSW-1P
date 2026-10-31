import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite/sqflite.dart';
import 'package:mobile_template/datos/repositorio.dart';
import 'package:mobile_template/esquema/esquema.dart';
import 'package:mobile_template/esquema/esquema_barberia.dart';

/// Implementación de Database para pruebas unitarias respaldada en un archivo físico en disco.
class FileTestDatabase implements Database {
  final String dbPath;
  Map<String, List<Map<String, dynamic>>> tables = {};

  FileTestDatabase(this.dbPath) {
    final file = File(dbPath);
    if (file.existsSync()) {
      try {
        final content = file.readAsStringSync();
        if (content.trim().isNotEmpty) {
          final decoded = jsonDecode(content);
          if (decoded is Map) {
            tables = (decoded as Map<String, dynamic>).map(
              (key, value) => MapEntry(
                key,
                (value as List)
                    .map((item) => Map<String, dynamic>.from(item as Map))
                    .toList(),
              ),
            );
          }
        }
      } catch (_) {
        tables = {};
      }
    } else {
      file.createSync(recursive: true);
      _persist();
    }
  }

  void _persist() {
    File(dbPath).writeAsStringSync(jsonEncode(tables));
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);

  @override
  Future<void> execute(String sql, [List<Object?>? arguments]) async {
    // Si es CREATE TABLE, inicializar la tabla si no existe
    final match = RegExp(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)', caseSensitive: false)
        .firstMatch(sql);
    if (match != null) {
      final tableName = match.group(1)!.toLowerCase();
      tables.putIfAbsent(tableName, () => []);
      _persist();
    }
  }

  @override
  Future<int> insert(String table, Map<String, Object?> values,
      {String? nullColumnHack, ConflictAlgorithm? conflictAlgorithm}) async {
    final list = tables.putIfAbsent(table.toLowerCase(), () => []);
    final id = list.length + 1;
    final row = Map<String, dynamic>.from(values);
    row['id_local'] = id;
    list.add(row);
    _persist();
    return id;
  }

  @override
  Future<List<Map<String, dynamic>>> query(
    String table, {
    bool? distinct,
    List<String>? columns,
    String? where,
    List<Object?>? whereArgs,
    String? groupBy,
    String? having,
    String? orderBy,
    int? limit,
    int? offset,
  }) async {
    var list = tables[table.toLowerCase()] ?? [];
    if (where != null && whereArgs != null && whereArgs.isNotEmpty) {
      if (where.contains('id_local = ?')) {
        final targetId = whereArgs.first;
        list = list.where((r) => r['id_local'] == targetId).toList();
      } else if (where.contains('substr(creado_en, 1, 10) = ?')) {
        final targetDate = whereArgs.first.toString();
        list = list.where((r) {
          final creado = r['creado_en']?.toString() ?? '';
          return creado.length >= 10 && creado.substring(0, 10) == targetDate;
        }).toList();
      }
    }
    return list.map((r) => Map<String, dynamic>.from(r)).toList();
  }

  @override
  Future<List<Map<String, Object?>>> rawQuery(String sql,
      [List<Object?>? arguments]) async {
    final sqlLower = sql.toLowerCase();
    for (final entry in tables.entries) {
      if (sqlLower.contains('from ${entry.key}')) {
        var rows = entry.value;
        if (arguments != null && arguments.isNotEmpty && sqlLower.contains('substr(creado_en, 1, 10) = ?')) {
          final targetDate = arguments.first.toString();
          rows = rows.where((r) {
            final creado = r['creado_en']?.toString() ?? '';
            return creado.length >= 10 && creado.substring(0, 10) == targetDate;
          }).toList();
        }

        if (sqlLower.contains('count(*)')) {
          return [
            {'c': rows.length}
          ];
        }
        if (sqlLower.contains('sum(')) {
          final match = RegExp(r'sum\(([a-zA-Z0-9_]+)\)').firstMatch(sqlLower);
          final col = match?.group(1);
          num total = 0;
          if (col != null) {
            for (final r in rows) {
              final v = r[col];
              if (v is num) total += v;
            }
          }
          return [
            {'s': total}
          ];
        }
      }
    }
    return [
      {'c': 0, 's': 0}
    ];
  }
}

void main() {
  late Directory tempDir;

  final esquemaTienda = Esquema.desdeJson({
    'clases': [
      {
        'nombre': 'Categoria',
        'campos': [
          {'nombre': 'nombre', 'tipo': 'texto'}
        ]
      },
      {
        'nombre': 'Producto',
        'campos': [
          {'nombre': 'categoria', 'tipo': 'ref', 'destino': 'Categoria'},
          {'nombre': 'nombre', 'tipo': 'texto'},
          {'nombre': 'precio', 'tipo': 'numero'}
        ]
      }
    ]
  });

  setUp(() {
    tempDir = Directory.systemTemp.createTempSync('repo_migracion_test_');
  });

  tearDown(() {
    if (tempDir.existsSync()) {
      tempDir.deleteSync(recursive: true);
    }
  });

  group('Pruebas de Repositorio - Firma de esquema y migración', () {
    test(
        'Firma distinta: la base vieja se renombra a app_anterior_<timestamp>.db, la nueva queda vacía y la vieja conserva sus datos',
        () async {
      // 1. Abrir base inicial con Esquema Barbería
      final repoBarberia = await Repositorio.abrir(
        esquemaBarberia,
        directorioBases: tempDir.path,
        abrirDbFn: (p, {onCreate}) async => FileTestDatabase(p),
      );

      // Insertar datos en la base inicial
      await repoBarberia.insertar('Cliente', {'nombre': 'Carlos', 'telefono': '70011223'});
      await repoBarberia.insertar('Atencion', {'cliente': 'Carlos', 'servicio': 'Corte', 'monto': 35});

      final atencionesAntes = await repoBarberia.listar('Atencion');
      expect(atencionesAntes.length, 1);
      expect(atencionesAntes.first['servicio'], 'Corte');

      // Verificar que existen app.db y esquema_firma.txt
      final dbFile = File('${tempDir.path}/app.db');
      final firmaFile = File('${tempDir.path}/esquema_firma.txt');
      expect(dbFile.existsSync(), isTrue);
      expect(firmaFile.existsSync(), isTrue);
      expect(firmaFile.readAsStringSync().trim(), equals(Repositorio.calcularFirma(esquemaBarberia).trim()));

      // 2. Abrir repositorio con un esquema con firma distinta (Tienda)
      final repoTienda = await Repositorio.abrir(
        esquemaTienda,
        directorioBases: tempDir.path,
        abrirDbFn: (p, {onCreate}) async => FileTestDatabase(p),
      );

      // (a) La base vieja debe haberse renombrado a app_anterior_<timestamp>.db
      final backups = tempDir
          .listSync()
          .where((f) => f.path.contains('app_anterior_') && f.path.endsWith('.db'))
          .toList();
      expect(backups.length, 1, reason: 'Debe existir exactamente un archivo de respaldo app_anterior_');

      // (b) La nueva base queda vacía
      final productosNueva = await repoTienda.listar('Producto');
      expect(productosNueva, isEmpty, reason: 'La base nueva debe quedar vacía');
      final categoriasNueva = await repoTienda.listar('Categoria');
      expect(categoriasNueva, isEmpty, reason: 'La base nueva debe quedar vacía');

      // (c) La base vieja conserva sus datos intactos
      final backupFile = backups.first;
      final oldDb = FileTestDatabase(backupFile.path);
      final atencionesVieja = oldDb.tables['atencion'] ?? [];
      expect(atencionesVieja.length, 1, reason: 'La base vieja conserva sus datos');
      expect(atencionesVieja.first['servicio'], 'Corte');

      final clientesVieja = oldDb.tables['cliente'] ?? [];
      expect(clientesVieja.length, 1);
      expect(clientesVieja.first['nombre'], 'Carlos');

      // Firma guardada debe corresponder ahora al nuevo esquema
      expect(firmaFile.readAsStringSync().trim(), equals(Repositorio.calcularFirma(esquemaTienda).trim()));
    });

    test('Firma igual: los datos se mantienen y no se renombra la base', () async {
      // 1. Abrir con esquema Tienda e insertar un producto
      final repo1 = await Repositorio.abrir(
        esquemaTienda,
        directorioBases: tempDir.path,
        abrirDbFn: (p, {onCreate}) async => FileTestDatabase(p),
      );

      await repo1.insertar('Producto', {'nombre': 'Tijera', 'precio': 15.5});
      final prod1 = await repo1.listar('Producto');
      expect(prod1.length, 1);

      final backupsAntes = tempDir
          .listSync()
          .where((f) => f.path.contains('app_anterior_'))
          .toList();
      expect(backupsAntes, isEmpty);

      // 2. Abrir nuevamente con el MISMO esquema Tienda
      final repo2 = await Repositorio.abrir(
        esquemaTienda,
        directorioBases: tempDir.path,
        abrirDbFn: (p, {onCreate}) async => FileTestDatabase(p),
      );

      // No debe haberse creado ningún archivo de respaldo
      final backupsDespues = tempDir
          .listSync()
          .where((f) => f.path.contains('app_anterior_'))
          .toList();
      expect(backupsDespues, isEmpty, reason: 'No se debe respaldar ni renombrar si la firma es igual');

      // Los datos deben mantenerse
      final prod2 = await repo2.listar('Producto');
      expect(prod2.length, 1);
      expect(prod2.first['nombre'], 'Tijera');
      expect(prod2.first['precio'], 15.5);
    });

    test('Si no existía firma pero sí base, se trata como firma distinta', () async {
      // 1. Crear una base preexistente sin archivo de firma
      final repoPrevio = await Repositorio.abrir(
        esquemaBarberia,
        directorioBases: tempDir.path,
        abrirDbFn: (p, {onCreate}) async => FileTestDatabase(p),
      );
      await repoPrevio.insertar('Cliente', {'nombre': 'Marcos', 'telefono': '70099881'});

      // Eliminar el archivo de firma simulando base antigua legacy sin firma
      final firmaFile = File('${tempDir.path}/esquema_firma.txt');
      expect(firmaFile.existsSync(), isTrue);
      firmaFile.deleteSync();
      expect(firmaFile.existsSync(), isFalse);

      final dbFile = File('${tempDir.path}/app.db');
      expect(dbFile.existsSync(), isTrue);

      // 2. Abrir de nuevo: al no haber firma pero sí base, debe rotar como firma distinta
      final repoNuevo = await Repositorio.abrir(
        esquemaBarberia,
        directorioBases: tempDir.path,
        abrirDbFn: (p, {onCreate}) async => FileTestDatabase(p),
      );

      final backups = tempDir
          .listSync()
          .where((f) => f.path.contains('app_anterior_'))
          .toList();
      expect(backups.length, 1, reason: 'Debe haber rotado la base legacy sin firma a app_anterior_');

      // La nueva base está recién creada (vacía)
      final clientesNuevo = await repoNuevo.listar('Cliente');
      expect(clientesNuevo, isEmpty);

      // La vieja conserva a Marcos
      final oldDb = FileTestDatabase(backups.first.path);
      expect(oldDb.tables['cliente']?.length, 1);
      expect(oldDb.tables['cliente']?.first['nombre'], 'Marcos');

      // Se generó la firma nueva
      expect(firmaFile.existsSync(), isTrue);
    });
  });
}
