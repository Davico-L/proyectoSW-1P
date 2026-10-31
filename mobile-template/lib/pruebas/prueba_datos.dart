import 'package:flutter/material.dart';
import 'package:mobile_template/datos/repositorio.dart';
import 'package:mobile_template/esquema/esquema.dart';

class PruebaDatosScreen extends StatefulWidget {
  const PruebaDatosScreen({super.key});

  @override
  State<PruebaDatosScreen> createState() => _PruebaDatosScreenState();
}

class _PruebaDatosScreenState extends State<PruebaDatosScreen> {
  static final Esquema esquemaPrueba = Esquema.desdeJson({
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
  });

  final List<String> _lineasResultado = [];
  bool _cargando = false;

  Future<void> _ejecutarEscribirYLeer() async {
    setState(() {
      _cargando = true;
      _lineasResultado.clear();
      _lineasResultado.add('Iniciando prueba: Escribir y leer...');
    });

    try {
      final repo = await Repositorio.abrir(esquemaPrueba);

      // Limpiamos las tablas para garantizar repetibilidad estricta
      await repo.db.delete('atencion');
      await repo.db.delete('cliente');

      // Inserciones
      await repo.insertar('Atencion', {
        'cliente': 'Juan Pérez',
        'servicio': 'corte de barba',
        'monto': 10,
      });

      await repo.insertar('Atencion', {
        'cliente': 'juan perez',
        'servicio': 'afeitado',
        'monto': 5.5,
      });

      await repo.insertar('Atencion', {
        'cliente': 'Marta Soliz',
        'servicio': 'tinte',
        'monto': 80,
      });

      final nuevasLineas = <String>[];

      // Verificación 1: Cliente tiene 2 registros (Juan se reutilizó)
      final clientes = await repo.listar('Cliente');
      final cond1 = clientes.length == 2;
      nuevasLineas.add(
        '${cond1 ? "OK" : "FALLO"}: Cliente tiene 2 registros (Juan se reutilizó)',
      );

      // Verificación 2: conteo de Atencion es 3
      final conteoAtencion = await repo.consultar('Atencion', 'conteo', 'todo');
      final cond2 = conteoAtencion == 3;
      nuevasLineas.add(
        '${cond2 ? "OK" : "FALLO"}: conteo de Atencion es 3',
      );

      // Verificación 3: suma de Atencion es 95.5
      final sumaAtencion = await repo.consultar('Atencion', 'suma', 'todo');
      final cond3 = (sumaAtencion is num) && (sumaAtencion - 95.5).abs() < 0.001;
      nuevasLineas.add(
        '${cond3 ? "OK" : "FALLO"}: suma de Atencion es 95.5',
      );

      // Verificación 4: listar Atencion devuelve el nombre de cliente y no un id
      final listaAtencion = await repo.listar('Atencion');
      final bool cond4 = listaAtencion.isNotEmpty &&
          listaAtencion.every(
            (a) => a['cliente'] is String && !a.containsKey('cliente_id'),
          );
      nuevasLineas.add(
        '${cond4 ? "OK" : "FALLO"}: listar Atencion devuelve el nombre de cliente y no un id',
      );

      // Verificación 5: conteo hoy es 3
      final conteoHoy = await repo.consultar('Atencion', 'conteo', 'hoy');
      final cond5 = conteoHoy == 3;
      nuevasLineas.add(
        '${cond5 ? "OK" : "FALLO"}: conteo hoy es 3',
      );

      setState(() {
        _lineasResultado.clear();
        _lineasResultado.addAll(nuevasLineas);
      });
    } catch (e, st) {
      setState(() {
        _lineasResultado.add('ERROR: $e');
        _lineasResultado.add(st.toString());
      });
    } finally {
      setState(() {
        _cargando = false;
      });
    }
  }

  Future<void> _ejecutarSoloLeer() async {
    setState(() {
      _cargando = true;
      _lineasResultado.clear();
      _lineasResultado.add('Abriendo base de datos para lectura...');
    });

    try {
      final repo = await Repositorio.abrir(esquemaPrueba);

      final countCliente = await repo.consultar('Cliente', 'conteo', 'todo');
      final countAtencion = await repo.consultar('Atencion', 'conteo', 'todo');
      final atenciones = await repo.listar('Atencion');

      final nuevasLineas = <String>[
        'Registros en Cliente: $countCliente',
        'Registros en Atencion: $countAtencion',
        '--- Lista de Atencion ---',
      ];

      if (atenciones.isEmpty) {
        nuevasLineas.add('(Sin registros en Atencion)');
      } else {
        for (final item in atenciones) {
          nuevasLineas.add(
            '• ID: ${item['id_local']} | Cliente: ${item['cliente']} | Servicio: ${item['servicio']} | Monto: ${item['monto']} | Creado: ${item['creado_en']}',
          );
        }
      }

      setState(() {
        _lineasResultado.clear();
        _lineasResultado.addAll(nuevasLineas);
      });
    } catch (e, st) {
      setState(() {
        _lineasResultado.add('ERROR: $e');
        _lineasResultado.add(st.toString());
      });
    } finally {
      setState(() {
        _cargando = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Prueba de datos'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.edit_note_rounded),
                    label: const Text('Escribir y leer'),
                    onPressed: _cargando ? null : _ejecutarEscribirYLeer,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.visibility_rounded),
                    label: const Text('Solo leer'),
                    onPressed: _cargando ? null : _ejecutarSoloLeer,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (_cargando) const LinearProgressIndicator(),
            const SizedBox(height: 8),
            Expanded(
              child: Card(
                elevation: 1,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(12.0),
                  child: _lineasResultado.isEmpty
                      ? const Center(
                          child: Text(
                            'Toca "Escribir y leer" o "Solo leer" para iniciar.',
                            style: TextStyle(color: Colors.grey),
                          ),
                        )
                      : ListView.separated(
                          itemCount: _lineasResultado.length,
                          separatorBuilder: (context, index) => const Divider(height: 1),
                          itemBuilder: (context, index) {
                            final linea = _lineasResultado[index];
                            final esOk = linea.startsWith('OK');
                            final esFallo = linea.startsWith('FALLO');

                            Color? textColor;
                            if (esOk) textColor = Colors.green.shade800;
                            if (esFallo) textColor = Colors.red.shade800;

                            return Padding(
                              padding: const EdgeInsets.symmetric(vertical: 4.0),
                              child: Text(
                                linea,
                                style: TextStyle(
                                  fontWeight: (esOk || esFallo)
                                      ? FontWeight.bold
                                      : FontWeight.normal,
                                  color: textColor,
                                  fontFamily: 'monospace',
                                  fontSize: 13,
                                ),
                              ),
                            );
                          },
                        ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
