import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  reviewModel,
  Finding,
  formatFindingsForPrompt,
  formatFindingsFallback,
  formatNoFindingsMessage,
  formatEmptyDiagramMessage,
  MAX_CHAT_MESSAGE_LENGTH,
} from "./diagramReview";
import { UmlModel, UmlClass, UmlRelation } from "../backendGenerator/types";

describe("CU21: diagramReview — reviewModel", () => {
  // Helper para crear clases mínimas
  function makeClass(
    id: string,
    className: string,
    attrs: { name: string; type?: string; visibility?: string }[] = []
  ): UmlClass {
    return {
      id,
      className,
      attributes: attrs.map((a) => ({
        name: a.name,
        type: a.type || "String",
        visibility: a.visibility || "private",
      })),
      methods: [],
    };
  }

  // ==========================================
  // R1: clase sin atributos y que NO es hija
  // ==========================================
  describe("R1 — Clase sin atributos y no hija", () => {
    test("positivo (una sola clase): sugiere comando de chat para agregar atributo id", () => {
      const model: UmlModel = {
        classes: [makeClass("c1", "Cliente", [])],
        relations: [],
      };
      const findings = reviewModel(model);
      const r1 = findings.find((f) => f.code === "R1");
      assert.ok(r1, "Debe disparar R1");
      assert.equal(r1.severity, "recomendado");
      assert.deepEqual(r1.classNames, ["Cliente"]);
      assert.equal(r1.fix, "@Codia agrega el atributo id a Cliente");
      assert.ok(!r1.message.includes("**"));
      assert.ok(!r1.fix.includes("**"));
    });

    test("positivo (múltiples clases): remite a editar cada una", () => {
      const model: UmlModel = {
        classes: [makeClass("c1", "Cliente", []), makeClass("c2", "Factura", [])],
        relations: [
          {
            relationType: "association",
            sourceClassId: "c1",
            targetClassId: "c2",
            multiplicitySource: "1",
            multiplicityTarget: "*",
          },
        ],
      };
      const findings = reviewModel(model);
      const r1 = findings.find((f) => f.code === "R1");
      assert.ok(r1);
      assert.deepEqual(r1.classNames, ["Cliente", "Factura"]);
      assert.ok(r1.fix.toLowerCase().includes("cada una"));
    });

    test("negativo: clase con al menos un atributo no dispara R1", () => {
      const model: UmlModel = {
        classes: [makeClass("c1", "Cliente", [{ name: "id" }])],
        relations: [],
      };
      const findings = reviewModel(model);
      assert.ok(!findings.some((f) => f.code === "R1"));
    });
  });

  // ==========================================
  // R2: clase NO hija con primer atributo no identificador
  // ==========================================
  describe("R2 — Primer atributo no parece identificador", () => {
    test("positivo: primer atributo es 'nombre' en clase raíz dispara R2 con severidad importante y fix sin chat", () => {
      const model: UmlModel = {
        classes: [
          makeClass("c1", "Usuario", [
            { name: "nombre" },
            { name: "id" },
          ]),
        ],
        relations: [],
      };
      const findings = reviewModel(model);
      const r2 = findings.find((f) => f.code === "R2");
      assert.ok(r2, "Debe disparar R2");
      assert.equal(r2.severity, "importante");
      assert.deepEqual(r2.classNames, ["Usuario"]);
      assert.ok(r2.message.includes("clave primaria"));
      assert.ok(r2.fix.toLowerCase().includes("doble clic"));
      assert.ok(!r2.fix.includes("@Codia"), "No debe tener comando de chat");
    });

    test("negativo: primer atributo 'id', 'idUsuario' o 'codigo' no dispara R2", () => {
      const testNames = ["id", "idUsuario", "codigo", "código", "codProducto"];
      for (const name of testNames) {
        const model: UmlModel = {
          classes: [makeClass("c1", "Producto", [{ name }])],
          relations: [],
        };
        const findings = reviewModel(model);
        assert.ok(
          !findings.some((f) => f.code === "R2"),
          `No debe disparar R2 para atributo '${name}'`
        );
      }
    });
  });

  // ==========================================
  // R3: clase aislada (al menos 2 clases)
  // ==========================================
  describe("R3 — Clase aislada", () => {
    test("positivo: habiendo 2 clases y una no conectada dispara R3", () => {
      const model: UmlModel = {
        classes: [
          makeClass("c1", "Cliente", [{ name: "id" }]),
          makeClass("c2", "Configuracion", [{ name: "id" }]),
        ],
        relations: [],
      };
      const findings = reviewModel(model);
      const r3 = findings.find((f) => f.code === "R3");
      assert.ok(r3, "Debe disparar R3");
      assert.equal(r3.severity, "recomendado");
      assert.deepEqual(r3.classNames, ["Cliente", "Configuracion"]);
    });

    test("negativo: si solo hay 1 clase en el diagrama no dispara R3", () => {
      const model: UmlModel = {
        classes: [makeClass("c1", "Solo", [{ name: "id" }])],
        relations: [],
      };
      const findings = reviewModel(model);
      assert.ok(!findings.some((f) => f.code === "R3"));
    });

    test("negativo: clases conectadas entre sí no disparan R3", () => {
      const model: UmlModel = {
        classes: [
          makeClass("c1", "A", [{ name: "id" }]),
          makeClass("c2", "B", [{ name: "id" }]),
        ],
        relations: [
          {
            relationType: "association",
            sourceClassId: "c1",
            targetClassId: "c2",
            multiplicitySource: "1",
            multiplicityTarget: "*",
          },
        ],
      };
      const findings = reviewModel(model);
      assert.ok(!findings.some((f) => f.code === "R3"));
    });
  });

  // ==========================================
  // R4: relación con multiplicidad vacía
  // ==========================================
  describe("R4 — Relación con multiplicidad vacía", () => {
    test("positivo: asociación con multiplicitySource vacía dispara R4", () => {
      const model: UmlModel = {
        classes: [
          makeClass("c1", "Pedido", [{ name: "id" }]),
          makeClass("c2", "Item", [{ name: "id" }]),
        ],
        relations: [
          {
            relationType: "association",
            sourceClassId: "c1",
            targetClassId: "c2",
            multiplicitySource: "",
            multiplicityTarget: "1..*",
          },
        ],
      };
      const findings = reviewModel(model);
      const r4 = findings.find((f) => f.code === "R4");
      assert.ok(r4, "Debe disparar R4");
      assert.equal(r4.severity, "recomendado");
      assert.ok(r4.classNames.includes("Pedido"));
      assert.ok(r4.classNames.includes("Item"));
    });

    test("negativo: herencia con multiplicidad vacía NO dispara R4", () => {
      const model: UmlModel = {
        classes: [
          makeClass("c1", "Gerente", []),
          makeClass("c2", "Empleado", [{ name: "id" }]),
        ],
        relations: [
          {
            relationType: "inheritance",
            sourceClassId: "c1",
            targetClassId: "c2",
            multiplicitySource: "",
            multiplicityTarget: "",
          },
        ],
      };
      const findings = reviewModel(model);
      assert.ok(!findings.some((f) => f.code === "R4"));
    });

    test("negativo: asociación con ambas multiplicidades llenas no dispara R4", () => {
      const model: UmlModel = {
        classes: [
          makeClass("c1", "A", [{ name: "id" }]),
          makeClass("c2", "B", [{ name: "id" }]),
        ],
        relations: [
          {
            relationType: "association",
            sourceClassId: "c1",
            targetClassId: "c2",
            multiplicitySource: "1",
            multiplicityTarget: "0..*",
          },
        ],
      };
      const findings = reviewModel(model);
      assert.ok(!findings.some((f) => f.code === "R4"));
    });
  });

  // ==========================================
  // R5: manyToMany sin clase intermedia
  // ==========================================
  describe("R5 — Relación manyToMany sin clase intermedia", () => {
    test("positivo: relación con '*' en ambos extremos sugiere clase intermedia en chat", () => {
      const model: UmlModel = {
        classes: [
          makeClass("c1", "Estudiante", [{ name: "id" }]),
          makeClass("c2", "Curso", [{ name: "id" }]),
        ],
        relations: [
          {
            relationType: "association",
            sourceClassId: "c1",
            targetClassId: "c2",
            multiplicitySource: "*",
            multiplicityTarget: "*",
          },
        ],
      };
      const findings = reviewModel(model);
      const r5 = findings.find((f) => f.code === "R5");
      assert.ok(r5, "Debe disparar R5");
      assert.equal(r5.severity, "recomendado");
      assert.deepEqual(r5.classNames, ["Estudiante", "Curso"]);
      assert.equal(r5.fix, "@Codia crea la clase EstudianteCurso");
    });

    test("positivo: relationType manyToMany explícito", () => {
      const model: UmlModel = {
        classes: [
          makeClass("c1", "Autor", [{ name: "id" }]),
          makeClass("c2", "Libro", [{ name: "id" }]),
        ],
        relations: [
          {
            relationType: "manyToMany",
            sourceClassId: "c1",
            targetClassId: "c2",
            multiplicitySource: "1..*",
            multiplicityTarget: "1..*",
          },
        ],
      };
      const findings = reviewModel(model);
      const r5 = findings.find((f) => f.code === "R5");
      assert.ok(r5);
      assert.equal(r5.fix, "@Codia crea la clase AutorLibro");
    });

    test("negativo: con clase intermedia conectada a ambas no dispara R5", () => {
      const model: UmlModel = {
        classes: [
          makeClass("c1", "Estudiante", [{ name: "id" }]),
          makeClass("c2", "Curso", [{ name: "id" }]),
          makeClass("c3", "Inscripcion", [{ name: "id" }]),
        ],
        relations: [
          {
            relationType: "manyToMany",
            sourceClassId: "c1",
            targetClassId: "c2",
            multiplicitySource: "*",
            multiplicityTarget: "*",
          },
          {
            relationType: "association",
            sourceClassId: "c3",
            targetClassId: "c1",
            multiplicitySource: "*",
            multiplicityTarget: "1",
          },
          {
            relationType: "association",
            sourceClassId: "c3",
            targetClassId: "c2",
            multiplicitySource: "*",
            multiplicityTarget: "1",
          },
        ],
      };
      const findings = reviewModel(model);
      assert.ok(!findings.some((f) => f.code === "R5"));
    });

    test("negativo: relación 1 a muchos no dispara R5", () => {
      const model: UmlModel = {
        classes: [
          makeClass("c1", "Padre", [{ name: "id" }]),
          makeClass("c2", "Hijo", [{ name: "id" }]),
        ],
        relations: [
          {
            relationType: "association",
            sourceClassId: "c1",
            targetClassId: "c2",
            multiplicitySource: "1",
            multiplicityTarget: "*",
          },
        ],
      };
      const findings = reviewModel(model);
      assert.ok(!findings.some((f) => f.code === "R5"));
    });
  });

  // ==========================================
  // R6: nombres duplicados (importante) o singular/plural (recomendado)
  // ==========================================
  describe("R6 — Nombres duplicados o singular/plural", () => {
    test("positivo (importante): nombres duplicados ignorando mayúsculas y tildes", () => {
      const model: UmlModel = {
        classes: [
          makeClass("c1", "Usuario", [{ name: "id" }]),
          makeClass("c2", "usuario", [{ name: "id" }]),
        ],
        relations: [],
      };
      const findings = reviewModel(model);
      const r6 = findings.find((f) => f.code === "R6");
      assert.ok(r6, "Debe disparar R6");
      assert.equal(r6.severity, "importante");
      assert.ok(r6.classNames.includes("Usuario"));
      assert.ok(r6.classNames.includes("usuario"));
      assert.ok(r6.message.includes("duplicados"));
    });

    test("positivo (recomendado): pares singular/plural (Cliente y Clientes)", () => {
      const model: UmlModel = {
        classes: [
          makeClass("c1", "Cliente", [{ name: "id" }]),
          makeClass("c2", "Clientes", [{ name: "id" }]),
        ],
        relations: [],
      };
      const findings = reviewModel(model);
      const r6 = findings.find((f) => f.code === "R6");
      assert.ok(r6, "Debe disparar R6");
      assert.equal(r6.severity, "recomendado");
      assert.deepEqual(r6.classNames, ["Cliente", "Clientes"]);
      assert.ok(r6.message.includes("singular y plural"));
    });

    test("negativo: nombres distintos sin relación singular/plural no disparan R6", () => {
      const model: UmlModel = {
        classes: [
          makeClass("c1", "Cliente", [{ name: "id" }]),
          makeClass("c2", "Factura", [{ name: "id" }]),
        ],
        relations: [],
      };
      const findings = reviewModel(model);
      assert.ok(!findings.some((f) => f.code === "R6"));
    });
  });

  // ==========================================
  // R7: atributos repetidos dentro de una clase
  // ==========================================
  describe("R7 — Atributos repetidos dentro de una clase", () => {
    test("positivo: atributos duplicados ignorando mayúsculas y tildes dispara R7 importante", () => {
      const model: UmlModel = {
        classes: [
          makeClass("c1", "Persona", [
            { name: "id" },
            { name: "email" },
            { name: "EMAIL" },
          ]),
        ],
        relations: [],
      };
      const findings = reviewModel(model);
      const r7 = findings.find((f) => f.code === "R7");
      assert.ok(r7, "Debe disparar R7");
      assert.equal(r7.severity, "importante");
      assert.deepEqual(r7.classNames, ["Persona"]);
      // Verificar que el fix no sugiera quitar ni renombrar
      assert.ok(!r7.fix.toLowerCase().includes("quitar"));
      assert.ok(!r7.fix.toLowerCase().includes("renombrar"));
    });

    test("negativo: atributos con nombres distintos no disparan R7", () => {
      const model: UmlModel = {
        classes: [
          makeClass("c1", "Persona", [
            { name: "id" },
            { name: "nombre" },
            { name: "apellido" },
          ]),
        ],
        relations: [],
      };
      const findings = reviewModel(model);
      assert.ok(!findings.some((f) => f.code === "R7"));
    });
  });

  // ==========================================
  // R8: nombres de clase que no empiezan con mayúscula o llevan espacios
  // ==========================================
  describe("R8 — Nombres de clase sin mayúscula inicial o con espacios", () => {
    test("positivo: clase en minúscula y clase con espacios agrupadas en una sola Finding", () => {
      const model: UmlModel = {
        classes: [
          makeClass("c1", "cliente", [{ name: "id" }]),
          makeClass("c2", "Orden Compra", [{ name: "id" }]),
        ],
        relations: [],
      };
      const findings = reviewModel(model);
      const r8 = findings.find((f) => f.code === "R8");
      assert.ok(r8, "Debe disparar R8");
      assert.equal(r8.severity, "recomendado");
      assert.deepEqual(r8.classNames, ["cliente", "Orden Compra"]);
    });

    test("negativo: nombres válidos en PascalCase no disparan R8", () => {
      const model: UmlModel = {
        classes: [
          makeClass("c1", "Cliente", [{ name: "id" }]),
          makeClass("c2", "OrdenCompra", [{ name: "id" }]),
        ],
        relations: [],
      };
      const findings = reviewModel(model);
      assert.ok(!findings.some((f) => f.code === "R8"));
    });
  });

  // ==========================================
  // R9: clase hija con más de un padre o ciclos de herencia
  // ==========================================
  describe("R9 — Herencia múltiple y ciclos de herencia", () => {
    test("positivo: clase hija con más de un padre dispara R9 importante", () => {
      const model: UmlModel = {
        classes: [
          makeClass("c1", "Hijo", []),
          makeClass("c2", "PadreA", [{ name: "id" }]),
          makeClass("c3", "PadreB", [{ name: "id" }]),
        ],
        relations: [
          {
            relationType: "inheritance",
            sourceClassId: "c1",
            targetClassId: "c2",
            multiplicitySource: "",
            multiplicityTarget: "",
          },
          {
            relationType: "inheritance",
            sourceClassId: "c1",
            targetClassId: "c3",
            multiplicitySource: "",
            multiplicityTarget: "",
          },
        ],
      };
      const findings = reviewModel(model);
      const r9 = findings.find((f) => f.code === "R9");
      assert.ok(r9, "Debe disparar R9");
      assert.equal(r9.severity, "importante");
      assert.ok(r9.classNames.includes("Hijo"));
    });

    test("positivo: ciclo de herencia A -> B -> A dispara R9 importante", () => {
      const model: UmlModel = {
        classes: [
          makeClass("c1", "ClaseA", []),
          makeClass("c2", "ClaseB", []),
        ],
        relations: [
          {
            relationType: "inheritance",
            sourceClassId: "c1",
            targetClassId: "c2",
            multiplicitySource: "",
            multiplicityTarget: "",
          },
          {
            relationType: "inheritance",
            sourceClassId: "c2",
            targetClassId: "c1",
            multiplicitySource: "",
            multiplicityTarget: "",
          },
        ],
      };
      const findings = reviewModel(model);
      const r9 = findings.find((f) => f.code === "R9");
      assert.ok(r9, "Debe disparar R9 por ciclo");
      assert.equal(r9.severity, "importante");
      assert.ok(r9.classNames.includes("ClaseA"));
      assert.ok(r9.classNames.includes("ClaseB"));
    });

    test("negativo: jerarquía lineal simple sin ciclos ni múltiple herencia", () => {
      const model: UmlModel = {
        classes: [
          makeClass("c1", "Hijo", []),
          makeClass("c2", "Padre", [{ name: "id" }]),
        ],
        relations: [
          {
            relationType: "inheritance",
            sourceClassId: "c1",
            targetClassId: "c2",
            multiplicitySource: "",
            multiplicityTarget: "",
          },
        ],
      };
      const findings = reviewModel(model);
      assert.ok(!findings.some((f) => f.code === "R9"));
    });
  });

  // ==========================================
  // R10: relaciones duplicadas del mismo tipo entre el mismo par
  // ==========================================
  describe("R10 — Relaciones duplicadas del mismo tipo", () => {
    test("positivo: dos asociaciones entre el mismo par de clases disparan R10", () => {
      const model: UmlModel = {
        classes: [
          makeClass("c1", "A", [{ name: "id" }]),
          makeClass("c2", "B", [{ name: "id" }]),
        ],
        relations: [
          {
            relationType: "association",
            sourceClassId: "c1",
            targetClassId: "c2",
            multiplicitySource: "1",
            multiplicityTarget: "*",
          },
          {
            relationType: "association",
            sourceClassId: "c2",
            targetClassId: "c1",
            multiplicitySource: "*",
            multiplicityTarget: "1",
          },
        ],
      };
      const findings = reviewModel(model);
      const r10 = findings.find((f) => f.code === "R10");
      assert.ok(r10, "Debe disparar R10");
      assert.equal(r10.severity, "recomendado");
      assert.ok(r10.classNames.includes("A"));
      assert.ok(r10.classNames.includes("B"));
    });

    test("negativo: dos relaciones de distinto tipo entre el mismo par no disparan R10", () => {
      const model: UmlModel = {
        classes: [
          makeClass("c1", "A", [{ name: "id" }]),
          makeClass("c2", "B", [{ name: "id" }]),
        ],
        relations: [
          {
            relationType: "association",
            sourceClassId: "c1",
            targetClassId: "c2",
            multiplicitySource: "1",
            multiplicityTarget: "1",
          },
          {
            relationType: "composition",
            sourceClassId: "c1",
            targetClassId: "c2",
            multiplicitySource: "1",
            multiplicityTarget: "*",
          },
        ],
      };
      const findings = reviewModel(model);
      assert.ok(!findings.some((f) => f.code === "R10"));
    });
  });

  // ==========================================
  // Casos Globales y Especiales
  // ==========================================
  describe("Casos Globales y Especiales", () => {
    test("caso de clase hija que NO dispara R1 ni R2 (sin atributos propios y con atributos que no son id)", () => {
      const model: UmlModel = {
        classes: [
          makeClass("cParent", "Persona", [{ name: "id" }]),
          makeClass("cChild1", "Estudiante", []), // Sin atributos pero es hija -> no R1
          makeClass("cChild2", "Docente", [{ name: "sueldo" }]), // Atributo no es id pero es hija -> no R2
        ],
        relations: [
          {
            relationType: "inheritance",
            sourceClassId: "cChild1",
            targetClassId: "cParent",
            multiplicitySource: "",
            multiplicityTarget: "",
          },
          {
            relationType: "inheritance",
            sourceClassId: "cChild2",
            targetClassId: "cParent",
            multiplicitySource: "",
            multiplicityTarget: "",
          },
        ],
      };
      const findings = reviewModel(model);
      assert.ok(!findings.some((f) => f.code === "R1"), "No debe disparar R1 para clases hijas");
      assert.ok(!findings.some((f) => f.code === "R2"), "No debe disparar R2 para clases hijas");
    });

    test("diagrama sano devuelve []", () => {
      const model: UmlModel = {
        classes: [
          makeClass("c1", "Cliente", [{ name: "id" }, { name: "nombre" }]),
          makeClass("c2", "Factura", [{ name: "codigo" }, { name: "monto" }]),
        ],
        relations: [
          {
            relationType: "association",
            sourceClassId: "c1",
            targetClassId: "c2",
            multiplicitySource: "1",
            multiplicityTarget: "0..*",
          },
        ],
      };
      const findings = reviewModel(model);
      assert.deepEqual(findings, []);
    });

    test("modelo vacío o sin clases devuelve []", () => {
      assert.deepEqual(reviewModel({ classes: [], relations: [] }), []);
      assert.deepEqual(reviewModel(null as any), []);
      assert.deepEqual(reviewModel({} as any), []);
    });

    test("límite máximo de 6 Finding cuando se disparan muchas reglas", () => {
      // Configuramos un modelo que dispara muchas reglas a la vez
      const model: UmlModel = {
        classes: [
          makeClass("c1", "cliente", []), // R1 (sin attrs), R8 (minúscula)
          makeClass("c2", "Orden Compra", [{ name: "detalle" }]), // R2 (no id), R8 (espacio)
          makeClass("c3", "Aislada", [{ name: "id" }]), // R3 (aislada)
          makeClass("c4", "Producto", [
            { name: "id" },
            { name: "precio" },
            { name: "precio" },
          ]), // R7 (attrs repetidos)
          makeClass("c5", "Padre", [{ name: "id" }]),
        ],
        relations: [
          {
            relationType: "association",
            sourceClassId: "c1",
            targetClassId: "c2",
            multiplicitySource: "", // R4 (multiplicidad vacía)
            multiplicityTarget: "",
          },
          {
            relationType: "manyToMany", // R5 (manyToMany sin intermedia)
            sourceClassId: "c1",
            targetClassId: "c5",
            multiplicitySource: "*",
            multiplicityTarget: "*",
          },
        ],
      };
      const findings = reviewModel(model);
      assert.ok(findings.length <= 6, `Debe devolver a lo sumo 6 hallazgos, devolvió: ${findings.length}`);
      assert.equal(findings.length, 6, "Debe alcanzar el tope de 6");
    });

    test("orden por severidad: 'importante' primero, luego 'recomendado'", () => {
      const model: UmlModel = {
        classes: [
          makeClass("c1", "Cliente", [{ name: "nombre" }]), // R2: importante
          makeClass("c2", "cliente", [{ name: "nombre" }]), // R6: importante (duplicado)
          makeClass("c3", "Aislada", []), // R1: recomendado, R3: recomendado
        ],
        relations: [],
      };
      const findings = reviewModel(model);
      assert.ok(findings.length >= 2);

      let seenRecomendado = false;
      for (const f of findings) {
        if (f.severity === "recomendado") {
          seenRecomendado = true;
        }
        if (seenRecomendado) {
          assert.equal(
            f.severity,
            "recomendado",
            `No debe haber un 'importante' después de un 'recomendado' (${f.code})`
          );
        }
      }
    });

    test("ningún fix sugiere quitar ni renombrar atributos", () => {
      // Disparamos varias reglas (R1, R2, R3, R4, R5, R6, R7, R8, R9, R10)
      const model: UmlModel = {
        classes: [
          makeClass("c1", "Cliente", [
            { name: "nombre" },
            { name: "email" },
            { name: "email" },
          ]),
          makeClass("c2", "Cliente", [{ name: "id" }]),
        ],
        relations: [],
      };
      const findings = reviewModel(model);
      for (const f of findings) {
        const fixLower = f.fix.toLowerCase();
        assert.ok(
          !fixLower.includes("quitar atributo"),
          `Fix de ${f.code} no debe sugerir quitar atributos`
        );
        assert.ok(
          !fixLower.includes("renombrar atributo"),
          `Fix de ${f.code} no debe sugerir renombrar atributos`
        );
      }
    });

    test("los textos message y fix no contienen formato markdown", () => {
      const model: UmlModel = {
        classes: [
          makeClass("c1", "cliente", []),
          makeClass("c2", "Orden", [{ name: "descripcion" }]),
        ],
        relations: [
          {
            relationType: "association",
            sourceClassId: "c1",
            targetClassId: "c2",
            multiplicitySource: "",
            multiplicityTarget: "",
          },
        ],
      };
      const findings = reviewModel(model);
      for (const f of findings) {
        assert.ok(!f.message.includes("**"), `Message de ${f.code} contiene **`);
        assert.ok(!f.message.includes("`"), `Message de ${f.code} contiene backticks`);
        assert.ok(!f.fix.includes("**"), `Fix de ${f.code} contiene **`);
        assert.ok(!f.fix.includes("`"), `Fix de ${f.code} contiene backticks`);
      }
    });
  });

  // ==========================================
  // CU21 Fase 1B: Formateadores de Revisión
  // ==========================================
  describe("CU21 Fase 1B — Formateadores de Revisión", () => {
    function assertNoMarkdown(text: string, context = "") {
      assert.ok(!text.includes("*"), `[${context}] No debe contener asteriscos (*)`);
      assert.ok(!text.includes("#"), `[${context}] No debe contener almohadillas (#)`);
      assert.ok(!text.includes("`"), `[${context}] No debe contener comillas invertidas (\`)`);
      assert.ok(
        !/(?:^|\n)\s*-\s+/.test(text),
        `[${context}] No debe contener guiones de lista (- )`
      );
    }

    const sampleFindings: Finding[] = [
      {
        code: "R2",
        severity: "importante",
        classNames: ["Usuario"],
        message:
          "El backend generado toma el primer atributo como clave primaria. En la clase Usuario, el primer atributo no parece ser un identificador.",
        fix: "Haz doble clic sobre la clase en el lienzo y pon el identificador como primer atributo.",
      },
      {
        code: "R1",
        severity: "recomendado",
        classNames: ["Cliente"],
        message:
          "La clase Cliente no tiene atributos definidos y no es hija de otra clase.",
        fix: "@Codia agrega el atributo id a Cliente",
      },
    ];

    describe("formatFindingsForPrompt", () => {
      test("formato exacto con frase sugerida (@Codia) y qué hacer (sin @Codia)", () => {
        const text = formatFindingsForPrompt(sampleFindings);
        const lines = text.split("\n");
        assert.equal(lines.length, 2);

        // Línea 1 (R2): Qué hacer:
        assert.ok(lines[0].startsWith("1. [importante] Clases: Usuario."));
        assert.ok(lines[0].includes("Qué hacer: Haz doble clic"));

        // Línea 2 (R1): Frase sugerida:
        assert.ok(lines[1].startsWith("2. [recomendado] Clases: Cliente."));
        assert.ok(
          lines[1].includes(
            "Frase sugerida: @Codia agrega el atributo id a Cliente"
          )
        );
      });

      test("lista vacía devuelve cadena vacía", () => {
        assert.equal(formatFindingsForPrompt([]), "");
        assert.equal(formatFindingsForPrompt(null as any), "");
      });

      test("sin markdown en toda la salida", () => {
        const text = formatFindingsForPrompt(sampleFindings);
        assertNoMarkdown(text, "formatFindingsForPrompt");
      });
    });

    describe("formatFindingsFallback", () => {
      test("dirigido por nombre cuando askerName está presente", () => {
        const text = formatFindingsFallback(sampleFindings, "Ana");
        assert.ok(
          text.startsWith("Ana, revisé el diagrama y encontré 2 observaciones:"),
          `Debe iniciar dirigido por nombre: ${text}`
        );
      });

      test("sin nombre cuando askerName está vacío o solo espacios", () => {
        const text1 = formatFindingsFallback(sampleFindings, "");
        assert.ok(
          text1.startsWith("Revisé el diagrama y encontré 2 observaciones:"),
          `Debe iniciar sin nombre: ${text1}`
        );

        const text2 = formatFindingsFallback(sampleFindings, "   ");
        assert.ok(
          text2.startsWith("Revisé el diagrama y encontré 2 observaciones:"),
          `Debe iniciar sin nombre con espacios: ${text2}`
        );
      });

      test("singular con 1 observación", () => {
        const text = formatFindingsFallback([sampleFindings[0]], "Carlos");
        assert.ok(text.includes("encontré 1 observación:"));
      });

      test("contiene lista numerada con message y fix", () => {
        const text = formatFindingsFallback(sampleFindings, "Davico");
        assert.ok(text.includes("1. [importante]"));
        assert.ok(text.includes("2. [recomendado]"));
        assert.ok(text.includes("Qué hacer: Haz doble clic"));
        assert.ok(text.includes("Frase sugerida: @Codia"));
      });

      test("termina invitando a pedirle a Codia que aplique alguna", () => {
        const text = formatFindingsFallback(sampleFindings, "Ana");
        assert.ok(
          text.includes(
            "Si quieres que aplique algún cambio, pídemelo en el chat mencionando a @Codia"
          )
        );
      });

      test("si no hay observaciones delega en mensaje sin observaciones", () => {
        const text = formatFindingsFallback([], "Ana");
        assert.equal(
          text,
          "Ana, revisé el diagrama y no encontré problemas de estructura."
        );
      });

      test("sin markdown en toda la salida", () => {
        const text = formatFindingsFallback(sampleFindings, "Ana");
        assertNoMarkdown(text, "formatFindingsFallback");
      });

      test("largo máximo en peor caso (6 observaciones muy extensas) no supera el límite de 2000 caracteres", () => {
        const longFindings: Finding[] = Array.from({ length: 6 }, (_, i) => ({
          code: `R${i + 1}`,
          severity: (i % 2 === 0 ? "importante" : "recomendado") as
            | "importante"
            | "recomendado",
          classNames: [
            `EntidadSuperExtensaConNombreLargo${i}A`,
            `EntidadSuperExtensaConNombreLargo${i}B`,
          ],
          message:
            `Esta es una descripción detallada y extensa del problema de diseño estructural ${i} ` +
            "encontrado en el modelo UML de la aplicación que explica con muchas palabras las consecuencias para el backend generado.",
          fix:
            i % 2 === 0
              ? `Haz doble clic sobre la clase EntidadSuperExtensaConNombreLargo${i}A en el lienzo para ajustar su clave primaria y dependencias asociadas.`
              : `@Codia crea la clase intermedia EntidadSuperExtensaConNombreLargo${i}AEntidadSuperExtensaConNombreLargo${i}B`,
        }));

        const text = formatFindingsFallback(longFindings, "JuanCarlosDeLaFuente");
        assert.ok(
          text.length <= MAX_CHAT_MESSAGE_LENGTH,
          `El texto no debe exceder ${MAX_CHAT_MESSAGE_LENGTH} caracteres (longitud actual: ${text.length})`
        );
        assertNoMarkdown(text, "formatFindingsFallback peor caso");
      });
    });

    describe("formatNoFindingsMessage", () => {
      test("con nombre", () => {
        const text = formatNoFindingsMessage("Ana");
        assert.equal(
          text,
          "Ana, revisé el diagrama y no encontré problemas de estructura."
        );
      });

      test("sin nombre", () => {
        const text1 = formatNoFindingsMessage("");
        assert.equal(
          text1,
          "Revisé el diagrama y no encontré problemas de estructura."
        );

        const text2 = formatNoFindingsMessage("   ");
        assert.equal(
          text2,
          "Revisé el diagrama y no encontré problemas de estructura."
        );
      });

      test("sin saludo ni presentación", () => {
        const text = formatNoFindingsMessage("Ana");
        assert.ok(!text.toLowerCase().includes("hola"));
        assert.ok(!text.toLowerCase().includes("soy codia"));
      });

      test("sin markdown", () => {
        assertNoMarkdown(formatNoFindingsMessage("Ana"), "formatNoFindingsMessage");
      });
    });

    describe("formatEmptyDiagramMessage", () => {
      test("con nombre", () => {
        const text = formatEmptyDiagramMessage("Ana");
        assert.equal(
          text,
          "Ana, el diagrama está vacío y no hay elementos para revisar."
        );
      });

      test("sin nombre", () => {
        const text1 = formatEmptyDiagramMessage("");
        assert.equal(
          text1,
          "El diagrama está vacío y no hay elementos para revisar."
        );

        const text2 = formatEmptyDiagramMessage("   ");
        assert.equal(
          text2,
          "El diagrama está vacío y no hay elementos para revisar."
        );
      });

      test("sin markdown", () => {
        assertNoMarkdown(
          formatEmptyDiagramMessage("Ana"),
          "formatEmptyDiagramMessage"
        );
      });
    });
  });
});
