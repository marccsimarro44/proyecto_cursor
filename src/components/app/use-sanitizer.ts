"use client";

import { useEffect, useState } from "react";
import { SanitizerClient } from "@/core-engine/workers/client";

export type EngineState =
  | { status: "loading" }
  | { status: "ready"; client: SanitizerClient }
  | { status: "error"; message: string };

/**
 * Starts the sanitizer worker for as long as the calling component is
 * mounted. The vault session lives exactly as long as the client does.
 */
export function useSanitizer(): EngineState {
  const [state, setState] = useState<EngineState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    let created: SanitizerClient | undefined;

    SanitizerClient.create().then(
      (client) => {
        if (cancelled) {
          client.dispose();
          return;
        }
        created = client;
        setState({ status: "ready", client });
      },
      (error: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      },
    );

    return () => {
      cancelled = true;
      created?.dispose();
    };
  }, []);

  return state;
}
