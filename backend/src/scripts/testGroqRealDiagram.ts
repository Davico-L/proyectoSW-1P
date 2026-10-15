import dotenv from "dotenv";
import { getDiagramById } from "../services/diagramService";
import { extractUmlModel } from "../backendGenerator/extractModel";
import { editDiagramByInstructionGroq } from "../services/groq";
import { pool } from "../db";

dotenv.config();

async function main() {
  const diagramId = process.argv[2] || process.env.DIAGRAM_ID;

  if (!diagramId) {
    console.error("Error: Se requiere un diagramId como argumento de línea de comandos o mediante la variable de entorno DIAGRAM_ID.");
    console.error("Uso:");
    console.error("  npx tsx src/scripts/testGroqRealDiagram.ts <diagramId>");
    console.error("  o");
    console.error("  $env:DIAGRAM_ID='<diagramId>'; npx tsx src/scripts/testGroqRealDiagram.ts");
    process.exit(1);
  }

  try {
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

    console.log("\n=== Resumen del Modelo UML ===");
    console.log(
      `Clases (${classes.length}):`,
      classes.map((c) => c.className).join(", ") || "(ninguna)"
    );
    console.log(`Relaciones (${relationsWithNames.length}):`);
    for (const r of relationsWithNames) {
      console.log(
        `  - ${r.sourceClassName} -> ${r.targetClassName} (${r.relationType || "association"}) [${r.multiplicitySource || "1"}..${r.multiplicityTarget || "1"}]`
      );
    }

    // Si el modelo no contiene clases, detener sin consumir tokens
    if (!classes || classes.length === 0) {
      console.error("\nError: El modelo no contiene clases. Se detiene la prueba sin consumir tokens de Groq.");
      process.exit(1);
    }

    const targetClassName = classes[0].className;
    const instruction = `Agrega a la clase ${targetClassName} un atributo observaciones de tipo String privado.`;

    console.log(`\nClase objetivo seleccionada: "${targetClassName}"`);
    console.log(`Instrucción de prueba enviada a Groq:\n"${instruction}"\n`);

    console.log("Consultando Groq (openai/gpt-oss-20b)...");
    const result = await editDiagramByInstructionGroq(currentModel, instruction);

    console.log("\n=== Respuesta devuelta por Groq ===");
    console.log(JSON.stringify(result, null, 2));

    // Verificaciones
    console.log("\n=== Ejecutando Verificaciones ===");

    if (!result || !Array.isArray(result.operations)) {
      console.error("Error de verificación: El resultado no contiene un array 'operations'.");
      process.exit(1);
    }

    if (result.operations.length !== 1) {
      console.error(
        `Error de verificación: Se esperaba exactamente 1 operación, pero se obtuvieron ${result.operations.length}.`
      );
      process.exit(1);
    }

    const op = result.operations[0];

    if (op.action !== "updateClass") {
      console.error(
        `Error de verificación: La acción recibida es '${op.action}', se esperaba 'updateClass'.`
      );
      process.exit(1);
    }

    if (op.className !== targetClassName) {
      console.error(
        `Error de verificación: className es '${op.className}', se esperaba '${targetClassName}'.`
      );
      process.exit(1);
    }

    const attributes = op.attributes;
    if (!Array.isArray(attributes)) {
      console.error(
        "Error de verificación: 'attributes' no es un array en la operación updateClass."
      );
      process.exit(1);
    }

    const hasObsAttr = attributes.some(
      (attr: any) =>
        attr.name === "observaciones" &&
        attr.type === "String" &&
        attr.visibility === "private"
    );

    if (!hasObsAttr) {
      console.error(
        "Error de verificación: No se encontró el atributo 'observaciones' con tipo 'String' y visibilidad 'private'."
      );
      console.error("Atributos recibidos:", JSON.stringify(attributes));
      process.exit(1);
    }
    console.log("✓ Operación updateClass válida sobre la clase correcta con el atributo solicitado.");

    // Comprobación de que los campos opcionales no permanezcan en null tras la normalización
    const nullKeys = Object.keys(op).filter((key) => op[key] === null);
    if (nullKeys.length > 0) {
      console.error(
        `Error de verificación: Se encontraron campos con valor null en la operación normalizada: ${nullKeys.join(", ")}`
      );
      process.exit(1);
    }
    console.log("✓ No existen campos con valor null en la operación normalizada.");

    console.log("\n¡Prueba de Fase 2 completada exitosamente!");
  } catch (err: any) {
    console.error("\nError durante la ejecución de la prueba:", err?.message || err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
