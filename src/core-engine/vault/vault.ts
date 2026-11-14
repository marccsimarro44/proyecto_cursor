import type { PiiEntityType, VaultEntry, VaultToken } from "../types";
import { decryptEntries, encryptEntries } from "./crypto";
import type { VaultStorage } from "./storage";

/** The stored vault cannot be read, e.g. it was encrypted with another key. */
export class VaultError extends Error {
  override name = "VaultError";
}

export interface VaultOptions {
  /** Identifies the page session; prefixes every storage key. */
  sessionId: string;
  /** AES-GCM key of the session, see `generateVaultKey`. */
  key: CryptoKey;
  storage: VaultStorage;
}

/**
 * The reversible dictionary between tokens and original values.
 *
 * Lookups are answered from memory so sanitizing stays synchronous and fast.
 * Storage only ever receives entries encrypted with the session key, one
 * record per flush; it is the copy a new worker reads to carry on after the
 * previous one is terminated, for instance to cancel a long file job.
 */
export class Vault {
  private readonly byToken = new Map<VaultToken, VaultEntry>();
  private readonly byOriginal = new Map<string, VaultEntry>();
  private readonly counters = new Map<PiiEntityType, number>();
  /** Entries not yet written to storage. */
  private pending: VaultEntry[] = [];
  /** Number of the next stored batch; storage keys are `<sessionId>:<n>`. */
  private nextBatch = 0;
  /** Bumped by `clear`, so work started before it can tell it is outdated. */
  private generation = 0;
  private storageQueue: Promise<unknown> = Promise.resolve();

  private constructor(private readonly options: VaultOptions) {}

  /**
   * Opens the vault of a session, loading whatever that session already
   * stored. Throws {@link VaultError} if those records cannot be decrypted
   * with `options.key`.
   */
  static async open(options: VaultOptions): Promise<Vault> {
    const vault = new Vault(options);
    const prefix = `${options.sessionId}:`;

    // Batches are replayed in the order they were written.
    const records = (await options.storage.entries(prefix))
      .map(([storageKey, record]) => ({
        storageKey,
        record,
        batch: Number(storageKey.slice(prefix.length)),
      }))
      .sort((a, b) => a.batch - b.batch);

    let batches: VaultEntry[][];
    try {
      batches = await Promise.all(
        records.map(({ storageKey, record }) =>
          decryptEntries(options.key, record, storageKey),
        ),
      );
    } catch {
      throw new VaultError(
        "The stored vault cannot be decrypted with this session key.",
      );
    }

    for (const entries of batches) {
      for (const entry of entries) vault.index(entry);
    }
    const last = records[records.length - 1];
    if (last !== undefined) vault.nextBatch = last.batch + 1;
    return vault;
  }

  /** Number of distinct values held. */
  get size(): number {
    return this.byToken.size;
  }

  /**
   * The token standing for `original`, creating it on first sight. The same
   * exact string always gets the same token; a different spelling of the
   * same identifier gets its own, so restoring reproduces the source text
   * character by character.
   */
  tokenize(type: PiiEntityType, original: string): VaultToken {
    const known = this.byOriginal.get(`${type}:${original}`);
    if (known !== undefined) return known.token;

    const number = (this.counters.get(type) ?? 0) + 1;
    const entry: VaultEntry = { token: `[${type}_${number}]`, type, original };
    this.index(entry);
    this.pending.push(entry);
    return entry.token;
  }

  /** The original value behind `token`, if this vault issued it. */
  resolve(token: VaultToken): string | undefined {
    return this.byToken.get(token)?.original;
  }

  /** Every entry, in creation order. */
  entries(): VaultEntry[] {
    return [...this.byToken.values()];
  }

  /**
   * Encrypts and stores the entries created since the last flush. If the
   * write fails the entries stay queued for the next attempt.
   */
  flush(): Promise<void> {
    return this.enqueue(() => this.writePending());
  }

  /** Forgets every entry and deletes this session's records from storage. */
  clear(): Promise<void> {
    this.byToken.clear();
    this.byOriginal.clear();
    this.counters.clear();
    this.pending = [];
    this.generation++;

    return this.enqueue(async () => {
      const prefix = `${this.options.sessionId}:`;
      const stored = await this.options.storage.keys();
      await this.options.storage.deleteMany(
        stored.filter((key) => key.startsWith(prefix)),
      );
    });
  }

  /**
   * Runs storage operations one after another, so a `clear` requested while
   * a flush is still writing deletes those records too instead of racing it.
   */
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.storageQueue.then(operation, operation);
    this.storageQueue = result.catch(() => undefined);
    return result;
  }

  private async writePending(): Promise<void> {
    if (this.pending.length === 0) return;

    const batch = this.pending;
    const generation = this.generation;
    this.pending = [];
    try {
      // The whole batch becomes a single record: one encryption and one
      // write, however many entries a large file produced.
      const storageKey = `${this.options.sessionId}:${this.nextBatch}`;
      const record = await encryptEntries(this.options.key, batch, storageKey);
      await this.options.storage.setMany([[storageKey, record]]);
      this.nextBatch++;
    } catch (error) {
      // Entries cleared in the meantime must not come back.
      if (generation === this.generation) {
        this.pending = batch.concat(this.pending);
      }
      throw error;
    }
  }

  private index(entry: VaultEntry): void {
    this.byToken.set(entry.token, entry);
    this.byOriginal.set(`${entry.type}:${entry.original}`, entry);

    // "[DNI_12]" -> 12. Reopened vaults continue from the highest number.
    const number = Number(entry.token.slice(entry.type.length + 2, -1));
    if (number > (this.counters.get(entry.type) ?? 0)) {
      this.counters.set(entry.type, number);
    }
  }
}
