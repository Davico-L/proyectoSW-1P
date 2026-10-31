import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sqflite/sqflite.dart';
import 'package:mobile_template/datos/repositorio.dart';
import 'package:mobile_template/esquema/esquema_barberia.dart';
import 'package:mobile_template/pruebas/prueba_ia.dart';
import 'package:mobile_template/sync/sincronizador.dart';

/// Base de datos SQLite falsa en memoria para pruebas unitarias.
class FakeDatabase implements Database {
  final Map<String, List<Map<String, dynamic>>> tables = {};

  void initTable(String table, List<Map<String, dynamic>> rows) {
    tables[table] = rows.map((r) => Map<String, dynamic>.from(r)).toList();
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);

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
    var list = tables[table] ?? [];
    if (where != null) {
      if (where == 'sincronizado = 0') {
        list = list.where((r) => r['sincronizado'] == 0).toList();
      } else if (where == 'id_local = ?' &&
          whereArgs != null &&
          whereArgs.isNotEmpty) {
        final id = whereArgs.first;
        list = list.where((r) => r['id_local'] == id).toList();
      }
    }
    if (columns != null) {
      return list.map((row) {
        final m = <String, dynamic>{};
        for (final col in columns) {
          if (row.containsKey(col)) m[col] = row[col];
        }
        return m;
      }).toList();
    }
    return list.map((r) => Map<String, dynamic>.from(r)).toList();
  }

  @override
  Future<int> update(
    String table,
    Map<String, Object?> values, {
    String? where,
    List<Object?>? whereArgs,
    ConflictAlgorithm? conflictAlgorithm,
  }) async {
    final list = tables[table] ?? [];
    int count = 0;
    if (where == 'id_local = ?' && whereArgs != null && whereArgs.isNotEmpty) {
      final id = whereArgs.first;
      for (final r in list) {
        if (r['id_local'] == id) {
          r.addAll(values);
          count++;
        }
      }
    }
    return count;
  }

  @override
  Future<List<Map<String, Object?>>> rawQuery(String sql,
      [List<Object?>? arguments]) async {
    if (sql.contains('COUNT(*)')) {
      for (final entry in tables.entries) {
        if (sql.contains('FROM ${entry.key}')) {
          final c = entry.value.where((r) => r['sincronizado'] == 0).length;
          return [
            {'COUNT(*)': c, 'c': c}
          ];
        }
      }
      return [
        {'COUNT(*)': 0, 'c': 0}
      ];
    }
    return [];
  }
}

void main() {
  const serverUrl = 'http://192.168.1.50:8081';

  group('Pruebas de Sincronizador con Esquema Barbería', () {
    test('1. Orden padres antes que hijos al sincronizar', () async {
      final fakeDb = FakeDatabase();
      fakeDb.initTable('cliente', [
        {
          'id_local': 1,
          'id_servidor': null,
          'nombre': 'Carlos',
          'telefono': '70012345',
          'creado_en': '2026-10-30T10:00:00',
          'sincronizado': 0,
        }
      ]);
      fakeDb.initTable('atencion', [
        {
          'id_local': 10,
          'id_servidor': null,
          'cliente_id': 1,
          'servicio': 'corte',
          'monto': 35.0,
          'creado_en': '2026-10-30T10:05:00',
          'sincronizado': 0,
        }
      ]);

      final repo = Repositorio(esquemaBarberia, fakeDb);
      final pathsRecibidos = <String>[];

      final mockClient = MockClient((request) async {
        pathsRecibidos.add(request.url.path);
        if (request.url.path == '/api/clientes') {
          return http.Response(
            jsonEncode({'id': 101, 'nombre': 'Carlos', 'telefono': '70012345'}),
            200,
          );
        } else if (request.url.path == '/api/atencions') {
          return http.Response(
            jsonEncode({'id': 501, 'servicio': 'corte', 'monto': 35.0}),
            200,
          );
        }
        return http.Response('Not found', 404);
      });

      final sincronizador =
          Sincronizador(esquemaBarberia, repo, mockClient);
      final resultado = await sincronizador.sincronizar(serverUrl);

      expect(resultado.exito, isTrue);
      expect(resultado.enviados, equals(2));
      expect(resultado.pendientes, equals(0));
      expect(pathsRecibidos, equals(['/api/clientes', '/api/atencions']));
    });

    test('2. El hijo recibe el id del servidor del padre', () async {
      final fakeDb = FakeDatabase();
      fakeDb.initTable('cliente', [
        {
          'id_local': 1,
          'id_servidor': null,
          'nombre': 'Ana',
          'telefono': null,
          'creado_en': '2026-10-30T10:00:00',
          'sincronizado': 0,
        }
      ]);
      fakeDb.initTable('atencion', [
        {
          'id_local': 2,
          'id_servidor': null,
          'cliente_id': 1,
          'servicio': 'barba',
          'monto': 20.0,
          'creado_en': '2026-10-30T10:05:00',
          'sincronizado': 0,
        }
      ]);

      final repo = Repositorio(esquemaBarberia, fakeDb);
      Map<String, dynamic>? bodyHijo;

      final mockClient = MockClient((request) async {
        if (request.url.path == '/api/clientes') {
          return http.Response(
            jsonEncode({'id': 888, 'nombre': 'Ana'}),
            201,
          );
        } else if (request.url.path == '/api/atencions') {
          bodyHijo = jsonDecode(request.body) as Map<String, dynamic>;
          return http.Response(
            jsonEncode({'id': 999, 'servicio': 'barba'}),
            201,
          );
        }
        return http.Response('Error', 500);
      });

      final sincronizador =
          Sincronizador(esquemaBarberia, repo, mockClient);
      await sincronizador.sincronizar(serverUrl);

      expect(bodyHijo, isNotNull);
      expect(bodyHijo!['cliente'], equals({'id': 888}));
      expect(bodyHijo!['servicio'], equals('barba'));
      expect(bodyHijo!['monto'], equals(20.0));
    });

    test('3. Marca sincronizado = 1 e id_servidor en la base local', () async {
      final fakeDb = FakeDatabase();
      fakeDb.initTable('cliente', [
        {
          'id_local': 1,
          'id_servidor': null,
          'nombre': 'Mario',
          'telefono': '71122334',
          'creado_en': '2026-10-30T10:00:00',
          'sincronizado': 0,
        }
      ]);
      fakeDb.initTable('atencion', []);

      final repo = Repositorio(esquemaBarberia, fakeDb);
      final mockClient = MockClient((request) async {
        return http.Response(jsonEncode({'id': 456}), 200);
      });

      final sincronizador =
          Sincronizador(esquemaBarberia, repo, mockClient);
      final res = await sincronizador.sincronizar(serverUrl);

      expect(res.enviados, equals(1));
      final clienteFila = fakeDb.tables['cliente']!.first;
      expect(clienteFila['sincronizado'], equals(1));
      expect(clienteFila['id_servidor'], equals(456));
    });

    test(
        '4. Si el servidor falla a mitad, lo ya enviado queda marcado y lo demás pendiente',
        () async {
      final fakeDb = FakeDatabase();
      fakeDb.initTable('cliente', [
        {
          'id_local': 1,
          'id_servidor': null,
          'nombre': 'Luis',
          'telefono': '72233445',
          'creado_en': '2026-10-30T10:00:00',
          'sincronizado': 0,
        }
      ]);
      fakeDb.initTable('atencion', [
        {
          'id_local': 5,
          'id_servidor': null,
          'cliente_id': 1,
          'servicio': 'corte',
          'monto': 30,
          'creado_en': '2026-10-30T10:10:00',
          'sincronizado': 0,
        }
      ]);

      final repo = Repositorio(esquemaBarberia, fakeDb);

      final mockClient = MockClient((request) async {
        if (request.url.path == '/api/clientes') {
          return http.Response(jsonEncode({'id': 100}), 200);
        } else {
          // Falla en atencion
          return http.Response('Internal Server Error', 500);
        }
      });

      final sincronizador =
          Sincronizador(esquemaBarberia, repo, mockClient);
      final res = await sincronizador.sincronizar(serverUrl);

      expect(res.exito, isFalse);
      expect(res.enviados, equals(1));
      expect(res.pendientes, equals(1));

      // Cliente quedó marcado como sincronizado
      final clienteFila = fakeDb.tables['cliente']!.first;
      expect(clienteFila['sincronizado'], equals(1));
      expect(clienteFila['id_servidor'], equals(100));

      // Atencion quedó pendiente
      final atencionFila = fakeDb.tables['atencion']!.first;
      expect(atencionFila['sincronizado'], equals(0));
      expect(atencionFila['id_servidor'], isNull);
    });

    test('5. No reenvía lo ya sincronizado', () async {
      final fakeDb = FakeDatabase();
      fakeDb.initTable('cliente', [
        {
          'id_local': 1,
          'id_servidor': 77,
          'nombre': 'Ya Sincronizado',
          'telefono': '70000000',
          'creado_en': '2026-10-30T09:00:00',
          'sincronizado': 1,
        },
        {
          'id_local': 2,
          'id_servidor': null,
          'nombre': 'Nuevo Pendiente',
          'telefono': '71111111',
          'creado_en': '2026-10-30T10:00:00',
          'sincronizado': 0,
        }
      ]);
      fakeDb.initTable('atencion', []);

      final repo = Repositorio(esquemaBarberia, fakeDb);
      int llamadas = 0;
      final mockClient = MockClient((request) async {
        llamadas++;
        return http.Response(jsonEncode({'id': 78}), 200);
      });

      final sincronizador =
          Sincronizador(esquemaBarberia, repo, mockClient);
      final res = await sincronizador.sincronizar(serverUrl);

      expect(llamadas, equals(1));
      expect(res.enviados, equals(1));
      expect(res.pendientes, equals(0));
    });

    test('6. Un padre sin id_servidor deja al hijo pendiente', () async {
      final fakeDb = FakeDatabase();
      // El padre no tiene id_servidor
      fakeDb.initTable('cliente', [
        {
          'id_local': 1,
          'id_servidor': null,
          'nombre': 'Padre Fallido',
          'telefono': '70000000',
          'creado_en': '2026-10-30T09:00:00',
          'sincronizado': 0,
        }
      ]);
      fakeDb.initTable('atencion', [
        {
          'id_local': 10,
          'id_servidor': null,
          'cliente_id': 1,
          'servicio': 'corte',
          'monto': 25,
          'creado_en': '2026-10-30T09:10:00',
          'sincronizado': 0,
        }
      ]);

      final repo = Repositorio(esquemaBarberia, fakeDb);

      // El servidor falla al enviar el padre
      final mockClient = MockClient((request) async {
        return http.Response('Server error', 500);
      });

      final sincronizador =
          Sincronizador(esquemaBarberia, repo, mockClient);
      final res = await sincronizador.sincronizar(serverUrl);

      expect(res.enviados, equals(0));
      expect(res.pendientes, equals(2));
      expect(fakeDb.tables['atencion']!.first['sincronizado'], equals(0));
    });
  });

  group('Pruebas de Sincronizador con Esquema Tienda', () {
    test(
        '7. Sincronización completa con esquema Tienda (Categoria y Producto)',
        () async {
      final esquemaTienda = PruebaIaScreen.esquemaTienda;
      final fakeDb = FakeDatabase();
      fakeDb.initTable('categoria', [
        {
          'id_local': 1,
          'id_servidor': null,
          'nombre': 'Bebidas',
          'creado_en': '2026-10-30T10:00:00',
          'sincronizado': 0,
        }
      ]);
      fakeDb.initTable('producto', [
        {
          'id_local': 10,
          'id_servidor': null,
          'categoria_id': 1,
          'descripcion': 'Gaseosa Cola',
          'precio': 12.5,
          'creado_en': '2026-10-30T10:05:00',
          'sincronizado': 0,
        }
      ]);

      final repo = Repositorio(esquemaTienda, fakeDb);
      final paths = <String>[];
      Map<String, dynamic>? bodyProducto;

      final mockClient = MockClient((request) async {
        paths.add(request.url.path);
        if (request.url.path == '/api/categorias') {
          return http.Response(jsonEncode({'id': 301, 'nombre': 'Bebidas'}), 200);
        } else if (request.url.path == '/api/productos') {
          bodyProducto = jsonDecode(request.body) as Map<String, dynamic>;
          return http.Response(
            jsonEncode({'id': 401, 'descripcion': 'Gaseosa Cola', 'precio': 12.5}),
            200,
          );
        }
        return http.Response('Not found', 404);
      });

      final sincronizador = Sincronizador(esquemaTienda, repo, mockClient);
      final res = await sincronizador.sincronizar(serverUrl);

      expect(res.exito, isTrue);
      expect(res.enviados, equals(2));
      expect(res.pendientes, equals(0));
      expect(paths, equals(['/api/categorias', '/api/productos']));

      expect(bodyProducto, isNotNull);
      expect(bodyProducto!['categoria'], equals({'id': 301}));
      expect(bodyProducto!['descripcion'], equals('Gaseosa Cola'));
      expect(bodyProducto!['precio'], equals(12.5));

      final catFila = fakeDb.tables['categoria']!.first;
      expect(catFila['sincronizado'], equals(1));
      expect(catFila['id_servidor'], equals(301));

      final prodFila = fakeDb.tables['producto']!.first;
      expect(prodFila['sincronizado'], equals(1));
      expect(prodFila['id_servidor'], equals(401));
    });
  });
}
