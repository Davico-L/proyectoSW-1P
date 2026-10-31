import 'package:flutter/material.dart';
import 'package:sqflite/sqflite.dart';
import 'package:mobile_template/datos/repositorio.dart';
import 'package:mobile_template/esquema/esquema.dart';
import 'package:mobile_template/esquema/esquema_barberia.dart';
import 'package:mobile_template/ia/resumen.dart';
import 'package:mobile_template/ia/servicio_ia.dart';
import 'package:mobile_template/voz/servicio_voz.dart';

class PantallaVoz extends StatefulWidget {
  const PantallaVoz({super.key});

  @override
  State<PantallaVoz> createState() => _PantallaVozState();
}

class _PantallaVozState extends State<PantallaVoz> {
  final ServicioIa _servicioIa = ServicioIa.instancia;
  final ServicioVoz _servicioVoz = ServicioVoz();
  static final Map<String, Map<String, String>> _esquemaValidador =
      esquemaBarberia.paraValidador();

  Repositorio? _repositorio;
  int _totalPendientes = 0;

  bool _preparando = true;
  String _estadoMensaje = 'Preparando asistente...';
  String? _errorModelo;

  bool _grabando = false;
  bool _procesando = false;

  // Mensajes al usuario
  String? _mensajeVozVacio;
  String? _mensajeError;
  String? _mensajeExito;

  // Flujo de consulta
  String? _respuestaConsultaTexto;

  // Flujo de creación
  ClaseEsq? _claseCrear;
  String? _resumenCrearTexto;
  final Map<String, TextEditingController> _controladores = {};
  final Map<String, String?> _erroresCampos = {};
  final Set<String> _camposFaltantes = {};
  bool _guardando = false;

  @override
  void initState() {
    super.initState();
    _servicioVoz.addListener(_onVozActualizada);
    _iniciarTodo();
  }

  @override
  void dispose() {
    _servicioVoz.removeListener(_onVozActualizada);
    _servicioVoz.dispose();
    for (final c in _controladores.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _onVozActualizada() {
    if (mounted) {
      setState(() {});
    }
  }

  Future<void> _iniciarTodo() async {
    setState(() {
      _preparando = true;
      _estadoMensaje = 'Preparando asistente...';
      _errorModelo = null;
    });

    try {
      // 1. Abrir Repositorio una sola vez con el esquema oficial de barbería
      _repositorio ??= await Repositorio.abrir(esquemaBarberia);
      await _actualizarPendientes();

      // 2. Preparar el servicio compartido de IA (si no está listo)
      if (!_servicioIa.estaListo) {
        await _servicioIa.preparar();
      }

      // 3. Inicializar reconocimiento de voz (es_US, onDevice)
      final vozOk = await _servicioVoz.inicializar();
      if (!vozOk && mounted) {
        _mensajeError = _servicioVoz.ultimoError;
      }

      if (mounted) {
        setState(() {
          _preparando = false;
          _estadoMensaje = 'Toca el micrófono para comenzar';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _preparando = false;
          _errorModelo = e.toString();
          _estadoMensaje = 'No se pudo iniciar el asistente';
        });
      }
    }
  }

  Future<void> _actualizarPendientes() async {
    if (_repositorio == null) return;
    int count = 0;
    for (final c in esquemaBarberia.clases) {
      final tabla = esquemaBarberia.nombreTabla(c);
      final res = await _repositorio!.db.rawQuery(
        'SELECT COUNT(*) as c FROM $tabla WHERE sincronizado = 0',
      );
      count += Sqflite.firstIntValue(res) ?? 0;
    }
    if (mounted) {
      setState(() {
        _totalPendientes = count;
      });
    }
  }

  void _limpiarFormularioCrear() {
    for (final c in _controladores.values) {
      c.dispose();
    }
    _controladores.clear();
    _erroresCampos.clear();
    _camposFaltantes.clear();
    _claseCrear = null;
    _resumenCrearTexto = null;
    _guardando = false;
  }

  static String _normalizarTexto(String texto) {
    var res = texto.trim().toLowerCase();
    const conAcento = 'áàäâãéèëêíìïîóòöôõúùüûñ';
    const sinAcento = 'aaaaaeeeeiiiiooooouuuun';
    for (int i = 0; i < conAcento.length; i++) {
      res = res.replaceAll(conAcento[i], sinAcento[i]);
    }
    res = res.replaceAll(RegExp(r'\s+'), ' ');
    return res;
  }

  static String _formatearValorInicial(dynamic v) {
    if (v == null) return '';
    if (v is double) {
      if (v == v.roundToDouble()) {
        return v.toInt().toString();
      }
    }
    return v.toString();
  }

  Future<void> _toggleGrabacion() async {
    if (_preparando || _procesando || _guardando || _errorModelo != null) return;

    if (!_grabando) {
      // Iniciar escucha
      setState(() {
        _grabando = true;
        _mensajeVozVacio = null;
        _mensajeError = null;
        _mensajeExito = null;
        _respuestaConsultaTexto = null;
        _limpiarFormularioCrear();
      });

      await _servicioVoz.iniciar();
    } else {
      // Tocar de nuevo para enviar
      setState(() {
        _grabando = false;
        _procesando = true;
      });

      final textoFinal = await _servicioVoz.detener();
      final frase = textoFinal.trim();

      // Si reconocimiento devuelve texto vacío, avisa y no llama al modelo
      if (frase.isEmpty) {
        if (mounted) {
          setState(() {
            _procesando = false;
            _mensajeVozVacio = 'No te escuché, intenta de nuevo';
          });
        }
        return;
      }

      // Procesar con IA
      try {
        final resInter = await _servicioIa.interpretar(frase, _esquemaValidador);
        final resultado = resInter.resultado;

        if (!mounted) return;

        // Si el resultado es un error o inválido
        if (resultado.tieneError || !resultado.esValido || resultado.accion == null) {
          setState(() {
            _procesando = false;
            _mensajeError = 'No te entendí, intenta de nuevo';
          });
          return;
        }

        // Caso: Consultar (sin confirmación)
        if (resultado.accion == 'consultar') {
          final clase = resultado.clase ?? 'Atencion';
          final q = resultado.q ?? 'lista';
          final p = resultado.p ?? 'hoy';

          final datos = await _repositorio!.consultar(clase, q, p);
          final textoResp = respuestaConsulta(q, p, clase, datos, esquemaBarberia);

          setState(() {
            _procesando = false;
            _respuestaConsultaTexto = textoResp;
          });
          return;
        }

        // Caso: Crear (mostrar resumen y formulario editable)
        if (resultado.accion == 'crear') {
          final nombreClase = resultado.clase ?? 'Atencion';
          ClaseEsq? claseEsq;
          for (final c in esquemaBarberia.clases) {
            if (c.nombre.toLowerCase() == nombreClase.toLowerCase()) {
              claseEsq = c;
              break;
            }
          }

          if (claseEsq == null) {
            setState(() {
              _procesando = false;
              _mensajeError = 'No te entendí, intenta de nuevo';
            });
            return;
          }

          _limpiarFormularioCrear();
          _claseCrear = claseEsq;
          _resumenCrearTexto = resumenCrear(resultado, esquemaBarberia);
          _camposFaltantes.addAll(resultado.faltantes);

          for (final campo in claseEsq.campos) {
            final val = resultado.campos[campo.nombre];
            final textoVal = val != null ? _formatearValorInicial(val) : '';
            _controladores[campo.nombre] = TextEditingController(text: textoVal);
            _erroresCampos[campo.nombre] = null;
          }

          setState(() {
            _procesando = false;
          });
          return;
        }

        // Cualquier otra acción desconocida
        setState(() {
          _procesando = false;
          _mensajeError = 'No te entendí, intenta de nuevo';
        });
      } catch (e) {
        if (!mounted) return;
        setState(() {
          _procesando = false;
          _mensajeError = 'No te entendí, intenta de nuevo';
        });
      }
    }
  }

  Future<void> _confirmarCrear() async {
    if (_guardando || _claseCrear == null || _repositorio == null) return;

    setState(() {
      _erroresCampos.clear();
      _mensajeExito = null;
    });

    bool hayError = false;
    final primerCampo = _claseCrear!.campos.first;
    final primerValor = _controladores[primerCampo.nombre]?.text.trim() ?? '';

    // 1. Exige el primer campo no vacío
    if (primerValor.isEmpty) {
      _erroresCampos[primerCampo.nombre] = 'El primer campo no puede estar vacío';
      hayError = true;
    }

    // 2. Si hay campos número, deben ser válidos (acepta coma decimal)
    for (final campo in _claseCrear!.campos) {
      if (campo.tipo == 'numero') {
        final val = _controladores[campo.nombre]?.text.trim() ?? '';
        if (val.isNotEmpty) {
          final normalizado = val.replaceAll(',', '.');
          if (double.tryParse(normalizado) == null) {
            _erroresCampos[campo.nombre] = 'Debe ser un número válido';
            hayError = true;
          }
        }
      }
    }

    if (hayError) {
      setState(() {});
      return;
    }

    // 3. Si es crear de una clase sin campos ref (ej. Cliente),
    // y ya existe un registro con ese primer campo igual (sin mayúsculas ni acentos), avisa "Ya existe" y no inserta
    final tieneRefs = _claseCrear!.campos.any((c) => c.tipo == 'ref');
    if (!tieneRefs) {
      final tabla = esquemaBarberia.nombreTabla(_claseCrear!);
      final filas = await _repositorio!.db.query(tabla);
      final primerNorm = _normalizarTexto(primerValor);
      bool yaExiste = false;

      for (final f in filas) {
        final valExistente = f[primerCampo.nombre];
        if (valExistente != null && _normalizarTexto(valExistente.toString()) == primerNorm) {
          yaExiste = true;
          break;
        }
      }

      if (yaExiste) {
        setState(() {
          _mensajeExito = 'Ya existe';
        });
        return;
      }
    }

    // 4. Guardar deshabilitando botón para evitar doble toque
    setState(() {
      _guardando = true;
    });

    try {
      final camposAInsertar = <String, dynamic>{};
      for (final campo in _claseCrear!.campos) {
        final val = _controladores[campo.nombre]?.text.trim() ?? '';
        if (val.isNotEmpty) {
          if (campo.tipo == 'numero') {
            camposAInsertar[campo.nombre] = double.parse(val.replaceAll(',', '.'));
          } else {
            camposAInsertar[campo.nombre] = val;
          }
        }
      }

      await _repositorio!.insertar(_claseCrear!.nombre, camposAInsertar);
      await _actualizarPendientes();

      setState(() {
        _guardando = false;
        _limpiarFormularioCrear();
        _mensajeExito = 'Guardado';
      });
    } catch (e) {
      setState(() {
        _guardando = false;
        _mensajeError = 'Error al guardar: $e';
      });
    }
  }

  void _cancelarCrear() {
    setState(() {
      _limpiarFormularioCrear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final bool micHabilitado = !_preparando && !_procesando && !_guardando && _errorModelo == null;
    final String textoEnVivo = _servicioVoz.textoParcial;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Asistente'),
        centerTitle: true,
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          decoration: BoxDecoration(
            color: Colors.grey.shade50,
            border: Border(top: BorderSide(color: Colors.grey.shade300)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '$_totalPendientes pendientes',
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
              ),
              if (_procesando)
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
            ],
          ),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Error si falta el modelo
              if (_errorModelo != null) ...[
                Card(
                  color: Colors.red.shade50,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                    side: BorderSide(color: Colors.red.shade300),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.error_outline, color: Colors.red),
                            const SizedBox(width: 8),
                            const Text(
                              'Modelo no encontrado',
                              style: TextStyle(fontWeight: FontWeight.bold, color: Colors.red),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        SelectableText(
                          _errorModelo!,
                          style: TextStyle(color: Colors.red.shade900, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Estado / Feedback en tiempo real
              _buildBarraEstado(),
              const SizedBox(height: 16),

              // Caja de texto en vivo
              _buildCajaTextoEnVivo(textoEnVivo),
              const SizedBox(height: 16),

              // Notificaciones de usuario
              if (_mensajeVozVacio != null) _buildCardAviso(_mensajeVozVacio!, Colors.amber),
              if (_mensajeError != null) _buildCardAviso(_mensajeError!, Colors.red),
              if (_mensajeExito != null)
                _buildCardAviso(
                  _mensajeExito!,
                  _mensajeExito == 'Ya existe' ? Colors.amber : Colors.green,
                ),

              // Botón grande de micrófono
              _buildBotonMicrofono(micHabilitado),
              const SizedBox(height: 24),

              // Respuesta de consulta directa
              if (_respuestaConsultaTexto != null) ...[
                Card(
                  elevation: 2,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Resultado',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                        const Divider(height: 16),
                        SelectableText(
                          _respuestaConsultaTexto!,
                          style: const TextStyle(fontSize: 16, height: 1.4),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Formulario editable para crear con Confirmar / Cancelar
              if (_claseCrear != null && _resumenCrearTexto != null) ...[
                _buildFormularioCrear(),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBarraEstado() {
    String mensaje = _estadoMensaje;
    if (_preparando) {
      mensaje = 'Preparando asistente...';
    } else if (_procesando) {
      mensaje = 'Procesando...';
    } else if (_grabando) {
      mensaje = 'Escuchando...';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 10.0),
      decoration: BoxDecoration(
        color: _grabando ? Colors.red.shade50 : Colors.indigo.shade50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: _grabando ? Colors.red.shade200 : Colors.indigo.shade200,
        ),
      ),
      child: Row(
        children: [
          if (_preparando || _procesando)
            const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          else
            Icon(
              _grabando ? Icons.mic : Icons.smart_toy_outlined,
              size: 20,
              color: _grabando ? Colors.red : Colors.indigo,
            ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              mensaje,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 14,
                color: _grabando ? Colors.red.shade800 : Colors.indigo.shade900,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCajaTextoEnVivo(String textoEnVivo) {
    final bool activa = _grabando;
    final String contenido = activa
        ? (textoEnVivo.isEmpty ? 'Habla ahora...' : textoEnVivo)
        : (textoEnVivo.isNotEmpty ? textoEnVivo : 'Presiona el micrófono para hablar.');

    return Container(
      constraints: const BoxConstraints(minHeight: 100),
      padding: const EdgeInsets.all(14.0),
      decoration: BoxDecoration(
        color: activa ? Colors.red.shade50 : Colors.grey.shade100,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: activa ? Colors.red.shade300 : Colors.grey.shade300,
          width: 1.5,
        ),
      ),
      child: Text(
        contenido,
        style: TextStyle(
          fontSize: 16,
          height: 1.35,
          color: (activa && textoEnVivo.isEmpty) || (!activa && textoEnVivo.isEmpty)
              ? Colors.grey.shade600
              : Colors.black87,
          fontStyle: (activa && textoEnVivo.isEmpty) || (!activa && textoEnVivo.isEmpty)
              ? FontStyle.italic
              : FontStyle.normal,
        ),
      ),
    );
  }

  Widget _buildCardAviso(String texto, MaterialColor color) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16.0),
      padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 10.0),
      decoration: BoxDecoration(
        color: color.shade50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.shade300),
      ),
      child: Row(
        children: [
          Icon(
            color == Colors.green ? Icons.check_circle_outline : Icons.info_outline,
            color: color.shade800,
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              texto,
              style: TextStyle(
                color: color.shade900,
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBotonMicrofono(bool habilitado) {
    Color bg = Colors.indigo;
    IconData icono = Icons.mic_none;
    String etiqueta = 'Tocar para grabar';

    if (_preparando) {
      bg = Colors.grey.shade400;
      etiqueta = 'Preparando asistente...';
    } else if (_procesando) {
      bg = Colors.grey.shade400;
      etiqueta = 'Procesando...';
    } else if (_grabando) {
      bg = Colors.red.shade600;
      icono = Icons.send_rounded;
      etiqueta = 'Tocar para enviar';
    }

    return Center(
      child: Column(
        children: [
          SizedBox(
            width: 88,
            height: 88,
            child: FloatingActionButton(
              heroTag: 'mic_asistente_voz',
              elevation: _grabando ? 8 : 3,
              backgroundColor: bg,
              onPressed: habilitado ? _toggleGrabacion : null,
              shape: const CircleBorder(),
              child: Icon(
                icono,
                size: 42,
                color: Colors.white,
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            etiqueta,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: _grabando ? Colors.red.shade700 : Colors.indigo.shade800,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFormularioCrear() {
    return Card(
      elevation: 3,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Resumen de la acción
            Text(
              _resumenCrearTexto ?? '',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.indigo,
              ),
            ),
            const Divider(height: 20),

            // Campo editable por cada campo del esquema
            for (final campo in _claseCrear!.campos) ...[
              Builder(builder: (context) {
                final ctrl = _controladores[campo.nombre]!;
                final error = _erroresCampos[campo.nombre];
                final esFaltante = _camposFaltantes.contains(campo.nombre) || ctrl.text.trim().isEmpty;

                return Padding(
                  padding: const EdgeInsets.only(bottom: 14.0),
                  child: TextField(
                    controller: ctrl,
                    enabled: !_guardando,
                    keyboardType: campo.tipo == 'numero'
                        ? const TextInputType.numberWithOptions(decimal: true)
                        : TextInputType.text,
                    decoration: InputDecoration(
                      labelText: campo.nombre,
                      border: const OutlineInputBorder(),
                      helperText: esFaltante ? 'falta completar' : null,
                      helperStyle: TextStyle(
                        color: Colors.orange.shade800,
                        fontWeight: FontWeight.w600,
                      ),
                      errorText: error,
                    ),
                  ),
                );
              }),
            ],

            const SizedBox(height: 10),

            // Botones Confirmar y Cancelar
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _guardando ? null : _cancelarCrear,
                    child: const Text('Cancelar'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _guardando ? null : _confirmarCrear,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.indigo,
                      foregroundColor: Colors.white,
                    ),
                    child: _guardando
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Confirmar'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
