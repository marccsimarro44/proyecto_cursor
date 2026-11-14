import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { generateVaultKey } from "../vault/crypto";
import { createIndexedDbStorage, createMemoryStorage } from "../vault/storage";
import { createRequestHandler } from "./handler";
import type { WorkerRequest, WorkerResponse } from "./protocol";

type Handler = ReturnType<typeof createRequestHandler>;

let nextId = 1;

/** Sends one request and returns everything the handler posted for it. */
async function send(
  handler: Handler,
  request: Omit<WorkerRequest, "id">,
): Promise<WorkerResponse[]> {
  const responses: WorkerResponse[] = [];
  await handler({ id: nextId++, ...request } as WorkerRequest, (response) =>
    responses.push(response),
  );
  return responses;
}

/** Sends one request and returns its result, failing on an error response. */
async function call<Result>(
  handler: Handler,
  request: Omit<WorkerRequest, "id">,
): Promise<Result> {
  const last = (await send(handler, request)).at(-1);
  if (last?.type !== "result") {
    throw new Error(`Expected a result, got ${JSON.stringify(last)}`);
  }
  return last.result as Result;
}

async function initialized(sessionId = "session-a") {
  const handler = createRequestHandler({ locks: null });
  const key = await generateVaultKey();
  await call(handler, { method: "init", params: { sessionId, key } });
  return { handler, key, sessionId };
}

afterEach(async () => {
  const storage = createIndexedDbStorage();
  await storage.deleteMany(await storage.keys());
});

describe("request handler", () => {
  it("refuses to work before init", async () => {
    const handler = createRequestHandler({ locks: null });

    const responses = await send(handler, {
      method: "sanitizeText",
      params: { text: "12345678Z" },
    });

    expect(responses).toEqual([
      {
        id: expect.any(Number),
        type: "error",
        error: {
          name: "NotInitializedError",
          message: "The sanitizer worker must be initialized before use.",
        },
      },
    ]);
  });

  it("opens the vault on IndexedDB and reports it", async () => {
    const handler = createRequestHandler({ locks: null });

    const result = await call(handler, {
      method: "init",
      params: { sessionId: "session-a", key: await generateVaultKey() },
    });

    expect(result).toEqual({ backend: "indexeddb", entryCount: 0 });
  });

  it("reports the memory backend when IndexedDB is unavailable", async () => {
    const handler = createRequestHandler({
      locks: null,
      openStorage: async () => ({
        storage: createMemoryStorage(),
        backend: "memory",
      }),
    });

    const result = await call(handler, {
      method: "init",
      params: { sessionId: "session-a", key: await generateVaultKey() },
    });

    expect(result).toEqual({ backend: "memory", entryCount: 0 });
  });

  it("sanitizes and restores text", async () => {
    const { handler } = await initialized();

    const sanitized = await call(handler, {
      method: "sanitizeText",
      params: { text: "DNI 12345678Z, tel. 612345678" },
    });
    const restored = await call(handler, {
      method: "restoreText",
      params: { text: "Documento [DNI_1] y teléfono [PHONE_1]." },
    });

    expect(sanitized).toMatchObject({
      sanitizedText: "DNI [DNI_1], tel. [PHONE_1]",
    });
    expect(restored).toEqual({
      restoredText: "Documento 12345678Z y teléfono 612345678.",
      restoredCount: 2,
      unresolvedTokens: [],
    });
  });

  it("has stored the entries, encrypted, by the time it answers", async () => {
    const { handler } = await initialized();

    await call(handler, {
      method: "sanitizeText",
      params: { text: "12345678Z y ana@example.com" },
    });

    const stored = await createIndexedDbStorage().entries("session-a:");
    expect(stored.map(([key]) => key)).toEqual(["session-a:0"]);
    for (const [, record] of stored) {
      const bytes = new TextDecoder("latin1").decode(record.data);
      expect(bytes).not.toContain("12345678Z");
      expect(bytes).not.toContain("ana@example.com");
    }
  });

  it("lets a new worker of the same session pick up the vault", async () => {
    const { handler, key, sessionId } = await initialized();
    await call(handler, {
      method: "sanitizeText",
      params: { text: "12345678Z" },
    });

    const replacement = createRequestHandler({ locks: null });
    const init = await call(replacement, {
      method: "init",
      params: { sessionId, key },
    });
    const restored = await call(replacement, {
      method: "restoreText",
      params: { text: "[DNI_1]" },
    });

    expect(init).toEqual({ backend: "indexeddb", entryCount: 1 });
    expect(restored).toMatchObject({ restoredText: "12345678Z" });
  });

  it("answers init with an error when the key does not match the session", async () => {
    const { handler, sessionId } = await initialized();
    await call(handler, {
      method: "sanitizeText",
      params: { text: "12345678Z" },
    });

    const responses = await send(createRequestHandler({ locks: null }), {
      method: "init",
      params: { sessionId, key: await generateVaultKey() },
    });

    expect(responses.at(-1)).toMatchObject({
      type: "error",
      error: { name: "VaultError" },
    });
  });

  it("deletes what closed tabs left behind when it starts", async () => {
    const storage = createIndexedDbStorage();
    await storage.setMany([
      ["closed-tab:0", { iv: new Uint8Array(12), data: new ArrayBuffer(8) }],
    ]);
    const handler = createRequestHandler({
      locks: {
        request: async () => undefined,
        query: async () => ({ held: [] }),
      },
    });

    await call(handler, {
      method: "init",
      params: { sessionId: "session-a", key: await generateVaultKey() },
    });

    expect(await storage.keys()).toEqual([]);
  });

  it("processes a file, posting progress before the result", async () => {
    const { handler, key } = await initialized();

    const responses = await send(handler, {
      method: "processFile",
      params: {
        file: new Blob(["dni\n12345678Z\n87654321X\n"]),
        fileName: "datos.csv",
        mode: "sanitize",
      },
    });

    const types = responses.map((response) => response.type);
    expect(types.at(-1)).toBe("result");
    expect(types.slice(0, -1).length).toBeGreaterThan(0);
    expect(types.slice(0, -1).every((type) => type === "progress")).toBe(true);

    const last = responses.at(-1);
    if (last?.type !== "result") throw new Error("unreachable");
    const result = last.result as { blob: Blob; fileName: string };
    expect(result.fileName).toBe("datos.sanitized.csv");
    expect(await result.blob.text()).toBe("dni\n[DNI_1]\n[DNI_2]\n");

    // Entries created by the file job are stored too: a new worker finds them.
    expect(await createIndexedDbStorage().keys()).toEqual(["session-a:0"]);
    const replacement = createRequestHandler({ locks: null });
    expect(
      await call(replacement, {
        method: "init",
        params: { sessionId: "session-a", key },
      }),
    ).toEqual({ backend: "indexeddb", entryCount: 2 });
  });

  it("reports an unsupported file as an error response", async () => {
    const { handler } = await initialized();

    const responses = await send(handler, {
      method: "processFile",
      params: { file: new Blob(["x"]), fileName: "x.pdf", mode: "sanitize" },
    });

    expect(responses.at(-1)).toMatchObject({
      type: "error",
      error: { name: "UnsupportedFileError" },
    });
  });

  it("lists the entries and clears them", async () => {
    const { handler } = await initialized();
    await call(handler, {
      method: "sanitizeText",
      params: { text: "12345678Z" },
    });

    expect(
      await call(handler, { method: "listEntries", params: undefined }),
    ).toEqual([{ token: "[DNI_1]", type: "DNI", original: "12345678Z" }]);

    await call(handler, { method: "clear", params: undefined });

    expect(
      await call(handler, { method: "listEntries", params: undefined }),
    ).toEqual([]);
    expect(await createIndexedDbStorage().keys()).toEqual([]);
  });
});
