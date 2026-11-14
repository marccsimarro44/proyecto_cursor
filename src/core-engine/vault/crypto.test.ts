import { describe, expect, it } from "vitest";
import type { VaultEntry } from "../types";
import { decryptEntries, encryptEntries, generateVaultKey } from "./crypto";

const ENTRIES: VaultEntry[] = [
  { token: "[DNI_1]", type: "DNI", original: "12345678Z" },
  { token: "[EMAIL_1]", type: "EMAIL", original: "soporte@españa.es" },
];
const CONTEXT = "session-a:0";

function containsBytes(haystack: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

describe("generateVaultKey", () => {
  it("creates a 256-bit AES-GCM key limited to encrypt and decrypt", async () => {
    const key = await generateVaultKey();

    expect(key.algorithm).toMatchObject({ name: "AES-GCM", length: 256 });
    expect([...key.usages].sort()).toEqual(["decrypt", "encrypt"]);
  });

  it("creates a key whose raw bytes cannot be exported", async () => {
    const key = await generateVaultKey();

    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", key)).rejects.toThrow();
  });
});

describe("encryptEntries / decryptEntries", () => {
  it("round-trips a batch of entries, including non-ASCII values", async () => {
    const key = await generateVaultKey();
    const record = await encryptEntries(key, ENTRIES, CONTEXT);

    await expect(decryptEntries(key, record, CONTEXT)).resolves.toEqual(
      ENTRIES,
    );
  });

  it("does not leave any original value readable in the record", async () => {
    const key = await generateVaultKey();
    const record = await encryptEntries(key, ENTRIES, CONTEXT);

    for (const entry of ENTRIES) {
      const plaintext = new TextEncoder().encode(entry.original);
      expect(containsBytes(new Uint8Array(record.data), plaintext)).toBe(false);
      expect(containsBytes(record.iv, plaintext)).toBe(false);
    }
  });

  it("uses a fresh 96-bit IV for every record", async () => {
    const key = await generateVaultKey();
    const first = await encryptEntries(key, ENTRIES, CONTEXT);
    const second = await encryptEntries(key, ENTRIES, CONTEXT);

    expect(first.iv).toHaveLength(12);
    expect(first.iv).not.toEqual(second.iv);
    expect(new Uint8Array(first.data)).not.toEqual(new Uint8Array(second.data));
  });

  it("cannot be decrypted with another key", async () => {
    const record = await encryptEntries(
      await generateVaultKey(),
      ENTRIES,
      CONTEXT,
    );

    await expect(
      decryptEntries(await generateVaultKey(), record, CONTEXT),
    ).rejects.toThrow();
  });

  it("cannot be decrypted under another storage key", async () => {
    const key = await generateVaultKey();
    const record = await encryptEntries(key, ENTRIES, CONTEXT);

    await expect(decryptEntries(key, record, "session-a:1")).rejects.toThrow();
    await expect(decryptEntries(key, record, "session-b:0")).rejects.toThrow();
  });

  it("detects tampering with the ciphertext", async () => {
    const key = await generateVaultKey();
    const record = await encryptEntries(key, ENTRIES, CONTEXT);
    const tampered = new Uint8Array(record.data.slice(0));
    tampered[0] ^= 1;

    await expect(
      decryptEntries(key, { iv: record.iv, data: tampered.buffer }, CONTEXT),
    ).rejects.toThrow();
  });
});
