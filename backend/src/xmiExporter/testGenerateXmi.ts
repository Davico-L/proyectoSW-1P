import fs from "fs";
import path from "path";
import { generateXmiDocument } from "./generateXmi";
import { UmlModel } from "../backendGenerator/types";

// 2 & 3. Objeto UmlModel compatible exactamente con la interfaz real de backend/src/backendGenerator/types.ts
const model: UmlModel = {
  classes: [
    {
      id: "persona_1",
      className: "Persona",
      attributes: [
        { name: "id", type: "Integer", visibility: "private" },
        { name: "nombre", type: "String", visibility: "public" },
        { name: "saldo", type: "Double", visibility: "protected" },
        { name: "codigoLargo", type: "Long", visibility: "private" },
        { name: "fechaNacimiento", type: "Date", visibility: "private" }
      ],
      methods: [
        { name: "getNombre", returnType: "String", visibility: "public" },
        { name: "getCodigoLargo", returnType: "Long", visibility: "public" },
        { name: "reiniciar", returnType: "void", visibility: "public" }
      ]
    }
  ],
  relations: []
};

// 4. Ejecución del generador XMI
const xmi = generateXmiDocument(model);

// 5. Mostrar el XMI completo por consola
console.log(xmi);

// 6. Guardar el resultado en backend/test-output.xmi
const outputPath = path.resolve(__dirname, "../../test-output.xmi");
fs.writeFileSync(outputPath, xmi, "utf-8");
console.log(`\n[testGenerateXmi] Archivo guardado en: ${outputPath}`);
