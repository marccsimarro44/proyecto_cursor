import { isWordCode } from "@/lib/regex-utils/match";
import type { FileMode } from "../types";

export interface TextTransformOptions {
  mode: FileMode;
  /** Called after each read with the number of source bytes consumed. */
  onProgress?: (processedBytes: number) => void;
  /** Awaited after each chunk is transformed, e.g. to flush the vault. */
  afterChunk?: () => Promise<void>;
  /** Characters to buffer before transforming a chunk. Default 1 M. */
  chunkSize?: number;
  /**
   * Characters beyond the built-in ones that can be part of a value to
   * sanitize (those of user terms, e.g. the comma in "Smith, John"). A chunk
   * is never cut right after one of them.
   */
  valueChars?: string;
}

const DEFAULT_CHUNK_SIZE = 1 << 20;
/** A buffer this many times the chunk size is cut even at an unsafe place. */
const FORCE_SPLIT_FACTOR = 8;
const MIN_FORCE_SPLIT_SIZE = 4096;
/** Longest token worth waiting for: `\[CREDIT\_CARD\_<digits>\]` and room. */
const MAX_TOKEN_LENGTH = 48;

const UTF8_BOM = new Uint8Array([0xef, 0xbb, 0xbf]);
const BACKSLASH = 92;

/** The bytes are not valid text in the encoding being tried. */
class EncodingError extends Error {}

/**
 * Whether a character can be part of a detectable value: letters, digits
 * and the separators the detectors accept (space `.` `-` `_` `%` `+` `@`
 * `(` `)`). No value spans a character outside this set.
 */
function isValueCode(code: number): boolean {
  return (
    isWordCode(code) ||
    code === 32 || // space
    code === 46 || // .
    code === 45 || // -
    code === 95 || // _
    code === 37 || // %
    code === 43 || // +
    code === 64 || // @
    code === 40 || // (
    code === 41 // )
  );
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

/**
 * Where `buffer` can be cut so that neither part needs the other to be
 * transformed correctly: the head `buffer.slice(0, index)` is ready, the
 * rest waits for more text. Returns 0 when there is no such place yet.
 *
 * A line break is always safe. Without one, sanitizing cuts after the last
 * character no value can contain, and restoring cuts before a token that
 * has been opened but not closed.
 */
export function findSplitIndex(
  buffer: string,
  mode: FileMode,
  valueChars = "",
): number {
  const lineBreak = buffer.lastIndexOf("\n");
  if (lineBreak !== -1) return lineBreak + 1;

  if (mode === "restore") {
    let index = buffer.length;
    const open = buffer.lastIndexOf("[");
    if (
      open !== -1 &&
      buffer.indexOf("]", open) === -1 &&
      buffer.length - open <= MAX_TOKEN_LENGTH
    ) {
      index = open;
    }
    // A trailing backslash may be the Markdown escape of the next token.
    if (index > 0 && buffer.charCodeAt(index - 1) === BACKSLASH) index--;
    return index;
  }

  for (let index = buffer.length - 1; index >= 0; index--) {
    const code = buffer.charCodeAt(index);
    if (!isValueCode(code) && !valueChars.includes(buffer.charAt(index))) {
      // Never separate the two halves of an emoji or other astral character.
      return isHighSurrogate(code) ? index : index + 1;
    }
  }
  return 0;
}

async function transformAs(
  encoding: string,
  open: () => AsyncIterable<Uint8Array>,
  transform: (text: string) => string,
  options: TextTransformOptions,
  head: number[],
): Promise<Blob> {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const forceSplitSize = Math.max(
    chunkSize * FORCE_SPLIT_FACTOR,
    MIN_FORCE_SPLIT_SIZE,
  );

  // `ignoreBOM` keeps a byte order mark in the text, so it is written back.
  const decoder = new TextDecoder(encoding, { fatal: true, ignoreBOM: true });
  const encoder = new TextEncoder();
  const decode = (bytes?: Uint8Array): string => {
    try {
      return decoder.decode(bytes, { stream: bytes !== undefined });
    } catch {
      throw new EncodingError();
    }
  };

  // Each part becomes a Blob right away so the browser can move finished
  // output out of memory while the rest of a large file is processed.
  const parts: Blob[] = [];
  // Legacy encodings are converted to UTF-8; the mark tells Excel so.
  if (encoding === "windows-1252") parts.push(new Blob([UTF8_BOM]));

  const emit = async (text: string): Promise<void> => {
    if (text.length > 0)
      parts.push(new Blob([encoder.encode(transform(text))]));
    await options.afterChunk?.();
  };

  let buffer = "";
  let processedBytes = 0;
  for await (const bytes of open()) {
    for (let index = 0; head.length < 2 && index < bytes.length; index++) {
      head.push(bytes[index]);
    }
    processedBytes += bytes.byteLength;
    buffer += decode(bytes);

    if (buffer.length >= chunkSize) {
      let split = findSplitIndex(buffer, options.mode, options.valueChars);
      if (split === 0 && buffer.length >= forceSplitSize) {
        split = buffer.length;
        if (isHighSurrogate(buffer.charCodeAt(split - 1))) split--;
      }
      if (split > 0) {
        await emit(buffer.slice(0, split));
        buffer = buffer.slice(split);
      }
    }
    options.onProgress?.(processedBytes);
  }

  await emit(buffer + decode());
  return new Blob(parts);
}

/**
 * Applies `transform` to a text file delivered as byte chunks and returns
 * the result as UTF-8.
 *
 * The file is never parsed: delimiters, quoting and line endings pass
 * through untouched, which keeps a CSV valid whatever its dialect. Text is
 * transformed in chunks cut at places chosen by {@link findSplitIndex}, so
 * memory use does not grow with the file and no value or token is ever
 * split between two chunks.
 *
 * Encoding: UTF-8 first; if the bytes are not valid UTF-8 the file is read
 * again as UTF-16 (when it starts with that byte order mark) or as
 * Windows-1252, the encoding Spanish Excel uses for CSV. `open` is called
 * once per attempt and must return the file from its start each time.
 */
export async function transformTextChunks(
  open: () => AsyncIterable<Uint8Array>,
  transform: (text: string) => string,
  options: TextTransformOptions,
): Promise<Blob> {
  const head: number[] = [];
  try {
    return await transformAs("utf-8", open, transform, options, head);
  } catch (error) {
    if (!(error instanceof EncodingError)) throw error;
  }

  let fallback = "windows-1252";
  if (head[0] === 0xff && head[1] === 0xfe) fallback = "utf-16le";
  if (head[0] === 0xfe && head[1] === 0xff) fallback = "utf-16be";
  return transformAs(fallback, open, transform, options, []);
}

async function* readBlob(blob: Blob): AsyncGenerator<Uint8Array> {
  // A reader instead of `for await (... of stream)`: Safari cannot iterate
  // a ReadableStream directly.
  const reader = blob.stream().getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

/** {@link transformTextChunks} for a `Blob` or `File`, read as a stream. */
export function transformTextFile(
  file: Blob,
  transform: (text: string) => string,
  options: TextTransformOptions,
): Promise<Blob> {
  return transformTextChunks(() => readBlob(file), transform, options);
}
