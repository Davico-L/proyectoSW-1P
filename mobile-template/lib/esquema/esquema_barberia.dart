import 'esquema.dart';

/// Definición en formato esquema.json para el dominio de Barbería.
const Map<String, dynamic> kEsquemaBarberiaJson = {
  'clases': [
    {
      'nombre': 'Cliente',
      'campos': [
        {'nombre': 'nombre', 'tipo': 'texto'},
        {'nombre': 'telefono', 'tipo': 'texto'},
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

/// Instancia compilada de [Esquema] para Barbería.
final Esquema esquemaBarberia = Esquema.desdeJson(kEsquemaBarberiaJson);
