import fs from "fs";
import path from "path";
import archiver from "archiver";
import { UmlModel } from "../backendGenerator/types";
import { convertUmlModelToSchema } from "./converter";

export const LEEME_TEXTO = `======================================================================
INSTRUCCIONES DE USO - APLICACIÓN MÓVIL GENERADA (ClassDrawSW)
======================================================================

1. REQUISITOS PREVIOS
----------------------------------------------------------------------
- Flutter SDK (versión 3.x o superior) instalado y en el PATH.
- Android SDK configurado con un dispositivo físico o emulador Android.

2. INSTALACIÓN Y EJECUCIÓN
----------------------------------------------------------------------
Desde la carpeta raíz del proyecto extraído, ejecuta en terminal:

   flutter pub get
   flutter run --release

3. MODELO DE INTELIGENCIA ARTIFICIAL LOCAL (GGUF)
----------------------------------------------------------------------
El modelo de IA local NO viene incluido dentro de este archivo ZIP
debido a su tamaño (~1 GB). Debe copiarse por separado al dispositivo:

- Nombre exacto del archivo:
  qwen2.5-1.5b-instruct-q4_k_m.gguf

- Ruta exacta en el almacenamiento del dispositivo Android:
  /sdcard/Android/data/com.example.mobile_template/files/models/qwen2.5-1.5b-instruct-q4_k_m.gguf

- Comando para transferirlo mediante ADB:
  adb shell mkdir -p /sdcard/Android/data/com.example.mobile_template/files/models
  adb push qwen2.5-1.5b-instruct-q4_k_m.gguf /sdcard/Android/data/com.example.mobile_template/files/models/

4. CONFIGURACIÓN DEL SERVIDOR Y SINCRONIZACIÓN
----------------------------------------------------------------------
Para sincronizar los datos registrados en la app móvil con el backend
Spring Boot generado:

a) Habilitar el puerto 8081 en el Firewall del host (PC):
   Asegúrate de permitir el tráfico entrante TCP en el puerto 8081
   en el Firewall del sistema operativo para que el dispositivo móvil
   pueda comunicarse con el backend a través de la red local (Wi-Fi).

b) Configurar la URL del servidor en la app móvil:
   En la pantalla principal de la app, pulsa el botón "Sincronizar"
   (o el icono de enlace/URL) y escribe la URL base de tu servidor backend,
   por ejemplo: http://192.168.1.10:8081
======================================================================
`;

/**
 * Localiza la carpeta raíz de mobile-template de forma robusta.
 */
export function getMobileTemplateDir(): string {
  const candidates = [
    path.resolve(__dirname, "../../../mobile-template"),
    path.resolve(process.cwd(), "mobile-template"),
    path.resolve(process.cwd(), "../mobile-template"),
  ];

  for (const candidate of candidates) {
    if (
      fs.existsSync(candidate) &&
      fs.existsSync(path.join(candidate, "pubspec.yaml"))
    ) {
      return candidate;
    }
  }

  return candidates[0];
}

/**
 * Determina si un directorio debe excluirse del empaquetado ZIP.
 */
export function shouldExcludeDir(dirName: string, relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, "/");

  // Carpetas excluidas por regla explícita
  if (
    dirName === "build" ||
    dirName === ".dart_tool" ||
    dirName === ".gradle" ||
    dirName === ".idea" ||
    dirName === "node_modules" ||
    dirName === ".git"
  ) {
    return true;
  }

  // Rutas compuestas como android/build o android/.gradle
  if (
    normalized === "android/build" ||
    normalized.startsWith("android/build/") ||
    normalized.includes("/.gradle") ||
    normalized.endsWith("/build")
  ) {
    return true;
  }

  return false;
}

/**
 * Determina si un archivo debe excluirse del empaquetado ZIP.
 */
export function shouldExcludeFile(fileName: string, relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, "/");

  // Excluir cualquier archivo .gguf
  if (fileName.toLowerCase().endsWith(".gguf")) {
    return true;
  }

  // Excluir assets/esquema.json y LEEME.txt para reemplazarlos limpiamente
  if (normalized === "assets/esquema.json" || normalized === "LEEME.txt") {
    return true;
  }

  return false;
}

/**
 * Empaqueta mobile-template en un archivo ZIP con archiver, reemplazando
 * assets/esquema.json con el esquema generado a partir del UmlModel
 * e incorporando LEEME.txt en la raíz del ZIP.
 */
export function buildMobileZip(model: UmlModel): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // 1. Validación de clases válidas en el modelo
    if (!model || !model.classes || !Array.isArray(model.classes)) {
      return reject(
        new Error(
          "El diagrama debe tener al menos una clase válida para generar la app móvil"
        )
      );
    }

    const validClasses = model.classes.filter(
      (c) => c && typeof c.className === "string" && c.className.trim() !== ""
    );

    if (validClasses.length === 0) {
      return reject(
        new Error(
          "El diagrama debe tener al menos una clase válida para generar la app móvil"
        )
      );
    }

    const templateDir = getMobileTemplateDir();
    if (!fs.existsSync(templateDir)) {
      return reject(
        new Error(
          `No se encontró el directorio de plantilla móvil en: ${templateDir}`
        )
      );
    }

    // 2. Generar el esquema móvil desde el modelo UML
    const schemaObj = convertUmlModelToSchema(model);
    const schemaJson = JSON.stringify(schemaObj, null, 2);

    // 3. Crear el archivo ZIP con compresión level 9
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    archive.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    archive.on("error", (err) => {
      reject(err);
    });

    // Función recursiva para recorrer la plantilla móvil y agregar archivos
    function addDirToArchive(currentDir: string, currentRelPath: string) {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = currentRelPath
          ? `${currentRelPath}/${entry.name}`
          : entry.name;
        const normalizedRelPath = relPath.replace(/\\/g, "/");

        if (entry.isDirectory()) {
          if (shouldExcludeDir(entry.name, normalizedRelPath)) {
            continue;
          }
          addDirToArchive(fullPath, relPath);
        } else if (entry.isFile()) {
          if (shouldExcludeFile(entry.name, normalizedRelPath)) {
            continue;
          }
          archive.file(fullPath, { name: normalizedRelPath });
        }
      }
    }

    // Agregar archivos base de mobile-template respetando exclusiones
    addDirToArchive(templateDir, "");

    // Inyectar assets/esquema.json generado
    archive.append(schemaJson, { name: "assets/esquema.json" });

    // Inyectar LEEME.txt en la raíz
    archive.append(LEEME_TEXTO, { name: "LEEME.txt" });

    // Finalizar compresión
    archive.finalize();
  });
}
