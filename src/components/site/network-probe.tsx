"use client";

import {
  CheckCircle2Icon,
  Loader2Icon,
  RadioTowerIcon,
  ShieldAlertIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Probe =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "blocked"; directive: string }
  | { status: "open" };

/**
 * The privacy claim, testable by the visitor. It tries to open a connection
 * and reports what the browser did. When the page's policy is active the
 * request is refused before leaving the device; the console shows the
 * refusal, which is the proof.
 */
export function NetworkProbe() {
  const [probe, setProbe] = useState<Probe>({ status: "idle" });
  const violation = useRef<string>(undefined);

  async function run() {
    setProbe({ status: "checking" });
    violation.current = undefined;
    const onViolation = (event: SecurityPolicyViolationEvent) => {
      violation.current = event.violatedDirective;
    };
    document.addEventListener("securitypolicyviolation", onViolation);

    let outcome: Probe;
    try {
      // Same origin on purpose: nothing leaves for a third party, and
      // `connect-src 'none'` still refuses it.
      await fetch(window.location.href, { method: "HEAD", cache: "no-store" });
      outcome = { status: "open" };
    } catch {
      // The violation event is queued a moment after the rejection.
      await new Promise((resolve) => setTimeout(resolve, 60));
      outcome = {
        status: "blocked",
        directive: violation.current ?? "connect-src",
      };
    } finally {
      document.removeEventListener("securitypolicyviolation", onViolation);
    }
    // Long enough to read as a test, not a flash.
    await new Promise((resolve) => setTimeout(resolve, 350));
    setProbe(outcome);
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-medium">
          <RadioTowerIcon className="text-primary size-4" aria-hidden="true" />
          Prueba en vivo
        </p>
        <p
          aria-live="polite"
          className="text-muted-foreground mt-1 text-sm text-pretty"
        >
          {probe.status === "idle" &&
            "Intenta abrir una conexión desde esta misma página y comprueba qué hace tu navegador."}
          {probe.status === "checking" && "Intentando conectar…"}
          {probe.status === "blocked" && (
            <span className="text-primary flex items-start gap-1.5">
              <CheckCircle2Icon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                Conexión rechazada por tu navegador (
                <code className="font-mono text-xs">{probe.directive}</code>).
                Verás el aviso en rojo en la consola: esa es la prueba.
              </span>
            </span>
          )}
          {probe.status === "open" && (
            <span className="text-pii flex items-start gap-1.5">
              <ShieldAlertIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                Esta copia no tiene la política de seguridad activa (por
                ejemplo, un servidor de desarrollo). En la web publicada, la
                conexión se rechaza.
              </span>
            </span>
          )}
        </p>
      </div>
      <Button
        variant="outline"
        onClick={run}
        disabled={probe.status === "checking"}
        className="shrink-0"
      >
        {probe.status === "checking" ? (
          <Loader2Icon className="animate-spin" />
        ) : (
          <RadioTowerIcon />
        )}
        {probe.status === "idle" ? "Probar ahora" : "Repetir prueba"}
      </Button>
    </div>
  );
}
