import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { UmlModel } from "../backendGenerator/types";
import { convertUmlModelToSchema, mapAttributeType } from "./converter";
import { buildMobileZip, shouldExcludeDir, shouldExcludeFile } from "./buildMobileZip";

describe("Conversor UmlModel -> esquema.json", () => {
  test("Mapeo individual de tipos de atributos", () => {
    assert.equal(mapAttributeType("String"), "texto");
    assert.equal(mapAttributeType("string"), "texto");
    assert.equal(mapAttributeType("TEXT"), "texto");

    assert.equal(mapAttributeType("number"), "numero");
    assert.equal(mapAttributeType("int"), "numero");
    assert.equal(mapAttributeType("Integer"), "numero");
    assert.equal(mapAttributeType("float"), "numero");
    assert.equal(mapAttributeType("double"), "numero");

    // Tipos no soportados deben mapearse a "otro"
    assert.equal(mapAttributeType("boolean"), "otro");
    assert.equal(mapAttributeType("Date"), "otro");
    assert.equal(mapAttributeType("Blob"), "otro");
    assert.equal(mapAttributeType("CustomType"), "otro");
  });

  test("Esquema de Barbería: Cliente y Atencion con ref cliente primero", () => {
    const barberiaModel: UmlModel = {
      classes: [
        {
          id: "cls_cliente",
          className: "Cliente",
          attributes: [
            { name: "nombre", type: "String", visibility: "public" },
            { name: "telefono", type: "String", visibility: "public" },
          ],
          methods: [],
        },
        {
          id: "cls_atencion",
          className: "Atencion",
          attributes: [
            { name: "servicio", type: "String", visibility: "public" },
            { name: "monto", type: "float", visibility: "public" },
          ],
          methods: [],
        },
      ],
      relations: [
        {
          relationType: "association",
          sourceClassId: "cls_atencion",
          targetClassId: "cls_cliente",
          multiplicitySource: "*",
          multiplicityTarget: "1",
        },
      ],
    };

    const schema = convertUmlModelToSchema(barberiaModel);

    assert.equal(schema.clases.length, 2);

    // Clase Cliente
    const cliente = schema.clases.find((c) => c.nombre === "Cliente");
    assert.ok(cliente);
    assert.deepEqual(cliente.campos, [
      { nombre: "nombre", tipo: "texto" },
      { nombre: "telefono", tipo: "texto" },
    ]);

    // Clase Atencion
    const atencion = schema.clases.find((c) => c.nombre === "Atencion");
    assert.ok(atencion);
    // El campo ref debe ir primero
    assert.equal(atencion.campos[0].tipo, "ref");
    assert.equal(atencion.campos[0].nombre, "cliente");
    assert.equal(atencion.campos[0].destino, "Cliente");
    assert.deepEqual(atencion.campos, [
      { nombre: "cliente", tipo: "ref", destino: "Cliente" },
      { nombre: "servicio", tipo: "texto" },
      { nombre: "monto", tipo: "numero" },
    ]);
  });

  test("Esquema de Tienda: Categoria y Producto con agregación/composición", () => {
    const tiendaModel: UmlModel = {
      classes: [
        {
          id: "cls_cat",
          className: "Categoria",
          attributes: [
            { name: "nombre", type: "String", visibility: "public" },
          ],
          methods: [],
        },
        {
          id: "cls_prod",
          className: "Producto",
          attributes: [
            { name: "nombre", type: "String", visibility: "public" },
            { name: "precio", type: "number", visibility: "public" },
          ],
          methods: [],
        },
      ],
      relations: [
        {
          relationType: "composition",
          sourceClassId: "cls_prod",
          targetClassId: "cls_cat",
          multiplicitySource: "*",
          multiplicityTarget: "1",
        },
      ],
    };

    const schema = convertUmlModelToSchema(tiendaModel);

    const cat = schema.clases.find((c) => c.nombre === "Categoria");
    assert.ok(cat);
    assert.deepEqual(cat.campos, [{ nombre: "nombre", tipo: "texto" }]);

    const prod = schema.clases.find((c) => c.nombre === "Producto");
    assert.ok(prod);
    assert.deepEqual(prod.campos, [
      { nombre: "categoria", tipo: "ref", destino: "Categoria" },
      { nombre: "nombre", tipo: "texto" },
      { nombre: "precio", tipo: "numero" },
    ]);
  });

  test("Ignora herencia, manyToMany, relación * a * y mapea tipo no soportado a otro", () => {
    const complexModel: UmlModel = {
      classes: [
        {
          id: "cls_persona",
          className: "Persona",
          attributes: [
            { name: "nombre", type: "String", visibility: "public" },
          ],
          methods: [],
        },
        {
          id: "cls_empleado",
          className: "Empleado",
          attributes: [
            { name: "sueldo", type: "number", visibility: "public" },
            { name: "foto", type: "Blob", visibility: "public" }, // Tipo no soportado -> "otro"
            { name: "activo", type: "boolean", visibility: "public" }, // Tipo no soportado -> "otro"
          ],
          methods: [],
        },
        {
          id: "cls_proyecto",
          className: "Proyecto",
          attributes: [
            { name: "titulo", type: "String", visibility: "public" },
          ],
          methods: [],
        },
      ],
      relations: [
        // 1. Herencia: debe ser ignorada
        {
          relationType: "inheritance",
          sourceClassId: "cls_empleado",
          targetClassId: "cls_persona",
          multiplicitySource: "",
          multiplicityTarget: "",
        },
        // 2. Relación * a *: debe ser ignorada
        {
          relationType: "association",
          sourceClassId: "cls_empleado",
          targetClassId: "cls_proyecto",
          multiplicitySource: "*",
          multiplicityTarget: "*",
        },
        // 3. Relación manyToMany: debe ser ignorada
        {
          relationType: "manyToMany",
          sourceClassId: "cls_persona",
          targetClassId: "cls_proyecto",
          multiplicitySource: "1..*",
          multiplicityTarget: "1..*",
        },
      ],
    };

    const schema = convertUmlModelToSchema(complexModel);

    const empleado = schema.clases.find((c) => c.nombre === "Empleado");
    assert.ok(empleado);

    // Ninguna de las relaciones anteriores debe haber generado un campo ref
    const refFields = empleado.campos.filter((f) => f.tipo === "ref");
    assert.equal(refFields.length, 0);

    // Atributos foto y activo deben ser mapeados a "otro"
    assert.deepEqual(empleado.campos, [
      { nombre: "sueldo", tipo: "numero" },
      { nombre: "foto", tipo: "otro" },
      { nombre: "activo", tipo: "otro" },
    ]);
  });

  test("Reglas de exclusión de archivos y directorios para el ZIP", () => {
    // Directorios excluidos
    assert.equal(shouldExcludeDir("build", "build"), true);
    assert.equal(shouldExcludeDir(".dart_tool", ".dart_tool"), true);
    assert.equal(shouldExcludeDir("build", "android/build"), true);
    assert.equal(shouldExcludeDir(".gradle", "android/.gradle"), true);
    assert.equal(shouldExcludeDir(".idea", ".idea"), true);
    assert.equal(shouldExcludeDir("node_modules", "node_modules"), true);

    // Directorios no excluidos
    assert.equal(shouldExcludeDir("lib", "lib"), false);
    assert.equal(shouldExcludeDir("assets", "assets"), false);

    // Archivos excluidos
    assert.equal(shouldExcludeFile("model.gguf", "models/model.gguf"), true);
    assert.equal(shouldExcludeFile("qwen2.5-1.5b-instruct-q4_k_m.gguf", "models/qwen2.5-1.5b-instruct-q4_k_m.gguf"), true);
    assert.equal(shouldExcludeFile("esquema.json", "assets/esquema.json"), true);
    assert.equal(shouldExcludeFile("LEEME.txt", "LEEME.txt"), true);

    // Archivos no excluidos
    assert.equal(shouldExcludeFile("pubspec.yaml", "pubspec.yaml"), false);
    assert.equal(shouldExcludeFile("main.dart", "lib/main.dart"), false);
  });

  test("buildMobileZip genera un buffer ZIP válido", async () => {
    const barberiaModel: UmlModel = {
      classes: [
        {
          id: "cls_cliente",
          className: "Cliente",
          attributes: [{ name: "nombre", type: "String", visibility: "public" }],
          methods: [],
        },
      ],
      relations: [],
    };

    const zipBuffer = await buildMobileZip(barberiaModel);
    assert.ok(Buffer.isBuffer(zipBuffer));
    assert.ok(zipBuffer.length > 1000);
    // Firma mágica de archivo ZIP: PK (0x50, 0x4B, 0x03, 0x04)
    assert.equal(zipBuffer[0], 0x50);
    assert.equal(zipBuffer[1], 0x4b);
  });

  test("Omite atributos con nombre 'id' e 'ID' en distintas clases y genera clase con campos vacíos si solo tenía ID", () => {
    const modelWithIds: UmlModel = {
      classes: [
        {
          id: "cls_usuario",
          className: "Usuario",
          attributes: [
            { name: "id", type: "Long", visibility: "public" },
            { name: "nombre", type: "String", visibility: "public" },
          ],
          methods: [],
        },
        {
          id: "cls_rol",
          className: "Rol",
          attributes: [
            { name: "ID", type: "int", visibility: "public" },
            { name: "descripcion", type: "String", visibility: "public" },
          ],
          methods: [],
        },
        {
          id: "cls_etiqueta",
          className: "Etiqueta",
          attributes: [
            { name: "ID", type: "Long", visibility: "public" },
          ],
          methods: [],
        },
      ],
      relations: [],
    };

    const schema = convertUmlModelToSchema(modelWithIds);

    assert.equal(schema.clases.length, 3);

    const usuario = schema.clases.find((c) => c.nombre === "Usuario");
    assert.ok(usuario);
    assert.deepEqual(usuario.campos, [{ nombre: "nombre", tipo: "texto" }]);

    const rol = schema.clases.find((c) => c.nombre === "Rol");
    assert.ok(rol);
    assert.deepEqual(rol.campos, [{ nombre: "descripcion", tipo: "texto" }]);

    const etiqueta = schema.clases.find((c) => c.nombre === "Etiqueta");
    assert.ok(etiqueta);
    assert.deepEqual(etiqueta.campos, []);
  });
});
