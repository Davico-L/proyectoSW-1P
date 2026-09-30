import { describe, it, expect } from "vitest";
import { generateXmiDocument } from "../../../backend/src/xmiExporter/generateXmi";
import type { UmlModel } from "../../../backend/src/backendGenerator/types";
import { parseXmi } from "./parseXmi";

describe("CU11 - Prueba de Ida y Vuelta (Round-Trip) CU10 -> CU11", () => {
  it("exporta un UmlModel completo con CU10 y lo reconstruye equivalentemente con parseXmi", () => {
    // 1. Construir UmlModel de referencia con:
    // - 5 tipos de relación (inheritance, association, composition, aggregation, manyToMany)
    // - Atributos con todos los tipos soportados: String, Integer, Long, Boolean, Double, Date
    // - Métodos con retorno void y retornos tipados
    const originalModel: UmlModel = {
      classes: [
        {
          id: "cls_persona",
          className: "Persona",
          attributes: [
            { name: "id", type: "Integer", visibility: "private" },
            { name: "nombre", type: "String", visibility: "public" },
            { name: "activo", type: "Boolean", visibility: "protected" },
          ],
          methods: [
            { name: "getNombre", returnType: "String", visibility: "public" },
            { name: "desactivar", returnType: "void", visibility: "public" },
          ],
        },
        {
          id: "cls_estudiante",
          className: "Estudiante",
          attributes: [
            { name: "codigoEstudiante", type: "Long", visibility: "private" },
            { name: "promedio", type: "Double", visibility: "public" },
            { name: "fechaIngreso", type: "Date", visibility: "private" },
          ],
          methods: [
            { name: "calcularPromedio", returnType: "Double", visibility: "public" },
            { name: "esRegular", returnType: "Boolean", visibility: "public" },
          ],
        },
        {
          id: "cls_colegio",
          className: "Colegio",
          attributes: [
            { name: "nombreColegio", type: "String", visibility: "public" },
          ],
          methods: [],
        },
        {
          id: "cls_aula",
          className: "Aula",
          attributes: [
            { name: "numero", type: "Integer", visibility: "private" },
            { name: "capacidad", type: "Integer", visibility: "public" },
          ],
          methods: [],
        },
        {
          id: "cls_profesor",
          className: "Profesor",
          attributes: [
            { name: "especialidad", type: "String", visibility: "public" },
            { name: "sueldo", type: "Double", visibility: "protected" },
          ],
          methods: [
            { name: "asignarMateria", returnType: "void", visibility: "public" },
          ],
        },
        {
          id: "cls_materia",
          className: "Materia",
          attributes: [
            { name: "titulo", type: "String", visibility: "public" },
            { name: "creditos", type: "Integer", visibility: "private" },
          ],
          methods: [],
        },
      ],
      relations: [
        // 1. Inheritance: Estudiante -> Persona
        {
          relationType: "inheritance",
          sourceClassId: "cls_estudiante",
          targetClassId: "cls_persona",
          multiplicitySource: "1",
          multiplicityTarget: "1",
        },
        // 2. Association: Profesor -> Materia (1 a 0..1)
        {
          relationType: "association",
          sourceClassId: "cls_profesor",
          targetClassId: "cls_materia",
          multiplicitySource: "1",
          multiplicityTarget: "0..1",
        },
        // 3. Composition: Colegio -> Aula (1 a 1..*)
        {
          relationType: "composition",
          sourceClassId: "cls_colegio",
          targetClassId: "cls_aula",
          multiplicitySource: "1",
          multiplicityTarget: "1..*",
        },
        // 4. Aggregation: Profesor -> Aula (0..1 a *)
        {
          relationType: "aggregation",
          sourceClassId: "cls_profesor",
          targetClassId: "cls_aula",
          multiplicitySource: "0..1",
          multiplicityTarget: "*",
        },
        // 5. Many to Many: Estudiante -> Materia (0..* a 1..*)
        {
          relationType: "association",
          sourceClassId: "cls_estudiante",
          targetClassId: "cls_materia",
          multiplicitySource: "0..*",
          multiplicityTarget: "1..*",
        },
      ],
    };

    // 2. Generar XMI usando la función real del exportador CU10
    const xmiXml = generateXmiDocument(originalModel, "ModeloRoundTrip");
    expect(xmiXml).toContain("<xmi:XMI");
    expect(xmiXml).toContain("uml:Model");

    // 3. Parsear el XMI con el importador CU11
    const { model: importedModel, stats } = parseXmi(xmiXml);

    // 4. Validar estadísticas
    expect(stats.classes).toBe(6);
    expect(stats.relations).toBe(5);
    expect(stats.ignoredElements).toBe(0);
    expect(stats.discardedRelations).toBe(0);

    // 5. Validar que las clases y sus miembros son equivalentes
    // Creamos mapas por className para comparar sin depender de los IDs generados
    const origClassMap = new Map(originalModel.classes.map((c) => [c.className, c]));
    const impClassMap = new Map(importedModel.classes.map((c) => [c.className, c]));

    expect(Array.from(impClassMap.keys()).sort()).toEqual(
      Array.from(origClassMap.keys()).sort()
    );

    for (const [className, origClass] of origClassMap.entries()) {
      const impClass = impClassMap.get(className);
      expect(impClass).toBeDefined();

      // Atributos
      expect(impClass!.attributes).toEqual(origClass.attributes);

      // Métodos
      expect(impClass!.methods).toEqual(origClass.methods);
    }

    // 6. Validar que las relaciones son equivalentes en tipo, dirección y multiplicidades
    // Mapa de ID a className para original y para importado
    const origIdToName = new Map(originalModel.classes.map((c) => [c.id, c.className]));
    const impIdToName = new Map(importedModel.classes.map((c) => [c.id, c.className]));

    interface NormalizedRelation {
      relationType: string;
      sourceName: string;
      targetName: string;
      multiplicitySource: string;
      multiplicityTarget: string;
    }

    const normMult = (m: string) => (m === "*" ? "0..*" : m);

    const normalizeRel = (
      rel: any,
      idToName: Map<string, string>
    ): NormalizedRelation => ({
      // En CU11, las relaciones N:M con * en ambos extremos se clasifican como manyToMany
      relationType:
        rel.relationType === "manyToMany" ||
        (rel.multiplicitySource?.includes("*") && rel.multiplicityTarget?.includes("*"))
          ? "manyToMany"
          : rel.relationType,
      sourceName: idToName.get(rel.sourceClassId) || "",
      targetName: idToName.get(rel.targetClassId) || "",
      multiplicitySource: normMult(rel.multiplicitySource),
      multiplicityTarget: normMult(rel.multiplicityTarget),
    });

    const origNormalized = originalModel.relations.map((r) =>
      normalizeRel(r, origIdToName)
    );
    const impNormalized = importedModel.relations.map((r) =>
      normalizeRel(r, impIdToName)
    );

    // Ordenar para comparar independientemente del orden de serialización
    const sortKey = (r: NormalizedRelation) =>
      `${r.relationType}_${r.sourceName}_${r.targetName}`;

    origNormalized.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    impNormalized.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

    expect(impNormalized).toEqual(origNormalized);
  });
});
