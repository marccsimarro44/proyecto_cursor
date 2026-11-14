import type { Sanitizer } from "../sanitizer";
import type { DetectionCounts, FileMode, FileResult } from "../types";
import { transformSpreadsheet } from "./spreadsheet";
import { transformTextFile } from "./text-file";

/** The file is of a type the engine cannot process. */
export class UnsupportedFileError extends Error {
  override name = "UnsupportedFileError";
}

export interface ProcessFileOptions {
  file: Blob;
  /** Original name; its extension decides how the file is read. */
  fileName: string;
  mode: FileMode;
  /** Called with the fraction of work done, from 0 to 1. */
  onProgress?: (fraction: number) => void;
  /** Awaited between chunks of work, e.g. to flush the vault. */
  afterChunk?: () => Promise<void>;
}

/** Read with SheetJS and written back as `.xlsx`. */
const SPREADSHEET_EXTENSIONS = new Set(["xlsx", "xls"]);

/**
 * Processed as plain text. Anything else is refused: treating a binary
 * format such as PDF or DOCX as text would corrupt it.
 */
const TEXT_EXTENSIONS = new Set([
  "csv",
  "tsv",
  "txt",
  "json",
  "jsonl",
  "ndjson",
  "md",
  "xml",
  "html",
  "sql",
  "log",
  "yaml",
  "yml",
]);

const SUFFIX: Record<FileMode, string> = {
  sanitize: "sanitized",
  restore: "restored",
};

/** `clientes.csv` -> `clientes.sanitized.csv`; restoring swaps the suffix. */
function outputName(base: string, extension: string, mode: FileMode): string {
  const stem =
    mode === "restore" && base.endsWith(`.${SUFFIX.sanitize}`)
      ? base.slice(0, -SUFFIX.sanitize.length - 1)
      : base;
  return `${stem}.${SUFFIX[mode]}.${extension}`;
}

/**
 * Sanitizes or restores one file with `sanitizer`.
 *
 * Text formats are streamed and keep their bytes outside the replaced
 * values; spreadsheets are rewritten as `.xlsx`. Throws
 * {@link UnsupportedFileError} for any other extension.
 */
export async function processFile(
  sanitizer: Sanitizer,
  options: ProcessFileOptions,
): Promise<FileResult> {
  const { file, fileName, mode, onProgress, afterChunk } = options;

  const dot = fileName.lastIndexOf(".");
  const base = dot === -1 ? fileName : fileName.slice(0, dot);
  const extension = dot === -1 ? "" : fileName.slice(dot + 1);
  const kind = extension.toLowerCase();

  const detections: DetectionCounts = {};
  let restoredCount = 0;
  const unresolved = new Set<string>();

  const transform = (text: string): string => {
    if (mode === "sanitize") {
      const result = sanitizer.sanitize(text);
      for (const { type } of result.detections) {
        detections[type] = (detections[type] ?? 0) + 1;
      }
      return result.sanitizedText;
    }
    const result = sanitizer.restore(text);
    restoredCount += result.restoredCount;
    for (const token of result.unresolvedTokens) unresolved.add(token);
    return result.restoredText;
  };

  let blob: Blob;
  let outputExtension = extension;
  if (SPREADSHEET_EXTENSIONS.has(kind)) {
    blob = await transformSpreadsheet(file, transform, {
      mode,
      onProgress,
      afterSheet: afterChunk,
    });
    outputExtension = "xlsx";
  } else if (TEXT_EXTENSIONS.has(kind)) {
    blob = await transformTextFile(file, transform, {
      mode,
      onProgress: (bytes) =>
        onProgress?.(file.size === 0 ? 1 : bytes / file.size),
      afterChunk,
    });
    onProgress?.(1);
  } else {
    throw new UnsupportedFileError(
      `Cannot process "${fileName}": only text files (${[...TEXT_EXTENSIONS].join(", ")}) and spreadsheets (${[...SPREADSHEET_EXTENSIONS].join(", ")}) are supported.`,
    );
  }

  return {
    blob,
    fileName: outputName(base, outputExtension, mode),
    detections,
    restoredCount,
    unresolvedTokens: [...unresolved],
  };
}
