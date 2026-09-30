import assert from "assert";
import { generateXmiDocument } from "./generateXmi";
import { parseMultiplicity, isManyToMany, getTargetAggregation } from "./generateXmiRelations";
import { UmlModel } from "../backendGenerator/types";

console.log("=== INICIANDO PRUEBAS DE RELACIONES XMI ===");

// 1. Pruebas de parseMultiplicity
console.log("\n[1] Probando parseMultiplicity...");
assert.deepStrictEqual(parseMultiplicity("1"), {
  lowerValue: 1,
  lowerType: "uml:LiteralInteger",
  upperValue: 1,
  upperType: "uml:LiteralInteger"
});
assert.deepStrictEqual(parseMultiplicity("0..1"), {
  lowerValue: 0,
  lowerType: "uml:LiteralInteger",
  upperValue: 1,
  upperType: "uml:LiteralInteger"
});
assert.deepStrictEqual(parseMultiplicity("0..*"), {
  lowerValue: 0,
  lowerType: "uml:LiteralInteger",
  upperValue: -1,
  upperType: "uml:LiteralUnlimitedNatural"
});
assert.deepStrictEqual(parseMultiplicity("*"), {
  lowerValue: 0,
  lowerType: "uml:LiteralInteger",
  upperValue: -1,
  upperType: "uml:LiteralUnlimitedNatural"
});
assert.deepStrictEqual(parseMultiplicity("1..*"), {
  lowerValue: 1,
  lowerType: "uml:LiteralInteger",
  upperValue: -1,
  upperType: "uml:LiteralUnlimitedNatural"
});
assert.deepStrictEqual(parseMultiplicity(""), {
  lowerValue: 1,
  lowerType: "uml:LiteralInteger",
  upperValue: 1,
  upperType: "uml:LiteralInteger"
});
assert.deepStrictEqual(parseMultiplicity("desconocido"), {
  lowerValue: 1,
  lowerType: "uml:LiteralInteger",
  upperValue: 1,
  upperType: "uml:LiteralInteger"
});
console.log("parseMultiplicity: OK!");

// 2. Pruebas de isManyToMany y getTargetAggregation
console.log("\n[2] Probando isManyToMany y getTargetAggregation...");
assert.strictEqual(
  isManyToMany({
    relationType: "association",
    sourceClassId: "c1",
    targetClassId: "c2",
    multiplicitySource: "0..*",
    multiplicityTarget: "1..*"
  }),
  true
);
assert.strictEqual(
  getTargetAggregation({
    relationType: "composition",
    sourceClassId: "c1",
    targetClassId: "c2",
    multiplicitySource: "*",
    multiplicityTarget: "*"
  }),
  "none" // N:M anula composite
);
assert.strictEqual(
  getTargetAggregation({
    relationType: "composition",
    sourceClassId: "c1",
    targetClassId: "c2",
    multiplicitySource: "1",
    multiplicityTarget: "0..*"
  }),
  "composite"
);
assert.strictEqual(
  getTargetAggregation({
    relationType: "aggregation",
    sourceClassId: "c1",
    targetClassId: "c2",
    multiplicitySource: "1",
    multiplicityTarget: "1"
  }),
  "shared"
);
assert.strictEqual(
  getTargetAggregation({
    relationType: "association",
    sourceClassId: "c1",
    targetClassId: "c2",
    multiplicitySource: "1",
    multiplicityTarget: "1"
  }),
  "none"
);
console.log("isManyToMany / getTargetAggregation: OK!");

// 3. Prueba de generación XMI completa con relaciones
console.log("\n[3] Probando generateXmiDocument con modelo de relaciones...");

const model: UmlModel = {
  classes: [
    {
      id: "persona",
      className: "Persona",
      attributes: [{ name: "id", type: "Integer", visibility: "private" }],
      methods: []
    },
    {
      id: "empleado",
      className: "Empleado",
      attributes: [{ name: "legajo", type: "String", visibility: "private" }],
      methods: []
    },
    {
      id: "departamento",
      className: "Departamento",
      attributes: [{ name: "nombre", type: "String", visibility: "public" }],
      methods: []
    },
    {
      id: "proyecto",
      className: "Proyecto",
      attributes: [{ name: "codigo", type: "String", visibility: "public" }],
      methods: []
    }
  ],
  relations: [
    // Herencia: Empleado extiende Persona
    {
      relationType: "inheritance",
      sourceClassId: "empleado",
      targetClassId: "persona",
      multiplicitySource: "1",
      multiplicityTarget: "1"
    },
    // Agregación: Departamento tiene Empleados (1 a 0..*)
    {
      relationType: "aggregation",
      sourceClassId: "departamento",
      targetClassId: "empleado",
      multiplicitySource: "1",
      multiplicityTarget: "0..*"
    },
    // Composición: Departamento tiene Proyectos (1 a 1..*)
    {
      relationType: "composition",
      sourceClassId: "departamento",
      targetClassId: "proyecto",
      multiplicitySource: "0..1",
      multiplicityTarget: "1..*"
    },
    // Muchos a Muchos: Empleado trabaja en Proyectos (* a *)
    {
      relationType: "composition", // Debe ser forzado a none por N:M
      sourceClassId: "empleado",
      targetClassId: "proyecto",
      multiplicitySource: "0..*",
      multiplicityTarget: "1..*"
    },
    // Relación colgante (source o target inexistente) -> debe ser omitida
    {
      relationType: "association",
      sourceClassId: "empleado",
      targetClassId: "no_existe",
      multiplicitySource: "1",
      multiplicityTarget: "1"
    },
    {
      relationType: "inheritance",
      sourceClassId: "no_existe_2",
      targetClassId: "persona",
      multiplicitySource: "1",
      multiplicityTarget: "1"
    }
  ]
};

const xmi = generateXmiDocument(model);
console.log("\n--- XMI Generado con Relaciones: ---");
console.log(xmi);
console.log("------------------------------------\n");

// Validar Regla 1 (Herencia)
assert(
  xmi.includes(
    '<generalization xmi:type="uml:Generalization" xmi:id="gen_empleado_persona" general="cls_persona" isSubstitutable="true"/>'
  ),
  "Debe generar <generalization> dentro de Empleado apuntando a Persona"
);
assert(!xmi.includes('assoc_empleado_persona'), "Herencia NO debe generar packagedElement Association");

// Validar que la relación de herencia esté dentro de cls_empleado
const empleadoIndex = xmi.indexOf('id="cls_empleado"');
const generalizationIndex = xmi.indexOf('id="gen_empleado_persona"');
const closeEmpleadoIndex = xmi.indexOf('</packagedElement>', empleadoIndex);
assert(
  generalizationIndex > empleadoIndex && generalizationIndex < closeEmpleadoIndex,
  "La generalización debe estar dentro de cls_empleado"
);

// Validar Regla 3: Agregación
assert(
  xmi.includes('<packagedElement xmi:type="uml:Association" xmi:id="assoc_departamento_empleado" visibility="public">'),
  "Debe generar Association departamento_empleado"
);
assert(xmi.includes('<memberEnd xmi:idref="end_assoc_departamento_empleado_src"/>'));
assert(xmi.includes('<memberEnd xmi:idref="end_assoc_departamento_empleado_dst"/>'));
assert(xmi.includes('aggregation="shared"'), "Debe incluir aggregation shared en target de agregación");

// Validar Regla 3: Composición
assert(
  xmi.includes('<packagedElement xmi:type="uml:Association" xmi:id="assoc_departamento_proyecto" visibility="public">'),
  "Debe generar Association departamento_proyecto"
);
assert(xmi.includes('aggregation="composite"'), "Debe incluir aggregation composite en target de composición");

// Validar Regla 2: Muchos a muchos (anula composite)
assert(
  xmi.includes('<packagedElement xmi:type="uml:Association" xmi:id="assoc_empleado_proyecto" visibility="public">'),
  "Debe generar Association empleado_proyecto"
);
// En assoc_empleado_proyecto ambos deben tener aggregation="none"
const nToMSection = xmi.substring(xmi.indexOf('id="assoc_empleado_proyecto"'));
const nToMEnd = nToMSection.indexOf('</packagedElement>');
const nToMXml = nToMSection.substring(0, nToMEnd);
assert(!nToMXml.includes('aggregation="composite"'), "N:M no debe tener aggregation composite");
assert(!nToMXml.includes('aggregation="shared"'), "N:M no debe tener aggregation shared");
assert(nToMXml.includes('aggregation="none"'), "N:M debe tener aggregation none");

// Validar multiplicidades en XMI
// 0..* -> lower=0 (LiteralInteger), upper=-1 (LiteralUnlimitedNatural)
assert(xmi.includes('<lowerValue xmi:type="uml:LiteralInteger" value="0"/>'));
assert(xmi.includes('<upperValue xmi:type="uml:LiteralUnlimitedNatural" value="-1"/>'));
// 0..1 -> lower=0 (LiteralInteger), upper=1 (LiteralInteger)
assert(xmi.includes('<upperValue xmi:type="uml:LiteralInteger" value="1"/>'));

// Validar atributos de ownedEnd requeridos por la regla 3
assert(xmi.includes('isStatic="false"'));
assert(xmi.includes('isReadOnly="false"'));
assert(xmi.includes('isDerived="false"'));
assert(xmi.includes('isOrdered="false"'));
assert(xmi.includes('isDerivedUnion="false"'));
assert(xmi.includes('isUnique="true"'));

// Validar Regla 4: Relaciones colgantes omitidas
assert(!xmi.includes("no_existe"), "Relación colgante hacia no_existe debe ser omitida");
assert(!xmi.includes("no_existe_2"), "Relación colgante desde no_existe_2 debe ser omitida");

console.log("\n=== TODAS LAS PRUEBAS DE RELACIONES PASARON CON ÉXITO ===");
