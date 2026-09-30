import assert from "assert";
import { classifyUmlType } from "./xmiTypeMapping";
import { generateXmiDocument, escapeXml, mapVisibility } from "./generateXmi";
import { UmlModel } from "../backendGenerator/types";

console.log("=== INICIANDO PRUEBAS DE XMI EXPORTER ===");

// 1. Pruebas de classifyUmlType
console.log("\n[1] Probando classifyUmlType...");
assert.deepStrictEqual(classifyUmlType("Double"), { kind: "primitive", name: "Real" });
assert.deepStrictEqual(classifyUmlType("double"), { kind: "primitive", name: "Real" });
assert.deepStrictEqual(classifyUmlType("String"), { kind: "primitive", name: "String" });
assert.deepStrictEqual(classifyUmlType("Integer"), { kind: "primitive", name: "Integer" });
assert.deepStrictEqual(classifyUmlType("Boolean"), { kind: "primitive", name: "Boolean" });
assert.deepStrictEqual(classifyUmlType("Real"), { kind: "primitive", name: "Real" });
assert.deepStrictEqual(classifyUmlType("UnlimitedNatural"), { kind: "primitive", name: "UnlimitedNatural" });
assert.deepStrictEqual(classifyUmlType("Long"), { kind: "custom", name: "Long" });
assert.deepStrictEqual(classifyUmlType("Date"), { kind: "custom", name: "Date" });
assert.deepStrictEqual(classifyUmlType("long"), { kind: "custom", name: "Long" });
assert.deepStrictEqual(classifyUmlType("date"), { kind: "custom", name: "Date" });
assert.deepStrictEqual(classifyUmlType("UnknownType"), { kind: "primitive", name: "String" });
assert.deepStrictEqual(classifyUmlType(""), { kind: "primitive", name: "String" });
assert.deepStrictEqual(classifyUmlType(null as any), { kind: "primitive", name: "String" });
console.log("classifyUmlType: Todas las aserciones pasaron OK.");

// 2. Pruebas de escapeXml
console.log("\n[2] Probando escapeXml...");
assert.strictEqual(escapeXml("a & b < c > d \" e ' f"), "a &amp; b &lt; c &gt; d &quot; e &apos; f");
console.log("escapeXml: Todas las aserciones pasaron OK.");

// 3. Pruebas de mapVisibility
console.log("\n[3] Probando mapVisibility...");
assert.strictEqual(mapVisibility("+"), "public");
assert.strictEqual(mapVisibility("public"), "public");
assert.strictEqual(mapVisibility("-"), "private");
assert.strictEqual(mapVisibility("private"), "private");
assert.strictEqual(mapVisibility("#"), "protected");
assert.strictEqual(mapVisibility("protected"), "protected");
assert.strictEqual(mapVisibility("~"), "package");
assert.strictEqual(mapVisibility("package"), "package");
assert.strictEqual(mapVisibility("xyz"), "public");
assert.strictEqual(mapVisibility(""), "public");
assert.strictEqual(mapVisibility(undefined), "public");
console.log("mapVisibility: Todas las aserciones pasaron OK.");

// 4. Pruebas de generateXmiDocument con modelo completo
console.log("\n[4] Probando generateXmiDocument...");

const testModel: UmlModel = {
  classes: [
    {
      id: "c1",
      className: "Usuario<Admin>",
      attributes: [
        { name: "id", type: "Long", visibility: "-" },
        { name: "nombre", type: "String", visibility: "public" },
        { name: "saldo", type: "Double", visibility: "#" },
        { name: "activo", type: "Boolean", visibility: "~" },
        { name: "creadoEn", type: "Date", visibility: "private" },
        { name: "otro", type: "Invalido", visibility: "unknown" }
      ],
      methods: [
        { name: "getId", returnType: "Long", visibility: "+" },
        { name: "reset", returnType: "void", visibility: "public" },
        { name: "limpiar", returnType: "VOID", visibility: "public" },
        { name: "calcular", returnType: "Double", visibility: "protected" }
      ]
    },
    {
      id: "c2",
      className: "Rol",
      attributes: [
        { name: "codigo", type: "Integer", visibility: "+" }
      ],
      methods: []
    }
  ],
  relations: []
};

const xmi = generateXmiDocument(testModel);

console.log("\n--- XMI Generado: ---");
console.log(xmi);
console.log("---------------------\n");

// Validaciones estructurales
assert(xmi.includes('xmlns:xmi="http://schema.omg.org/spec/XMI/2.1"'), "Debe incluir namespace XMI 2.1");
assert(xmi.includes('xmi:version="2.1"'), "Debe especificar xmi:version 2.1");
assert(xmi.includes('xmlns:uml="http://schema.omg.org/spec/UML/2.1"'), "Debe incluir namespace UML 2.1");
assert(xmi.includes('<uml:Model xmi:type="uml:Model" name="EA_Model" visibility="public">'), "Debe incluir EA_Model");
assert(xmi.includes('<packagedElement xmi:type="uml:Package" xmi:id="pkg_diagrama" name="Diagrama" visibility="public">'), "Debe incluir pkg_diagrama");

// Validaciones de clases y escaping
assert(xmi.includes('<packagedElement xmi:type="uml:Class" xmi:id="cls_c1" name="Usuario&lt;Admin&gt;" visibility="public">'), "Clase c1 escapada y con id cls_c1");
assert(xmi.includes('<packagedElement xmi:type="uml:Class" xmi:id="cls_c2" name="Rol" visibility="public">'), "Clase c2 con id cls_c2");

// Validaciones de atributos
assert(xmi.includes('<ownedAttribute xmi:type="uml:Property" name="id" visibility="private">'), "Atributo id con visibilidad private");
assert(xmi.includes('<type xmi:idref="dt_long"/>'), "Tipo Long como dt_long");
assert(xmi.includes('<lowerValue xmi:type="uml:LiteralInteger" value="1"/>'), "lowerValue = 1");
assert(xmi.includes('<upperValue xmi:type="uml:LiteralUnlimitedNatural" value="1"/>'), "upperValue = 1");

// Validaciones de primitivos
assert(xmi.includes('<type href="http://schema.omg.org/spec/UML/2.1/uml.xml#String"/>'), "Tipo String primitivo");
assert(xmi.includes('<type href="http://schema.omg.org/spec/UML/2.1/uml.xml#Real"/>'), "Double mapea a Real");
assert(xmi.includes('<type href="http://schema.omg.org/spec/UML/2.1/uml.xml#Boolean"/>'), "Tipo Boolean primitivo");
assert(xmi.includes('<type href="http://schema.omg.org/spec/UML/2.1/uml.xml#Integer"/>'), "Tipo Integer primitivo");
assert(xmi.includes('<type xmi:idref="dt_date"/>'), "Tipo Date como dt_date");

// Validaciones de métodos
assert(xmi.includes('<ownedOperation name="reset" visibility="public">\n          <ownedParameter name="return" direction="return"/>\n        </ownedOperation>'), "Método void sin <type>");
assert(xmi.includes('<ownedOperation name="limpiar" visibility="public">\n          <ownedParameter name="return" direction="return"/>\n        </ownedOperation>'), "Método VOID sin <type>");

// Validaciones de DataTypes al final
assert(xmi.includes('<packagedElement xmi:type="uml:DataType" xmi:id="dt_date" name="Date" visibility="public"/>'), "DataType Date declarado");
assert(xmi.includes('<packagedElement xmi:type="uml:DataType" xmi:id="dt_long" name="Long" visibility="public"/>'), "DataType Long declarado");

// Validar que un modelo sin tipos custom NO declare DataTypes
const primitiveOnlyModel: UmlModel = {
  classes: [
    {
      id: "p1",
      className: "Item",
      attributes: [
        { name: "count", type: "Integer", visibility: "public" },
        { name: "price", type: "Double", visibility: "public" }
      ],
      methods: [
        { name: "getName", returnType: "String", visibility: "public" }
      ]
    }
  ],
  relations: []
};

const xmiPrimitive = generateXmiDocument(primitiveOnlyModel);
assert(!xmiPrimitive.includes('xmi:type="uml:DataType"'), "Modelo solo con primitivos no debe declarar uml:DataType");

console.log("generateXmiDocument: Todas las aserciones pasaron OK!");
console.log("\n=== TODAS LAS PRUEBAS COMPLETADAS CON ÉXITO ===");
