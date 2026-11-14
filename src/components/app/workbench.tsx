"use client";

import {
  CopyIcon,
  EyeOffIcon,
  KeyRoundIcon,
  LockIcon,
  SparklesIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { RestoreResult, SanitizeResult } from "@/core-engine/types";
import { ENTITY_LABELS, countByType, sortedCounts } from "@/lib/format";
import { FilePanel } from "./file-panel";
import { TermsPanel } from "./terms-panel";
import { TokenText } from "./token-text";
import { useSanitizer } from "./use-sanitizer";

const DEBOUNCE_MS = 200;
const TERMS_DEBOUNCE_MS = 400;

const EXAMPLE_TEXT =
  "Hola, soy Ana García Ruiz (DNI 12345678Z) y te escribo por la factura de Construcciones Levante S.L. (CIF B12345674). " +
  "Pagadla a la cuenta ES91 2100 0418 4502 0005 1332. " +
  "Si hay dudas, escríbeme a ana.garcia@example.com o llámame al +34 612 345 678.";
const EXAMPLE_TERMS = "Ana García Ruiz\nConstrucciones Levante S.L.";

function termList(raw: string): string[] {
  return raw.split("\n").map((line) => line.trim());
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copiado al portapapeles");
  } catch {
    toast.error("No se pudo copiar. Selecciona el texto y cópialo a mano.");
  }
}

function Output({
  children,
  placeholder,
}: {
  children: React.ReactNode;
  placeholder: string;
}) {
  return (
    <div
      aria-live="polite"
      className="border-input bg-muted/30 min-h-48 w-full overflow-auto rounded-lg border px-2.5 py-2 font-mono text-sm break-words whitespace-pre-wrap md:max-h-96"
    >
      {children ?? <span className="text-muted-foreground">{placeholder}</span>}
    </div>
  );
}

export function Workbench() {
  const engine = useSanitizer();
  const client = engine.status === "ready" ? engine.client : undefined;

  const [tab, setTab] = useState<string>("protect");
  const [source, setSource] = useState("");
  const [terms, setTerms] = useState("");
  const [response, setResponse] = useState("");
  const [latestProtected, setProtectedResult] = useState<SanitizeResult>();
  const [latestRestored, setRestored] = useState<RestoreResult>();
  const [vaultSize, setVaultSize] = useState(0);
  /** Bumped whenever earlier results are outdated and must be recomputed. */
  const [version, setVersion] = useState(0);
  const [failure, setFailure] = useState<string>();

  const sequence = useRef(0);

  const refreshVault = useCallback(() => {
    client?.vaultSize().then(setVaultSize, () => undefined);
  }, [client]);

  // Terms first: the worker handles messages in order, so a text sent after
  // `setTerms` is always checked against the new list.
  useEffect(() => {
    if (!client) return;
    const timer = setTimeout(() => {
      client.setTerms(termList(terms)).then(
        () => setVersion((current) => current + 1),
        () => undefined,
      );
    }, TERMS_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [client, terms]);

  // Live protection of the text on the left.
  useEffect(() => {
    if (!client) return;
    const current = ++sequence.current; // Also drops any answer in flight.
    if (source.trim() === "") return;
    const timer = setTimeout(() => {
      client.sanitizeText(source).then(
        (result) => {
          if (current !== sequence.current) return;
          setProtectedResult(result);
          setFailure(undefined);
          refreshVault();
        },
        (error: unknown) => {
          if (current === sequence.current && !isAborted(error)) {
            setFailure(error instanceof Error ? error.message : String(error));
          }
        },
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [client, source, version, refreshVault]);

  // Restoring the AI's answer.
  const restoreSequence = useRef(0);
  useEffect(() => {
    if (!client) return;
    const current = ++restoreSequence.current;
    if (response.trim() === "") return;
    const timer = setTimeout(() => {
      client.restoreText(response).then(
        (result) => {
          if (current === restoreSequence.current) setRestored(result);
        },
        () => undefined,
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [client, response, version]);

  // Closing the tab destroys the key, and with it the way back.
  useEffect(() => {
    if (vaultSize === 0) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [vaultSize]);

  async function clearVault() {
    if (!client) return;
    await client.clear();
    setVaultSize(0);
    setProtectedResult(undefined);
    setRestored(undefined);
    setVersion((current) => current + 1);
    toast.success(
      "Bóveda borrada. Los marcadores anteriores ya no se pueden restaurar.",
    );
  }

  function loadExample() {
    setTab("protect");
    setTerms(EXAMPLE_TERMS);
    setSource(EXAMPLE_TEXT);
  }

  if (engine.status === "error") {
    return (
      <Card>
        <CardContent role="alert" className="flex gap-3">
          <TriangleAlertIcon
            className="text-destructive size-5 shrink-0"
            aria-hidden="true"
          />
          <div className="text-sm">
            <p className="font-medium">
              Tu navegador no puede ejecutar el motor de PromptShield.
            </p>
            <p className="text-muted-foreground mt-1">
              Necesita Web Workers y cifrado WebCrypto, disponibles en las
              versiones actuales de Chrome, Edge, Firefox y Safari. Detalle:{" "}
              {engine.message}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // An emptied box shows nothing, whatever the last answer was.
  const protectedResult = source.trim() === "" ? undefined : latestProtected;
  const restored = response.trim() === "" ? undefined : latestRestored;
  const counts = protectedResult ? countByType(protectedResult.detections) : {};
  const total = protectedResult?.detections.length ?? 0;

  return (
    <Card id="herramienta" className="scroll-mt-20">
      <CardContent className="flex flex-col gap-5">
        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="protect">
                <EyeOffIcon /> Proteger
              </TabsTrigger>
              <TabsTrigger value="restore">
                <KeyRoundIcon /> Restaurar
              </TabsTrigger>
            </TabsList>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadExample}
              disabled={!client}
            >
              <SparklesIcon /> Probar con un ejemplo
            </Button>
          </div>

          <TabsContent value="protect" className="mt-4 flex flex-col gap-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="source" className="text-sm font-medium">
                  Tu texto, con los datos reales
                </label>
                <Textarea
                  id="source"
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                  placeholder="Pega aquí el texto que vas a enviar a ChatGPT o Claude…"
                  className="min-h-48 font-mono md:max-h-96"
                  spellCheck={false}
                />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    Texto protegido: esto es lo que envías
                  </span>
                  <Button
                    size="sm"
                    disabled={!protectedResult}
                    onClick={() =>
                      protectedResult && copy(protectedResult.sanitizedText)
                    }
                  >
                    <CopyIcon /> Copiar
                  </Button>
                </div>
                <Output placeholder="Aquí aparecerá tu texto sin datos personales.">
                  {protectedResult && (
                    <TokenText text={protectedResult.sanitizedText} />
                  )}
                </Output>
                <div
                  className="flex min-h-6 flex-wrap gap-1.5"
                  aria-live="polite"
                >
                  {protectedResult &&
                    (total === 0 ? (
                      <Badge variant="secondary">
                        No se detectó ningún dato. Revisa los nombres abajo.
                      </Badge>
                    ) : (
                      sortedCounts(counts).map(([type, count]) => (
                        <Badge key={type} variant="secondary">
                          {count} {ENTITY_LABELS[type]}
                        </Badge>
                      ))
                    ))}
                </div>
              </div>
            </div>

            <TermsPanel value={terms} onChange={setTerms} />

            {failure && (
              <p role="alert" className="text-destructive text-sm">
                {failure}
              </p>
            )}

            {client && (
              <FilePanel
                client={client}
                mode="sanitize"
                onFinished={refreshVault}
              />
            )}
          </TabsContent>

          <TabsContent value="restore" className="mt-4 flex flex-col gap-5">
            <p className="text-muted-foreground text-sm">
              Pega la respuesta de la IA tal como te la dio, con sus marcadores
              como <code className="font-mono">[DNI_1]</code>, y recuperas los
              datos reales. Solo funciona con los marcadores creados en esta
              pestaña.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="response" className="text-sm font-medium">
                  Respuesta de la IA
                </label>
                <Textarea
                  id="response"
                  value={response}
                  onChange={(event) => setResponse(event.target.value)}
                  placeholder="Pega aquí la respuesta que contiene marcadores…"
                  className="min-h-48 font-mono md:max-h-96"
                  spellCheck={false}
                />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Texto restaurado</span>
                  <Button
                    size="sm"
                    disabled={!restored}
                    onClick={() => restored && copy(restored.restoredText)}
                  >
                    <CopyIcon /> Copiar
                  </Button>
                </div>
                <Output placeholder="Aquí aparecerá la respuesta con tus datos reales.">
                  {restored && restored.restoredText}
                </Output>
                <div
                  className="flex min-h-6 flex-wrap gap-1.5"
                  aria-live="polite"
                >
                  {restored && (
                    <Badge variant="secondary">
                      {restored.restoredCount} valores restaurados
                    </Badge>
                  )}
                  {restored && restored.unresolvedTokens.length > 0 && (
                    <Badge variant="destructive">
                      Sin origen: {restored.unresolvedTokens.join(", ")}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            {client && (
              <FilePanel
                client={client}
                mode="restore"
                onFinished={refreshVault}
              />
            )}
          </TabsContent>
        </Tabs>

        <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <LockIcon className="text-primary size-4" aria-hidden="true" />
            <span>
              Bóveda cifrada:{" "}
              <strong className="tabular-nums">
                {vaultSize.toLocaleString("es-ES")}
              </strong>{" "}
              {vaultSize === 1 ? "valor" : "valores"}
            </span>
            {client && client.backend === "memory" && (
              <Badge variant="outline">solo memoria</Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground hidden text-xs sm:inline">
              Si cierras o recargas la pestaña, la clave se destruye.
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={vaultSize === 0}
              onClick={clearVault}
            >
              <Trash2Icon /> Borrar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function isAborted(error: unknown): boolean {
  return error instanceof Error && error.name === "SanitizerAbortedError";
}
