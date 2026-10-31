import 'package:flutter/material.dart';
import 'package:mobile_template/esquema/esquema.dart';
import 'package:mobile_template/ia/interprete.dart';
import 'package:mobile_template/ia/servicio_ia.dart';
import 'package:mobile_template/voz/servicio_voz.dart';

class PruebaVozScreen extends StatefulWidget {
  const PruebaVozScreen({super.key});

  @override
  State<PruebaVozScreen> createState() => _PruebaVozScreenState();
}

class _PruebaVozScreenState extends State<PruebaVozScreen> {
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

  final ServicioIa _servicioIa = ServicioIa.instancia;
  final ServicioVoz _servicioVoz = ServicioVoz();

  bool _preparandoAsistente = true;
  String _estadoMensaje = 'Preparando asistente...';
  String? _errorAsistente;

  bool _grabando = false;
  bool _procesando = false;
  String? _mensajeVacio;

  String? _textoTranscrito;
  ResultadoInterpretacion? _resultadoIa;
  String? _errorInterpretacion;
  double? _segundosReconocimiento;
  double? _segundosInterpretacion;

  @override
  void initState() {
    super.initState();
    _servicioVoz.addListener(_onVozActualizada);
    _iniciarServicios();
  }

  @override
  void dispose() {
    _servicioVoz.removeListener(_onVozActualizada);
    _servicioVoz.dispose();
    super.dispose();
  }

  void _onVozActualizada() {
    if (mounted) {
      setState(() {});
    }
  }

  Future<void> _iniciarServicios() async {
    setState(() {
      _preparandoAsistente = true;
      _estadoMensaje = 'Preparando asistente...';
      _errorAsistente = null;
    });

    try {
      // 1. Preparar el modelo GGUF compartido si aún no está listo
      if (!_servicioIa.estaListo) {
        await _servicioIa.preparar();
      }

      // 2. Inicializar el servicio de reconocimiento de voz (es_US, onDevice)
      final vozOk = await _servicioVoz.inicializar();
      if (!vozOk && mounted) {
        _errorAsistente = _servicioVoz.ultimoError ?? 'Error al inicializar micrófono';
      }

      if (mounted) {
        setState(() {
          _preparandoAsistente = false;
          _estadoMensaje = _servicioIa.estaListo
              ? 'Asistente listo para escuchar'
              : 'Error en la preparación';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _preparandoAsistente = false;
          _errorAsistente = e.toString();
          _estadoMensaje = 'Error en la preparación: $e';
        });
      }
    }
  }

  Future<void> _toggleGrabacion() async {
    if (_preparandoAsistente || _procesando) return;

    if (!_grabando) {
      // Iniciar grabación (tocar para grabar)
      setState(() {
        _grabando = true;
        _mensajeVacio = null;
        _textoTranscrito = null;
        _resultadoIa = null;
        _errorInterpretacion = null;
        _segundosReconocimiento = null;
        _segundosInterpretacion = null;
      });

      await _servicioVoz.iniciar();
    } else {
      // Enviar grabación (tocar de nuevo para enviar)
      setState(() {
        _grabando = false;
        _procesando = true;
      });

      // Medir segundos del reconocimiento: desde tocar para enviar hasta texto final
      final swRec = Stopwatch()..start();
      final textoFinal = await _servicioVoz.detener();
      swRec.stop();
      final segRec = swRec.elapsedMilliseconds / 1000.0;

      final textoLimpio = textoFinal.trim();

      // Si el reconocimiento devuelve texto vacío, no llamar al modelo
      if (textoLimpio.isEmpty) {
        if (mounted) {
          setState(() {
            _procesando = false;
            _textoTranscrito = '';
            _segundosReconocimiento = segRec;
            _mensajeVacio = 'No te escuché, intenta de nuevo';
          });
        }
        return;
      }

      // Si hay texto reconocido, pasar a Interprete con el esquema Cliente/Atencion
      final swIa = Stopwatch()..start();
      ResultadoInterpretacion? resultado;
      String? errorIa;

      try {
        resultado = await _servicioIa.interpretar(textoLimpio, esquemaValidador);
      } catch (e) {
        errorIa = e.toString();
      } finally {
        swIa.stop();
      }

      final segIa = swIa.elapsedMilliseconds / 1000.0;

      if (mounted) {
        setState(() {
          _procesando = false;
          _textoTranscrito = textoLimpio;
          _resultadoIa = resultado;
          _errorInterpretacion = errorIa;
          _segundosReconocimiento = segRec;
          _segundosInterpretacion = segIa;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool micHabilitado = !_preparandoAsistente && !_procesando && _errorAsistente == null;
    final String textoEnVivo = _servicioVoz.textoParcial;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Prueba de Voz'),
        centerTitle: true,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Barra de estado del asistente
              _buildBarraEstado(),
              const SizedBox(height: 16),

              // Caja de texto en vivo / transcripción
              _buildCajaTextoEnVivo(textoEnVivo),
              const SizedBox(height: 20),

              // Mensaje de texto vacío ("No te escuché, intenta de nuevo")
              if (_mensajeVacio != null) ...[
                Card(
                  color: Colors.amber.shade100,
                  elevation: 1,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                    side: BorderSide(color: Colors.amber.shade400),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
                    child: Row(
                      children: [
                        Icon(Icons.info_outline, color: Colors.amber.shade900),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            _mensajeVacio!,
                            style: TextStyle(
                              color: Colors.amber.shade900,
                              fontWeight: FontWeight.bold,
                              fontSize: 15,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Botón grande de micrófono
              _buildBotonMicrofono(micHabilitado),
              const SizedBox(height: 24),

              // Resultados de la transcripción y de la interpretación
              if (_resultadoIa != null || _errorInterpretacion != null) ...[
                _buildCardResultados(),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBarraEstado() {
    Color bg = Colors.indigo.shade50;
    Color border = Colors.indigo.shade200;
    Widget leading = const Icon(Icons.check_circle_rounded, color: Colors.green);

    if (_preparandoAsistente) {
      bg = Colors.amber.shade50;
      border = Colors.amber.shade300;
      leading = const SizedBox(
        width: 18,
        height: 18,
        child: CircularProgressIndicator(strokeWidth: 2),
      );
    } else if (_procesando) {
      bg = Colors.deepPurple.shade50;
      border = Colors.deepPurple.shade300;
      leading = const SizedBox(
        width: 18,
        height: 18,
        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.deepPurple),
      );
    } else if (_errorAsistente != null) {
      bg = Colors.red.shade50;
      border = Colors.red.shade300;
      leading = const Icon(Icons.error_outline, color: Colors.red);
    }

    final String mensajeMostrar = _procesando
        ? 'Procesando...'
        : (_preparandoAsistente ? 'Preparando asistente...' : _estadoMensaje);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 10.0),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: border),
      ),
      child: Row(
        children: [
          leading,
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              mensajeMostrar,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: _errorAsistente != null ? Colors.red.shade900 : Colors.black87,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCajaTextoEnVivo(String textoEnVivo) {
    final bool escuchando = _grabando;
    final String textoMostrar = escuchando
        ? (textoEnVivo.isEmpty ? 'Escuchando... habla ahora' : textoEnVivo)
        : (_textoTranscrito != null
            ? _textoTranscrito!
            : 'Toca el micrófono para comenzar a dictar.');

    return Container(
      constraints: const BoxConstraints(minHeight: 120),
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: escuchando ? Colors.red.shade50 : Colors.grey.shade100,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: escuchando ? Colors.red.shade400 : Colors.grey.shade300,
          width: 2,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(
                    escuchando ? Icons.hearing_rounded : Icons.record_voice_over_rounded,
                    size: 18,
                    color: escuchando ? Colors.red.shade700 : Colors.grey.shade700,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    escuchando ? 'Voz en tiempo real:' : 'Transcripción de voz:',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: escuchando ? Colors.red.shade800 : Colors.grey.shade800,
                    ),
                  ),
                ],
              ),
              if (escuchando)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.red.shade100,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    'EN VIVO',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: Colors.red.shade900,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          SelectableText(
            textoMostrar,
            style: TextStyle(
              fontSize: 17,
              height: 1.35,
              color: (escuchando && textoEnVivo.isEmpty) ||
                      (!escuchando && _textoTranscrito == null)
                  ? Colors.grey.shade600
                  : Colors.black87,
              fontStyle: (escuchando && textoEnVivo.isEmpty) ||
                      (!escuchando && _textoTranscrito == null)
                  ? FontStyle.italic
                  : FontStyle.normal,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBotonMicrofono(bool micHabilitado) {
    Color btnColor = Colors.deepPurple;
    IconData btnIcon = Icons.mic_none;
    String btnLabel = 'Tocar para grabar';

    if (_preparandoAsistente) {
      btnColor = Colors.grey.shade400;
      btnLabel = 'Preparando asistente... (bloqueado)';
    } else if (_procesando) {
      btnColor = Colors.grey.shade400;
      btnLabel = 'Procesando... (bloqueado)';
    } else if (_grabando) {
      btnColor = Colors.red.shade600;
      btnIcon = Icons.send_rounded;
      btnLabel = 'Tocar de nuevo para enviar';
    }

    return Center(
      child: Column(
        children: [
          SizedBox(
            width: 88,
            height: 88,
            child: FloatingActionButton(
              heroTag: 'mic_btn_prueba_voz',
              elevation: _grabando ? 8 : 3,
              backgroundColor: btnColor,
              onPressed: micHabilitado ? _toggleGrabacion : null,
              shape: const CircleBorder(),
              child: Icon(
                btnIcon,
                size: 42,
                color: Colors.white,
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            btnLabel,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: _grabando ? Colors.red.shade700 : (_procesando ? Colors.grey : Colors.deepPurple),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCardResultados() {
    final res = _resultadoIa?.resultado;
    final String? errorMsg = _errorInterpretacion ?? (res?.tieneError == true ? res?.error : null);

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Resultado de la Operación',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
            ),
            const Divider(height: 20),

            // Texto transcrito tal cual
            _buildFilaDato('Texto transcrito:', _textoTranscrito ?? ''),
            const SizedBox(height: 8),

            // Métricas de tiempo
            _buildFilaDato(
              'Tiempo reconocimiento:',
              _segundosReconocimiento != null
                  ? '${_segundosReconocimiento!.toStringAsFixed(2)} s (de enviar a texto final)'
                  : '-',
            ),
            const SizedBox(height: 6),
            _buildFilaDato(
              'Tiempo interpretación:',
              _segundosInterpretacion != null
                  ? '${_segundosInterpretacion!.toStringAsFixed(2)} s'
                  : '-',
            ),
            const SizedBox(height: 8),

            // Error de interpretación si hubo
            if (errorMsg != null) ...[
              Container(
                margin: const EdgeInsets.only(top: 6),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.error_outline, color: Colors.red, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Error: $errorMsg',
                        style: TextStyle(color: Colors.red.shade900, fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
            ],

            // Clase
            if (res != null) ...[
              _buildFilaDato('Acción:', res.accion ?? '(ninguna)'),
              const SizedBox(height: 6),
              if (res.clase != null) ...[
                _buildFilaDato('Clase:', res.clase!),
                const SizedBox(height: 6),
              ],
              if (res.q != null) ...[
                _buildFilaDato('Consulta (q):', '${res.q} | periodo (p): ${res.p ?? '-'}'),
                const SizedBox(height: 6),
              ],

              // Campos
              _buildFilaDato(
                'Campos:',
                res.campos.isEmpty ? '(ninguno)' : res.campos.toString(),
              ),
              const SizedBox(height: 6),

              // Faltantes
              _buildFilaDato(
                'Faltantes:',
                res.faltantes.isEmpty ? '(ninguno)' : res.faltantes.join(', '),
              ),
              const SizedBox(height: 6),

              // Descartados
              _buildFilaDato(
                'Descartados:',
                res.descartados.isEmpty ? '(ninguno)' : res.descartados.join(', '),
              ),
              const SizedBox(height: 6),

              // Reintento
              _buildFilaDato(
                'Reintento:',
                _resultadoIa!.huboReintento
                    ? 'Sí (${_resultadoIa!.segundosReintento?.toStringAsFixed(2)} s)'
                    : 'No',
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildFilaDato(String etiqueta, String valor) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 140,
          child: Text(
            etiqueta,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          ),
        ),
        Expanded(
          child: SelectableText(
            valor,
            style: const TextStyle(fontSize: 13),
          ),
        ),
      ],
    );
  }
}
