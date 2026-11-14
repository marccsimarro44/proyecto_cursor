import { processFile } from "../files/process-file";
import { Sanitizer } from "../sanitizer";
import {
  browserLocks,
  purgeStaleSessions,
  type SessionLocks,
} from "../vault/session";
import { openVaultStorage } from "../vault/storage";
import { Vault } from "../vault/vault";
import type {
  SanitizerApi,
  SanitizerMethod,
  WorkerRequest,
  WorkerResponse,
} from "./protocol";

/** A request arrived before `init` completed. */
export class NotInitializedError extends Error {
  override name = "NotInitializedError";

  constructor() {
    super("The sanitizer worker must be initialized before use.");
  }
}

export interface HandlerDependencies {
  /** Defaults to IndexedDB with an in-memory fallback. */
  openStorage?: typeof openVaultStorage;
  /** Defaults to `navigator.locks`; `null` disables stale-session cleanup. */
  locks?: SessionLocks | null;
}

type Handlers = {
  [Method in SanitizerMethod]: (
    params: SanitizerApi[Method]["params"],
    onProgress: (fraction: number) => void,
  ) => Promise<SanitizerApi[Method]["result"]>;
};

/**
 * Builds the function that serves the worker's requests.
 *
 * It lives apart from the worker entry point so the whole request flow can
 * run, and be tested, in any JavaScript context. Requests may overlap: a
 * text can be sanitized while a file job is in progress.
 */
export function createRequestHandler(dependencies: HandlerDependencies = {}) {
  const openStorage = dependencies.openStorage ?? openVaultStorage;
  const locks =
    dependencies.locks === undefined
      ? browserLocks()
      : (dependencies.locks ?? undefined);

  let engine: { vault: Vault; sanitizer: Sanitizer } | undefined;

  function ready() {
    if (engine === undefined) throw new NotInitializedError();
    return engine;
  }

  const handlers: Handlers = {
    async init({ sessionId, key }) {
      const { storage, backend } = await openStorage();
      await purgeStaleSessions(storage, locks, sessionId);
      const vault = await Vault.open({ sessionId, key, storage });
      engine = { vault, sanitizer: new Sanitizer(vault) };
      return { backend, entryCount: vault.size };
    },

    async sanitizeText({ text }) {
      const { vault, sanitizer } = ready();
      const result = sanitizer.sanitize(text);
      await vault.flush();
      return result;
    },

    async restoreText({ text }) {
      return ready().sanitizer.restore(text);
    },

    async processFile({ file, fileName, mode }, onProgress) {
      const { vault, sanitizer } = ready();
      return processFile(sanitizer, {
        file,
        fileName,
        mode,
        onProgress,
        afterChunk: () => vault.flush(),
      });
    },

    async setTerms({ terms }) {
      ready().sanitizer.setTerms(terms);
      return undefined;
    },

    async listEntries() {
      return ready().vault.entries();
    },

    async vaultSize() {
      return ready().vault.size;
    },

    async clear() {
      await ready().vault.clear();
      return undefined;
    },
  };

  return async function handleRequest(
    request: WorkerRequest,
    post: (response: WorkerResponse) => void,
  ): Promise<void> {
    const { id } = request;
    try {
      // The request union guarantees `params` matches `method`.
      const handler = handlers[request.method] as (
        params: unknown,
        onProgress: (fraction: number) => void,
      ) => Promise<SanitizerApi[SanitizerMethod]["result"]>;

      const result = await handler(request.params, (fraction) =>
        post({ id, type: "progress", fraction }),
      );
      post({ id, type: "result", result });
    } catch (error) {
      post({
        id,
        type: "error",
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : { name: "Error", message: String(error) },
      });
    }
  };
}
