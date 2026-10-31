import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_template/esquema/cargar_esquema.dart';
import 'package:mobile_template/esquema/esquema_barberia.dart';

/// AssetBundle simulado para pruebas unitarias sin depender de la plataforma.
class FakeAssetBundle extends CachingAssetBundle {
  final Map<String, String> assets;

  FakeAssetBundle(this.assets);

  @override
  Future<ByteData> load(String key) async {
    if (!assets.containsKey(key)) {
      throw StateError('Asset not found: $key');
    }
    final bytes = utf8.encode(assets[key]!);
    return ByteData.view(Uint8List.fromList(bytes).buffer);
  }

  @override
  Future<String> loadString(String key, {bool cache = true}) async {
    if (!assets.containsKey(key)) {
      throw StateError('Asset not found: $key');
    }
    return assets[key]!;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Pruebas de cargarEsquema', () {
    test('1. JSON válido devuelve el Esquema correspondiente', () async {
      final jsonValido = jsonEncode({
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

      final bundle = FakeAssetBundle({
        'assets/esquema.json': jsonValido,
      });

      final esquema = await cargarEsquema('assets/esquema.json', bundle);

      expect(esquema.clases.length, equals(2));
      expect(esquema.clases[0].nombre, equals('Categoria'));
      expect(esquema.clases[1].nombre, equals('Producto'));
      expect(esquema.clases[1].campos.any((c) => c.tipo == 'ref'), isTrue);
    });

    test('2. Asset faltante o inválido devuelve el esquema de la barbería', () async {
      // Bundle vacío (el archivo no existe)
      final bundleVacio = FakeAssetBundle({});
      final esquemaFaltante =
          await cargarEsquema('assets/esquema_inexistente.json', bundleVacio);

      expect(esquemaFaltante.clases.length, equals(esquemaBarberia.clases.length));
      expect(esquemaFaltante.clases[0].nombre, equals(esquemaBarberia.clases[0].nombre));
      expect(esquemaFaltante.clases[1].nombre, equals(esquemaBarberia.clases[1].nombre));

      // Contenido JSON corrupto o inválido
      final bundleCorrupto = FakeAssetBundle({
        'assets/esquema.json': 'este no es un json válido',
      });
      final esquemaInvalido =
          await cargarEsquema('assets/esquema.json', bundleCorrupto);

      expect(esquemaInvalido.clases.length, equals(esquemaBarberia.clases.length));
      expect(esquemaInvalido.clases[0].nombre, equals(esquemaBarberia.clases[0].nombre));
    });
  });
}
