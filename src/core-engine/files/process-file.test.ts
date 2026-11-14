import { beforeEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { Sanitizer } from "../sanitizer";
import { generateVaultKey } from "../vault/crypto";
import { createMemoryStorage } from "../vault/storage";
import { Vault } from "../vault/vault";
import { processFile, UnsupportedFileError } from "./process-file";

const CSV = [
  "nombre;dni;email",
  "Ana;12345678Z;ana@example.com",
  "Luis;87654321X;",
  "Ana otra vez;12345678Z;",
  "",
].join("\n");

let sanitizer: Sanitizer;

beforeEach(async () => {
  const vault = await Vault.open({
    sessionId: "test",
    key: await generateVaultKey(),
    storage: createMemoryStorage(),
  });
  sanitizer = new Sanitizer(vault);
});

describe("processFile", () => {
  it("sanitizes a CSV and counts what it replaced", async () => {
    const result = await processFile(sanitizer, {
      file: new Blob([CSV]),
      fileName: "clientes.csv",
      mode: "sanitize",
    });

    expect(await result.blob.text()).toBe(
      [
        "nombre;dni;email",
        "Ana;[DNI_1];[EMAIL_1]",
        "Luis;[DNI_2];",
        "Ana otra vez;[DNI_1];",
        "",
      ].join("\n"),
    );
    expect(result).toMatchObject({
      fileName: "clientes.sanitized.csv",
      detections: { DNI: 3, EMAIL: 1 },
      restoredCount: 0,
      unresolvedTokens: [],
    });
  });

  it("restores a sanitized CSV to the exact original", async () => {
    const sanitized = await processFile(sanitizer, {
      file: new Blob([CSV]),
      fileName: "clientes.csv",
      mode: "sanitize",
    });

    const restored = await processFile(sanitizer, {
      file: sanitized.blob,
      fileName: sanitized.fileName,
      mode: "restore",
    });

    expect(await restored.blob.text()).toBe(CSV);
    expect(restored).toMatchObject({
      fileName: "clientes.restored.csv",
      detections: {},
      restoredCount: 4,
      unresolvedTokens: [],
    });
  });

  it("reports tokens it could not restore", async () => {
    const result = await processFile(sanitizer, {
      file: new Blob(["[DNI_5]\n[DNI_5] [EMAIL_2]\n"]),
      fileName: "respuesta.txt",
      mode: "restore",
    });

    expect(result.unresolvedTokens).toEqual(["[DNI_5]", "[EMAIL_2]"]);
    expect(result.restoredCount).toBe(0);
  });

  it("sanitizes a workbook and always returns .xlsx", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["DNI", "Teléfono"],
        ["12345678Z", 612345678],
      ]),
      "Hoja1",
    );
    const data: ArrayBuffer = XLSX.write(workbook, {
      type: "array",
      bookType: "xls",
    });

    const result = await processFile(sanitizer, {
      file: new Blob([data]),
      fileName: "Clientes 2025.XLS",
      mode: "sanitize",
    });

    const output = XLSX.read(await result.blob.arrayBuffer(), {
      type: "array",
    });
    expect(
      XLSX.utils.sheet_to_json(output.Sheets.Hoja1, { header: 1 }),
    ).toEqual([
      ["DNI", "Teléfono"],
      ["[DNI_1]", "[PHONE_1]"],
    ]);
    expect(result.fileName).toBe("Clientes 2025.sanitized.xlsx");
    expect(result.detections).toEqual({ DNI: 1, PHONE: 1 });
  });

  it("reports progress from 0 to 1 and runs the hook between chunks", async () => {
    const progress: number[] = [];
    let hookCalls = 0;

    await processFile(sanitizer, {
      file: new Blob([CSV]),
      fileName: "clientes.csv",
      mode: "sanitize",
      onProgress: (fraction) => progress.push(fraction),
      afterChunk: async () => {
        hookCalls++;
      },
    });

    expect(progress.at(-1)).toBe(1);
    expect(progress.every((fraction) => fraction >= 0 && fraction <= 1)).toBe(
      true,
    );
    expect(hookCalls).toBeGreaterThan(0);
  });

  it.each(["informe.pdf", "contrato.docx", "foto.png", "sin-extension", ""])(
    "rejects the unsupported file %j",
    async (fileName) => {
      await expect(
        processFile(sanitizer, {
          file: new Blob(["12345678Z"]),
          fileName,
          mode: "sanitize",
        }),
      ).rejects.toThrow(UnsupportedFileError);
    },
  );

  it.each([
    ["datos.CSV", "datos.sanitized.CSV"],
    ["export.2025.json", "export.2025.sanitized.json"],
    ["notas.txt", "notas.sanitized.txt"],
  ])("names the sanitized copy of %s as %s", async (fileName, expected) => {
    const result = await processFile(sanitizer, {
      file: new Blob(["hola"]),
      fileName,
      mode: "sanitize",
    });

    expect(result.fileName).toBe(expected);
  });
});
