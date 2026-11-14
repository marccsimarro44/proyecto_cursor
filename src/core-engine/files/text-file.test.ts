import { describe, expect, it } from "vitest";
import { detectPii } from "../detectors/detect";
import {
  findSplitIndex,
  transformTextChunks,
  transformTextFile,
} from "./text-file";

const UTF8_BOM = [0xef, 0xbb, 0xbf];

/** Stand-in for the sanitizer: masks each detection with its type. */
function mask(text: string): string {
  let output = "";
  let cursor = 0;
  for (const detection of detectPii(text)) {
    output += `${text.slice(cursor, detection.start)}<${detection.type}>`;
    cursor = detection.end;
  }
  return output + text.slice(cursor);
}

function utf8(text: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(text);
}

function latin1(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
}

function utf16le(text: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(text.length * 2);
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    bytes[index * 2] = code & 0xff;
    bytes[index * 2 + 1] = code >> 8;
  }
  return bytes;
}

async function bytesOf(blob: Blob): Promise<number[]> {
  return [...new Uint8Array(await blob.arrayBuffer())];
}

/** Feeds `bytes` in pieces of `size` bytes, like a slow file stream. */
function inPieces(bytes: Uint8Array, size: number) {
  return async function* () {
    for (let offset = 0; offset < bytes.length; offset += size) {
      yield bytes.subarray(offset, offset + size);
    }
  };
}

const CSV = [
  "id;nombre;dni;telefono;email;iban",
  '1;"García, Ana";12345678Z;+34 612 345 678;ana@example.com;ES91 2100 0418 4502 0005 1332',
  "2;Luis Peña;87654321X;722123456;luis.pena@example.org;ES7921000813610123456789",
  "3;Sin datos;;;;",
  "",
].join("\r\n");

describe("transformTextFile", () => {
  it("sanitizes a CSV and leaves every other byte as it was", async () => {
    const output = await transformTextFile(new Blob([CSV]), mask, {
      mode: "sanitize",
    });

    expect(await output.text()).toBe(
      [
        "id;nombre;dni;telefono;email;iban",
        '1;"García, Ana";<DNI>;<PHONE>;<EMAIL>;<IBAN>',
        "2;Luis Peña;<DNI>;<PHONE>;<EMAIL>;<IBAN>",
        "3;Sin datos;;;;",
        "",
      ].join("\r\n"),
    );
  });

  it("returns a file without personal data byte for byte", async () => {
    const source = utf8("título;año\r\nCanción;1999\n\n  fin");

    const output = await transformTextFile(new Blob([source]), mask, {
      mode: "sanitize",
    });

    expect(await bytesOf(output)).toEqual([...source]);
  });

  it("keeps the UTF-8 byte order mark that Excel writes", async () => {
    const source = new Uint8Array([...UTF8_BOM, ...utf8("dni\n12345678Z\n")]);

    const output = await transformTextFile(new Blob([source]), mask, {
      mode: "sanitize",
    });

    expect(await bytesOf(output)).toEqual([
      ...UTF8_BOM,
      ...utf8("dni\n<DNI>\n"),
    ]);
  });

  it("reads Windows-1252 files and writes them as UTF-8 with BOM", async () => {
    // Spanish Excel saves "CSV (delimitado por comas)" in Windows-1252.
    const source = latin1("nombre;dni\r\nBegoña Muñoz;12345678Z\r\n");

    const output = await transformTextFile(new Blob([source]), mask, {
      mode: "sanitize",
    });

    expect(await bytesOf(output)).toEqual([
      ...UTF8_BOM,
      ...utf8("nombre;dni\r\nBegoña Muñoz;<DNI>\r\n"),
    ]);
  });

  it("reads UTF-16 files with a byte order mark", async () => {
    const source = utf16le("\uFEFFnombre\tdni\r\nBegoña\t12345678Z\r\n");

    const output = await transformTextFile(new Blob([source]), mask, {
      mode: "sanitize",
    });

    expect(await bytesOf(output)).toEqual([
      ...UTF8_BOM,
      ...utf8("nombre\tdni\r\nBegoña\t<DNI>\r\n"),
    ]);
  });

  it("handles an empty file", async () => {
    const output = await transformTextFile(new Blob([]), mask, {
      mode: "sanitize",
    });

    expect(output.size).toBe(0);
  });

  it("reports progress in bytes and runs the hook after each chunk", async () => {
    const progress: number[] = [];
    let chunks = 0;
    const source = new Blob([CSV]);

    await transformTextFile(source, mask, {
      mode: "sanitize",
      onProgress: (bytes) => progress.push(bytes),
      afterChunk: async () => {
        chunks++;
      },
    });

    expect(progress.at(-1)).toBe(source.size);
    expect(chunks).toBeGreaterThan(0);
  });
});

describe("transformTextChunks", () => {
  it.each([1, 2, 3, 7, 16, 64])(
    "gives the same result when the file arrives %i bytes at a time",
    async (pieceSize) => {
      const output = await transformTextChunks(
        inPieces(utf8(CSV), pieceSize),
        mask,
        { mode: "sanitize", chunkSize: 1 },
      );

      expect(await output.text()).toBe(mask(CSV));
    },
  );

  it("never cuts a value in two on a line without line breaks", async () => {
    const line =
      '{"a":"12345678Z","b":"ana@example.com","c":"+34 612 345 678"}'.repeat(
        50,
      );

    const output = await transformTextChunks(inPieces(utf8(line), 5), mask, {
      mode: "sanitize",
      chunkSize: 1,
    });

    expect(await output.text()).toBe(mask(line));
  });

  it("never cuts a token in two when restoring", async () => {
    const restore = (text: string) =>
      text.replace(/\\?\[DNI\\?_(\d+)\\?\]/g, "dni-$1");
    const text = "x [DNI_1] y \\[DNI\\_22\\] z [DNI_333] [no token] [".repeat(
      40,
    );

    for (const pieceSize of [1, 2, 3, 5, 11]) {
      const output = await transformTextChunks(
        inPieces(utf8(text), pieceSize),
        restore,
        { mode: "restore", chunkSize: 1 },
      );

      expect(await output.text()).toBe(restore(text));
    }
  });

  it("does not break multi-byte characters or emoji at chunk borders", async () => {
    const text = "Peña 👩‍💻 12345678Z ñ€😀|😀;😀 fin".repeat(30);

    for (const pieceSize of [1, 3, 4, 5]) {
      const output = await transformTextChunks(
        inPieces(utf8(text), pieceSize),
        mask,
        { mode: "sanitize", chunkSize: 1 },
      );

      expect(await output.text()).toBe(mask(text));
    }
  });

  it("still makes progress on a huge run with no safe place to cut", async () => {
    const text = `${"a".repeat(20_000)} 12345678Z`;

    const output = await transformTextChunks(inPieces(utf8(text), 512), mask, {
      mode: "sanitize",
      chunkSize: 16,
    });

    expect(await output.text()).toBe(`${"a".repeat(20_000)} <DNI>`);
  });
});

describe("transformTextChunks with terms", () => {
  it("never cuts a term in two, even at a comma inside it", async () => {
    const terms = ["Smith, John"];
    const text = "Contacto: Smith, John y otros. ".repeat(60);
    const maskTerms = (chunk: string) =>
      chunk.replaceAll("Smith, John", "<TERM>");

    for (const pieceSize of [1, 2, 3, 5, 7]) {
      const output = await transformTextChunks(
        inPieces(utf8(text), pieceSize),
        maskTerms,
        {
          mode: "sanitize",
          chunkSize: 1,
          valueChars: [...new Set(terms.join(""))].join(""),
        },
      );

      expect(await output.text()).toBe(maskTerms(text));
    }
  });
});

describe("findSplitIndex", () => {
  it("does not cut after a character that the caller says belongs to a value", () => {
    expect(findSplitIndex("Smith,", "sanitize")).toBe(6);
    expect(findSplitIndex("Smith,", "sanitize", ",")).toBe(0);
  });

  it("cuts after the last line break when there is one", () => {
    expect(findSplitIndex("uno\ndos\ntres", "sanitize")).toBe(8);
    expect(findSplitIndex("uno\ndos\ntres", "restore")).toBe(8);
  });

  it("cuts after the last character that cannot be part of a value", () => {
    expect(findSplitIndex('"a";"612 345', "sanitize")).toBe(5);
    expect(findSplitIndex("ana@example.com", "sanitize")).toBe(0);
  });

  it("cuts before a token that is still open when restoring", () => {
    expect(findSplitIndex("hola [DNI_1", "restore")).toBe(5);
    expect(findSplitIndex("hola \\[DNI\\_1", "restore")).toBe(5);
    expect(findSplitIndex("hola [DNI_1] adios", "restore")).toBe(18);
    expect(findSplitIndex("hola \\", "restore")).toBe(5);
  });
});
