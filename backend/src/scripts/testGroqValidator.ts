import dotenv from "dotenv";
import { getDiagramById } from "../services/diagramService";
import { extractUmlModel } from "../backendGenerator/extractModel";
import { editDiagramByInstructionGroq } from "../services/groq";
import { validateAndResolveOperations } from "../services/operationValidator";
import { pool } from "../db";
import { UmlClass } from "../backendGenerator/types";

dotenv.config();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGroqWithTpmHandling(model: any, instruction: string) {
  while (true) {
    try {
      return await editDiagramByInstructionGroq(model, instruction);
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("429") || msg.includes("Rate limit")) {
        console.log("   [Groq 429 TPM alcanzado en tier gratuito. Esperando 16s para liberar cuota de tokens...]");
        await sleep(16000);
        continue;
      }
      throw err;
    }
  }
}

interface TestCaseResult {
  caseId: string;
  description: string;
  instruction: string;
  groqOperations: any[];
  validOperations: any[];
  warnings: string[];
  passed: boolean;
  notes?: string;
}

async function main() {
  let diagramId = process.argv[2] || process.env.DIAGRAM_ID;

  try {
    if (!diagramId) {
      const res = await pool.query(
        "SELECT id, name FROM diagrams ORDER BY updated_at DESC LIMIT 10"
      );
      if (res.rows.length === 0) {
        console.error("Error: No se encontraron diagramas en la base de datos.");
        process.exit(1);
      }
      for (const row of res.rows) {
        const d = await getDiagramById(row.id);
        const m = extractUmlModel(d?.data);
        if (m.classes.length > 0) {
          diagramId = row.id;
          break;
        }
      }
      if (!diagramId) {
        diagramId = res.rows[0].id;
      }
      console.log(`Usando diagrama recuperado de la base de datos: ${diagramId}`);
    }

    if (!diagramId) {
      console.error("Error: No se encontró ningún diagramId válido.");
      process.exit(1);
      return;
    }

    console.log(`Recuperando diagrama con ID: ${diagramId}...`);
    const diagram = await getDiagramById(diagramId);

    if (!diagram) {
      console.error(`Error: No se encontró ningún diagrama con el id "${diagramId}".`);
      process.exit(1);
    }

    console.log(`Diagrama encontrado: "${diagram.name}"`);

    const { classes, relations } = extractUmlModel(diagram.data);

    // Mapeo id -> className y relaciones con nombres siguiendo la lógica de diagramRoutes.ts
    const classMap = new Map<string, string>();
    for (const c of classes) {
      classMap.set(c.id, c.className);
    }

    const relationsWithNames: any[] = [];
    for (const rel of relations) {
      const sourceClassName = classMap.get(rel.sourceClassId);
      const targetClassName = classMap.get(rel.targetClassId);
      if (sourceClassName && targetClassName) {
        relationsWithNames.push({
          relationType: rel.relationType,
          sourceClassName,
          targetClassName,
          multiplicitySource: rel.multiplicitySource,
          multiplicityTarget: rel.multiplicityTarget,
        });
      }
    }

    const currentModel = {
      classes,
      relations: relationsWithNames,
    };

    console.log("\n=== Modelo UML Inicial ===");
    console.log(
      `Clases (${classes.length}):`,
      classes.map((c) => c.className).join(", ") || "(ninguna)"
    );
    console.log(`Relaciones (${relationsWithNames.length}):`);
    for (const r of relationsWithNames) {
      console.log(
        `  - ${r.sourceClassName} -> ${r.targetClassName} (${r.relationType || "association"})`
      );
    }

    const targetClass = classes.length > 0 ? classes[0].className : "Casa";
    const classForRel1 = targetClass;
    const classForRel2 = classes.length > 1 ? classes[1].className : "Factura";
    const validationClassesForRel: UmlClass[] = [...classes];

    if (classes.length < 2) {
      validationClassesForRel.push({
        id: "mock-class-factura-id",
        className: "Factura",
        attributes: [],
        methods: [],
      });
    }

    const testResults: TestCaseResult[] = [];

    // --- Caso a: createClass simple ---
    console.log("\n------------------------------------------------------------");
    console.log("Caso a: createClass simple");
    const instructionA = "agregá una clase Factura con numero Integer y total Double";
    console.log(`Instrucción: "${instructionA}"`);
    const resA = await callGroqWithTpmHandling(currentModel, instructionA);
    console.log("Operaciones devueltas por Groq (normalizadas):", JSON.stringify(resA.operations, null, 2));
    const valA = validateAndResolveOperations(resA.operations, classes);
    console.log("Resultado de validateAndResolveOperations:", JSON.stringify(valA, null, 2));
    const passedA =
      valA.validOperations.length === 1 &&
      valA.validOperations[0].action === "createClass" &&
      valA.validOperations[0].className === "Factura" &&
      valA.warnings.length === 0;
    testResults.push({
      caseId: "a",
      description: "createClass simple",
      instruction: instructionA,
      groqOperations: resA.operations,
      validOperations: valA.validOperations,
      warnings: valA.warnings,
      passed: passedA,
    });

    await sleep(1000);

    // --- Caso b: updateClass que SOLO cambie un campo (renombrar) ---
    console.log("\n------------------------------------------------------------");
    console.log("Caso b: updateClass que SOLO cambie un campo (renombrar)");
    const newName = `${targetClass}Vivienda`;
    const instructionB = `renombrá la clase ${targetClass} a ${newName}`;
    console.log(`Instrucción: "${instructionB}"`);
    const resB = await callGroqWithTpmHandling(currentModel, instructionB);
    console.log("Operaciones devueltas por Groq (normalizadas):", JSON.stringify(resB.operations, null, 2));
    const valB = validateAndResolveOperations(resB.operations, classes);
    console.log("Resultado de validateAndResolveOperations:", JSON.stringify(valB, null, 2));
    const passedB =
      valB.validOperations.length === 1 &&
      valB.validOperations[0].action === "updateClass" &&
      valB.validOperations[0].className === targetClass &&
      valB.validOperations[0].newClassName === newName &&
      valB.validOperations[0].classId !== undefined &&
      valB.validOperations[0].attributes === undefined &&
      valB.validOperations[0].methods === undefined &&
      valB.warnings.length === 0;
    testResults.push({
      caseId: "b",
      description: "updateClass solo rename (newClassName presente, attributes/methods ausentes)",
      instruction: instructionB,
      groqOperations: resB.operations,
      validOperations: valB.validOperations,
      warnings: valB.warnings,
      passed: passedB,
    });

    await sleep(1000);

    // --- Caso c: updateClass que agregue atributos sin renombrar ---
    console.log("\n------------------------------------------------------------");
    console.log("Caso c: updateClass agregar atributos sin renombrar");
    const instructionC = `agregale el atributo direccion de tipo String a la clase ${targetClass}`;
    console.log(`Instrucción: "${instructionC}"`);
    const resC = await callGroqWithTpmHandling(currentModel, instructionC);
    console.log("Operaciones devueltas por Groq (normalizadas):", JSON.stringify(resC.operations, null, 2));
    const valC = validateAndResolveOperations(resC.operations, classes);
    console.log("Resultado de validateAndResolveOperations:", JSON.stringify(valC, null, 2));
    const passedC =
      valC.validOperations.length === 1 &&
      valC.validOperations[0].action === "updateClass" &&
      valC.validOperations[0].className === targetClass &&
      valC.validOperations[0].newClassName === undefined &&
      Array.isArray(valC.validOperations[0].attributes) &&
      valC.validOperations[0].classId !== undefined &&
      valC.warnings.length === 0;
    testResults.push({
      caseId: "c",
      description: "updateClass agregar atributo (attributes presente, newClassName ausente)",
      instruction: instructionC,
      groqOperations: resC.operations,
      validOperations: valC.validOperations,
      warnings: valC.warnings,
      passed: passedC,
    });

    await sleep(1000);

    // --- Caso d: createRelation entre dos clases reales ---
    console.log("\n------------------------------------------------------------");
    console.log("Caso d: createRelation entre dos clases reales");
    const modelForD =
      classes.length < 2
        ? {
            classes: validationClassesForRel,
            relations: currentModel.relations,
          }
        : currentModel;

    const instructionD = `creá una relación de asociación entre ${classForRel1} y ${classForRel2}`;
    console.log(`Instrucción: "${instructionD}"`);
    const resD = await callGroqWithTpmHandling(modelForD, instructionD);
    console.log("Operaciones devueltas por Groq (normalizadas):", JSON.stringify(resD.operations, null, 2));
    const valD = validateAndResolveOperations(resD.operations, validationClassesForRel);
    console.log("Resultado de validateAndResolveOperations:", JSON.stringify(valD, null, 2));
    const passedD =
      valD.validOperations.length === 1 &&
      valD.validOperations[0].action === "createRelation" &&
      valD.validOperations[0].sourceClassId !== undefined &&
      valD.validOperations[0].targetClassId !== undefined &&
      valD.warnings.length === 0;
    testResults.push({
      caseId: "d",
      description: "createRelation entre dos clases (IDs resueltos correctamente)",
      instruction: instructionD,
      groqOperations: resD.operations,
      validOperations: valD.validOperations,
      warnings: valD.warnings,
      passed: passedD,
    });

    await sleep(1000);

    // --- Caso e: instrucción que referencie una clase inexistente ---
    console.log("\n------------------------------------------------------------");
    console.log("Caso e: referencia a clase inexistente (verificación de warnings)");
    const instructionE = "eliminá la clase NoExiste";
    console.log(`Instrucción: "${instructionE}"`);
    const resE = await callGroqWithTpmHandling(currentModel, instructionE);
    console.log("Operaciones devueltas por Groq (normalizadas):", JSON.stringify(resE.operations, null, 2));
    const valE = validateAndResolveOperations(resE.operations, classes);
    console.log("Resultado de validateAndResolveOperations:", JSON.stringify(valE, null, 2));
    const warningFound = valE.warnings.some((w) =>
      w.toLowerCase().includes("no encontré la clase 'noexiste'")
    );
    const passedE = valE.validOperations.length === 0 && warningFound;
    testResults.push({
      caseId: "e",
      description: "clase inexistente genera warning y 0 validOperations",
      instruction: instructionE,
      groqOperations: resE.operations,
      validOperations: valE.validOperations,
      warnings: valE.warnings,
      passed: passedE,
      notes: warningFound ? "Warning detectado correctamente" : "Falta warning esperado",
    });

    await sleep(1000);

    // --- Caso f: instrucción sin relación con el diagrama ---
    console.log("\n------------------------------------------------------------");
    console.log("Caso f: instrucción no relacionada con el diagrama");
    const instructionF = "hola, ¿cómo estás?";
    console.log(`Instrucción: "${instructionF}"`);
    const resF = await callGroqWithTpmHandling(currentModel, instructionF);
    console.log("Operaciones devueltas por Groq (normalizadas):", JSON.stringify(resF.operations, null, 2));
    const passedF = Array.isArray(resF.operations) && resF.operations.length === 0;
    testResults.push({
      caseId: "f",
      description: "instrucción no relacionada devuelve operations: [] sin validar",
      instruction: instructionF,
      groqOperations: resF.operations,
      validOperations: [],
      warnings: [],
      passed: passedF,
      notes: passedF ? "Array operations vacío verificado" : "Groq no devolvió array vacío",
    });

    // --- Resumen final ---
    console.log("\n============================================================");
    console.log("                     RESUMEN FINAL");
    console.log("============================================================");
    const passedCount = testResults.filter((t) => t.passed).length;
    console.log(`Casos superados: ${passedCount} / ${testResults.length}\n`);

    for (const t of testResults) {
      console.log(`[Caso ${t.caseId}] ${t.passed ? "✓ PASÓ" : "✗ FALLÓ"}: ${t.description}`);
      console.log(`  Instrucción: "${t.instruction}"`);
      console.log(`  Groq Operations: ${JSON.stringify(t.groqOperations)}`);
      console.log(`  validOperations: ${JSON.stringify(t.validOperations)}`);
      console.log(`  warnings: ${JSON.stringify(t.warnings)}`);
      if (t.notes) console.log(`  Notas: ${t.notes}`);
      console.log("");
    }

    if (passedCount !== testResults.length) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error("Error inesperado durante la ejecución de las pruebas:", err?.message || err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
