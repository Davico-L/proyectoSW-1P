import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_template/ia/validador.dart';

void main() {
  final esquema = {
    'Cliente': {
      'nombre': 'String',
      'telefono': 'String',
    },
    'Atencion': {
      'cliente': 'String',
      'servicio': 'String',
      'monto': 'int',
    },
  };

  group('Pruebas del Validador de Salida del LLM', () {
    test('1. Reclasificación a Atencion y descarte de telefono "no disponible"', () {
      const frase = 'Registra al cliente Juan Pérez, corte de barba, 10 bolivianos';
      final salida = {
        'accion': 'crear',
        'clase': 'Cliente',
        'campos': {
          'cliente': 'Juan Pérez',
          'servicio': 'corte de barba',
          'monto': 10,
          'telefono': 'no disponible',
        },
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.accion, 'crear');
      expect(res.clase, 'Atencion');
      expect(res.campos['cliente'], 'Juan Pérez');
      expect(res.campos['servicio'], 'corte de barba');
      expect(res.campos['monto'], 10);
      expect(res.descartados, contains('telefono'));
      expect(res.faltantes, isEmpty);
    });

    test('2. Consulta con "Muéstrame las atenciones de hoy" debe quedar q=lista y p=hoy', () {
      const frase = 'Muéstrame las atenciones de hoy';
      final salida = {
        'accion': 'consultar',
        'clase': 'Atencion',
        'q': 'conteo',
        'p': 'hoy',
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.accion, 'consultar');
      expect(res.clase, 'Atencion');
      expect(res.q, 'lista');
      expect(res.p, 'hoy');
    });

    test('3. Nombre inventado no presente en la frase debe descartarse', () {
      const frase = 'Registra al cliente Juan Pérez, corte de barba, 10 bolivianos';
      final salida = {
        'accion': 'crear',
        'clase': 'Atencion',
        'campos': {
          'cliente': 'Roberto Gómez',
          'servicio': 'corte de barba',
          'monto': 10,
        },
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.descartados, contains('cliente'));
      expect(res.campos.containsKey('cliente'), isFalse);
      expect(res.faltantes, contains('cliente'));
      expect(res.campos['servicio'], 'corte de barba');
      expect(res.campos['monto'], 10);
    });

    test('4. Monto inventado no presente en la frase debe descartarse', () {
      const frase = 'Anota que atendí a Carlos Mamani con afeitado completo';
      final salida = {
        'accion': 'crear',
        'clase': 'Atencion',
        'campos': {
          'cliente': 'Carlos Mamani',
          'servicio': 'afeitado completo',
          'monto': 99,
        },
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.descartados, contains('monto'));
      expect(res.campos.containsKey('monto'), isFalse);
      expect(res.faltantes, contains('monto'));
      expect(res.campos['cliente'], 'Carlos Mamani');
      expect(res.campos['servicio'], 'afeitado completo');
    });

    test('5. Campo inexistente en la clase debe descartarse', () {
      const frase = 'Cliente Pedro Rojas, corte y barba, 35 bolivianos';
      final salida = {
        'accion': 'crear',
        'clase': 'Atencion',
        'campos': {
          'cliente': 'Pedro Rojas',
          'servicio': 'corte y barba',
          'monto': 35,
          'descuento': 5,
        },
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.descartados, contains('descuento'));
      expect(res.campos.containsKey('descuento'), isFalse);
      expect(res.campos['cliente'], 'Pedro Rojas');
      expect(res.campos['monto'], 35);
      expect(res.faltantes, isEmpty);
    });

    test('6. Creación válida de Cliente con nombre y teléfono presentes', () {
      const frase = 'Registra cliente nuevo Ana Gutiérrez, teléfono 77712345';
      final salida = {
        'accion': 'crear',
        'clase': 'Cliente',
        'campos': {
          'nombre': 'Ana Gutiérrez',
          'telefono': '77712345',
        },
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.clase, 'Cliente');
      expect(res.campos['nombre'], 'Ana Gutiérrez');
      expect(res.campos['telefono'], '77712345');
      expect(res.faltantes, isEmpty);
      expect(res.descartados, isEmpty);
    });

    test('7. Creación de Cliente sin teléfono genera campo faltante', () {
      const frase = 'Registra cliente nuevo Ana Gutiérrez';
      final salida = {
        'accion': 'crear',
        'clase': 'Cliente',
        'campos': {
          'nombre': 'Ana Gutiérrez',
        },
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.clase, 'Cliente');
      expect(res.campos['nombre'], 'Ana Gutiérrez');
      expect(res.faltantes, contains('telefono'));
    });

    test('8. Consulta con "cuántos" produce q=conteo y p=hoy', () {
      const frase = 'Cuántos clientes atendí hoy';
      final salida = {
        'accion': 'consultar',
        'clase': 'Atencion',
        'q': 'lista',
        'p': 'todo',
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.q, 'conteo');
      expect(res.p, 'hoy');
    });

    test('9. Consulta con "cantidad" produce q=conteo y p=todo (sin "hoy")', () {
      const frase = 'Dime la cantidad de clientes atendidos';
      final salida = {
        'accion': 'consultar',
        'clase': 'Atencion',
        'q': 'lista',
        'p': 'hoy',
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.q, 'conteo');
      expect(res.p, 'todo');
    });

    test('10. Consulta con "cuánto" produce q=suma y p=hoy', () {
      const frase = 'Cuánto he cobrado hoy';
      final salida = {
        'accion': 'consultar',
        'clase': 'Atencion',
        'q': 'conteo',
        'p': 'todo',
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.q, 'suma');
      expect(res.p, 'hoy');
    });

    test('11. Consulta con "total" produce q=suma', () {
      const frase = 'Dime el total de ingresos de hoy';
      final salida = {
        'accion': 'consultar',
        'clase': 'Atencion',
        'q': 'lista',
        'p': 'hoy',
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.q, 'suma');
      expect(res.p, 'hoy');
    });

    test('12. Consulta con "quiénes" produce q=lista y p=todo', () {
      const frase = 'Necesito saber a quiénes he atendido';
      final salida = {
        'accion': 'consultar',
        'clase': 'Atencion',
        'q': 'conteo',
        'p': 'hoy',
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.q, 'lista');
      expect(res.p, 'todo');
    });

    test('13. Reclasificación por mención de "bs"', () {
      const frase = 'Corte para Luis 12 bs';
      final salida = {
        'accion': 'crear',
        'clase': 'Cliente',
        'campos': {
          'cliente': 'Luis',
          'servicio': 'Corte',
          'monto': 12,
        },
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.clase, 'Atencion');
      expect(res.campos['cliente'], 'Luis');
      expect(res.campos['monto'], 12);
      expect(res.faltantes, isEmpty);
    });

    test('14. Reclasificación por mención de "boliviano" (singular)', () {
      const frase = 'Atendí a Carlos afeitado 1 boliviano';
      final salida = {
        'accion': 'crear',
        'clase': 'Cliente',
        'campos': {
          'cliente': 'Carlos',
          'servicio': 'afeitado',
          'monto': 1,
        },
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.clase, 'Atencion');
      expect(res.campos['monto'], 1);
    });

    test('15. Error si la acción del JSON es inválida o desconocida', () {
      const frase = 'Buenas tardes amigos';
      final salida = {
        'accion': 'desconocido',
        'clase': 'Atencion',
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isFalse);
      expect(res.tieneError, isTrue);
      expect(res.error, isNotNull);
    });

    test('16. Error si la clase no existe en el esquema y no hay moneda para reclasificar', () {
      const frase = 'Elimina el historial anterior';
      final salida = {
        'accion': 'crear',
        'clase': 'ServicioInexistente',
        'campos': {},
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isFalse);
      expect(res.tieneError, isTrue);
    });

    test('17. Formato compacto con claves cortas ("a", "c", "f")', () {
      const frase = 'Anota que atendí a Carlos Mamani con afeitado completo por 20 bolivianos';
      final salida = {
        'a': 'crear',
        'c': 'Atencion',
        'f': {
          'cliente': 'Carlos Mamani',
          'servicio': 'afeitado completo',
          'monto': 20,
        },
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.accion, 'crear');
      expect(res.clase, 'Atencion');
      expect(res.campos['cliente'], 'Carlos Mamani');
      expect(res.campos['servicio'], 'afeitado completo');
      expect(res.campos['monto'], 20);
      expect(res.faltantes, isEmpty);
      expect(res.descartados, isEmpty);
    });

    test('18. Coincidencia por palabras: "cortando la barba" conserva servicio "corte de barba"', () {
      const frase = 'Atiendo a Pedro, le estoy cortando la barba y cobro 10 Bs';
      final salida = {
        'accion': 'crear',
        'clase': 'Atencion',
        'campos': {
          'cliente': 'Pedro',
          'servicio': 'corte de barba',
          'monto': 10,
        },
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.campos['servicio'], 'corte de barba');
      expect(res.descartados.contains('servicio'), isFalse);
    });

    test('19. Coincidencia por palabras: "cortando la barba" descarta servicio "corte de pelo"', () {
      const frase = 'Atiendo a Pedro, le estoy cortando la barba y cobro 10 Bs';
      final salida = {
        'accion': 'crear',
        'clase': 'Atencion',
        'campos': {
          'cliente': 'Pedro',
          'servicio': 'corte de pelo',
          'monto': 10,
        },
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.campos.containsKey('servicio'), isFalse);
      expect(res.descartados, contains('servicio'));
    });

    test('20. Números con coma decimal: "cobré 10,5 bolivianos" valida monto 10.5', () {
      const frase = 'cobré 10,5 bolivianos';
      final salida = {
        'accion': 'crear',
        'clase': 'Atencion',
        'campos': {
          'monto': 10.5,
        },
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.campos['monto'], 10.5);
      expect(res.descartados.contains('monto'), isFalse);
    });

    test('21. Moneda exige palabra completa: "absoluto" sin moneda real no reclasifica la clase', () {
      const frase = 'Registro en absoluto silencio para el cliente Juan Pérez';
      final salida = {
        'accion': 'crear',
        'clase': 'Cliente',
        'campos': {
          'nombre': 'Juan Pérez',
        },
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.clase, 'Cliente');
      expect(res.campos['nombre'], 'Juan Pérez');
    });

    test('22. Caso real (a): Atencion con cliente Juan Pérez y monto 10 recuperado, faltantes solo servicio', () {
      const frase = 'Registra al cliente Juan Pérez, corte de barba, 10 bolivianos';
      final salida = {
        'a': 'crear',
        'c': 'Cliente',
        'f': {
          'nombre': 'Juan Pérez',
          'telefono': 'no disponible',
        },
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.accion, 'crear');
      expect(res.clase, 'Atencion');
      expect(res.campos['cliente'], 'Juan Pérez');
      expect(res.campos['monto'], 10);
      expect(res.faltantes, ['servicio']);
      expect(res.descartados, contains('telefono'));
    });

    test('23. Caso real (b): Registra a Juan, monto 0 descartado y en faltantes', () {
      const frase = 'Registra a Juan, le corté la barba';
      final salida = {
        'a': 'crear',
        'c': 'Atencion',
        'f': {
          'cliente': 'Juan',
          'servicio': 'corte la barba',
          'monto': 0,
        },
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.accion, 'crear');
      expect(res.clase, 'Atencion');
      expect(res.campos['cliente'], 'Juan');
      expect(res.campos['servicio'], 'corte la barba');
      expect(res.campos.containsKey('monto'), isFalse);
      expect(res.descartados, contains('monto'));
      expect(res.faltantes, contains('monto'));
    });

    test('24. Caso real (c): Muéstrame las atenciones de hoy, modelo q conteo p hoy queda lista hoy', () {
      const frase = 'Muéstrame las atenciones de hoy';
      final salida = {
        'a': 'consultar',
        'c': 'Atencion',
        'q': 'conteo',
        'p': 'hoy',
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.accion, 'consultar');
      expect(res.clase, 'Atencion');
      expect(res.q, 'lista');
      expect(res.p, 'hoy');
    });

    test('25. Caso real (d): Cuánto he ganado en total, modelo q conteo p todo queda suma todo', () {
      const frase = 'Cuánto he ganado en total';
      final salida = {
        'a': 'consultar',
        'c': 'Atencion',
        'q': 'conteo',
        'p': 'todo',
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.accion, 'consultar');
      expect(res.clase, 'Atencion');
      expect(res.q, 'suma');
      expect(res.p, 'todo');
    });

    test('26. Caso real (e): Dime cuántos clientes tengo, modelo Atencion conteo hoy pasa a Cliente conteo todo', () {
      const frase = 'Dime cuántos clientes tengo';
      final salida = {
        'a': 'consultar',
        'c': 'Atencion',
        'q': 'conteo',
        'p': 'hoy',
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.accion, 'consultar');
      expect(res.clase, 'Cliente');
      expect(res.q, 'conteo');
      expect(res.p, 'todo');
    });

    test('27. Caso real (f): Quiénes son mis clientes, modelo Atencion lista todo pasa a Cliente lista todo', () {
      const frase = 'Quiénes son mis clientes';
      final salida = {
        'a': 'consultar',
        'c': 'Atencion',
        'q': 'lista',
        'p': 'todo',
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.accion, 'consultar');
      expect(res.clase, 'Cliente');
      expect(res.q, 'lista');
      expect(res.p, 'todo');
    });

    test('28. Caso real (g): Hola buenos días sin dominio devuelve error no entendí', () {
      const frase = 'Hola buenos días';
      final salida = {
        'a': 'consultar',
        'c': 'Atencion',
        'q': 'conteo',
        'p': 'hoy',
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isFalse);
      expect(res.tieneError, isTrue);
      expect(res.error, 'no entendí');
    });

    test('29. Caso real (h): Necesito saber a quiénes he atendido con atend sigue en Atencion', () {
      const frase = 'Necesito saber a quiénes he atendido';
      final salida = {
        'a': 'consultar',
        'c': 'Atencion',
        'q': 'lista',
        'p': 'todo',
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.clase, 'Atencion');
      expect(res.q, 'lista');
      expect(res.p, 'todo');
    });

    test('30. Caso real (i): Cuántas atenciones tuvo el cliente Juan con 2 clases sigue en Atencion', () {
      const frase = 'Cuántas atenciones tuvo el cliente Juan';
      final salida = {
        'a': 'consultar',
        'c': 'Atencion',
        'q': 'conteo',
        'p': 'todo',
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.clase, 'Atencion');
      expect(res.q, 'conteo');
      expect(res.p, 'todo');
    });

    test('31. Regla (3): Si q es suma y clase final Cliente no tiene campo numérico, q pasa a conteo', () {
      const frase = 'Cuánto dinero suman mis clientes';
      final salida = {
        'a': 'consultar',
        'c': 'Cliente',
        'q': 'suma',
        'p': 'todo',
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.clase, 'Cliente');
      expect(res.q, 'conteo');
      expect(res.p, 'todo');
    });

    test('32. Error si al crear no queda ningún campo con valor tras validar', () {
      const frase = 'Registra al cliente';
      final salida = {
        'a': 'crear',
        'c': 'Cliente',
        'f': {
          'nombre': 'Carlos Inventado',
        },
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isFalse);
      expect(res.tieneError, isTrue);
      expect(res.error, 'No se pudo validar ningún campo para crear');
    });

    test('33. Test (a): "Cuánto dinero entró hoy", modelo Atencion suma hoy, es válida con suma hoy', () {
      const frase = 'Cuánto dinero entró hoy';
      final salida = {
        'a': 'consultar',
        'c': 'Atencion',
        'q': 'suma',
        'p': 'hoy',
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.accion, 'consultar');
      expect(res.clase, 'Atencion');
      expect(res.q, 'suma');
      expect(res.p, 'hoy');
    });

    test('34. Test (b): "Cuéntame un chiste", modelo Atencion con servicio pero sin primer campo da error no entendí', () {
      const frase = 'Cuéntame un chiste';
      final salida = {
        'a': 'crear',
        'c': 'Atencion',
        'f': {
          'cliente': 'Cliente',
          'servicio': 'chiste',
          'monto': 0,
        },
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isFalse);
      expect(res.tieneError, isTrue);
      expect(res.error, 'no entendí');
    });

    test('35. Test (c): "Registra a Tomás", modelo Cliente con nombre Tomás y telefono "" queda válida con nombre y telefono en faltantes', () {
      const frase = 'Registra a Tomás';
      final salida = {
        'a': 'crear',
        'c': 'Cliente',
        'f': {
          'nombre': 'Tomás',
          'telefono': '',
        },
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.accion, 'crear');
      expect(res.clase, 'Cliente');
      expect(res.campos['nombre'], 'Tomás');
      expect(res.campos.containsKey('telefono'), isFalse);
      expect(res.descartados, contains('telefono'));
      expect(res.faltantes, contains('telefono'));
    });

    test('36. Test (d): "Agrega a Marta Soliz con el número 70011223", debe quedar válida con nombre y teléfono', () {
      const frase = 'Agrega a Marta Soliz con el número 70011223';
      final salida = {
        'a': 'crear',
        'c': 'Cliente',
        'f': {
          'nombre': 'Marta Soliz',
          'telefono': '70011223',
        },
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.accion, 'crear');
      expect(res.clase, 'Cliente');
      expect(res.campos['nombre'], 'Marta Soliz');
      expect(res.campos['telefono'], '70011223');
      expect(res.faltantes, isEmpty);
      expect(res.descartados, isEmpty);
    });

    test('37. Test (e): "Nuevo cliente Luis Rojas", modelo con telefono igual a frase completa se descarta y queda en faltantes', () {
      const frase = 'Nuevo cliente Luis Rojas';
      final salida = {
        'a': 'crear',
        'c': 'Cliente',
        'f': {
          'nombre': 'Luis Rojas',
          'telefono': 'Nuevo cliente Luis Rojas',
        },
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.campos['nombre'], 'Luis Rojas');
      expect(res.campos.containsKey('telefono'), isFalse);
      expect(res.descartados, contains('telefono'));
      expect(res.faltantes, contains('telefono'));
    });

    test('38. Test (f): "Añade al cliente Roberto", modelo con telefono "12345678" se descarta por no estar en la frase', () {
      const frase = 'Añade al cliente Roberto';
      final salida = {
        'a': 'crear',
        'c': 'Cliente',
        'f': {
          'nombre': 'Roberto',
          'telefono': '12345678',
        },
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.campos['nombre'], 'Roberto');
      expect(res.campos.containsKey('telefono'), isFalse);
      expect(res.descartados, contains('telefono'));
      expect(res.faltantes, contains('telefono'));
    });

    test('39. Test (g): Teléfono de 5 dígitos que sí aparece en la frase se descarta por la regla de 7 dígitos', () {
      const frase = 'Nuevo cliente Ana teléfono 12345';
      final salida = {
        'a': 'crear',
        'c': 'Cliente',
        'f': {
          'nombre': 'Ana',
          'telefono': '12345',
        },
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.campos['nombre'], 'Ana');
      expect(res.campos.containsKey('telefono'), isFalse);
      expect(res.descartados, contains('telefono'));
      expect(res.faltantes, contains('telefono'));
    });

    test('40. Regla de exclusión de clases en consultas: "Cuántos clientes he atendido", modelo Atencion conteo todo, sigue en Atencion', () {
      const frase = 'Cuántos clientes he atendido';
      final salida = {
        'a': 'consultar',
        'c': 'Atencion',
        'q': 'conteo',
        'p': 'todo',
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.accion, 'consultar');
      expect(res.clase, 'Atencion');
      expect(res.q, 'conteo');
      expect(res.p, 'todo');
    });

    test('41. Test (a): "Cuánta plata he ganado hoy", modelo Atencion suma hoy, debe quedar suma hoy', () {
      const frase = 'Cuánta plata he ganado hoy';
      final salida = {
        'a': 'consultar',
        'c': 'Atencion',
        'q': 'suma',
        'p': 'hoy',
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.accion, 'consultar');
      expect(res.clase, 'Atencion');
      expect(res.q, 'suma');
      expect(res.p, 'hoy');
    });

    test('42. Test (b): "Cuántas atenciones hice hoy", modelo Atencion conteo hoy, debe seguir en conteo', () {
      const frase = 'Cuántas atenciones hice hoy';
      final salida = {
        'a': 'consultar',
        'c': 'Atencion',
        'q': 'conteo',
        'p': 'hoy',
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.accion, 'consultar');
      expect(res.clase, 'Atencion');
      expect(res.q, 'conteo');
      expect(res.p, 'hoy');
    });

    test('43. Test (c): "Cuánta plata he ganado hoy", modelo Atencion lista hoy, debe quedar suma hoy', () {
      const frase = 'Cuánta plata he ganado hoy';
      final salida = {
        'a': 'consultar',
        'c': 'Atencion',
        'q': 'lista',
        'p': 'hoy',
      };

      final res = validar(frase, salida, esquema);

      expect(res.esValido, isTrue);
      expect(res.accion, 'consultar');
      expect(res.clase, 'Atencion');
      expect(res.q, 'suma');
      expect(res.p, 'hoy');
    });
  });
}
