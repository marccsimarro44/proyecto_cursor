"use client";

import {
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  Loader2Icon,
  LockIcon,
  ShieldCheckIcon,
  SparklesIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsIndicator,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type {
  PiiEntityType,
  RestoreResult,
  SanitizeResult,
} from "@/core-engine/types";
import { entityStyle } from "@/lib/entity-style";
import { ENTITY_LABELS, countByType, sortedCounts } from "@/lib/format";
import { AnimatedNumber } from "./animated-number";
import { CopyButton } from "./copy-button";
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

/** A framed, scrollable result area with a scanner line while it is working. */
function Output({
  children,
  placeholder,
  busy,
}: {
  children: React.ReactNode;
  placeholder: string;
  busy: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/8 bg-black/25">
      <div
        aria-live="polite"
        aria-busy={busy}
        className="min-h-52 w-full overflow-auto px-3 py-2.5 font-mono text-sm leading-7 break-words whitespace-pre-wrap md:max-h-96"
      >
        {children ?? (
          <span className="text-muted-foreground/80 flex h-40 flex-col items-center justify-center gap-2 text-center font-sans whitespace-normal">
            <ShieldCheckIcon className="size-6 opacity-50" aria-hidden="true" />
            {placeholder}
          </span>
        )}
      </div>
      {busy && <div className="scanner" aria-hidden="true" />}
    </div>
  );
}

/** A count of one kind of data, colored like its markers in the text. */
function EntityChip({ type, count }: { type: PiiEntityType; count: number }) {
  return (
    <span
      style={entityStyle(type)}
      className="tok animate-in fade-in zoom-in-90 inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium duration-300"
    >
      <span className="tok-dot size-1.5 rounded-full" aria-hidden="true" />
      <span className="tabular-nums">{count.toLocaleString("es-ES")}</span>
      {ENTITY_LABELS[type]}
    </span>
  );
}

function PaneLabel({
  icon: Icon,
  title,
  tone = "muted",
  aside,
}: {
  icon: typeof EyeIcon;
  title: string;
  tone?: "muted" | "primary";
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex h-7 items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-sm font-medium">
        <Icon
          className={
            tone === "primary"
              ? "text-primary size-4"
              : "text-muted-foreground size-4"
          }
          aria-hidden="true"
        />
        {title}
      </span>
      {aside}
    </div>
  );
}

function EngineStatus({ status }: { status: "loading" | "ready" | "error" }) {
  if (status === "loading") {
    return (
      <span className="text-muted-foreground flex items-center gap-2 text-xs">
        <Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />
        Iniciando el motor…
      </span>
    );
  }
  return (
    <span className="text-muted-foreground flex items-center gap-2 text-xs">
      <span
        className="live-dot bg-primary size-2 rounded-full"
        aria-hidden="true"
      />
      Motor local activo
      <span className="hidden text-white/25 sm:inline">·</span>
      <span className="hidden sm:inline">0 bytes enviados</span>
    </span>
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
  const [elapsedMs, setElapsedMs] = useState<number>();
  const [protecting, setProtecting] = useState(false);
  const [restoring, setRestoring] = useState(false);
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
      const startedAt = performance.now();
      setProtecting(true);
      client.sanitizeText(source).then(
        (result) => {
          if (current !== sequence.current) return;
          setProtectedResult(result);
          setElapsedMs(performance.now() - startedAt);
          setFailure(undefined);
          setProtecting(false);
          refreshVault();
        },
        (error: unknown) => {
          if (current !== sequence.current) return;
          setProtecting(false);
          if (!isAborted(error)) {
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
      setRestoring(true);
      client.restoreText(response).then(
        (result) => {
          if (current !== restoreSequence.current) return;
          setRestored(result);
          setRestoring(false);
        },
        () => {
          if (current === restoreSequence.current) setRestoring(false);
        },
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
    <div
      id="herramienta"
      className="surface ring-gradient scroll-mt-20 rounded-2xl"
    >
      <div className="flex flex-col gap-5 p-4 sm:p-6">
        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <TabsList className="bg-black/30 p-1 ring-1 ring-white/8 group-data-horizontal/tabs:h-10">
                <TabsIndicator className="bg-white/10 shadow-sm ring-1 ring-white/10" />
                <TabsTrigger
                  value="protect"
                  className="z-10 px-3.5 data-active:bg-transparent dark:data-active:border-transparent dark:data-active:bg-transparent"
                >
                  <EyeOffIcon /> Proteger
                </TabsTrigger>
                <TabsTrigger
                  value="restore"
                  className="z-10 px-3.5 data-active:bg-transparent dark:data-active:border-transparent dark:data-active:bg-transparent"
                >
                  <KeyRoundIcon /> Restaurar
                </TabsTrigger>
              </TabsList>
              <EngineStatus status={engine.status} />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadExample}
              disabled={!client}
            >
              <SparklesIcon className="text-primary" /> Probar con un ejemplo
            </Button>
          </div>

          <TabsContent
            value="protect"
            className="animate-in fade-in slide-in-from-bottom-1 mt-5 flex flex-col gap-5 duration-300"
          >
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="flex flex-col gap-2">
                <PaneLabel
                  icon={EyeIcon}
                  title="Tu texto, con los datos reales"
                  aside={
                    source.length > 0 && (
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {source.length.toLocaleString("es-ES")} caracteres
                      </span>
                    )
                  }
                />
                <Textarea
                  id="source"
                  aria-label="Tu texto, con los datos reales"
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                  placeholder="Pega aquí el texto que vas a enviar a ChatGPT o Claude…"
                  className="min-h-52 rounded-xl border-white/8 bg-black/25 py-2.5 font-mono leading-7 md:max-h-96 dark:bg-black/25"
                  spellCheck={false}
                />
              </div>
              <div className="flex flex-col gap-2">
                <PaneLabel
                  icon={EyeOffIcon}
                  tone="primary"
                  title="Protegido: esto es lo que envías"
                  aside={
                    <CopyButton
                      disabled={!protectedResult}
                      getText={() => protectedResult?.sanitizedText}
                    />
                  }
                />
                <Output
                  busy={protecting && source.trim() !== ""}
                  placeholder="Aquí aparecerá tu texto sin datos personales."
                >
                  {protectedResult && (
                    <TokenText text={protectedResult.sanitizedText} />
                  )}
                </Output>
                <div
                  className="flex min-h-6 flex-wrap items-center gap-1.5"
                  aria-live="polite"
                >
                  {protectedResult &&
                    (total === 0 ? (
                      <Badge variant="secondary">
                        No se detectó ningún dato. Revisa los nombres abajo.
                      </Badge>
                    ) : (
                      <>
                        {sortedCounts(counts).map(([type, count]) => (
                          <EntityChip key={type} type={type} count={count} />
                        ))}
                        {elapsedMs !== undefined && (
                          <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                            {total.toLocaleString("es-ES")}{" "}
                            {total === 1
                              ? "dato protegido"
                              : "datos protegidos"}{" "}
                            en {Math.max(1, Math.round(elapsedMs))} ms
                          </span>
                        )}
                      </>
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

          <TabsContent
            value="restore"
            className="animate-in fade-in slide-in-from-bottom-1 mt-5 flex flex-col gap-5 duration-300"
          >
            <p className="text-muted-foreground text-sm text-pretty">
              Pega la respuesta de la IA tal como te la dio, con sus marcadores
              como <code className="font-mono">[DNI_1]</code>, y recuperas los
              datos reales. Solo funciona con los marcadores creados en esta
              pestaña.
            </p>
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="flex flex-col gap-2">
                <PaneLabel icon={EyeOffIcon} title="Respuesta de la IA" />
                <Textarea
                  id="response"
                  aria-label="Respuesta de la IA"
                  value={response}
                  onChange={(event) => setResponse(event.target.value)}
                  placeholder="Pega aquí la respuesta que contiene marcadores…"
                  className="min-h-52 rounded-xl border-white/8 bg-black/25 py-2.5 font-mono leading-7 md:max-h-96 dark:bg-black/25"
                  spellCheck={false}
                />
              </div>
              <div className="flex flex-col gap-2">
                <PaneLabel
                  icon={EyeIcon}
                  tone="primary"
                  title="Texto restaurado"
                  aside={
                    <CopyButton
                      disabled={!restored}
                      getText={() => restored?.restoredText}
                    />
                  }
                />
                <Output
                  busy={restoring && response.trim() !== ""}
                  placeholder="Aquí aparecerá la respuesta con tus datos reales."
                >
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

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/20 px-4 py-3 text-sm">
          <div className="flex items-center gap-2.5">
            <span className="bg-primary/12 text-primary grid size-7 place-items-center rounded-lg">
              <LockIcon className="size-3.5" aria-hidden="true" />
            </span>
            <span>
              Bóveda cifrada:{" "}
              <strong className="tabular-nums">
                <AnimatedNumber value={vaultSize} />
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
      </div>
    </div>
  );
}

function isAborted(error: unknown): boolean {
  return error instanceof Error && error.name === "SanitizerAbortedError";
}
