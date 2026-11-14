import { generateVaultKey } from "./crypto";
import type { VaultStorage } from "./storage";

/** What a page needs to open its vault, in this or any of its workers. */
export interface VaultSession {
  sessionId: string;
  key: CryptoKey;
}

/** The part of the Web Locks API (`navigator.locks`) the vault relies on. */
export interface SessionLocks {
  request(name: string, callback: () => Promise<unknown>): Promise<unknown>;
  query(): Promise<{ held?: { name?: string }[] }>;
}

const LOCK_PREFIX = "promptshield-vault:";

/** `navigator.locks`, or `undefined` where the API does not exist. */
export function browserLocks(): SessionLocks | undefined {
  return typeof navigator !== "undefined" && navigator.locks
    ? navigator.locks
    : undefined;
}

/**
 * Starts a vault session: a random id plus a fresh in-memory key.
 *
 * The calling context also takes a Web Lock named after the session and
 * never releases it, so the browser frees it exactly when that page goes
 * away, even on a crash. That lock is how other tabs tell live sessions from
 * dead ones in {@link purgeStaleSessions}. Call this from the page (not from
 * a worker) so the session outlives worker restarts. Pass
 * {@link browserLocks}() as `locks`; with `undefined` no lock is taken.
 */
export async function createVaultSession(
  locks: SessionLocks | undefined,
): Promise<VaultSession> {
  const sessionId = crypto.randomUUID();
  const key = await generateVaultKey();

  if (locks !== undefined) {
    await new Promise<void>((granted, failed) => {
      locks
        .request(LOCK_PREFIX + sessionId, () => {
          granted();
          return new Promise<never>(() => {});
        })
        .catch(failed);
    });
  }

  return { sessionId, key };
}

/**
 * Deletes the stored records of sessions whose page no longer exists, and
 * returns how many sessions were removed.
 *
 * Those records are already unreadable (their key is gone); this keeps the
 * ciphertext from piling up on disk. Without the Web Locks API there is no
 * safe way to tell whether another tab is still using its records, so
 * nothing is deleted.
 */
export async function purgeStaleSessions(
  storage: VaultStorage,
  locks: SessionLocks | undefined,
  currentSessionId?: string,
): Promise<number> {
  if (locks === undefined) return 0;

  const { held = [] } = await locks.query();
  const live = new Set<string>();
  // The caller's own session is kept even if its lock cannot be seen.
  if (currentSessionId !== undefined) live.add(currentSessionId);
  for (const { name } of held) {
    if (name?.startsWith(LOCK_PREFIX)) live.add(name.slice(LOCK_PREFIX.length));
  }

  const staleKeys: string[] = [];
  const staleSessions = new Set<string>();
  for (const key of await storage.keys()) {
    const sessionId = key.slice(0, key.indexOf(":"));
    if (!live.has(sessionId)) {
      staleKeys.push(key);
      staleSessions.add(sessionId);
    }
  }

  await storage.deleteMany(staleKeys);
  return staleSessions.size;
}
