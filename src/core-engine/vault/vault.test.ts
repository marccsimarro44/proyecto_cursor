import { describe, expect, it } from "vitest";
import { generateVaultKey } from "./crypto";
import { createMemoryStorage, type VaultStorage } from "./storage";
import { Vault, VaultError } from "./vault";

async function openVault(
  overrides: Partial<Parameters<typeof Vault.open>[0]> = {},
) {
  const options = {
    sessionId: "session-a",
    key: await generateVaultKey(),
    storage: createMemoryStorage(),
    ...overrides,
  };
  return { vault: await Vault.open(options), ...options };
}

function containsText(buffer: ArrayBuffer, text: string): boolean {
  // Latin-1 keeps one character per byte, enough to search for ASCII values.
  return new TextDecoder("latin1").decode(buffer).includes(text);
}

describe("Vault tokens", () => {
  it("numbers tokens per entity type, starting at 1", async () => {
    const { vault } = await openVault();

    expect(vault.tokenize("DNI", "12345678Z")).toBe("[DNI_1]");
    expect(vault.tokenize("DNI", "87654321X")).toBe("[DNI_2]");
    expect(vault.tokenize("EMAIL", "ana@example.com")).toBe("[EMAIL_1]");
    expect(vault.size).toBe(3);
  });

  it("returns the same token for a value it has already seen", async () => {
    const { vault } = await openVault();

    const first = vault.tokenize("DNI", "12345678Z");
    vault.tokenize("DNI", "87654321X");

    expect(vault.tokenize("DNI", "12345678Z")).toBe(first);
    expect(vault.size).toBe(2);
  });

  it("keeps different spellings of a value apart so restoring is exact", async () => {
    const { vault } = await openVault();

    expect(vault.tokenize("DNI", "12345678Z")).toBe("[DNI_1]");
    expect(vault.tokenize("DNI", "12345678-Z")).toBe("[DNI_2]");
  });

  it("resolves a token back to its original value", async () => {
    const { vault } = await openVault();
    const token = vault.tokenize("IBAN", "ES9121000418450200051332");

    expect(vault.resolve(token)).toBe("ES9121000418450200051332");
    expect(vault.resolve("[IBAN_99]")).toBeUndefined();
  });

  it("lists its entries in creation order", async () => {
    const { vault } = await openVault();
    vault.tokenize("DNI", "12345678Z");
    vault.tokenize("EMAIL", "ana@example.com");

    expect(vault.entries()).toEqual([
      { token: "[DNI_1]", type: "DNI", original: "12345678Z" },
      { token: "[EMAIL_1]", type: "EMAIL", original: "ana@example.com" },
    ]);
  });
});

describe("Vault persistence", () => {
  it("writes nothing until it is flushed", async () => {
    const { vault, storage } = await openVault();
    vault.tokenize("DNI", "12345678Z");

    expect(await storage.keys()).toEqual([]);

    await vault.flush();
    expect(await storage.keys()).toEqual(["session-a:0"]);
  });

  it("writes one record per flush, however many entries it holds", async () => {
    const { vault, storage } = await openVault();
    for (let n = 0; n < 1000; n++) vault.tokenize("EMAIL", `u${n}@example.com`);

    await vault.flush();

    expect(await storage.keys()).toEqual(["session-a:0"]);
  });

  it("stores entries encrypted, never in plaintext", async () => {
    const { vault, storage } = await openVault();
    vault.tokenize("DNI", "12345678Z");
    await vault.flush();

    const [[, record]] = await storage.entries("session-a:");
    expect(containsText(record.data, "12345678Z")).toBe(false);
  });

  it("only writes entries created since the last flush", async () => {
    const written: string[][] = [];
    const memory = createMemoryStorage();
    const storage: VaultStorage = {
      ...memory,
      async setMany(records) {
        written.push(records.map(([key]) => key));
        await memory.setMany(records);
      },
    };
    const { vault } = await openVault({ storage });

    vault.tokenize("DNI", "12345678Z");
    await vault.flush();
    vault.tokenize("DNI", "12345678Z");
    vault.tokenize("DNI", "87654321X");
    await vault.flush();
    await vault.flush();

    // The second flush only held the new value; the third had nothing to do.
    expect(written).toEqual([["session-a:0"], ["session-a:1"]]);
  });

  it("keeps entries queued when a write fails, and retries them", async () => {
    const memory = createMemoryStorage();
    let failures = 1;
    const storage: VaultStorage = {
      ...memory,
      async setMany(records) {
        if (failures-- > 0) throw new Error("quota exceeded");
        await memory.setMany(records);
      },
    };
    const { vault, key } = await openVault({ storage });
    vault.tokenize("DNI", "12345678Z");

    await expect(vault.flush()).rejects.toThrow("quota exceeded");
    expect(vault.resolve("[DNI_1]")).toBe("12345678Z");

    await vault.flush();
    expect(await storage.keys()).toEqual(["session-a:0"]);

    const reopened = await Vault.open({ sessionId: "session-a", key, storage });
    expect(reopened.resolve("[DNI_1]")).toBe("12345678Z");
  });

  it("can be reopened with the same key, as after a worker restart", async () => {
    const { vault, key, storage } = await openVault();
    vault.tokenize("DNI", "12345678Z");
    vault.tokenize("DNI", "87654321X");
    await vault.flush();
    vault.tokenize("EMAIL", "ana@example.com");
    await vault.flush();

    const reopened = await Vault.open({ sessionId: "session-a", key, storage });

    expect(reopened.size).toBe(3);
    expect(reopened.resolve("[DNI_2]")).toBe("87654321X");
    expect(reopened.entries().map((entry) => entry.token)).toEqual([
      "[DNI_1]",
      "[DNI_2]",
      "[EMAIL_1]",
    ]);
    // Known values keep their token and new ones continue the numbering.
    expect(reopened.tokenize("DNI", "12345678Z")).toBe("[DNI_1]");
    expect(reopened.tokenize("DNI", "99999999R")).toBe("[DNI_3]");
    expect(reopened.tokenize("EMAIL", "luis@example.org")).toBe("[EMAIL_2]");
  });

  it("adds to the stored records after reopening instead of replacing them", async () => {
    const { vault, key, storage } = await openVault();
    vault.tokenize("DNI", "12345678Z");
    await vault.flush();

    const reopened = await Vault.open({ sessionId: "session-a", key, storage });
    reopened.tokenize("DNI", "87654321X");
    await reopened.flush();

    const again = await Vault.open({ sessionId: "session-a", key, storage });
    expect((await storage.keys()).sort()).toEqual([
      "session-a:0",
      "session-a:1",
    ]);
    expect(again.resolve("[DNI_1]")).toBe("12345678Z");
    expect(again.resolve("[DNI_2]")).toBe("87654321X");
  });

  it("reloads many flushes in the order they were written", async () => {
    const { vault, key, storage } = await openVault();
    for (let n = 1; n <= 12; n++) {
      vault.tokenize("EMAIL", `u${n}@example.com`);
      await vault.flush();
    }

    const reopened = await Vault.open({ sessionId: "session-a", key, storage });

    expect(reopened.entries().map((entry) => entry.token)).toEqual(
      Array.from({ length: 12 }, (_, index) => `[EMAIL_${index + 1}]`),
    );
  });

  it("cannot be reopened with a different key", async () => {
    const { vault, storage } = await openVault();
    vault.tokenize("DNI", "12345678Z");
    await vault.flush();

    await expect(
      Vault.open({
        sessionId: "session-a",
        key: await generateVaultKey(),
        storage,
      }),
    ).rejects.toThrow(VaultError);
  });

  it("ignores the records of other sessions", async () => {
    const { vault, storage } = await openVault();
    vault.tokenize("DNI", "12345678Z");
    await vault.flush();

    const { vault: other } = await openVault({
      sessionId: "session-b",
      storage,
    });

    expect(other.size).toBe(0);
    expect(other.resolve("[DNI_1]")).toBeUndefined();
  });
});

describe("Vault.clear", () => {
  it("forgets every entry and deletes its records", async () => {
    const { vault, storage } = await openVault();
    vault.tokenize("DNI", "12345678Z");
    await vault.flush();
    vault.tokenize("DNI", "87654321X"); // still queued

    await vault.clear();

    expect(vault.size).toBe(0);
    expect(vault.resolve("[DNI_1]")).toBeUndefined();
    expect(await storage.keys()).toEqual([]);

    await vault.flush();
    expect(await storage.keys()).toEqual([]);
  });

  it("also deletes records that were still being written", async () => {
    const { vault, storage } = await openVault();
    vault.tokenize("DNI", "12345678Z");

    const flushing = vault.flush();
    await Promise.resolve(); // let the write start, then clear mid-write
    await vault.clear();
    await flushing;

    expect(await storage.keys()).toEqual([]);
    expect(vault.size).toBe(0);
  });

  it("restarts the numbering", async () => {
    const { vault } = await openVault();
    vault.tokenize("DNI", "12345678Z");

    await vault.clear();

    expect(vault.tokenize("DNI", "87654321X")).toBe("[DNI_1]");
  });

  it("leaves the records of other sessions alone", async () => {
    const { vault, storage } = await openVault();
    const { vault: other } = await openVault({
      sessionId: "session-b",
      storage,
    });
    vault.tokenize("DNI", "12345678Z");
    other.tokenize("DNI", "87654321X");
    await vault.flush();
    await other.flush();

    await vault.clear();

    expect(await storage.keys()).toEqual(["session-b:0"]);
  });
});
