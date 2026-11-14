"use client";

import {
  CircleCheckIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  TriangleAlertIcon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import type { FileMode, FileResult } from "@/core-engine/types";
import type { SanitizerClient } from "@/core-engine/workers/client";
import { entityStyle } from "@/lib/entity-style";
import { ENTITY_LABELS, formatBytes, sortedCounts } from "@/lib/format";

/** Spreadsheets are loaded whole into memory, so they get a hard ceiling. */
const MAX_SPREADSHEET_BYTES = 40 * 1024 * 1024;
const ACCEPT =
  ".csv,.tsv,.txt,.json,.jsonl,.ndjson,.md,.xml,.html,.sql,.log,.yaml,.yml,.xlsx,.xls";

/** Throughput estimates are noise before this much of the file is done. */
const MIN_FRACTION_FOR_ESTIMATE = 0.04;

type JobState =
  | { status: "idle" }
  | {
      status: "working";
      fileName: string;
      fraction: number;
      /** Bytes per second and seconds left, once there is enough to tell. */
      speed?: number;
      secondsLeft?: number;
    }
  | {
      status: "done";
      sourceName: string;
      result: FileResult;
      downloadUrl: string;
      seconds: number;
    }
  | { status: "error"; message: string };

interface FilePanelProps {
  client: SanitizerClient;
  mode: FileMode;
  /** Called after a job finishes, so the page can refresh the vault count. */
  onFinished: () => void;
}

function isSheet(name: string): boolean {
  return /\.xlsx?$/i.test(name);
}

function formatSeconds(seconds: number): string {
  if (seconds < 1) return "menos de 1 s";
  if (seconds < 60) return `${Math.ceil(seconds)} s`;
  return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
}

export function FilePanel({ client, mode, onFinished }: FilePanelProps) {
  const [job, setJob] = useState<JobState>({ status: "idle" });
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  /** Object URL of the result on screen, freed when replaced or unmounted. */
  const currentUrl = useRef<string>(undefined);

  useEffect(() => {
    return () => {
      if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
    };
  }, []);

  function releaseUrl() {
    if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
    currentUrl.current = undefined;
  }

  async function run(file: File) {
    releaseUrl();
    if (isSheet(file.name) && file.size > MAX_SPREADSHEET_BYTES) {
      setJob({
        status: "error",
        message: `Las hojas de cálculo se cargan enteras en memoria y ${file.name} pesa ${formatBytes(file.size)}. Expórtala a CSV, que se procesa por partes sin límite práctico.`,
      });
      return;
    }

    const startedAt = performance.now();
    setJob({ status: "working", fileName: file.name, fraction: 0 });
    try {
      const result = await client.processFile(file, mode, (fraction) => {
        const seconds = (performance.now() - startedAt) / 1000;
        const measurable = fraction >= MIN_FRACTION_FOR_ESTIMATE && seconds > 0;
        setJob((current) =>
          current.status === "working"
            ? {
                ...current,
                fraction,
                speed: measurable
                  ? (file.size * fraction) / seconds
                  : undefined,
                secondsLeft: measurable
                  ? (seconds / fraction) * (1 - fraction)
                  : undefined,
              }
            : current,
        );
      });
      currentUrl.current = URL.createObjectURL(result.blob);
      setJob({
        status: "done",
        sourceName: file.name,
        result,
        downloadUrl: currentUrl.current,
        seconds: (performance.now() - startedAt) / 1000,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "SanitizerAbortedError") {
        setJob({ status: "idle" });
      } else {
        setJob({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    } finally {
      onFinished();
    }
  }

  async function cancel() {
    // Terminating the worker is the only way to stop a running job. The
    // vault is reloaded from encrypted storage, so nothing is lost.
    await client.restart();
    onFinished();
  }

  function pick(files: FileList | null) {
    const file = files?.[0];
    if (file) void run(file);
    if (input.current) input.current.value = "";
  }

  const working = job.status === "working";

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!working) pick(event.dataTransfer.files);
        }}
        className={`group relative flex flex-col items-center gap-3 overflow-hidden rounded-xl border border-dashed p-7 text-center transition-all duration-300 ${
          dragging
            ? "border-primary bg-primary/8 scale-[1.01] shadow-[0_0_0_4px_oklch(0.86_0.19_155/10%),0_0_40px_-8px_oklch(0.86_0.19_155/40%)]"
            : "border-white/15 bg-black/15 hover:border-white/30 hover:bg-black/25"
        }`}
      >
        <span
          className={`grid size-11 place-items-center rounded-xl ring-1 transition-all duration-300 ${
            dragging
              ? "bg-primary/15 text-primary ring-primary/40 -translate-y-1"
              : "text-muted-foreground group-hover:text-foreground bg-white/5 ring-white/10"
          }`}
        >
          <UploadCloudIcon className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-medium">
            {dragging
              ? "Suéltalo para empezar"
              : mode === "sanitize"
                ? "Suelta aquí un CSV, TXT o Excel para protegerlo"
                : "Suelta aquí el archivo de la IA para restaurarlo"}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            CSV, TSV, TXT, JSON, XLSX y más. El archivo no sale de tu navegador.
          </p>
        </div>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          id={`file-${mode}`}
          aria-label="Elegir archivo"
          disabled={working}
          onChange={(event) => pick(event.target.files)}
        />
        <Button
          variant="outline"
          disabled={working}
          onClick={() => input.current?.click()}
        >
          Elegir archivo
        </Button>
      </div>

      {job.status === "working" && (
        <div className="animate-in fade-in slide-in-from-bottom-1 flex flex-col gap-3 rounded-xl border border-white/8 bg-black/20 p-4 duration-300">
          <Progress value={Math.round(job.fraction * 100)}>
            <ProgressLabel className="max-w-[70%] truncate">
              {job.fileName}
            </ProgressLabel>
            <ProgressValue />
          </Progress>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs tabular-nums">
              {job.speed !== undefined && job.secondsLeft !== undefined
                ? `${formatBytes(job.speed)}/s · quedan ${formatSeconds(job.secondsLeft)}`
                : "Leyendo el archivo…"}
            </p>
            <Button variant="ghost" size="sm" onClick={cancel}>
              <XIcon /> Cancelar
            </Button>
          </div>
        </div>
      )}

      {job.status === "error" && (
        <div
          role="alert"
          className="bg-destructive/10 text-destructive animate-in fade-in flex gap-2 rounded-xl p-4 text-sm"
        >
          <TriangleAlertIcon
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span>{job.message}</span>
        </div>
      )}

      {job.status === "done" && (
        <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-3 rounded-xl border border-white/8 bg-black/20 p-4 duration-500">
          <div className="flex items-start gap-3">
            <span className="bg-primary/12 text-primary relative grid size-10 shrink-0 place-items-center rounded-xl">
              {isSheet(job.sourceName) ? (
                <FileSpreadsheetIcon className="size-5" aria-hidden="true" />
              ) : (
                <FileTextIcon className="size-5" aria-hidden="true" />
              )}
              <CircleCheckIcon
                className="bg-card text-primary animate-in zoom-in-50 absolute -right-1 -bottom-1 size-4 rounded-full delay-200 duration-300"
                aria-hidden="true"
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{job.result.fileName}</p>
              <p className="text-muted-foreground text-sm">
                {formatBytes(job.result.blob.size)} · generado desde{" "}
                {job.sourceName} en {formatSeconds(job.seconds)}
              </p>
            </div>
            <a
              href={job.downloadUrl}
              download={job.result.fileName}
              className="bg-primary text-primary-foreground hover:bg-primary/85 focus-visible:ring-ring/50 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium shadow-[0_0_24px_-6px_oklch(0.86_0.19_155/70%)] transition-all outline-none focus-visible:ring-3 active:translate-y-px"
            >
              <DownloadIcon className="size-4" aria-hidden="true" /> Descargar
            </a>
          </div>

          {mode === "sanitize" ? (
            <div className="flex flex-wrap gap-1.5">
              {sortedCounts(job.result.detections).length === 0 ? (
                <Badge variant="secondary">
                  No se detectaron datos personales
                </Badge>
              ) : (
                sortedCounts(job.result.detections).map(([type, count]) => (
                  <span
                    key={type}
                    style={entityStyle(type)}
                    className="tok inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium"
                  >
                    <span
                      className="tok-dot size-1.5 rounded-full"
                      aria-hidden="true"
                    />
                    <span className="tabular-nums">
                      {count.toLocaleString("es-ES")}
                    </span>
                    {ENTITY_LABELS[type]}
                  </span>
                ))
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">
                {job.result.restoredCount.toLocaleString("es-ES")} valores
                restaurados
              </Badge>
              {job.result.unresolvedTokens.length > 0 && (
                <Badge variant="destructive">
                  {job.result.unresolvedTokens.length} marcadores sin origen
                </Badge>
              )}
            </div>
          )}

          {isSheet(job.sourceName) && (
            <p className="text-muted-foreground text-xs">
              Las hojas de cálculo se reescriben como .xlsx con valores y
              fórmulas; se pierden estilos, gráficos y macros.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
