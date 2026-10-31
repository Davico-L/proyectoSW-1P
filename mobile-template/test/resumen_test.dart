import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_template/esquema/esquema.dart';
import 'package:mobile_template/esquema/esquema_barberia.dart';
import 'package:mobile_template/ia/resumen.dart';
import 'package:mobile_template/ia/validador.dart';

void main() {
  // Esquema 1: Barbería oficial
  final esquema1 = esquemaBarberia;

  // Esquema 2: Taller mecánico (negocio inventado)
  final esquema2 = Esquema.desdeJson({
    'clases': [
      {
        'nombre': 'Vehiculo',
        'campos': [
          {'nombre': 'placa', 'tipo': 'texto'},
          {'nombre': 'marca', 'tipo': 'texto'},
        ],
      },
      {
        'nombre': 'Reparacion',
        'campos': [
          {'nombre': 'vehiculo', 'tipo': 'ref', 'destino': 'Vehiculo'},
          {'nombre': 'trabajo', 'tipo': 'texto'},
          {'nombre': 'costo', 'tipo': 'numero'},
        ],
      },
    ],
  });

  group('Pruebas de lib/ia/resumen.dart', () {
    test('1. Resumen de crear completo con todos los campos en orden', () {
      final res = Resultado(
        accion: 'crear',
        clase: 'Atencion',
        campos: {
          'cliente': 'Juan',
          'servicio': 'corte de barba',
          'monto': 10,
        },
      );
      final texto = resumenCrear(res, esquema1);
      expect(
        texto,
        equals('Registrar Atencion: cliente Juan, servicio corte de barba, monto 10'),
      );
    });

    test('2. Resumen de crear con un campo faltante', () {
      final res = Resultado(
        accion: 'crear',
        clase: 'Atencion',
        campos: {
          'cliente': 'Juan',
          'monto': 10,
        },
        faltantes: ['servicio'],
      );
      final texto = resumenCrear(res, esquema1);
      expect(
        texto,
        equals('Registrar Atencion: cliente Juan, monto 10'),
      );
    });

    test('3. Resumen de crear incluye solo campos del esquema y en su orden', () {
      final res = Resultado(
        accion: 'crear',
        clase: 'Atencion',
        campos: {
          'monto': 15,
          'campo_inventado': 'descartar',
          'cliente': 'Pedro',
          'servicio': 'tinte',
        },
      );
      final texto = resumenCrear(res, esquema1);
      // Debe ignorar campo_inventado y ordenar: cliente, servicio, monto
      expect(
        texto,
        equals('Registrar Atencion: cliente Pedro, servicio tinte, monto 15'),
      );
    });

    test('4. Consulta conteo hoy y todo', () {
      final hoy = respuestaConsulta('conteo', 'hoy', 'Atencion', 5, esquema1);
      expect(hoy, equals('Tienes 5 registros de Atencion hoy'));

      final todo = respuestaConsulta('conteo', 'todo', 'Atencion', 12, esquema1);
      expect(todo, equals('Tienes 12 registros de Atencion en total'));
    });

    test('5. Suma utiliza el nombre del primer campo numérico del esquema', () {
      // Esquema 1: primer campo numérico en Atencion es "monto"
      final suma1 = respuestaConsulta('suma', 'hoy', 'Atencion', 45.5, esquema1);
      expect(suma1, equals('El total de monto es 45.5 hoy'));

      // Esquema 2 (Taller): primer campo numérico en Reparacion es "costo"
      final suma2 = respuestaConsulta('suma', 'todo', 'Reparacion', 300, esquema2);
      expect(suma2, equals('El total de costo es 300 en total'));
    });

    test('6. Consulta de lista con 2 registros formatea una línea por registro', () {
      final filas = [
        {
          'id_local': 1,
          'cliente': 'Juan Pérez',
          'servicio': 'corte',
          'monto': 20,
          'sincronizado': 0,
        },
        {
          'id_local': 2,
          'cliente': 'Marta Gómez',
          'servicio': 'barba',
          'monto': 15,
          'sincronizado': 0,
        },
      ];
      final texto = respuestaConsulta('lista', 'hoy', 'Atencion', filas, esquema1);
      final lineas = texto.split('\n');
      expect(lineas.length, equals(2));
      expect(lineas[0], equals('cliente Juan Pérez, servicio corte, monto 20'));
      expect(lineas[1], equals('cliente Marta Gómez, servicio barba, monto 15'));
    });

    test('7. Consulta de lista vacía devuelve mensaje amigable', () {
      final texto = respuestaConsulta('lista', 'hoy', 'Atencion', [], esquema1);
      expect(texto, equals('No hay registros'));

      final textoNull = respuestaConsulta('lista', 'todo', 'Atencion', null, esquema1);
      expect(textoNull, equals('No hay registros'));
    });

    test('8. Ningún texto generado contiene las palabras técnicas clase, tabla o json', () {
      final ejemplos = <String>[
        resumenCrear(
          Resultado(
            accion: 'crear',
            clase: 'Atencion',
            campos: {'cliente': 'Carlos', 'servicio': 'corte', 'monto': 25},
          ),
          esquema1,
        ),
        resumenCrear(
          Resultado(
            accion: 'crear',
            clase: 'Reparacion',
            campos: {'vehiculo': 'ABC-123', 'trabajo': 'frenos', 'costo': 150},
          ),
          esquema2,
        ),
        respuestaConsulta('conteo', 'hoy', 'Atencion', 3, esquema1),
        respuestaConsulta('conteo', 'todo', 'Cliente', 8, esquema1),
        respuestaConsulta('suma', 'hoy', 'Atencion', 100, esquema1),
        respuestaConsulta('suma', 'todo', 'Reparacion', 500, esquema2),
        respuestaConsulta('lista', 'hoy', 'Atencion', [], esquema1),
        respuestaConsulta('lista', 'todo', 'Reparacion', [
          {'vehiculo': 'XYZ-789', 'trabajo': 'aceite', 'costo': 80}
        ], esquema2),
      ];

      final palabrasProhibidas = ['clase', 'tabla', 'json'];

      for (final texto in ejemplos) {
        final lower = texto.toLowerCase();
        for (final prohibida in palabrasProhibidas) {
          expect(
            lower.contains(prohibida),
            isFalse,
            reason: 'El texto "$texto" no debe contener la palabra "$prohibida"',
          );
        }
      }
    });

    test('9. Segundo esquema (Taller): resumen de crear completo', () {
      final res = Resultado(
        accion: 'crear',
        clase: 'Reparacion',
        campos: {
          'vehiculo': 'XYZ-789',
          'trabajo': 'afinamiento',
          'costo': 220,
        },
      );
      final texto = resumenCrear(res, esquema2);
      expect(
        texto,
        equals('Registrar Reparacion: vehiculo XYZ-789, trabajo afinamiento, costo 220'),
      );
    });
  });
}
