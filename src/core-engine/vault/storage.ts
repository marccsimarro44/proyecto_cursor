import { createStore, delMany, entries, keys, setMany } from "idb-keyval";
import type { EncryptedRecord } from "./crypto";

/**
 * Where encrypted vault records live. Keys have the form
 * `<sessionId>:<batch number>`; values never contain plaintext.
 */
export interface VaultStorage {
  setMany(records: [key: string, record: EncryptedRecord][]): Promise<void>;
  /** Every record whose key starts with `prefix`. */
  entries(prefix: string): Promise<[key: string, record: EncryptedRecord][]>;
  /** Every key, across all sessions. */
  keys(): Promise<string[]>;
  deleteMany(keys: string[]): Promise<void>;
}

export type VaultStorageBackend = "indexeddb" | "memory";

const DATABASE_NAME = "promptshield-vault";
const STORE_NAME = "entries";

/** Storage backed by IndexedDB, shared by every tab and worker of the origin. */
export function createIndexedDbStorage(): VaultStorage {
  const store = createStore(DATABASE_NAME, STORE_NAME);

  return {
    setMany: (records) => setMany(records, store),
    async entries(prefix) {
      const all = await entries<string, EncryptedRecord>(store);
      return all.filter(([key]) => key.startsWith(prefix));
    },
    keys: () => keys<string>(store),
    deleteMany: (targets) => delMany(targets, store),
  };
}

/** Storage that lives and dies with the JavaScript context that created it. */
export function createMemoryStorage(): VaultStorage {
  const records = new Map<string, EncryptedRecord>();

  return {
    async setMany(batch) {
      for (const [key, record] of batch) records.set(key, record);
    },
    async entries(prefix) {
      return [...records].filter(([key]) => key.startsWith(prefix));
    },
    async keys() {
      return [...records.keys()];
    },
    async deleteMany(targets) {
      for (const key of targets) records.delete(key);
    },
  };
}

/**
 * Opens IndexedDB storage, or in-memory storage when IndexedDB is missing or
 * blocked (some private browsing modes). The caller learns which one it got
 * because a memory-backed vault does not survive a worker restart.
 */
export async function openVaultStorage(): Promise<{
  storage: VaultStorage;
  backend: VaultStorageBackend;
}> {
  if (typeof indexedDB !== "undefined") {
    try {
      const storage = createIndexedDbStorage();
      await storage.keys();
      return { storage, backend: "indexeddb" };
    } catch {
      // Fall through to memory.
    }
  }
  return { storage: createMemoryStorage(), backend: "memory" };
}
