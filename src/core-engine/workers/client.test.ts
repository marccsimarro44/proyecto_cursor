import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { createIndexedDbStorage, createMemoryStorage } from "../vault/storage";
import {
  SanitizerAbortedError,
  SanitizerClient,
  type WorkerLike,
} from "./client";
import { createRequestHandler, type HandlerDependencies } from "./handler";
import type { WorkerRequest, WorkerResponse } from "./protocol";

/**
 * An in-process worker: runs the real request handler and copies every
 * message with the structured clone algorithm, as `postMessage` does.
 */
class FakeWorker implements WorkerLike {
  onmessage: WorkerLike["onmessage"] = null;
  onerror: WorkerLike["onerror"] = null;
  terminated = false;
  /** When set, requests are received but never answered. */
  frozen = false;

  private readonly handle: ReturnType<typeof createRequestHandler>;

  constructor(dependencies: HandlerDependencies = {}) {
    this.handle = createRequestHandler({ locks: null, ...dependencies });
  }

  postMessage(message: WorkerRequest): void {
    const request = structuredClone(message);
    queueMicrotask(() => {
      if (this.frozen) return;
      void this.handle(request, (response) => this.deliver(response));
    });
  }

  terminate(): void {
    this.terminated = true;
  }

  private deliver(response: WorkerResponse): void {
    if (this.terminated) return;
    this.onmessage?.({
      data: structuredClone(response),
    } as MessageEvent<WorkerResponse>);
  }
}

async function createClient(dependencies: HandlerDependencies = {}) {
  const workers: FakeWorker[] = [];
  const client = await SanitizerClient.create({
    locks: null,
    spawn: () => {
      const worker = new FakeWorker(dependencies);
      workers.push(worker);
      return worker;
    },
  });
  return { client, workers };
}

afterEach(async () => {
  const storage = createIndexedDbStorage();
  await storage.deleteMany(await storage.keys());
});

describe("SanitizerClient", () => {
  it("starts a worker and opens the vault", async () => {
    const { client, workers } = await createClient();

    expect(workers).toHaveLength(1);
    expect(client.backend).toBe("indexeddb");
  });

  it("sanitizes and restores text through the worker", async () => {
    const { client } = await createClient();
    const text = "Ana, DNI 12345678Z, ana@example.com, +34 612 345 678";

    const sanitized = await client.sanitizeText(text);
    const restored = await client.restoreText(sanitized.sanitizedText);

    expect(sanitized.sanitizedText).toBe(
      "Ana, DNI [DNI_1], [EMAIL_1], [PHONE_1]",
    );
    expect(sanitized.detections).toHaveLength(3);
    expect(restored.restoredText).toBe(text);
  });

  it("matches concurrent calls with their own answers", async () => {
    const { client } = await createClient();

    const results = await Promise.all([
      client.sanitizeText("12345678Z"),
      client.sanitizeText("sin datos"),
      client.sanitizeText("ana@example.com"),
    ]);

    expect(results.map((result) => result.sanitizedText)).toEqual([
      "[DNI_1]",
      "sin datos",
      "[EMAIL_1]",
    ]);
  });

  it("processes a file and reports its progress", async () => {
    const { client } = await createClient();
    const progress: number[] = [];
    const file = new File(["dni\n12345678Z\n"], "datos.csv");

    const result = await client.processFile(file, "sanitize", (fraction) =>
      progress.push(fraction),
    );

    expect(result.fileName).toBe("datos.sanitized.csv");
    expect(await result.blob.text()).toBe("dni\n[DNI_1]\n");
    expect(result.detections).toEqual({ DNI: 1 });
    expect(progress.at(-1)).toBe(1);
  });

  it("rejects with the name and message of the worker's error", async () => {
    const { client } = await createClient();

    await expect(
      client.processFile(new File(["x"], "informe.pdf"), "sanitize"),
    ).rejects.toMatchObject({
      name: "UnsupportedFileError",
      message: expect.stringContaining("informe.pdf"),
    });
  });

  it("lists and clears the vault", async () => {
    const { client } = await createClient();
    await client.sanitizeText("12345678Z");

    expect(await client.listEntries()).toEqual([
      { token: "[DNI_1]", type: "DNI", original: "12345678Z" },
    ]);

    await client.clear();

    expect(await client.listEntries()).toEqual([]);
    expect((await client.restoreText("[DNI_1]")).unresolvedTokens).toEqual([
      "[DNI_1]",
    ]);
  });

  it("keeps the vault across a restart, as when a file job is cancelled", async () => {
    const { client, workers } = await createClient();
    await client.sanitizeText("12345678Z y 87654321X");

    const init = await client.restart();

    expect(workers).toHaveLength(2);
    expect(workers[0].terminated).toBe(true);
    expect(init).toEqual({ backend: "indexeddb", entryCount: 2 });
    expect((await client.restoreText("[DNI_2]")).restoredText).toBe(
      "87654321X",
    );
    // Known values keep their token; new ones continue the numbering.
    expect((await client.sanitizeText("12345678Z")).sanitizedText).toBe(
      "[DNI_1]",
    );
    expect((await client.sanitizeText("99999999R")).sanitizedText).toBe(
      "[DNI_3]",
    );
  });

  it("keeps the user terms across a restart", async () => {
    const { client } = await createClient();
    await client.setTerms(["Ana García"]);
    expect((await client.sanitizeText("Ana García")).sanitizedText).toBe(
      "[TERM_1]",
    );

    await client.restart();

    expect((await client.sanitizeText("Ana García")).sanitizedText).toBe(
      "[TERM_1]",
    );
    expect(await client.vaultSize()).toBe(1);
  });

  it("loses the vault on restart when only memory storage is available", async () => {
    const { client } = await createClient({
      openStorage: async () => ({
        storage: createMemoryStorage(),
        backend: "memory",
      }),
    });
    await client.sanitizeText("12345678Z");

    expect(client.backend).toBe("memory");
    expect(await client.restart()).toEqual({
      backend: "memory",
      entryCount: 0,
    });
  });

  it("rejects the calls in flight when it restarts", async () => {
    const { client, workers } = await createClient();
    workers[0].frozen = true;

    const stuck = client.sanitizeText("12345678Z");
    const restarting = client.restart();

    await expect(stuck).rejects.toThrow(SanitizerAbortedError);
    await restarting;
    expect((await client.sanitizeText("12345678Z")).sanitizedText).toBe(
      "[DNI_1]",
    );
  });

  it("rejects the calls in flight when the worker crashes", async () => {
    const { client, workers } = await createClient();
    workers[0].frozen = true;

    const stuck = client.sanitizeText("12345678Z");
    workers[0].onerror?.({ message: "out of memory" } as ErrorEvent);

    await expect(stuck).rejects.toMatchObject({
      name: "SanitizerWorkerError",
      message: "out of memory",
    });
  });

  it("stops the worker and refuses calls once disposed", async () => {
    const { client, workers } = await createClient();
    workers[0].frozen = true;
    const stuck = client.sanitizeText("12345678Z");

    client.dispose();

    expect(workers[0].terminated).toBe(true);
    await expect(stuck).rejects.toThrow(SanitizerAbortedError);
    await expect(client.sanitizeText("x")).rejects.toThrow(
      SanitizerAbortedError,
    );
  });

  it("gives every client its own session and vault", async () => {
    const first = await createClient();
    const second = await createClient();
    await first.client.sanitizeText("12345678Z");

    expect(
      (await second.client.restoreText("[DNI_1]")).unresolvedTokens,
    ).toEqual(["[DNI_1]"]);
    expect((await second.client.sanitizeText("87654321X")).sanitizedText).toBe(
      "[DNI_1]",
    );
    expect((await first.client.restoreText("[DNI_1]")).restoredText).toBe(
      "12345678Z",
    );
  });
});
