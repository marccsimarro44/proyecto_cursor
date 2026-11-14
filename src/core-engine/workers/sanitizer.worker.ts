/**
 * SanitizerWorker: entry point of the dedicated Web Worker that owns the
 * detectors and the vault, keeping heavy work off the UI thread.
 *
 * All logic lives in `handler.ts`; this file only wires it to the worker's
 * message channel. Create the worker through `SanitizerClient`.
 */
import { createRequestHandler } from "./handler";
import type { WorkerRequest, WorkerResponse } from "./protocol";

/** The slice of `DedicatedWorkerGlobalScope` used here (not in the DOM lib). */
interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse): void;
}

const scope = self as unknown as WorkerScope;
const handleRequest = createRequestHandler();

scope.onmessage = (event) => {
  void handleRequest(event.data, (response) => scope.postMessage(response));
};
