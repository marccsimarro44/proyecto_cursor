import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { detectPii } from "../detectors/detect";
import { transformSpreadsheet } from "./spreadsheet";

/** Stand-in for the sanitizer: masks each detection with its type. */
function mask(text: string): string {
  let output = "";
  let cursor = 0;
  for (const detection of detectPii(text)) {
    output += `${text.slice(cursor, detection.start)}{${detection.type}}`;
    cursor = detection.end;
  }
  return output + text.slice(cursor);
}

function toBlob(workbook: XLSX.WorkBook): Blob {
  const data: ArrayBuffer = XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
  });
  return new Blob([data]);
}

async function readBack(blob: Blob): Promise<XLSX.WorkBook> {
  return XLSX.read(await blob.arrayBuffer(), { type: "array" });
}

function workbookOf(rows: unknown[][], sheetName = "Clientes"): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(rows),
    sheetName,
  );
  return workbook;
}

describe("transformSpreadsheet", () => {
  it("sanitizes text cells and leaves the rest as it was", async () => {
    const source = workbookOf([
      ["Nombre", "DNI", "Email", "Importe", "Alta"],
      ["Ana García", "12345678Z", "ana@example.com", 1250.5, true],
      ["Luis Peña", "sin DNI", "Escribir a luis@example.org", 80, false],
    ]);

    const output = await readBack(
      await transformSpreadsheet(toBlob(source), mask, { mode: "sanitize" }),
    );

    expect(
      XLSX.utils.sheet_to_json(output.Sheets.Clientes, { header: 1 }),
    ).toEqual([
      ["Nombre", "DNI", "Email", "Importe", "Alta"],
      ["Ana García", "{DNI}", "{EMAIL}", 1250.5, true],
      ["Luis Peña", "sin DNI", "Escribir a {EMAIL}", 80, false],
    ]);
  });

  it("sanitizes phone numbers that Excel stored as numbers", async () => {
    const source = workbookOf([
      ["Teléfono", "Unidades"],
      [612345678, 42],
    ]);

    const output = await readBack(
      await transformSpreadsheet(toBlob(source), mask, { mode: "sanitize" }),
    );
    const sheet = output.Sheets.Clientes;

    expect(sheet.A2).toMatchObject({ t: "s", v: "{PHONE}" });
    expect(sheet.B2).toMatchObject({ t: "n", v: 42 });
  });

  it("processes every sheet", async () => {
    const source = workbookOf([["12345678Z"]], "Uno");
    XLSX.utils.book_append_sheet(
      source,
      XLSX.utils.aoa_to_sheet([["ana@example.com"]]),
      "Dos",
    );

    const output = await readBack(
      await transformSpreadsheet(toBlob(source), mask, { mode: "sanitize" }),
    );

    expect(output.SheetNames).toEqual(["Uno", "Dos"]);
    expect(output.Sheets.Uno.A1.v).toBe("{DNI}");
    expect(output.Sheets.Dos.A1.v).toBe("{EMAIL}");
  });

  it("sanitizes formulas, hyperlinks and comments", async () => {
    const source = workbookOf([["Contacto"], ["x"], ["y"]]);
    const sheet = source.Sheets.Clientes;
    sheet.A2 = {
      t: "s",
      v: "ana@example.com",
      f: 'HYPERLINK("mailto:ana@example.com","ana@example.com")',
    };
    sheet.A3 = {
      t: "s",
      v: "Ficha",
      l: { Target: "mailto:luis@example.org", Tooltip: "DNI 12345678Z" },
      c: [{ a: "Autor", t: "Llamar al 612345678" }],
    };

    const output = await readBack(
      await transformSpreadsheet(toBlob(source), mask, { mode: "sanitize" }),
    );
    const result = output.Sheets.Clientes;

    expect(result.A2.v).toBe("{EMAIL}");
    expect(result.A2.f).toBe('HYPERLINK("mailto:{EMAIL}","{EMAIL}")');
    expect(result.A3.l).toMatchObject({
      Target: "mailto:{EMAIL}",
      Tooltip: "DNI {DNI}",
    });
    expect(result.A3.c?.[0].t).toBe("Llamar al {PHONE}");
  });

  it("removes the author and other document properties when sanitizing", async () => {
    const source = workbookOf([["hola"]]);
    source.Props = {
      Author: "Ana García",
      LastAuthor: "Luis Peña",
      Company: "ACME",
    };
    const before = await readBack(toBlob(source));
    expect(before.Props?.Author).toBe("Ana García");

    const output = await readBack(
      await transformSpreadsheet(toBlob(source), mask, { mode: "sanitize" }),
    );

    expect(output.Props?.Author).not.toBe("Ana García");
    expect(output.Props?.LastAuthor).not.toBe("Luis Peña");
    expect(output.Props?.Company).not.toBe("ACME");
  });

  it("restores a sanitized workbook", async () => {
    const restore = (text: string) =>
      text
        .replace("[DNI_1]", "12345678Z")
        .replace("[EMAIL_1]", "a@example.com");
    const sanitized = workbookOf([
      ["DNI", "Email", "Importe"],
      ["[DNI_1]", "Escribir a [EMAIL_1]", 12],
    ]);

    const output = await readBack(
      await transformSpreadsheet(toBlob(sanitized), restore, {
        mode: "restore",
      }),
    );

    expect(
      XLSX.utils.sheet_to_json(output.Sheets.Clientes, { header: 1 }),
    ).toEqual([
      ["DNI", "Email", "Importe"],
      ["12345678Z", "Escribir a a@example.com", 12],
    ]);
  });

  it("reports progress up to completion", async () => {
    const progress: number[] = [];

    await transformSpreadsheet(toBlob(workbookOf([["hola"]])), mask, {
      mode: "sanitize",
      onProgress: (fraction) => progress.push(fraction),
    });

    expect(progress.at(-1)).toBe(1);
    expect([...progress].sort((a, b) => a - b)).toEqual(progress);
  });
});
