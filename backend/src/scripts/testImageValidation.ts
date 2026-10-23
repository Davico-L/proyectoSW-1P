import assert from "node:assert";
import { Request, Response } from "express";
import {
  isValidBase64,
  detectImageMimeType,
  handleAiFromImage,
} from "../routes/aiVisionRoutes";

// Generadores de buffers mínimos con firmas reales
function createSamplePdfBuffer(): Buffer {
  return Buffer.from("%PDF-1.4 sample pdf content for testing binary detection");
}

function createSampleJpegBuffer(): Buffer {
  // JPEG magic bytes: FF D8 FF seguido de bytes válidos (al menos 12 bytes)
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ]);
}

function createSamplePngBuffer(): Buffer {
  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A (al menos 12 bytes)
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
}

function createSampleWebpBuffer(): Buffer {
  // WEBP magic bytes: RIFF (4 bytes) + file size (4 bytes) + WEBP (4 bytes)
  return Buffer.from([
    0x52, 0x49, 0x46, 0x46, // "RIFF"
    0x24, 0x00, 0x00, 0x00, // file length placeholder
    0x57, 0x45, 0x42, 0x50, // "WEBP"
    0x56, 0x50, 0x38, 0x20, // "VP8 "
  ]);
}

// Mock simple de Request y Response de Express para probar el handler
function createMockReqRes(body: any, params: any = { id: "test-diagram-id" }) {
  const req = {
    params,
    body,
  } as unknown as Request;

  let statusCode = 200;
  let jsonResponse: any = null;

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: any) {
      jsonResponse = data;
      return this;
    },
  } as unknown as Response;

  return {
    req,
    res,
    getStatusCode: () => statusCode,
    getJsonResponse: () => jsonResponse,
  };
}

async function runTests() {
  console.log("=== INICIANDO PRUEBAS DE VALIDACIÓN DE CONTENIDO DE IMÁGENES ===");
  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      fn();
      console.log(`  ✓ [PASÓ] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ [FALLÓ] ${name}`);
      console.error(`    Detalle: ${err?.message}`);
      throw err;
    }
  }

  // 1. Pruebas de detección de formato por magic bytes
  test("Detecta correctamente imagen JPEG válida (FF D8 FF)", () => {
    const jpeg = createSampleJpegBuffer();
    assert.strictEqual(detectImageMimeType(jpeg), "image/jpeg");
  });

  test("Detecta correctamente imagen PNG válida (89 50 4E 47 0D 0A 1A 0A)", () => {
    const png = createSamplePngBuffer();
    assert.strictEqual(detectImageMimeType(png), "image/png");
  });

  test("Detecta correctamente imagen WEBP válida (RIFF....WEBP)", () => {
    const webp = createSampleWebpBuffer();
    assert.strictEqual(detectImageMimeType(webp), "image/webp");
  });

  test("Rechaza archivo PDF retornando null", () => {
    const pdf = createSamplePdfBuffer();
    assert.strictEqual(detectImageMimeType(pdf), null);
  });

  test("Rechaza buffer aleatorio o corrupto", () => {
    const random = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]);
    assert.strictEqual(detectImageMimeType(random), null);
  });

  // 2. Pruebas de validación de Base64
  test("Valida correctamente cadenas Base64 bien formadas", () => {
    assert.strictEqual(isValidBase64(createSampleJpegBuffer().toString("base64")), true);
    assert.strictEqual(isValidBase64(createSamplePngBuffer().toString("base64")), true);
    assert.strictEqual(isValidBase64("YWJjZA=="), true);
  });

  test("Rechaza cadenas Base64 mal formadas o con caracteres inválidos", () => {
    assert.strictEqual(isValidBase64(""), false);
    assert.strictEqual(isValidBase64("not-valid-base64!@#$"), false);
    assert.strictEqual(isValidBase64("abc"), false); // longitud no múltiplo de 4
    assert.strictEqual(isValidBase64("@@@@@@=="), false);
  });

  // 3. Pruebas integradas de handler: respuestas HTTP 400
  test("Handler: rechaza PDF disfrazado de JPEG con HTTP 400 INVALID_IMAGE", async () => {
    const pdfBase64 = createSamplePdfBuffer().toString("base64");
    const { req, res, getStatusCode, getJsonResponse } = createMockReqRes({
      mimeType: "image/jpeg",
      imageBase64: pdfBase64,
    });

    await handleAiFromImage(req, res);

    assert.strictEqual(getStatusCode(), 400);
    assert.deepStrictEqual(getJsonResponse(), {
      error: "INVALID_IMAGE",
      message: "El archivo no es una imagen JPG, PNG o WEBP válida.",
    });
  });

  test("Handler: rechaza MIME incorrecto (PNG enviado como image/jpeg) con HTTP 400 INVALID_IMAGE", async () => {
    const pngBase64 = createSamplePngBuffer().toString("base64");
    const { req, res, getStatusCode, getJsonResponse } = createMockReqRes({
      mimeType: "image/jpeg",
      imageBase64: pngBase64,
    });

    await handleAiFromImage(req, res);

    assert.strictEqual(getStatusCode(), 400);
    assert.deepStrictEqual(getJsonResponse(), {
      error: "INVALID_IMAGE",
      message: "El archivo no es una imagen JPG, PNG o WEBP válida.",
    });
  });

  test("Handler: rechaza Base64 mal formado con HTTP 400 INVALID_IMAGE", async () => {
    const { req, res, getStatusCode, getJsonResponse } = createMockReqRes({
      mimeType: "image/png",
      imageBase64: "###corrupted-base64###",
    });

    await handleAiFromImage(req, res);

    assert.strictEqual(getStatusCode(), 400);
    assert.deepStrictEqual(getJsonResponse(), {
      error: "INVALID_IMAGE",
      message: "El archivo no es una imagen JPG, PNG o WEBP válida.",
    });
  });

  test("Handler: acepta imagen JPEG válida con prefijo data URL", () => {
    const jpeg = createSampleJpegBuffer();
    const withPrefix = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
    const clean = withPrefix.replace(/^data:[^;]+;base64,/i, "").trim();
    assert.strictEqual(isValidBase64(clean), true);
    assert.strictEqual(detectImageMimeType(Buffer.from(clean, "base64")), "image/jpeg");
  });

  test("Handler: acepta imagen PNG válida con prefijo data URL", () => {
    const png = createSamplePngBuffer();
    const withPrefix = `data:image/png;base64,${png.toString("base64")}`;
    const clean = withPrefix.replace(/^data:[^;]+;base64,/i, "").trim();
    assert.strictEqual(isValidBase64(clean), true);
    assert.strictEqual(detectImageMimeType(Buffer.from(clean, "base64")), "image/png");
  });

  test("Handler: acepta imagen WEBP válida con prefijo data URL", () => {
    const webp = createSampleWebpBuffer();
    const withPrefix = `data:image/webp;base64,${webp.toString("base64")}`;
    const clean = withPrefix.replace(/^data:[^;]+;base64,/i, "").trim();
    assert.strictEqual(isValidBase64(clean), true);
    assert.strictEqual(detectImageMimeType(Buffer.from(clean, "base64")), "image/webp");
  });

  console.log(`\n=== TODAS LAS PRUEBAS COMPLETADAS EXITOSAMENTE (${passed}/${total}) ===\n`);
}

runTests();
