import fs from "fs";
import path from "path";
import { generateXmiDocument } from "./generateXmi";
import { UmlModel } from "../backendGenerator/types";

// Construcción del UmlModel con las 6 clases requeridas
const model: UmlModel = {
  classes: [
    {
      id: "persona",
      className: "Persona",
      attributes: [{ name: "id", type: "Integer", visibility: "private" }],
      methods: []
    },
    {
      id: "estudiante",
      className: "Estudiante",
      attributes: [{ name: "matricula", type: "String", visibility: "private" }],
      methods: []
    },
    {
      id: "colegio",
      className: "Colegio",
      attributes: [{ name: "nombre", type: "String", visibility: "public" }],
      methods: []
    },
    {
      id: "aula",
      className: "Aula",
      attributes: [{ name: "numero", type: "Integer", visibility: "public" }],
      methods: []
    },
    {
      id: "profesor",
      className: "Profesor",
      attributes: [{ name: "legajo", type: "String", visibility: "private" }],
      methods: []
    },
    {
      id: "materia",
      className: "Materia",
      attributes: [{ name: "nombre", type: "String", visibility: "public" }],
      methods: []
    }
  ],
  relations: [
    // A) HERENCIA: Estudiante -> Persona
    {
      relationType: "inheritance",
      sourceClassId: "estudiante",
      targetClassId: "persona",
      multiplicitySource: "1",
      multiplicityTarget: "1"
    },
    // B) ASOCIACIÓN: Profesor -> Materia
    {
      relationType: "association",
      sourceClassId: "profesor",
      targetClassId: "materia",
      multiplicitySource: "1",
      multiplicityTarget: "0..*"
    },
    // C) COMPOSICIÓN: Colegio -> Aula
    {
      relationType: "composition",
      sourceClassId: "colegio",
      targetClassId: "aula",
      multiplicitySource: "1",
      multiplicityTarget: "1..*"
    },
    // D) AGREGACIÓN: Profesor -> Aula
    {
      relationType: "aggregation",
      sourceClassId: "profesor",
      targetClassId: "aula",
      multiplicitySource: "0..1",
      multiplicityTarget: "*"
    },
    // E) MUCHOS A MUCHOS: Estudiante -> Materia (relationType="association" intencional)
    {
      relationType: "association",
      sourceClassId: "estudiante",
      targetClassId: "materia",
      multiplicitySource: "0..*",
      multiplicityTarget: "1..*"
    },
    // F) RELACIÓN COLGANTE: targetClassId inexistente
    {
      relationType: "association",
      sourceClassId: "profesor",
      targetClassId: "clase_inexistente",
      multiplicitySource: "1",
      multiplicityTarget: "1"
    }
  ]
};

// Generar el documento XMI 2.1
const xmi = generateXmiDocument(model);

// Guardar en backend/test-relations-output.xmi
const outputPath = path.resolve(__dirname, "../../test-relations-output.xmi");
fs.writeFileSync(outputPath, xmi, "utf-8");

console.log(`[testRelationsXmi] Documento XMI guardado exitosamente en: ${outputPath}`);

// Verificación de relación colgante
const containsDangling = xmi.includes("clase_inexistente");
console.log(`[testRelationsXmi] Contiene relación colgante: ${containsDangling} (debe ser false)`);
