import 'dart:convert';
import 'package:flutter/services.dart' show rootBundle, AssetBundle;
import 'package:mobile_template/esquema/esquema.dart';
import 'package:mobile_template/esquema/esquema_barberia.dart';

/// Carga el esquema desde el archivo asset especificado (por defecto `assets/esquema.json`).
/// Si el asset no existe, ocurre un error al cargarlo o su formato JSON no es válido,
/// retorna como valor de respaldo el esquema por defecto de la barbería ([esquemaBarberia]).
Future<Esquema> cargarEsquema([
  String rutaAsset = 'assets/esquema.json',
  AssetBundle? bundle,
]) async {
  final assetBundle = bundle ?? rootBundle;
  try {
    final jsonStr = await assetBundle.loadString(rutaAsset);
    final decoded = jsonDecode(jsonStr);
    if (decoded is Map<String, dynamic>) {
      return Esquema.desdeJson(decoded);
    } else if (decoded is Map) {
      return Esquema.desdeJson(Map<String, dynamic>.from(decoded));
    }
    return esquemaBarberia;
  } catch (_) {
    return esquemaBarberia;
  }
}
