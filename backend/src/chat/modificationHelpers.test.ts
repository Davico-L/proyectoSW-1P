import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  classifyIntent,
  normalizeForIntent,
  summarizeOperations,
  checkOperationLimit,
  detectUnsupportedAttributeRequest,
  normalizeClassName,
  convertExistingCreateToUpdate,
  MAX_OPERATIONS,
} from "./modificationHelpers";

describe("CU20: modificationHelpers", () => {
  describe("normalizeForIntent", () => {
    test("elimina menciones @Codia y @ia en cualquier posición", () => {
      assert.equal(
        normalizeForIntent("@Codia agrega una clase"),
        "agrega una clase"
      );
      assert.equal(
        normalizeForIntent("agrega una clase @ia"),
        "agrega una clase"
      );
      assert.equal(
        normalizeForIntent("por favor @CODIA crea Cliente"),
        "crea cliente"
      );
    });

    test("elimina signos ¿ y ¡", () => {
      assert.equal(
        normalizeForIntent("¿cómo estás?"),
        "como estas?"
      );
      assert.equal(
        normalizeForIntent("¡crea la clase!"),
        "crea la clase!"
      );
    });

    test("convierte a minúsculas y remueve tildes y diacríticos", () => {
      assert.equal(normalizeForIntent("AGRÉGALE"), "agregale");
      assert.equal(normalizeForIntent("¿PODRÍAS?"), "podrias?");
      assert.equal(normalizeForIntent("Añade"), "anade");
    });

    test("remueve 'por favor' inicial y colapsa espacios", () => {
      assert.equal(
        normalizeForIntent("por favor crea Usuario"),
        "crea usuario"
      );
      assert.equal(
        normalizeForIntent("Por favor,   elimina Pedido"),
        "elimina pedido"
      );
    });
  });

  describe("classifyIntent", () => {
    // 1. Casos requeridos expresamente en la especificación
    test("caso requerido: '¿cómo agrego una clase?' -> query", () => {
      assert.equal(classifyIntent("¿cómo agrego una clase?"), "query");
    });

    test("caso requerido: '¿puedes agregar el atributo edad a Cliente?' -> modification", () => {
      assert.equal(
        classifyIntent("¿puedes agregar el atributo edad a Cliente?"),
        "modification"
      );
    });

    test("caso requerido: 'agrégale el atributo precio a Producto' -> modification", () => {
      assert.equal(
        classifyIntent("agrégale el atributo precio a Producto"),
        "modification"
      );
    });

    test("caso requerido: 'AGRÉGALE' -> modification", () => {
      assert.equal(classifyIntent("AGRÉGALE"), "modification");
    });

    test("caso requerido: 'explícame cómo crear una relación' -> query", () => {
      assert.equal(
        classifyIntent("explícame cómo crear una relación"),
        "query"
      );
    });

    test("caso requerido: texto vacío -> query", () => {
      assert.equal(classifyIntent(""), "query");
      assert.equal(classifyIntent("   "), "query");
      assert.equal(classifyIntent("@Codia"), "query");
      assert.equal(classifyIntent("@ia"), "query");
    });

    test("caso requerido: pregunta que contiene un verbo de acción -> query (prevalece Regla 1)", () => {
      assert.equal(
        classifyIntent("¿Qué pasa si borro la clase Pedido?"),
        "query"
      );
      assert.equal(
        classifyIntent("¿Cómo elimino una relación entre Cliente y Orden?"),
        "query"
      );
      assert.equal(
        classifyIntent("Dime cómo conectar Producto y Categoria"),
        "query"
      );
      assert.equal(
        classifyIntent("¿Por qué quitaste el atributo email?"),
        "query"
      );
    });

    // 2. Fórmulas de cortesía (Regla 2)
    test("fórmula de cortesía: 'podrías crear la clase Carrito?' -> modification", () => {
      assert.equal(
        classifyIntent("podrías crear la clase Carrito?"),
        "modification"
      );
    });

    test("fórmula de cortesía: 'podes agregar un atributo id a Cliente?' -> modification", () => {
      assert.equal(
        classifyIntent("podes agregar un atributo id a Cliente?"),
        "modification"
      );
    });

    test("fórmula de cortesía: 'quiero que agregues la clase Item' -> modification", () => {
      assert.equal(
        classifyIntent("quiero que agregues la clase Item"),
        "modification"
      );
    });

    test("fórmula de cortesía: 'necesito que borres la clase Obsoleta' -> modification", () => {
      assert.equal(
        classifyIntent("necesito que borres la clase Obsoleta"),
        "modification"
      );
    });

    test("fórmula de cortesía: 'ayúdame a crear la relación entre Usuario y Rol' -> modification", () => {
      assert.equal(
        classifyIntent("ayúdame a crear la relación entre Usuario y Rol"),
        "modification"
      );
    });

    test("fórmula de cortesía: 'me ayudas a modificar la clase Factura' -> modification", () => {
      assert.equal(
        classifyIntent("me ayudas a modificar la clase Factura"),
        "modification"
      );
    });

    // 3. Verbos de modificación (Regla 2)
    test("verbo 'crea' y 'créame' -> modification", () => {
      assert.equal(classifyIntent("crea la clase Usuario"), "modification");
      assert.equal(classifyIntent("créame la clase Proveedor"), "modification");
    });

    test("verbo 'agrega' y 'añade' -> modification", () => {
      assert.equal(
        classifyIntent("agrega el atributo email: String a Usuario"),
        "modification"
      );
      assert.equal(
        classifyIntent("añade el método login() a Auth"),
        "modification"
      );
    });

    test("verbos de eliminación 'elimina', 'borra', 'quita' -> modification", () => {
      assert.equal(classifyIntent("elimina la clase Temp"), "modification");
      assert.equal(
        classifyIntent("borra la relación entre Pedido y Envio"),
        "modification"
      );
      assert.equal(
        classifyIntent("quita el atributo telefono de Cliente"),
        "modification"
      );
    });

    test("verbos de edición 'cambia', 'modifica', 'renombra', 'edita', 'actualiza' -> modification", () => {
      assert.equal(
        classifyIntent("cambia el tipo de saldo a Double"),
        "modification"
      );
      assert.equal(
        classifyIntent("modifica la clase Cliente para agregar direccion"),
        "modification"
      );
      assert.equal(
        classifyIntent("renombra Usuario a Cuenta"),
        "modification"
      );
      assert.equal(
        classifyIntent("edita la clase Factura"),
        "modification"
      );
      assert.equal(
        classifyIntent("actualiza Producto con precio: Double"),
        "modification"
      );
    });

    test("verbos 'pon', 'relaciona', 'conecta', 'convierte', 'haz' -> modification", () => {
      assert.equal(
        classifyIntent("pon una relación entre Orden y Detalle"),
        "modification"
      );
      assert.equal(
        classifyIntent("relaciona Cliente con Pedido"),
        "modification"
      );
      assert.equal(
        classifyIntent("conecta Estudiante con Curso"),
        "modification"
      );
      assert.equal(
        classifyIntent("convierte la relación en composición"),
        "modification"
      );
      assert.equal(
        classifyIntent("haz una nueva clase llamada Notificacion"),
        "modification"
      );
    });

    // 4. Modificación con 'por favor' inicial o mención
    test("por favor inicial con verbo de modificación -> modification", () => {
      assert.equal(
        classifyIntent("Por favor agrega la clase Tarjeta"),
        "modification"
      );
      assert.equal(
        classifyIntent("@Codia, por favor, crea la clase Categoria"),
        "modification"
      );
    });

    // 4b. Cortesía seguida de verbo de explicación o palabra interrogativa (Regla 1b) -> query
    test("fórmula de cortesía seguida de verbo de explicación -> query", () => {
      assert.equal(
        classifyIntent("¿puedes explicarme qué es una clase abstracta?"),
        "query"
      );
      assert.equal(
        classifyIntent("¿podrías decirme qué atributos tiene Cliente?"),
        "query"
      );
      assert.equal(
        classifyIntent("puedes contarme cómo se relaciona Cliente con Pedido"),
        "query"
      );
      assert.equal(
        classifyIntent("¿podrías mostrar cómo se define una herencia?"),
        "query"
      );
      assert.equal(
        classifyIntent("ayúdame a aclarar la relación entre A y B"),
        "query"
      );
    });

    test("fórmula de cortesía seguida de palabra interrogativa -> query", () => {
      assert.equal(
        classifyIntent("¿puedes qué clases faltan por definir?"),
        "query"
      );
      assert.equal(
        classifyIntent("podrías cómo conectar Cliente con Pedido?"),
        "query"
      );
    });

    test("fórmula de cortesía seguida de verbo de modificación sigue dando modification", () => {
      assert.equal(
        classifyIntent("¿puedes agregar el atributo edad a Cliente?"),
        "modification"
      );
      assert.equal(
        classifyIntent("podrías crear la clase Pedido"),
        "modification"
      );
      assert.equal(
        classifyIntent("podes eliminar la clase Obsoleta"),
        "modification"
      );
    });

    // 5. Palabras interrogativas / de explicación (Regla 1)
    test("iniciadores de pregunta y explicación -> query", () => {
      assert.equal(
        classifyIntent("¿Cuál es la diferencia entre agregación y composición?"),
        "query"
      );
      assert.equal(
        classifyIntent("¿Cuáles son las clases principales del sistema?"),
        "query"
      );
      assert.equal(
        classifyIntent("¿Cuándo se recomienda usar una clase abstracta?"),
        "query"
      );
      assert.equal(
        classifyIntent("¿Dónde debería poner el atributo fecha?"),
        "query"
      );
      assert.equal(
        classifyIntent("¿Para qué sirve la multiplicidad 0..1?"),
        "query"
      );
      assert.equal(
        classifyIntent("Explica los métodos de la clase Factura"),
        "query"
      );
      assert.equal(
        classifyIntent("Diferencia entre interfaz y clase abstracta"),
        "query"
      );
      assert.equal(
        classifyIntent("¿qué tal si agregamos la clase Auditoría?"),
        "query"
      );
    });

    // 6. Texto general / declarativo / no accionable (Regla 3) -> query
    test("propuestas declarativas o comentarios sin verbo imperativo ni cortesía -> query", () => {
      assert.equal(classifyIntent("falta la clase Detalle"), "query");
      assert.equal(classifyIntent("deberías borrar Pedido"), "query");
      assert.equal(classifyIntent("Hola Codia, buen día"), "query");
      assert.equal(
        classifyIntent("El diagrama se ve bastante completo"),
        "query"
      );
      assert.equal(
        classifyIntent("Me parece que faltan algunas cosas"),
        "query"
      );
    });

    // 7. Regla 2b: Verbo de modificación no inicial (máximo primeras 8 palabras) en frase declarativa/imperativa
    test("Regla 2b: frases con preposición o contexto inicial y verbo de modificación en primeras 8 palabras -> modification", () => {
      assert.equal(
        classifyIntent("en Venta agrega una clase DetallesVenta"),
        "modification"
      );
      assert.equal(
        classifyIntent("a la clase Pedido agregale el atributo fecha"),
        "modification"
      );
      assert.equal(
        classifyIntent("sobre Cliente crea la relación con Factura"),
        "modification"
      );
      assert.equal(
        classifyIntent("en la clase detalles venta agrega observaciones y monto"),
        "modification"
      );
      assert.equal(
        classifyIntent("para la clase Factura crea el atributo total"),
        "modification"
      );
      assert.equal(
        classifyIntent("en Factura elimina la clase Factura"),
        "modification"
      );
      assert.equal(
        classifyIntent("en el diagrama cambia el nombre de la clase A a B"),
        "modification"
      );
      assert.equal(
        classifyIntent("entre Cliente y Pedido relaciona con asociacion"),
        "modification"
      );
      assert.equal(
        classifyIntent("en Usuario actualiza el email a String"),
        "modification"
      );
      assert.equal(
        classifyIntent("en la clase Parqueadero pon el campo tarifa"),
        "modification"
      );
      assert.equal(
        classifyIntent("en Proveedor elimina el atributo nombre"),
        "modification"
      );
      assert.equal(
        classifyIntent("en Factura renombra el atributo total a montoTotal"),
        "modification"
      );
    });

    test("Regla 2b: frases con interrogación o palabras interrogativas no son modificación -> query", () => {
      // Con signo de interrogación al final
      assert.equal(
        classifyIntent("en Venta agrega un atributo?"),
        "query"
      );
      // Con signo de apertura y cierre
      assert.equal(
        classifyIntent("¿en Venta agrega una clase DetallesVenta?"),
        "query"
      );
      // Con palabra interrogativa en cualquier posición
      assert.equal(
        classifyIntent("en qué se diferencian Venta y DetallesVenta"),
        "query"
      );
      assert.equal(
        classifyIntent("la clase Venta cómo se relaciona con Cliente"),
        "query"
      );
      assert.equal(
        classifyIntent("en Venta qué atributos debería agregar"),
        "query"
      );
      assert.equal(
        classifyIntent("en la clase Cliente cuál atributo elimina"),
        "query"
      );
    });

    test("Regla 2b: verbo después de las primeras 8 palabras no califica -> query", () => {
      assert.equal(
        classifyIntent("uno dos tres cuatro cinco seis siete ocho nueve agrega"),
        "query"
      );
    });

    test("Regla 2b y detectUnsupportedAttributeRequest: pedidos no soportados se clasifican como modification y detectan el rechazo", () => {
      const deleteText = "en Proveedor elimina el atributo nombre";
      assert.equal(classifyIntent(deleteText), "modification");
      assert.equal(detectUnsupportedAttributeRequest(deleteText), "delete");

      const renameText = "en Factura renombra el atributo total a montoTotal";
      assert.equal(classifyIntent(renameText), "modification");
      assert.equal(detectUnsupportedAttributeRequest(renameText), "rename");
    });
  });

  describe("summarizeOperations", () => {
    test("operación individual: createClass con 2 atributos", () => {
      const ops = [
        {
          action: "createClass",
          className: "Cliente",
          attributes: [{ name: "id" }, { name: "email" }],
        },
      ];
      assert.equal(
        summarizeOperations(ops),
        "creé la clase Cliente con 2 atributos."
      );
    });

    test("operación individual: createClass con 1 atributo", () => {
      const ops = [
        {
          action: "createClass",
          className: "Cliente",
          attributes: [{ name: "id" }],
        },
      ];
      assert.equal(
        summarizeOperations(ops),
        "creé la clase Cliente con 1 atributo."
      );
    });

    test("operación individual: createClass sin atributos", () => {
      const ops = [{ action: "createClass", className: "Factura" }];
      assert.equal(summarizeOperations(ops), "creé la clase Factura.");
    });

    test("operación individual: updateClass estándar", () => {
      const ops = [{ action: "updateClass", className: "Producto" }];
      assert.equal(summarizeOperations(ops), "actualicé la clase Producto.");
    });

    test("operación individual: updateClass con renombramiento", () => {
      const ops = [
        {
          action: "updateClass",
          className: "Usuario",
          newClassName: "Cuenta",
        },
      ];
      assert.equal(
        summarizeOperations(ops),
        "renombré la clase Usuario a Cuenta."
      );
    });

    test("operación individual: deleteClass", () => {
      const ops = [{ action: "deleteClass", className: "Temporal" }];
      assert.equal(summarizeOperations(ops), "eliminé la clase Temporal.");
    });

    test("operación individual: createRelation", () => {
      const ops = [
        {
          action: "createRelation",
          sourceClassName: "Cliente",
          targetClassName: "Pedido",
        },
      ];
      assert.equal(
        summarizeOperations(ops),
        "creé la relación entre Cliente y Pedido."
      );
    });

    test("operación individual: updateRelation", () => {
      const ops = [
        {
          action: "updateRelation",
          sourceClassName: "Pedido",
          targetClassName: "Factura",
        },
      ];
      assert.equal(
        summarizeOperations(ops),
        "actualicé la relación entre Pedido y Factura."
      );
    });

    test("operación individual: deleteRelation", () => {
      const ops = [
        {
          action: "deleteRelation",
          sourceClassName: "X",
          targetClassName: "Y",
        },
      ];
      assert.equal(
        summarizeOperations(ops),
        "eliminé la relación entre X e Y."
      );
    });

    test("múltiples operaciones (dos operaciones combinadas con 'y')", () => {
      const ops = [
        {
          action: "createClass",
          className: "Cliente",
          attributes: [{ name: "id" }, { name: "email" }],
        },
        { action: "updateClass", className: "Producto" },
      ];
      assert.equal(
        summarizeOperations(ops),
        "creé la clase Cliente con 2 atributos y actualicé la clase Producto."
      );
    });

    test("múltiples operaciones (tres operaciones con coma y 'y')", () => {
      const ops = [
        {
          action: "createClass",
          className: "Cliente",
          attributes: [{ name: "id" }, { name: "email" }],
        },
        { action: "updateClass", className: "Producto" },
        {
          action: "deleteRelation",
          sourceClassName: "X",
          targetClassName: "Y",
        },
      ];
      assert.equal(
        summarizeOperations(ops),
        "creé la clase Cliente con 2 atributos, actualicé la clase Producto y eliminé la relación entre X e Y."
      );
    });

    test("operaciones con avisos de descarte", () => {
      const ops = [
        {
          action: "createClass",
          className: "Cliente",
          attributes: [{ name: "id" }, { name: "email" }],
        },
      ];
      const warnings = ["No encontré la clase 'Factura'"];
      assert.equal(
        summarizeOperations(ops, warnings),
        "creé la clase Cliente con 2 atributos. Descarté: No encontré la clase 'Factura'."
      );
    });

    test("múltiples operaciones con múltiples avisos", () => {
      const ops = [
        { action: "updateClass", className: "Producto" },
        {
          action: "deleteRelation",
          sourceClassName: "A",
          targetClassName: "B",
        },
      ];
      const warnings = [
        "No encontré la clase 'Detalle'",
        "No encontré la clase 'Pago'",
      ];
      assert.equal(
        summarizeOperations(ops, warnings),
        "actualicé la clase Producto y eliminé la relación entre A y B. Descarté: No encontré la clase 'Detalle'; No encontré la clase 'Pago'."
      );
    });

    test("operaciones vacías pero con avisos", () => {
      const warnings = ["No encontré la clase 'Inexistente'"];
      assert.equal(
        summarizeOperations([], warnings),
        "no se aplicó ningún cambio. Descarté: No encontré la clase 'Inexistente'."
      );
    });

    test("operaciones vacías y sin avisos", () => {
      assert.equal(summarizeOperations([]), "no encontré cambios para aplicar.");
    });

    test("siempre empieza en minúscula para anteponer el nombre", () => {
      const res = summarizeOperations([
        { action: "createClass", className: "A" },
      ]);
      const firstChar = res[0];
      assert.equal(firstChar, firstChar.toLowerCase());
      assert.notEqual(firstChar, firstChar.toUpperCase());
    });
  });

  describe("checkOperationLimit", () => {
    test("exporta constante MAX_OPERATIONS = 10", () => {
      assert.equal(MAX_OPERATIONS, 10);
    });

    test("0 operaciones -> exceeded false", () => {
      const res = checkOperationLimit([]);
      assert.equal(res.exceeded, false);
      assert.equal(res.count, 0);
      assert.equal(res.message, undefined);
    });

    test("10 operaciones (límite exacto) -> exceeded false", () => {
      const ops = Array.from({ length: 10 }, (_, i) => ({
        action: "createClass",
        className: `Clase${i}`,
      }));
      const res = checkOperationLimit(ops);
      assert.equal(res.exceeded, false);
      assert.equal(res.count, 10);
      assert.equal(res.message, undefined);
    });

    test("11 operaciones (supera el límite) -> exceeded true y mensaje explicativo", () => {
      const ops = Array.from({ length: 11 }, (_, i) => ({
        action: "createClass",
        className: `Clase${i}`,
      }));
      const res = checkOperationLimit(ops);
      assert.equal(res.exceeded, true);
      assert.equal(res.count, 11);
      assert.match(
        res.message || "",
        /el pedido contiene 11 operaciones y supera el tope máximo de 10/i
      );
      assert.match(
        res.message || "",
        /dividilo en cambios más pequeños/i
      );
    });

    test("permite configurar un tope personalizado", () => {
      const ops = [{ action: "createClass", className: "A" }, { action: "createClass", className: "B" }];
      const resOk = checkOperationLimit(ops, 2);
      assert.equal(resOk.exceeded, false);

      const resFail = checkOperationLimit(ops, 1);
      assert.equal(resFail.exceeded, true);
      assert.equal(resFail.count, 2);
      assert.match(resFail.message || "", /supera el tope máximo de 1/i);
    });
  });

  describe("detectUnsupportedAttributeRequest", () => {
    // Casos positivos de eliminación (deben retornar "delete")
    test("detecta eliminación con 'elimina el atributo correo de Cliente'", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("elimina el atributo correo de Cliente"),
        "delete"
      );
    });

    test("detecta eliminación con 'quítale el atributo edad a Cliente'", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("quítale el atributo edad a Cliente"),
        "delete"
      );
    });

    test("detecta eliminación con 'borra el campo telefono'", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("borra el campo telefono"),
        "delete"
      );
    });

    test("detecta eliminación con 'elimina el método calcularTotal'", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("elimina el método calcularTotal"),
        "delete"
      );
    });

    test("detecta eliminación con 'borrar la propiedad direccion de Proveedor'", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("borrar la propiedad direccion de Proveedor"),
        "delete"
      );
    });

    test("detecta eliminación con 'quita la funcion validar'", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("quita la funcion validar"),
        "delete"
      );
    });

    test("detecta eliminación con 'sacale el atributo saldo'", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("sacale el atributo saldo"),
        "delete"
      );
    });

    test("detecta eliminación con 'remueve los atributos de Cliente'", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("remueve los atributos de Cliente"),
        "delete"
      );
    });

    test("detecta eliminación con 'suprime el metodo pagar'", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("suprime el metodo pagar"),
        "delete"
      );
    });

    test("detecta eliminación con 'elimina todos los atributos de Factura'", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("elimina todos los atributos de Factura"),
        "delete"
      );
    });

    test("detecta eliminación con 0 palabras de relleno 'elimina atributo id'", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("elimina atributo id"),
        "delete"
      );
    });

    test("detecta eliminación precedida de mención y cortesía '@Codia por favor elimina el atributo email'", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("@Codia por favor elimina el atributo email"),
        "delete"
      );
    });

    test("detecta eliminación interrogativa '¿puedes borrar el metodo calcularTotal de Pedido?'", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("¿puedes borrar el metodo calcularTotal de Pedido?"),
        "delete"
      );
    });

    // Casos positivos de renombrado (deben retornar "rename")
    test("detecta renombrado con 'renombra el atributo nombre a nombreCompleto'", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("renombra el atributo nombre a nombreCompleto"),
        "rename"
      );
    });

    test("detecta renombrado con 'cambiale el nombre al atributo precio por costo'", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("cambiale el nombre al atributo precio por costo"),
        "rename"
      );
    });

    test("detecta renombrado con 'cambia el nombre del metodo calcular'", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("cambia el nombre del metodo calcular"),
        "rename"
      );
    });

    test("detecta renombrado con 'renombrar la propiedad activo a habilitado'", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("renombrar la propiedad activo a habilitado"),
        "rename"
      );
    });

    test("detecta renombrado con 'cambiar el nombre del campo telefono'", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("cambiar el nombre del campo telefono"),
        "rename"
      );
    });

    test("detecta renombrado con 'renombrale el atributo codigo a identificador'", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("renombrale el atributo codigo a identificador"),
        "rename"
      );
    });

    // Casos negativos que NO deben detectarse (deben retornar null)
    test("no detecta cuando el verbo se refiere a clase: 'elimina la clase Pedido y sus atributos' -> null", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("elimina la clase Pedido y sus atributos"),
        null
      );
    });

    test("no detecta cuando el verbo se refiere a clase: 'borra la clase Pedido con todos sus atributos' -> null", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("borra la clase Pedido con todos sus atributos"),
        null
      );
    });

    test("no detecta eliminación de relaciones: 'elimina la relación entre Cliente y Pedido' -> null", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("elimina la relación entre Cliente y Pedido"),
        null
      );
    });

    test("no detecta creación con atributos: 'crea una clase con atributos' -> null", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("crea una clase con atributos"),
        null
      );
    });

    test("no detecta cambio de tipo: 'cambia el tipo del atributo edad a Integer' -> null", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("cambia el tipo del atributo edad a Integer"),
        null
      );
    });

    test("no detecta renombrado de clase: 'renombra la clase Cliente a Usuario' -> null", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("renombra la clase Cliente a Usuario"),
        null
      );
    });

    test("no detecta renombrado de clase sin palabra 'clase': 'renombra Cliente a Usuario' -> null", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("renombra Cliente a Usuario"),
        null
      );
    });

    test("no detecta renombrado de clase con frase compuesta: 'cambia el nombre de la clase Factura a Comprobante' -> null", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("cambia el nombre de la clase Factura a Comprobante"),
        null
      );
    });

    test("no detecta adición de atributos: 'agrega el atributo telefono a Cliente' -> null", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("agrega el atributo telefono a Cliente"),
        null
      );
    });

    test("no detecta creación de clases con campos: 'crea una clase Producto con nombre, precio y stock' -> null", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("crea una clase Producto con nombre, precio y stock"),
        null
      );
    });

    test("no detecta modificación general de clase: 'modifica la clase Cliente' -> null", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("modifica la clase Cliente"),
        null
      );
    });

    test("no detecta borrado simple de clase: 'elimina la clase Proveedor' -> null", () => {
      assert.equal(
        detectUnsupportedAttributeRequest("elimina la clase Proveedor"),
        null
      );
    });

    test("retorna null ante texto vacío o solo espacios", () => {
      assert.equal(detectUnsupportedAttributeRequest(""), null);
      assert.equal(detectUnsupportedAttributeRequest("   "), null);
    });
  });

  describe("convertExistingCreateToUpdate", () => {
    const existingClasses = [
      { className: "Cliente" },
      { className: "Dirección" },
      { className: "OrdenCompra" },
    ];

    test("1. createClass de clase existente con atributo nuevo se convierte y conserva atributos y métodos", () => {
      const ops = [
        {
          action: "createClass",
          className: "Cliente",
          attributes: [{ name: "email", type: "String", visibility: "public" }],
          methods: [{ name: "activar", returnType: "Boolean", visibility: "public" }],
        },
      ];

      const converted = convertExistingCreateToUpdate(ops, existingClasses);
      assert.equal(converted.length, 1);
      assert.equal(converted[0].action, "updateClass");
      assert.equal(converted[0].className, "Cliente");
      assert.deepEqual(converted[0].attributes, [
        { name: "email", type: "String", visibility: "public" },
      ]);
      assert.deepEqual(converted[0].methods, [
        { name: "activar", returnType: "Boolean", visibility: "public" },
      ]);
    });

    test("2. con nombre en otra capitalización y con tilde distinta también se convierte con el nombre real", () => {
      const ops = [
        {
          action: "createClass",
          className: "  DIRECCION  ",
          attributes: [{ name: "calle", type: "String", visibility: "public" }],
          methods: [],
        },
      ];

      const converted = convertExistingCreateToUpdate(ops, existingClasses);
      assert.equal(converted.length, 1);
      assert.equal(converted[0].action, "updateClass");
      assert.equal(converted[0].className, "Dirección");
      assert.deepEqual(converted[0].attributes, [
        { name: "calle", type: "String", visibility: "public" },
      ]);
      assert.deepEqual(converted[0].methods, []);
    });

    test("3. createClass de clase inexistente no cambia", () => {
      const ops = [
        {
          action: "createClass",
          className: "Factura",
          attributes: [{ name: "total", type: "Double", visibility: "public" }],
          methods: [],
        },
      ];

      const converted = convertExistingCreateToUpdate(ops, existingClasses);
      assert.equal(converted.length, 1);
      assert.equal(converted[0].action, "createClass");
      assert.equal(converted[0].className, "Factura");
    });

    test("4. el caso del deleteClass previo en el mismo lote no cambia (se mantiene createClass)", () => {
      const ops = [
        { action: "deleteClass", className: "cliente" },
        {
          action: "createClass",
          className: "Cliente",
          attributes: [{ name: "id", type: "Integer" }],
          methods: [],
        },
      ];

      const converted = convertExistingCreateToUpdate(ops, existingClasses);
      assert.equal(converted.length, 2);
      assert.equal(converted[0].action, "deleteClass");
      assert.equal(converted[1].action, "createClass");
      assert.equal(converted[1].className, "Cliente");
    });

    test("5. deleteClass posterior en el mismo lote sí permite la conversión previa de createClass", () => {
      const ops = [
        {
          action: "createClass",
          className: "Cliente",
          attributes: [{ name: "email", type: "String" }],
        },
        { action: "deleteClass", className: "Cliente" },
      ];

      const converted = convertExistingCreateToUpdate(ops, existingClasses);
      assert.equal(converted.length, 2);
      assert.equal(converted[0].action, "updateClass");
      assert.equal(converted[1].action, "deleteClass");
    });

    test("6. y el resumen final de summarizeOperations dice 'actualicé la clase X'", () => {
      const ops = [
        {
          action: "createClass",
          className: "cliente",
          attributes: [{ name: "telefono", type: "String" }],
        },
      ];

      const converted = convertExistingCreateToUpdate(ops, existingClasses);
      const summary = summarizeOperations(converted);
      assert.match(summary, /actualicé la clase Cliente/);
    });

    test("7. normalizeClassName normaliza mayúsculas, tildes y espacios", () => {
      assert.equal(normalizeClassName("  DIRECCIÓN  "), "direccion");
      assert.equal(normalizeClassName("Órden de Compra"), "orden de compra");
      assert.equal(normalizeClassName(null), "");
      assert.equal(normalizeClassName(""), "");
    });

    test("8. manejo defensivo con operaciones no array o vacías", () => {
      assert.deepEqual(convertExistingCreateToUpdate([], existingClasses), []);
      assert.deepEqual(convertExistingCreateToUpdate(null as any, existingClasses), []);
      const sample = [{ action: "createClass", className: "X" }];
      assert.deepEqual(convertExistingCreateToUpdate(sample, []), sample);
    });
  });
});
