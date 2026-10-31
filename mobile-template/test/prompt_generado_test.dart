import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_template/esquema/esquema.dart';
import 'package:mobile_template/esquema/esquema_barberia.dart';
import 'package:mobile_template/ia/prompt_generado.dart';
import 'package:mobile_template/ia/servicio_ia.dart';

void main() {
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

  final esquema4Clases = Esquema.desdeJson({
    'clases': [
      {
        'nombre': 'Cliente',
        'campos': [
          {'nombre': 'nombre', 'tipo': 'texto'},
        ],
      },
      {
        'nombre': 'Vehiculo',
        'campos': [
          {'nombre': 'cliente', 'tipo': 'ref', 'destino': 'Cliente'},
          {'nombre': 'placa', 'tipo': 'texto'},
        ],
      },
      {
        'nombre': 'Mecanico',
        'campos': [
          {'nombre': 'nombre', 'tipo': 'texto'},
        ],
      },
      {
        'nombre': 'Reparacion',
        'campos': [
          {'nombre': 'vehiculo', 'tipo': 'ref', 'destino': 'Vehiculo'},
          {'nombre': 'detalle', 'tipo': 'texto'},
          {'nombre': 'costo', 'tipo': 'numero'},
        ],
      },
    ],
  });

  final esquema6Clases = Esquema.desdeJson({
    'clases': [
      {
        'nombre': 'C1',
        'campos': [
          {'nombre': 'f1', 'tipo': 'texto'}
        ]
      },
      {
        'nombre': 'C2',
        'campos': [
          {'nombre': 'c1', 'tipo': 'ref', 'destino': 'C1'},
          {'nombre': 'f2', 'tipo': 'texto'}
        ]
      },
      {
        'nombre': 'C3',
        'campos': [
          {'nombre': 'c2', 'tipo': 'ref', 'destino': 'C2'},
          {'nombre': 'f3', 'tipo': 'texto'}
        ]
      },
      {
        'nombre': 'C4',
        'campos': [
          {'nombre': 'c3', 'tipo': 'ref', 'destino': 'C3'},
          {'nombre': 'f4', 'tipo': 'numero'}
        ]
      },
      {
        'nombre': 'C5',
        'campos': [
          {'nombre': 'f5', 'tipo': 'texto'}
        ]
      },
      {
        'nombre': 'C6',
        'campos': [
          {'nombre': 'f6', 'tipo': 'texto'}
        ]
      },
    ],
  });

  group('Pruebas de lib/ia/prompt_generado.dart', () {
    test('1. El esquema de barbería genera un texto que contiene "Cliente" y "Atencion"', () {
      final prompt = construirPrompt(esquemaBarberia);
      expect(prompt.contains('Cliente'), isTrue);
      expect(prompt.contains('Atencion'), isTrue);
      expect(prompt.startsWith('Eres el intérprete de una app de gestión.'), isTrue);
    });

    test(
        '2. El esquema de tienda contiene "Producto" y "precio" y no contiene "Atencion", "barbería" ni "cliente"',
        () {
      final prompt = construirPrompt(esquemaTienda);
      final lower = prompt.toLowerCase();

      expect(prompt.contains('Producto'), isTrue);
      expect(prompt.contains('precio'), isTrue);

      expect(prompt.contains('Atencion'), isFalse);
      expect(lower.contains('atencion'), isFalse);
      expect(lower.contains('barbería'), isFalse);
      expect(lower.contains('barberia'), isFalse);
      expect(lower.contains('cliente'), isFalse);
    });

    test('3. El prompt no pasa de 1800 caracteres con 2 clases y con 4 clases', () {
      final prompt2 = construirPrompt(esquemaBarberia);
      final prompt4 = construirPrompt(esquema4Clases);

      expect(
        prompt2.length,
        lessThanOrEqualTo(1800),
        reason: 'El prompt con 2 clases tiene ${prompt2.length} caracteres',
      );
      expect(
        prompt4.length,
        lessThanOrEqualTo(1800),
        reason: 'El prompt con 4 clases tiene ${prompt4.length} caracteres',
      );
    });

    test('4. Un esquema de 6 clases solo menciona las primeras 4', () {
      final prompt = construirPrompt(esquema6Clases);

      // Primeras 4 clases deben estar presentes
      expect(prompt.contains('C1'), isTrue);
      expect(prompt.contains('C2'), isTrue);
      expect(prompt.contains('C3'), isTrue);
      expect(prompt.contains('C4'), isTrue);

      // Clases 5 y 6 no deben mencionarse
      expect(prompt.contains('C5'), isFalse);
      expect(prompt.contains('C6'), isFalse);
    });

    test('5. No hay más de 10 ejemplos en total', () {
      for (final esq in [esquemaBarberia, esquemaTienda, esquema4Clases, esquema6Clases]) {
        final prompt = construirPrompt(esq);
        final partes = prompt.split('Ejemplos:\n');
        expect(partes.length, equals(2));

        final lineas = partes[1].split('\n').where((l) => l.trim().startsWith('{')).toList();
        expect(
          lineas.length,
          lessThanOrEqualTo(10),
          reason: 'El prompt generó ${lineas.length} ejemplos JSON',
        );
      }
    });

    test('6. Todos los ejemplos son JSON válido', () {
      for (final esq in [esquemaBarberia, esquemaTienda, esquema4Clases, esquema6Clases]) {
        final prompt = construirPrompt(esq);
        final partes = prompt.split('Ejemplos:\n');
        final lineasJson = partes[1].split('\n').where((l) => l.trim().startsWith('{')).toList();

        expect(lineasJson.isNotEmpty, isTrue);

        for (final linea in lineasJson) {
          expect(() => jsonDecode(linea), returnsNormally,
              reason: 'La línea "$linea" no es un JSON válido');
          final decoded = jsonDecode(linea) as Map<String, dynamic>;
          expect(decoded.containsKey('a'), isTrue);
          expect(decoded.containsKey('c'), isTrue);
        }
      }
    });

    test(
        '7. construirPrompt de la tienda no contiene "Atencion" ni "Cliente" y el servicio guarda el prompt que recibió',
        () {
      final promptTienda = construirPrompt(esquemaTienda);
      expect(promptTienda.contains('Atencion'), isFalse);
      expect(promptTienda.contains('Cliente'), isFalse);

      final servicio = ServicioIa.instancia;
      servicio.promptActivo = promptTienda;
      expect(servicio.promptActivo, equals(promptTienda));
    });
  });
}
