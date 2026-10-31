import 'package:flutter/material.dart';
import 'package:mobile_template/esquema/esquema.dart';
import 'package:mobile_template/ia/interprete.dart';

class FrasePrueba {
  final int id;
  final String frase;
  final String esperadoAccion; // 'crear', 'consultar', 'error'
  final String? esperadoClase; // 'Atencion', 'Cliente'
  final List<String> esperadoCampos;
  final String? esperadoQ; // 'lista', 'conteo', 'suma'
  final String? esperadoP; // 'hoy', 'todo'
  final bool exigeReintento;

  const FrasePrueba({
    required this.id,
    required this.frase,
    required this.esperadoAccion,
    this.esperadoClase,
    this.esperadoCampos = const [],
    this.esperadoQ,
    this.esperadoP,
    this.exigeReintento = false,
  });

  bool cumple(ResultadoInterpretacion inter) {
    final res = inter.resultado;
    if (esperadoAccion == 'error') {
      return res.tieneError || res.error != null;
    }

    if (res.tieneError) return false;
    if (res.accion != esperadoAccion) return false;
    if (esperadoClase != null && res.clase != esperadoClase) return false;

    if (esperadoAccion == 'crear') {
      for (final c in esperadoCampos) {
        if (!res.campos.containsKey(c) || res.campos[c] == null) {
          return false;
        }
      }
    } else if (esperadoAccion == 'consultar') {
      if (esperadoQ != null && res.q != esperadoQ) return false;
      if (esperadoP != null && res.p != esperadoP) return false;
    }

    if (exigeReintento && !inter.huboReintento) {
      return false;
    }

    return true;
  }
}

const List<FrasePrueba> kOchoFrases = [
  FrasePrueba(
    id: 1,
    frase: 'Registra al cliente Juan Pérez, corte de barba, 10 bolivianos',
    esperadoAccion: 'crear',
    esperadoClase: 'Atencion',
    esperadoCampos: ['cliente', 'servicio', 'monto'],
    exigeReintento: true,
  ),
  FrasePrueba(
    id: 2,
    frase: 'Atiendo a Pedro, le estoy cortando la barba y cobro 10 Bs',
    esperadoAccion: 'crear',
    esperadoClase: 'Atencion',
    esperadoCampos: ['cliente', 'servicio', 'monto'],
  ),
  FrasePrueba(
    id: 3,
    frase: 'Regístrame al cliente Pablo Rivera, le estoy cortando la barba y cobro 10 Bs',
    esperadoAccion: 'crear',
    esperadoClase: 'Atencion',
    esperadoCampos: ['cliente', 'servicio', 'monto'],
    exigeReintento: true,
  ),
  FrasePrueba(
    id: 4,
    frase: 'Nuevo cliente Raúl Vega',
    esperadoAccion: 'crear',
    esperadoClase: 'Cliente',
    esperadoCampos: ['nombre'],
  ),
  FrasePrueba(
    id: 5,
    frase: 'Registra al cliente Elías Mora, teléfono 71122334',
    esperadoAccion: 'crear',
    esperadoClase: 'Cliente',
    esperadoCampos: ['nombre', 'telefono'],
  ),
  FrasePrueba(
    id: 6,
    frase: 'Muéstrame las atenciones de hoy',
    esperadoAccion: 'consultar',
    esperadoClase: 'Atencion',
    esperadoQ: 'lista',
    esperadoP: 'hoy',
  ),
  FrasePrueba(
    id: 7,
    frase: 'Cuánta plata he ganado hoy',
    esperadoAccion: 'consultar',
    esperadoClase: 'Atencion',
    esperadoQ: 'suma',
    esperadoP: 'hoy',
  ),
  FrasePrueba(
    id: 8,
    frase: 'Cuéntame un chiste',
    esperadoAccion: 'error',
  ),
];

class PruebaIaScreen extends StatefulWidget {
  const PruebaIaScreen({super.key});

  @override
  State<PruebaIaScreen> createState() => _PruebaIaScreenState();
}

class _PruebaIaScreenState extends State<PruebaIaScreen> {
  static final Esquema esquemaBarberia = Esquema.desdeJson({
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
  });

  static final Map<String, Map<String, String>> esquemaValidador =
      esquemaBarberia.paraValidador();

  final Interprete _interprete = Interprete();
  final TextEditingController _fraseController = TextEditingController(
    text: 'Registra al cliente Juan Pérez, corte de barba, 10 bolivianos',
  );

  bool _preparando = true;
  String _estadoMensaje = 'Preparando asistente...';
  String? _errorPreparacion;
  MetricasPreparacion? _metricasPreparacion;

  bool _procesando = false;
  ResultadoInterpretacion? _ultimoResultado;

  bool _corriendoLote = false;
  final List<String> _lineasLote = [];

  @override
  void initState() {
    super.initState();
    _iniciarPreparacion();
  }

  @override
  void dispose() {
    _fraseController.dispose();
    _interprete.liberar();
    super.dispose();
  }

  Future<void> _iniciarPreparacion() async {
    setState(() {
      _preparando = true;
      _estadoMensaje = 'Preparando asistente...';
      _errorPreparacion = null;
    });

    try {
      final metricas = await _interprete.preparar();
      if (!mounted) return;
      setState(() {
        _preparando = false;
        _metricasPreparacion = metricas;
        _estadoMensaje =
            'Asistente listo.\nCarga: ${metricas.segundosCarga.toStringAsFixed(2)} s | '
            'Calentamiento: ${metricas.segundosCalentamiento.toStringAsFixed(2)} s | '
            'Total: ${metricas.segundosTotales.toStringAsFixed(2)} s';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _preparando = false;
        _errorPreparacion = e.toString();
        _estadoMensaje = 'Error en la preparación: $e';
      });
    }
  }

  Future<void> _interpretarFrase() async {
    final frase = _fraseController.text.trim();
    if (frase.isEmpty) return;

    setState(() {
      _procesando = true;
      _ultimoResultado = null;
    });

    try {
      final res = await _interprete.interpretar(frase, esquemaValidador);
      if (!mounted) return;
      setState(() {
        _ultimoResultado = res;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error al interpretar: $e')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _procesando = false;
        });
      }
    }
  }

  Future<void> _correrOchoFrases() async {
    setState(() {
      _corriendoLote = true;
      _lineasLote.clear();
      _lineasLote.add('Iniciando corrida de 8 frases...');
    });

    final nuevasLineas = <String>[];
    int aciertos = 0;

    for (final item in kOchoFrases) {
      try {
        final inter = await _interprete.interpretar(item.frase, esquemaValidador);
        final ok = item.cumple(inter);
        if (ok) aciertos++;

        final estadoStr = ok ? 'OK' : 'FALLO';
        final res = inter.resultado;
        final tiempoStr = inter.huboReintento
            ? '${inter.segundosPrimerIntento.toStringAsFixed(2)}s + ${inter.segundosReintento?.toStringAsFixed(2)}s'
            : '${inter.segundosPrimerIntento.toStringAsFixed(2)}s';

        final desc = res.tieneError
            ? 'error (${res.error})'
            : '${res.accion} ${res.clase ?? "ninguna"} ${res.campos}';

        nuevasLineas.add(
          '#${item.id} | $estadoStr | "$item.frase" | $desc | $tiempoStr',
        );
      } catch (e) {
        nuevasLineas.add('#${item.id} | FALLO | "$item.frase" | Excepción: $e');
      }

      if (mounted) {
        setState(() {
          _lineasLote.clear();
          _lineasLote.addAll(nuevasLineas);
        });
      }
    }

    nuevasLineas.add('Resultado final: $aciertos de ${kOchoFrases.length} OK');

    if (mounted) {
      setState(() {
        _lineasLote.clear();
        _lineasLote.addAll(nuevasLineas);
        _corriendoLote = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Prueba de IA'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 1. Estado de inicialización
            Card(
              color: _errorPreparacion != null
                  ? Colors.red.shade50
                  : (_preparando ? Colors.amber.shade50 : Colors.teal.shade50),
              elevation: 1,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
              child: Padding(
                padding: const EdgeInsets.all(12.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (_preparando)
                          const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        else if (_errorPreparacion != null)
                          const Icon(Icons.error_outline, color: Colors.red)
                        else
                          const Icon(Icons.check_circle_outline, color: Colors.teal),
                        const SizedBox(width: 8),
                        const Text(
                          'Estado del Intérprete Local',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _estadoMensaje,
                      style: TextStyle(
                        fontSize: 13,
                        color: _errorPreparacion != null ? Colors.red.shade900 : Colors.black87,
                      ),
                    ),
                    if (_metricasPreparacion != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Ruta: ${_metricasPreparacion!.rutaModelo}',
                        style: const TextStyle(fontSize: 11, color: Colors.black54),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // 2. Campo de texto interactivo
            TextField(
              controller: _fraseController,
              decoration: const InputDecoration(
                labelText: 'Frase a interpretar',
                border: OutlineInputBorder(),
                hintText: 'Ej. Registra al cliente Juan Pérez, corte de barba, 10 bolivianos',
              ),
              maxLines: 2,
              enabled: !_preparando && !_procesando && !_corriendoLote,
            ),
            const SizedBox(height: 8),
            ElevatedButton.icon(
              icon: const Icon(Icons.smart_toy_rounded),
              label: const Text('Interpretar'),
              onPressed: (!_preparando &&
                      _errorPreparacion == null &&
                      !_procesando &&
                      !_corriendoLote)
                  ? _interpretarFrase
                  : null,
            ),

            if (_procesando) ...[
              const SizedBox(height: 8),
              const LinearProgressIndicator(),
            ],

            // 3. Resultado de interpretación
            if (_ultimoResultado != null) ...[
              const SizedBox(height: 12),
              Card(
                elevation: 1,
                child: Padding(
                  padding: const EdgeInsets.all(12.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Resultado de la Interpretación',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                      const Divider(),
                      Text('Clase: ${_ultimoResultado!.resultado.clase ?? "ninguna"}'),
                      Text('Campos: ${_ultimoResultado!.resultado.campos}'),
                      Text('Faltantes: ${_ultimoResultado!.resultado.faltantes}'),
                      Text('Descartados: ${_ultimoResultado!.resultado.descartados}'),
                      if (_ultimoResultado!.resultado.tieneError)
                        Text(
                          'Error: ${_ultimoResultado!.resultado.error}',
                          style: const TextStyle(color: Colors.red),
                        ),
                      const SizedBox(height: 6),
                      Text(
                        'Segundos: ${_ultimoResultado!.segundosPrimerIntento.toStringAsFixed(2)} s'
                        '${_ultimoResultado!.huboReintento ? " (Reintento: ${_ultimoResultado!.segundosReintento?.toStringAsFixed(2)} s | Total: ${_ultimoResultado!.segundosTotales.toStringAsFixed(2)} s)" : ""}',
                        style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.indigo),
                      ),
                    ],
                  ),
                ),
              ),
            ],

            const SizedBox(height: 20),
            const Divider(),
            const SizedBox(height: 10),

            // 4. Botón Correr 8 frases
            ElevatedButton.icon(
              icon: const Icon(Icons.playlist_play_rounded),
              label: const Text('Correr 8 frases'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.indigo.shade50,
                foregroundColor: Colors.indigo.shade900,
              ),
              onPressed: (!_preparando &&
                      _errorPreparacion == null &&
                      !_procesando &&
                      !_corriendoLote)
                  ? _correrOchoFrases
                  : null,
            ),

            if (_corriendoLote) ...[
              const SizedBox(height: 8),
              const LinearProgressIndicator(),
            ],

            if (_lineasLote.isNotEmpty) ...[
              const SizedBox(height: 12),
              Card(
                elevation: 1,
                child: Padding(
                  padding: const EdgeInsets.all(12.0),
                  child: ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: _lineasLote.length,
                    separatorBuilder: (context, index) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final linea = _lineasLote[index];
                      final esOk = linea.contains('| OK |');
                      final esFallo = linea.contains('| FALLO |');

                      Color? textColor;
                      if (esOk) textColor = Colors.green.shade800;
                      if (esFallo) textColor = Colors.red.shade800;

                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4.0),
                        child: Text(
                          linea,
                          style: TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 12,
                            fontWeight: (esOk || esFallo) ? FontWeight.bold : FontWeight.normal,
                            color: textColor,
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
