import type {
  FileMode,
  FileResult,
  RestoreResult,
  SanitizeResult,
  VaultEntry,
} from "../types";
import type { VaultSession } from "../vault/session";
import type { VaultStorageBackend } from "../vault/storage";

/** What the worker reports once its vault is open. */
export interface InitResult {
  /**
   * Where encrypted entries are kept. With `"memory"` (IndexedDB missing or
   * blocked) the vault is lost if the worker is restarted.
   */
  backend: VaultStorageBackend;
  /** Entries recovered from storage; non-zero after a worker restart. */
  entryCount: number;
}

/** Every operation the sanitizer worker offers, with its input and output. */
export interface SanitizerApi {
  /** Must be the first call. Opens the vault of the page's session. */
  init: { params: VaultSession; result: InitResult };
  sanitizeText: { params: { text: string }; result: SanitizeResult };
  restoreText: { params: { text: string }; result: RestoreResult };
  /** Emits progress messages while it runs. */
  processFile: {
    params: { file: Blob; fileName: string; mode: FileMode };
    result: FileResult;
  };
  /** Replaces the user's list of names and phrases to hide. */
  setTerms: { params: { terms: string[] }; result: undefined };
  /** Turns name guessing on or off; `ignored` are values not to hide. */
  setNameDetection: {
    params: { enabled: boolean; ignored: string[] };
    result: undefined;
  };
  listEntries: { params: undefined; result: VaultEntry[] };
  /** Number of distinct values in the vault, without copying them. */
  vaultSize: { params: undefined; result: number };
  /** Forgets every entry and deletes the session's stored records. */
  clear: { params: undefined; result: undefined };
}

export type SanitizerMethod = keyof SanitizerApi;

/** Message from the page to the worker. `id` pairs it with its responses. */
export type WorkerRequest = {
  [Method in SanitizerMethod]: {
    id: number;
    method: Method;
    params: SanitizerApi[Method]["params"];
  };
}[SanitizerMethod];

/** An error as it crosses the worker boundary. */
export interface SerializedError {
  name: string;
  message: string;
}

/**
 * Message from the worker to the page. A request gets any number of
 * `progress` messages followed by exactly one `result` or `error`.
 */
export type WorkerResponse =
  | { id: number; type: "progress"; fraction: number }
  | {
      id: number;
      type: "result";
      result: SanitizerApi[SanitizerMethod]["result"];
    }
  | { id: number; type: "error"; error: SerializedError };
