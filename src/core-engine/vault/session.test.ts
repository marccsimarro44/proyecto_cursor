import { describe, expect, it } from "vitest";
import type { EncryptedRecord } from "./crypto";
import {
  createVaultSession,
  purgeStaleSessions,
  type SessionLocks,
} from "./session";
import { createMemoryStorage } from "./storage";

const RECORD: EncryptedRecord = {
  iv: new Uint8Array(12),
  data: new ArrayBuffer(4),
};

/** Minimal Web Locks stand-in: a lock is held until its callback settles. */
function createFakeLocks(): SessionLocks & { held: Set<string> } {
  const held = new Set<string>();
  return {
    held,
    async request(name, callback) {
      held.add(name);
      try {
        return await callback();
      } finally {
        held.delete(name);
      }
    },
    async query() {
      return { held: [...held].map((name) => ({ name })) };
    },
  };
}

describe("createVaultSession", () => {
  it("creates a random session id and a non-extractable key", async () => {
    const first = await createVaultSession(undefined);
    const second = await createVaultSession(undefined);

    expect(first.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.sessionId).not.toBe(second.sessionId);
    expect(first.sessionId).not.toContain(":");
    expect(first.key.extractable).toBe(false);
  });

  it("holds a lock named after the session for as long as the page lives", async () => {
    const locks = createFakeLocks();

    const session = await createVaultSession(locks);

    expect([...locks.held]).toEqual([
      `promptshield-vault:${session.sessionId}`,
    ]);
  });
});

describe("purgeStaleSessions", () => {
  it("deletes the records of sessions whose page is gone", async () => {
    const locks = createFakeLocks();
    const storage = createMemoryStorage();
    const live = await createVaultSession(locks);
    await storage.setMany([
      [`${live.sessionId}:0`, RECORD],
      ["closed-tab:0", RECORD],
      ["closed-tab:1", RECORD],
      ["crashed-tab:0", RECORD],
    ]);

    const purged = await purgeStaleSessions(storage, locks);

    expect(purged).toBe(2);
    expect(await storage.keys()).toEqual([`${live.sessionId}:0`]);
  });

  it("keeps the records of every other open tab", async () => {
    const locks = createFakeLocks();
    const storage = createMemoryStorage();
    const tabA = await createVaultSession(locks);
    const tabB = await createVaultSession(locks);
    await storage.setMany([
      [`${tabA.sessionId}:0`, RECORD],
      [`${tabB.sessionId}:0`, RECORD],
    ]);

    expect(await purgeStaleSessions(storage, locks)).toBe(0);
    expect(await storage.keys()).toHaveLength(2);
  });

  it("deletes nothing when the browser has no Web Locks API", async () => {
    const storage = createMemoryStorage();
    await storage.setMany([["unknown-tab:0", RECORD]]);

    expect(await purgeStaleSessions(storage, undefined)).toBe(0);
    expect(await storage.keys()).toEqual(["unknown-tab:0"]);
  });
});
