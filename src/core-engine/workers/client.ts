import type {
  FileMode,
  FileResult,
  RestoreResult,
  SanitizeResult,
  VaultEntry,
} from "../types";
import {
  browserLocks,
  createVaultSession,
  type SessionLocks,
  type VaultSession,
} from "../vault/session";
import type { VaultStorageBackend } from "../vault/storage";
import type {
  InitResult,
  SanitizerApi,
  SanitizerMethod,
  WorkerRequest,
  WorkerResponse,
} from "./protocol";

/** The part of the `Worker` interface the client depends on. */
export interface WorkerLike {
  postMessage(message: WorkerRequest): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

/** The call was dropped because the worker was restarted or disposed. */
export class SanitizerAbortedError extends Error {
  override name = "SanitizerAbortedError";
}

/** The worker failed. `name` carries the name of the original error. */
export class SanitizerWorkerError extends Error {
  constructor(name: string, message: string) {
    super(message);
    this.name = name;
  }
}

export interface SanitizerClientOptions {
  /** Creates the worker. Defaults to the bundled `sanitizer.worker.ts`. */
  spawn?: () => WorkerLike;
  /** Defaults to `navigator.locks`; `null` skips the session lock. */
  locks?: SessionLocks | null;
}

interface PendingCall {
  resolve: (result: never) => void;
  reject: (error: Error) => void;
  onProgress?: (fraction: number) => void;
}

function spawnSanitizerWorker(): WorkerLike {
  return new Worker(new URL("./sanitizer.worker.ts", import.meta.url), {
    type: "module",
  });
}

/**
 * Promise-based access to the sanitizer worker from the page.
 *
 * The client owns the vault session: it creates the encryption key, keeps
 * it in memory only, and hands it to each worker it starts. The dictionary
 * of original values itself never lives on the UI thread. Because the key
 * dies with the page, nothing stored by a session can be read afterwards.
 */
export class SanitizerClient {
  private worker: WorkerLike;
  private nextId = 1;
  private disposed = false;
  private storageBackend: VaultStorageBackend = "memory";
  private readonly pending = new Map<number, PendingCall>();

  private constructor(
    private readonly session: VaultSession,
    private readonly spawn: () => WorkerLike,
  ) {
    this.worker = this.start();
  }

  /** Starts a session and a worker, and waits until the vault is open. */
  static async create(
    options: SanitizerClientOptions = {},
  ): Promise<SanitizerClient> {
    const locks =
      options.locks === undefined
        ? browserLocks()
        : (options.locks ?? undefined);
    const session = await createVaultSession(locks);
    const client = new SanitizerClient(
      session,
      options.spawn ?? spawnSanitizerWorker,
    );
    await client.initialize();
    return client;
  }

  /**
   * Where the worker keeps the encrypted vault. With `"memory"` the vault
   * does not survive {@link restart}.
   */
  get backend(): VaultStorageBackend {
    return this.storageBackend;
  }

  /** Replaces the personal data in `text` with reversible tokens. */
  sanitizeText(text: string): Promise<SanitizeResult> {
    return this.call("sanitizeText", { text });
  }

  /** Puts the original values back in a text that contains tokens. */
  restoreText(text: string): Promise<RestoreResult> {
    return this.call("restoreText", { text });
  }

  /**
   * Sanitizes or restores a file. `onProgress` receives the fraction done,
   * from 0 to 1. To cancel a running job, call {@link restart}.
   */
  processFile(
    file: File,
    mode: FileMode,
    onProgress?: (fraction: number) => void,
  ): Promise<FileResult> {
    return this.call(
      "processFile",
      { file, fileName: file.name, mode },
      onProgress,
    );
  }

  /** Every token of the session with its original value. */
  listEntries(): Promise<VaultEntry[]> {
    return this.call("listEntries", undefined);
  }

  /** Forgets every token and deletes the session's stored records. */
  async clear(): Promise<void> {
    await this.call("clear", undefined);
  }

  /**
   * Terminates the worker, which is the only way to stop a job that is
   * running, and starts a new one on the same session. Calls in flight
   * reject with {@link SanitizerAbortedError}. The new worker reloads the
   * vault from encrypted storage, so tokens issued before still restore;
   * with the `"memory"` backend there is nothing to reload and they are lost.
   */
  async restart(): Promise<InitResult> {
    this.stop("The sanitizer worker was restarted.");
    this.worker = this.start();
    return this.initialize();
  }

  /** Terminates the worker for good. Later calls reject. */
  dispose(): void {
    this.disposed = true;
    this.stop("The sanitizer was disposed.");
  }

  private async initialize(): Promise<InitResult> {
    const result = await this.call("init", this.session);
    this.storageBackend = result.backend;
    return result;
  }

  private start(): WorkerLike {
    const worker = this.spawn();

    worker.onmessage = ({ data }) => {
      const call = this.pending.get(data.id);
      if (call === undefined) return;

      if (data.type === "progress") {
        call.onProgress?.(data.fraction);
        return;
      }
      this.pending.delete(data.id);
      if (data.type === "result") {
        call.resolve(data.result as never);
      } else {
        call.reject(
          new SanitizerWorkerError(data.error.name, data.error.message),
        );
      }
    };

    // The worker script failed to load or threw outside a request.
    worker.onerror = (event) => {
      this.rejectAll(
        new SanitizerWorkerError(
          "SanitizerWorkerError",
          event.message || "The sanitizer worker crashed.",
        ),
      );
    };

    return worker;
  }

  private stop(reason: string): void {
    this.worker.terminate();
    this.rejectAll(new SanitizerAbortedError(reason));
  }

  private rejectAll(error: Error): void {
    for (const call of this.pending.values()) call.reject(error);
    this.pending.clear();
  }

  private call<Method extends SanitizerMethod>(
    method: Method,
    params: SanitizerApi[Method]["params"],
    onProgress?: (fraction: number) => void,
  ): Promise<SanitizerApi[Method]["result"]> {
    if (this.disposed) {
      return Promise.reject(
        new SanitizerAbortedError("The sanitizer was disposed."),
      );
    }

    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject, onProgress });
      this.worker.postMessage({ id, method, params } as WorkerRequest);
    });
  }
}
