import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseXmi } from "./parseXmi";

describe("parseXmi - Importador XMI 2.1 (CU11)", () => {
  const rootDir = path.resolve(__dirname, "../../..");
  const testOutputXmiPath = path.resolve(rootDir, "backend/test-output.xmi");
  const testRelationsOutputXmiPath = path.resolve(
    rootDir,
    "backend/test-relations-output.xmi"
  );
  const eaLikeXmiPath = path.resolve(__dirname, "fixtures/ea-like.xmi");

  it("1. Parsea correctamente test-output.xmi (1 clase con tipos primitivos y custom, métodos, 0 relaciones)", () => {
    const xml = fs.readFileSync(testOutputXmiPath, "utf-8");
    const result = parseXmi(xml);

    // Validar estadísticas
    expect(result.stats).toEqual({
      classes: 1,
      relations: 0,
      ignoredElements: 0,
      discardedRelations: 0,
    });

    // Validar clase
    const [persona] = result.model.classes;
    expect(persona).toBeDefined();
    expect(persona.id).toBe("cls_persona_1");
    expect(persona.className).toBe("Persona");

    // Validar atributos: tipos y visibilidad
    expect(persona.attributes).toEqual([
      { name: "id", type: "Integer", visibility: "private" },
      { name: "nombre", type: "String", visibility: "public" },
      { name: "saldo", type: "Double", visibility: "protected" }, // Real -> Double
      { name: "codigoLargo", type: "Long", visibility: "private" }, // dt_long -> Long
      { name: "fechaNacimiento", type: "Date", visibility: "private" }, // dt_date -> Date
    ]);

    // Validar métodos y tipos de retorno
    expect(persona.methods).toEqual([
      { name: "getNombre", returnType: "String", visibility: "public" },
      { name: "getCodigoLargo", returnType: "Long", visibility: "public" },
      { name: "reiniciar", returnType: "void", visibility: "public" },
    ]);

    expect(result.model.relations).toHaveLength(0);
  });

  it("2. Parsea correctamente test-relations-output.xmi (6 clases y 5 relaciones con tipos exactos)", () => {
    const xml = fs.readFileSync(testRelationsOutputXmiPath, "utf-8");
    const result = parseXmi(xml);

    // Validar conteos
    expect(result.stats).toEqual({
      classes: 6,
      relations: 5,
      ignoredElements: 0,
      discardedRelations: 0,
    });

    const classNames = result.model.classes.map((c) => c.className);
    expect(classNames).toEqual(
      expect.arrayContaining([
        "Persona",
        "Estudiante",
        "Colegio",
        "Aula",
        "Profesor",
        "Materia",
      ])
    );

    // Relación A) Herencia: Estudiante -> Persona
    const herencia = result.model.relations.find(
      (r) => r.relationType === "inheritance"
    );
    expect(herencia).toBeDefined();
    expect(herencia?.sourceClassId).toBe("cls_estudiante");
    expect(herencia?.targetClassId).toBe("cls_persona");

    // Relación B) Asociación: Profesor -> Materia
    const asociacion = result.model.relations.find(
      (r) =>
        r.relationType === "association" &&
        r.sourceClassId === "cls_profesor" &&
        r.targetClassId === "cls_materia"
    );
    expect(asociacion).toBeDefined();
    expect(asociacion?.multiplicitySource).toBe("1");
    expect(asociacion?.multiplicityTarget).toBe("0..*");

    // Relación C) Composición: Colegio -> Aula
    const composicion = result.model.relations.find(
      (r) => r.relationType === "composition"
    );
    expect(composicion).toBeDefined();
    expect(composicion?.sourceClassId).toBe("cls_colegio");
    expect(composicion?.targetClassId).toBe("cls_aula");
    expect(composicion?.multiplicitySource).toBe("1");
    expect(composicion?.multiplicityTarget).toBe("1..*");

    // Relación D) Agregación: Profesor -> Aula
    const agregacion = result.model.relations.find(
      (r) => r.relationType === "aggregation"
    );
    expect(agregacion).toBeDefined();
    expect(agregacion?.sourceClassId).toBe("cls_profesor");
    expect(agregacion?.targetClassId).toBe("cls_aula");
    expect(agregacion?.multiplicitySource).toBe("0..1");
    expect(agregacion?.multiplicityTarget).toBe("0..*");

    // Relación E) Muchos a Muchos: Estudiante -> Materia
    const manyToMany = result.model.relations.find(
      (r) => r.relationType === "manyToMany"
    );
    expect(manyToMany).toBeDefined();
    expect(manyToMany?.sourceClassId).toBe("cls_estudiante");
    expect(manyToMany?.targetClassId).toBe("cls_materia");
    expect(manyToMany?.multiplicitySource).toBe("0..*");
    expect(manyToMany?.multiplicityTarget).toBe("1..*");
  });

  it("3. Parsea correctamente ea-like.xmi simulando Enterprise Architect", () => {
    const xml = fs.readFileSync(eaLikeXmiPath, "utf-8");
    const result = parseXmi(xml);

    // Debe ignorar 1 Interface y 1 Nested Package
    expect(result.stats.ignoredElements).toBe(2);
    expect(result.stats.classes).toBe(2);
    expect(result.stats.relations).toBe(2);
    expect(result.stats.discardedRelations).toBe(0);

    const [cliente, pedido] = result.model.classes;
    expect(cliente.id).toBe("EAID_CLS_001");
    expect(cliente.className).toBe("Cliente");
    // El extremo de asociación "pedidos" NO debe aparecer como atributo
    expect(cliente.attributes).toEqual([
      { name: "nombre", type: "String", visibility: "public" },
    ]);

    expect(pedido.id).toBe("EAID_CLS_002");
    expect(pedido.className).toBe("Pedido");
    // El extremo de asociación "cliente" NO debe aparecer como atributo
    expect(pedido.attributes).toEqual([
      { name: "monto", type: "Double", visibility: "private" }, // Real -> Double
    ]);

    // Relación 1: Herencia Pedido -> Cliente
    const gen = result.model.relations.find(
      (r) => r.relationType === "inheritance"
    );
    expect(gen).toBeDefined();
    expect(gen?.sourceClassId).toBe("EAID_CLS_002");
    expect(gen?.targetClassId).toBe("EAID_CLS_001");

    // Relación 2: Asociación Cliente <-> Pedido
    const assoc = result.model.relations.find(
      (r) => r.relationType === "association"
    );
    expect(assoc).toBeDefined();
    // Como faltan lowerValue y upperValue en ambos extremos, default a "1"
    expect(assoc?.multiplicitySource).toBe("1");
    expect(assoc?.multiplicityTarget).toBe("1");
  });

  it("4. Descarta relaciones con clases inexistentes y las suma a discardedRelations", () => {
    const xmlWithDangling = `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmlns:xmi="http://schema.omg.org/spec/XMI/2.1" xmi:version="2.1" xmlns:uml="http://schema.omg.org/spec/UML/2.1">
  <uml:Model xmi:type="uml:Model" name="Model">
    <packagedElement xmi:type="uml:Class" xmi:id="cls_valida" name="Valida"/>
    <packagedElement xmi:type="uml:Association" xmi:id="assoc_dangling">
      <memberEnd xmi:idref="end_1"/>
      <memberEnd xmi:idref="end_2"/>
      <ownedEnd xmi:id="end_1"><type xmi:idref="cls_valida"/></ownedEnd>
      <ownedEnd xmi:id="end_2"><type xmi:idref="cls_inexistente"/></ownedEnd>
    </packagedElement>
  </uml:Model>
</xmi:XMI>`;

    const result = parseXmi(xmlWithDangling);
    expect(result.stats.classes).toBe(1);
    expect(result.stats.relations).toBe(0);
    expect(result.stats.discardedRelations).toBe(1);
  });

  it("5. Lanza el error exacto con XML mal formado, XML no-XMI o sin clases", () => {
    const exactMessage =
      "El archivo no es un XMI válido o no contiene clases";

    // XML mal formado
    expect(() => parseXmi("<broken xml")).toThrow(exactMessage);

    // Texto vacío
    expect(() => parseXmi("")).toThrow(exactMessage);
    expect(() => parseXmi("   ")).toThrow(exactMessage);

    // XML válido pero no es XMI
    expect(() => parseXmi("<config><setting>true</setting></config>")).toThrow(
      exactMessage
    );

    // XMI válido pero sin clases
    const xmiNoClasses = `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmlns:xmi="http://schema.omg.org/spec/XMI/2.1" xmi:version="2.1" xmlns:uml="http://schema.omg.org/spec/UML/2.1">
  <uml:Model xmi:type="uml:Model" name="Model">
    <packagedElement xmi:type="uml:DataType" xmi:id="dt_1" name="Date"/>
  </uml:Model>
</xmi:XMI>`;
    expect(() => parseXmi(xmiNoClasses)).toThrow(exactMessage);
  });

  it("6. Soporta clase sin atributos ni métodos", () => {
    const xmiEmptyClass = `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmlns:xmi="http://schema.omg.org/spec/XMI/2.1" xmi:version="2.1" xmlns:uml="http://schema.omg.org/spec/UML/2.1">
  <uml:Model xmi:type="uml:Model" name="Model">
    <packagedElement xmi:type="uml:Class" xmi:id="cls_vacia" name="ClaseVacia"/>
  </uml:Model>
</xmi:XMI>`;

    const result = parseXmi(xmiEmptyClass);
    expect(result.stats.classes).toBe(1);
    expect(result.model.classes[0].className).toBe("ClaseVacia");
    expect(result.model.classes[0].attributes).toEqual([]);
    expect(result.model.classes[0].methods).toEqual([]);
  });

  it("7. Preserva nombres con caracteres especiales y acentos en clases, atributos y métodos", () => {
    const xmiSpecialChars = `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmlns:xmi="http://schema.omg.org/spec/XMI/2.1" xmi:version="2.1" xmlns:uml="http://schema.omg.org/spec/UML/2.1">
  <uml:Model xmi:type="uml:Model" name="Model">
    <packagedElement xmi:type="uml:Class" xmi:id="cls_esp" name="Configuración &amp; Gestión_2026">
      <ownedAttribute xmi:type="uml:Property" xmi:id="a_1" name="año_escolar" visibility="private">
        <type xmi:type="uml:PrimitiveType" href="http://schema.omg.org/spec/UML/2.1#Integer"/>
      </ownedAttribute>
      <ownedOperation xmi:type="uml:Operation" xmi:id="op_1" name="validar_año" visibility="public">
        <ownedParameter xmi:type="uml:Parameter" xmi:id="p_ret" direction="return">
          <type xmi:type="uml:PrimitiveType" href="http://schema.omg.org/spec/UML/2.1#Boolean"/>
        </ownedParameter>
      </ownedOperation>
    </packagedElement>
  </uml:Model>
</xmi:XMI>`;

    const result = parseXmi(xmiSpecialChars);
    expect(result.stats.classes).toBe(1);
    const cls = result.model.classes[0];
    expect(cls.className).toBe("Configuración & Gestión_2026");
    expect(cls.attributes[0].name).toBe("año_escolar");
    expect(cls.attributes[0].type).toBe("Integer");
    expect(cls.methods[0].name).toBe("validar_año");
    expect(cls.methods[0].returnType).toBe("Boolean");
  });

  it("8. Asigna multiplicidad por defecto '1' cuando están completamente ausentes", () => {
    const xmiNoMult = `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmlns:xmi="http://schema.omg.org/spec/XMI/2.1" xmi:version="2.1" xmlns:uml="http://schema.omg.org/spec/UML/2.1">
  <uml:Model xmi:type="uml:Model" name="Model">
    <packagedElement xmi:type="uml:Class" xmi:id="c_1" name="A"/>
    <packagedElement xmi:type="uml:Class" xmi:id="c_2" name="B"/>
    <packagedElement xmi:type="uml:Association" xmi:id="rel_1" name="conecta">
      <memberEnd xmi:idref="end_1"/>
      <memberEnd xmi:idref="end_2"/>
      <ownedEnd xmi:id="end_1" type="c_1"/>
      <ownedEnd xmi:id="end_2" type="c_2"/>
    </packagedElement>
  </uml:Model>
</xmi:XMI>`;

    const result = parseXmi(xmiNoMult);
    expect(result.stats.relations).toBe(1);
    expect(result.model.relations[0].multiplicitySource).toBe("1");
    expect(result.model.relations[0].multiplicityTarget).toBe("1");
  });

  it("9. Descarta y contabiliza generalización (herencia) con clase padre inexistente", () => {
    const xmiDanglingInheritance = `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmlns:xmi="http://schema.omg.org/spec/XMI/2.1" xmi:version="2.1" xmlns:uml="http://schema.omg.org/spec/UML/2.1">
  <uml:Model xmi:type="uml:Model" name="Model">
    <packagedElement xmi:type="uml:Class" xmi:id="c_hijo" name="Hijo">
      <generalization general="c_inexistente"/>
    </packagedElement>
  </uml:Model>
</xmi:XMI>`;

    const result = parseXmi(xmiDanglingInheritance);
    expect(result.stats.classes).toBe(1);
    expect(result.stats.relations).toBe(0);
    expect(result.stats.discardedRelations).toBe(1);
  });

  it("10. Soporta relación de una clase consigo misma (auto-asociación)", () => {
    const xmiSelfRel = `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmlns:xmi="http://schema.omg.org/spec/XMI/2.1" xmi:version="2.1" xmlns:uml="http://schema.omg.org/spec/UML/2.1">
  <uml:Model xmi:type="uml:Model" name="Model">
    <packagedElement xmi:type="uml:Class" xmi:id="c_emp" name="Empleado"/>
    <packagedElement xmi:type="uml:Association" xmi:id="rel_supervisa" name="supervisa">
      <memberEnd xmi:idref="end_jefe"/>
      <memberEnd xmi:idref="end_sub"/>
      <ownedEnd xmi:id="end_jefe" type="c_emp">
        <lowerValue xmi:type="uml:LiteralInteger" value="0"/>
        <upperValue xmi:type="uml:LiteralInteger" value="1"/>
      </ownedEnd>
      <ownedEnd xmi:id="end_sub" type="c_emp">
        <lowerValue xmi:type="uml:LiteralInteger" value="0"/>
        <upperValue xmi:type="uml:LiteralUnlimitedNatural" value="-1"/>
      </ownedEnd>
    </packagedElement>
  </uml:Model>
</xmi:XMI>`;

    const result = parseXmi(xmiSelfRel);
    expect(result.stats.classes).toBe(1);
    expect(result.stats.relations).toBe(1);
    expect(result.stats.discardedRelations).toBe(0);

    const rel = result.model.relations[0];
    expect(rel.sourceClassId).toBe("c_emp");
    expect(rel.targetClassId).toBe("c_emp");
    expect(rel.multiplicitySource).toBe("0..1");
    expect(rel.multiplicityTarget).toBe("0..*");
  });

  it("11. Soporta dos clases con el mismo nombre en paquetes distintos sin romper mapa de IDs", () => {
    const xmiSameNamePackages = `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmlns:xmi="http://schema.omg.org/spec/XMI/2.1" xmi:version="2.1" xmlns:uml="http://schema.omg.org/spec/UML/2.1">
  <uml:Model xmi:type="uml:Model" name="Model">
    <packagedElement xmi:type="uml:Package" xmi:id="pkg_auth" name="Auth">
      <packagedElement xmi:type="uml:Class" xmi:id="cls_auth_user" name="Usuario">
        <ownedAttribute xmi:type="uml:Property" xmi:id="a_auth_email" name="email">
          <type xmi:type="uml:PrimitiveType" href="http://schema.omg.org/spec/UML/2.1#String"/>
        </ownedAttribute>
      </packagedElement>
    </packagedElement>
    <packagedElement xmi:type="uml:Package" xmi:id="pkg_billing" name="Billing">
      <packagedElement xmi:type="uml:Class" xmi:id="cls_bill_user" name="Usuario">
        <ownedAttribute xmi:type="uml:Property" xmi:id="a_bill_saldo" name="saldo">
          <type xmi:type="uml:PrimitiveType" href="http://schema.omg.org/spec/UML/2.1#Real"/>
        </ownedAttribute>
      </packagedElement>
    </packagedElement>
    <packagedElement xmi:type="uml:Association" xmi:id="rel_auth_billing">
      <memberEnd xmi:idref="end_u1"/>
      <memberEnd xmi:idref="end_u2"/>
      <ownedEnd xmi:id="end_u1" type="cls_auth_user"/>
      <ownedEnd xmi:id="end_u2" type="cls_bill_user"/>
    </packagedElement>
  </uml:Model>
</xmi:XMI>`;

    const result = parseXmi(xmiSameNamePackages);
    expect(result.stats.classes).toBe(2);
    expect(result.stats.relations).toBe(1);
    expect(result.stats.discardedRelations).toBe(0);

    const userAuth = result.model.classes.find((c) => c.id === "cls_auth_user");
    const userBill = result.model.classes.find((c) => c.id === "cls_bill_user");

    expect(userAuth).toBeDefined();
    expect(userBill).toBeDefined();
    expect(userAuth?.className).toBe("Usuario");
    expect(userBill?.className).toBe("Usuario");
    expect(userAuth?.attributes[0].name).toBe("email");
    expect(userBill?.attributes[0].name).toBe("saldo");

    const rel = result.model.relations[0];
    expect(rel.sourceClassId).toBe("cls_auth_user");
    expect(rel.targetClassId).toBe("cls_bill_user");
  });
});
