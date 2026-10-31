import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_template/esquema/esquema.dart';

void main() {
  group('Esquema y generación DDL', () {
    // Esquema 1: Barbería (Cliente y Atención)
    final esquemaBarberiaJson = <String, dynamic>{
      'clases': [
        {
          'nombre': 'Cliente',
          'campos': [
            {'nombre': 'nombre', 'tipo': 'texto'},
          ],
        },
        {
          'nombre': 'Atencion',
          'campos': [
            {'nombre': 'cliente', 'tipo': 'ref', 'destino': 'Cliente'},
            {'nombre': 'servicio', 'tipo': 'texto'},
            {'nombre': 'monto', 'tipo': 'numero'},
          ],
        },
      ],
    };

    // Esquema 2: Tienda / Inventario (Categoria y Producto con 3 campos y una ref)
    final esquemaTiendaJson = <String, dynamic>{
      'clases': [
        {
          'nombre': 'Categoria',
          'campos': [
            {'nombre': 'nombre', 'tipo': 'texto'},
          ],
        },
        {
          'nombre': 'Producto',
          'campos': [
            {'nombre': 'categoria', 'tipo': 'ref', 'destino': 'Categoria'},
            {'nombre': 'descripcion', 'tipo': 'texto'},
            {'nombre': 'precio', 'tipo': 'numero'},
            {'nombre': 'codigo_barras', 'tipo': 'otro'},
          ],
        },
      ],
    };

    test('Parseo correcto de ambos esquemas', () {
      final esqBarberia = Esquema.desdeJson(esquemaBarberiaJson);
      expect(esqBarberia.clases.length, equals(2));
      expect(esqBarberia.clases[0].nombre, equals('Cliente'));
      expect(esqBarberia.clases[0].campos.length, equals(1));
      expect(esqBarberia.clases[0].campos[0].nombre, equals('nombre'));
      expect(esqBarberia.clases[0].campos[0].tipo, equals('texto'));

      expect(esqBarberia.clases[1].nombre, equals('Atencion'));
      expect(esqBarberia.clases[1].campos.length, equals(3));
      expect(esqBarberia.clases[1].campos[0].nombre, equals('cliente'));
      expect(esqBarberia.clases[1].campos[0].tipo, equals('ref'));
      expect(esqBarberia.clases[1].campos[0].destino, equals('Cliente'));
      expect(esqBarberia.clases[1].campos[1].nombre, equals('servicio'));
      expect(esqBarberia.clases[1].campos[1].tipo, equals('texto'));
      expect(esqBarberia.clases[1].campos[2].nombre, equals('monto'));
      expect(esqBarberia.clases[1].campos[2].tipo, equals('numero'));

      final esqTienda = Esquema.desdeJson(esquemaTiendaJson);
      expect(esqTienda.clases.length, equals(2));
      expect(esqTienda.clases[1].nombre, equals('Producto'));
      expect(esqTienda.clases[1].campos.length, equals(4));
      expect(esqTienda.clases[1].campos[0].tipo, equals('ref'));
      expect(esqTienda.clases[1].campos[1].tipo, equals('texto'));
      expect(esqTienda.clases[1].campos[2].tipo, equals('numero'));
      expect(esqTienda.clases[1].campos[3].tipo, equals('otro'));
    });

    test('Error si falta "nombre" en una clase', () {
      final jsonInvalido = <String, dynamic>{
        'clases': [
          {
            'campos': [
              {'nombre': 'nombre', 'tipo': 'texto'},
            ],
          },
        ],
      };

      expect(
        () => Esquema.desdeJson(jsonInvalido),
        throwsA(isA<FormatException>()),
      );
    });

    test('Orden de padres antes que hijos aunque Atencion aparezca primero en el JSON', () {
      final jsonInvertido = <String, dynamic>{
        'clases': [
          {
            'nombre': 'Atencion',
            'campos': [
              {'nombre': 'cliente', 'tipo': 'ref', 'destino': 'Cliente'},
              {'nombre': 'servicio', 'tipo': 'texto'},
              {'nombre': 'monto', 'tipo': 'numero'},
            ],
          },
          {
            'nombre': 'Cliente',
            'campos': [
              {'nombre': 'nombre', 'tipo': 'texto'},
            ],
          },
        ],
      };

      final esquema = Esquema.desdeJson(jsonInvertido);
      final sentencias = esquema.sentenciasCrearTablas();

      expect(sentencias.length, equals(2));
      // Cliente debe estar primero porque Atencion tiene ref hacia Cliente (Cliente es padre)
      expect(sentencias[0], startsWith('CREATE TABLE IF NOT EXISTS cliente '));
      expect(sentencias[1], startsWith('CREATE TABLE IF NOT EXISTS atencion '));
    });

    test('SQL de Atencion con cliente_id INTEGER y monto REAL', () {
      final esquema = Esquema.desdeJson(esquemaBarberiaJson);
      final sentencias = esquema.sentenciasCrearTablas();

      final sqlAtencion = sentencias.firstWhere(
        (s) => s.startsWith('CREATE TABLE IF NOT EXISTS atencion'),
      );

      expect(sqlAtencion, contains('cliente_id INTEGER'));
      expect(sqlAtencion, contains('monto REAL'));
      expect(sqlAtencion, contains('servicio TEXT'));
      expect(
        sqlAtencion,
        equals(
          'CREATE TABLE IF NOT EXISTS atencion (id_local INTEGER PRIMARY KEY AUTOINCREMENT, id_servidor INTEGER, creado_en TEXT NOT NULL, sincronizado INTEGER NOT NULL DEFAULT 0, cliente_id INTEGER, servicio TEXT, monto REAL)',
        ),
      );
    });

    test('paraValidador con cliente primero y tipo texto', () {
      final esquema = Esquema.desdeJson(esquemaBarberiaJson);
      final validadorMap = esquema.paraValidador();

      expect(validadorMap.containsKey('Atencion'), isTrue);
      final atencionCampos = validadorMap['Atencion']!;

      // cliente debe ser la primera clave
      expect(atencionCampos.keys.first, equals('cliente'));
      // cliente debe ser de tipo texto
      expect(atencionCampos['cliente'], equals('texto'));
      expect(atencionCampos['servicio'], equals('texto'));
      expect(atencionCampos['monto'], equals('numero'));
      expect(
        atencionCampos.keys.toList(),
        equals(['cliente', 'servicio', 'monto']),
      );
    });

    test('Campo tipo otro omitido en paraValidador pero presente en el SQL', () {
      final esquema = Esquema.desdeJson(esquemaTiendaJson);

      // En SQL de Producto, codigo_barras debe estar presente como TEXT
      final sentencias = esquema.sentenciasCrearTablas();
      final sqlProducto = sentencias.firstWhere(
        (s) => s.startsWith('CREATE TABLE IF NOT EXISTS producto'),
      );
      expect(sqlProducto, contains('codigo_barras TEXT'));

      // En paraValidador, codigo_barras debe ser omitido
      final validadorMap = esquema.paraValidador();
      expect(validadorMap.containsKey('Producto'), isTrue);
      final productoCampos = validadorMap['Producto']!;
      expect(productoCampos.containsKey('codigo_barras'), isFalse);
      expect(
        productoCampos.keys.toList(),
        equals(['categoria', 'descripcion', 'precio']),
      );
    });

    test('nombreTabla convierte a minúsculas, sin acentos y espacios a guion bajo', () {
      final esquema = Esquema.desdeJson(esquemaBarberiaJson);
      expect(esquema.nombreTabla('Atención Médica'), equals('atencion_medica'));
      expect(esquema.nombreTabla('Orden de Compra'), equals('orden_de_compra'));
      expect(esquema.nombreTabla('Configuración General'), equals('configuracion_general'));
    });

    test('Ciclo en dependencias devuelve el orden de aparición original', () {
      final jsonCiclo = <String, dynamic>{
        'clases': [
          {
            'nombre': 'ClaseA',
            'campos': [
              {'nombre': 'b', 'tipo': 'ref', 'destino': 'ClaseB'},
            ],
          },
          {
            'nombre': 'ClaseB',
            'campos': [
              {'nombre': 'a', 'tipo': 'ref', 'destino': 'ClaseA'},
            ],
          },
        ],
      };

      final esquema = Esquema.desdeJson(jsonCiclo);
      final orden = esquema.ordenarClasesPorJerarquia();
      expect(orden.map((c) => c.nombre).toList(), equals(['ClaseA', 'ClaseB']));
    });

    test('Un esquema donde el campo ref NO es el primero en el JSON y paraValidador igual lo devuelve primero', () {
      final jsonRefNoPrimero = <String, dynamic>{
        'clases': [
          {
            'nombre': 'Cliente',
            'campos': [
              {'nombre': 'nombre', 'tipo': 'texto'},
            ],
          },
          {
            'nombre': 'Atencion',
            'campos': [
              {'nombre': 'servicio', 'tipo': 'texto'},
              {'nombre': 'monto', 'tipo': 'numero'},
              {'nombre': 'cliente', 'tipo': 'ref', 'destino': 'Cliente'},
            ],
          },
        ],
      };

      final esquema = Esquema.desdeJson(jsonRefNoPrimero);
      final validadorMap = esquema.paraValidador();
      final atencionCampos = validadorMap['Atencion']!;

      expect(atencionCampos.keys.first, equals('cliente'));
      expect(atencionCampos['cliente'], equals('texto'));
      expect(
        atencionCampos.keys.toList(),
        equals(['cliente', 'servicio', 'monto']),
      );
    });

    test('Esquema de la tienda produce paraValidador con las clases Categoria y Producto y sin Atencion', () {
      final esquemaTienda = Esquema.desdeJson({
        'clases': [
          {
            'nombre': 'Categoria',
            'campos': [
              {'nombre': 'nombre', 'tipo': 'texto'},
            ],
          },
          {
            'nombre': 'Producto',
            'campos': [
              {'nombre': 'categoria', 'tipo': 'ref', 'destino': 'Categoria'},
              {'nombre': 'descripcion', 'tipo': 'texto'},
              {'nombre': 'precio', 'tipo': 'numero'},
            ],
          },
        ],
      });

      final validadorMap = esquemaTienda.paraValidador();

      expect(validadorMap.containsKey('Categoria'), isTrue);
      expect(validadorMap.containsKey('Producto'), isTrue);
      expect(validadorMap.containsKey('Atencion'), isFalse);
      expect(validadorMap.keys.toList(), equals(['Categoria', 'Producto']));
      expect(validadorMap['Categoria'], equals({'nombre': 'texto'}));
      expect(validadorMap['Producto'], equals({
        'categoria': 'texto',
        'descripcion': 'texto',
        'precio': 'numero',
      }));
    });
  });
}
