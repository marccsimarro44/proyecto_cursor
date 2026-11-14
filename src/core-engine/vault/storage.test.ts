import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EncryptedRecord } from "./crypto";
import {
  createIndexedDbStorage,
  createMemoryStorage,
  openVaultStorage,
  type VaultStorage,
} from "./storage";

function record(seed: number): EncryptedRecord {
  return {
    iv: new Uint8Array(12).fill(seed),
    data: new Uint8Array([seed, seed + 1, seed + 2]).buffer,
  };
}

const BACKENDS: [string, () => VaultStorage][] = [
  ["memory", createMemoryStorage],
  ["IndexedDB", createIndexedDbStorage],
];

describe.each(BACKENDS)("%s vault storage", (_name, create) => {
  afterEach(async () => {
    const storage = create();
    await storage.deleteMany(await storage.keys());
  });

  it("starts empty", async () => {
    const storage = create();

    expect(await storage.keys()).toEqual([]);
    expect(await storage.entries("a:")).toEqual([]);
  });

  it("stores records and returns them intact", async () => {
    const storage = create();
    await storage.setMany([
      ["a:0", record(1)],
      ["a:1", record(2)],
    ]);

    const entries = new Map(await storage.entries("a:"));
    expect(entries.size).toBe(2);
    expect(entries.get("a:0")?.iv).toEqual(record(1).iv);
    expect(new Uint8Array(entries.get("a:1")!.data)).toEqual(
      new Uint8Array(record(2).data),
    );
  });

  it("only returns the entries under the requested prefix", async () => {
    const storage = create();
    await storage.setMany([
      ["a:0", record(1)],
      ["b:0", record(2)],
    ]);

    expect((await storage.entries("b:")).map(([key]) => key)).toEqual(["b:0"]);
    expect((await storage.keys()).sort()).toEqual(["a:0", "b:0"]);
  });

  it("deletes the given keys and leaves the rest", async () => {
    const storage = create();
    await storage.setMany([
      ["a:0", record(1)],
      ["a:1", record(2)],
      ["b:0", record(3)],
    ]);

    await storage.deleteMany(["a:0", "b:0"]);

    expect(await storage.keys()).toEqual(["a:1"]);
  });
});

describe("IndexedDB vault storage", () => {
  it("shares its data between instances, like two workers of one origin", async () => {
    const first = createIndexedDbStorage();
    await first.setMany([["shared:0", record(7)]]);

    const second = createIndexedDbStorage();
    expect((await second.entries("shared:")).map(([key]) => key)).toEqual([
      "shared:0",
    ]);

    await second.deleteMany(["shared:0"]);
  });
});

describe("openVaultStorage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses IndexedDB when it is available", async () => {
    const { backend } = await openVaultStorage();

    expect(backend).toBe("indexeddb");
  });

  it("falls back to memory when IndexedDB is missing", async () => {
    vi.stubGlobal("indexedDB", undefined);

    const { backend, storage } = await openVaultStorage();

    expect(backend).toBe("memory");
    await storage.setMany([["a:0", record(1)]]);
    expect(await storage.keys()).toEqual(["a:0"]);
  });

  it("falls back to memory when IndexedDB refuses to open", async () => {
    vi.stubGlobal("indexedDB", {
      open: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    });

    const { backend } = await openVaultStorage();

    expect(backend).toBe("memory");
  });
});
