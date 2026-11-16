import type { CellObject, Comment } from "xlsx";
import type { FileMode } from "../types";

export interface SpreadsheetTransformOptions {
  mode: FileMode;
  /** Called with the fraction of work done, from 0 to 1. */
  onProgress?: (fraction: number) => void;
  /** Awaited after each sheet is transformed, e.g. to flush the vault. */
  afterSheet?: () => Promise<void>;
}

const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Share of the progress bar given to parsing and to writing the workbook. */
const READ_SHARE = 0.3;
const WRITE_SHARE = 0.2;

/** Joins the text cells of a row, like the columns of a TSV line. */
const CELL_SEPARATOR = "\t";

type TextCell = CellObject & { t: "s"; v: string };

function isTextCell(cell: CellObject | undefined): cell is TextCell {
  return cell?.t === "s" && typeof cell.v === "string";
}

function setText(cell: TextCell, value: string): void {
  if (value === cell.v) return;
  cell.v = value;
  // Cached renderings of the old value: formatted, rich text and HTML.
  delete cell.w;
  delete cell.r;
  delete cell.h;
}

/**
 * Transforms the text cells of a row in one go, so the detectors see them in
 * context: "Pilar" next to "García López" is a first name and its surnames.
 * Falls back to one cell at a time when a cell holds a tab or a replacement
 * would span two cells.
 */
function transformRowTexts(
  row: readonly (CellObject | undefined)[],
  transform: (text: string) => string,
): void {
  const cells = row.filter(isTextCell);
  const values = cells.map((cell) => cell.v);
  let results: string[] | undefined;
  if (
    cells.length > 1 &&
    !values.some((value) => value.includes(CELL_SEPARATOR))
  ) {
    const parts = transform(values.join(CELL_SEPARATOR)).split(CELL_SEPARATOR);
    if (parts.length === cells.length) results = parts;
  }
  results ??= values.map(transform);
  cells.forEach((cell, index) => setText(cell, results[index]));
}

/** Everything but the cell's text value, which goes by row. */
function transformCell(
  cell: CellObject,
  transform: (text: string) => string,
): void {
  if (cell.t === "n") {
    // Phone numbers are often stored as numbers. Check the cell as the user
    // sees it; if it holds a value to replace, the cell becomes text.
    const shown = cell.w ?? String(cell.v);
    const value = transform(shown);
    if (value !== shown) {
      cell.t = "s";
      cell.v = value;
      delete cell.w;
      delete cell.z;
    }
  }

  if (cell.f !== undefined) cell.f = transform(cell.f);

  if (cell.l !== undefined) {
    cell.l.Target = transform(cell.l.Target);
    if (cell.l.Tooltip !== undefined)
      cell.l.Tooltip = transform(cell.l.Tooltip);
  }

  if (cell.c !== undefined) {
    // Parsed comments also carry HTML and rich-text copies of their text,
    // which the type definitions do not declare.
    for (const comment of cell.c as (Comment & { h?: string; r?: string })[]) {
      comment.t = transform(comment.t);
      delete comment.h;
      delete comment.r;
    }
  }
}

/**
 * Applies `transform` to every text in a workbook (cell values, numbers as
 * displayed, formulas, hyperlinks and comments) and returns it as `.xlsx`.
 *
 * When sanitizing, document properties such as author and company are
 * dropped: they identify people and no pattern would catch them.
 *
 * Limits of the SheetJS Community Edition used here: the workbook is parsed
 * in memory as a whole, and the rewritten file keeps values, formulas and
 * sheets but not styling, charts, images or macros.
 */
export async function transformSpreadsheet(
  file: Blob,
  transform: (text: string) => string,
  options: SpreadsheetTransformOptions,
): Promise<Blob> {
  // Loaded on demand: SheetJS is by far the heaviest dependency.
  const XLSX = await import("xlsx");

  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    dense: true,
    cellHTML: false,
  });
  options.onProgress?.(READ_SHARE);

  const sheetCount = workbook.SheetNames.length;
  for (let index = 0; index < sheetCount; index++) {
    const rows = workbook.Sheets[workbook.SheetNames[index]]["!data"] ?? [];
    for (const row of rows) {
      if (row === undefined) continue;
      transformRowTexts(row, transform);
      for (const cell of row) {
        if (cell !== undefined) transformCell(cell, transform);
      }
    }
    await options.afterSheet?.();
    options.onProgress?.(
      READ_SHARE + ((1 - READ_SHARE - WRITE_SHARE) * (index + 1)) / sheetCount,
    );
  }

  if (options.mode === "sanitize") {
    delete workbook.Props;
    delete workbook.Custprops;
  }

  const data: ArrayBuffer = XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
    compression: true,
  });
  options.onProgress?.(1);
  return new Blob([data], { type: XLSX_MIME_TYPE });
}
