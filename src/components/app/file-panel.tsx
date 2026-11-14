"use client";

import {
  DownloadIcon,
  FileSpreadsheetIcon,
  TriangleAlertIcon,
  UploadIcon,
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
import { ENTITY_LABELS, formatBytes, sortedCounts } from "@/lib/format";

/** Spreadsheets are loaded whole into memory, so they get a hard ceiling. */
const MAX_SPREADSHEET_BYTES = 40 * 1024 * 1024;
const ACCEPT =
  ".csv,.tsv,.txt,.json,.jsonl,.ndjson,.md,.xml,.html,.sql,.log,.yaml,.yml,.xlsx,.xls";

type JobState =
  | { status: "idle" }
  | { status: "working"; fileName: string; fraction: number }
  | {
      status: "done";
      sourceName: string;
      result: FileResult;
      downloadUrl: string;
    }
  | { status: "error"; message: string };

interface FilePanelProps {
  client: SanitizerClient;
  mode: FileMode;
  /** Called after a job finishes, so the page can refresh the vault count. */
  onFinished: () => void;
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
    const isSheet = /\.xlsx?$/i.test(file.name);
    if (isSheet && file.size > MAX_SPREADSHEET_BYTES) {
      setJob({
        status: "error",
        message: `Las hojas de cálculo se cargan enteras en memoria y ${file.name} pesa ${formatBytes(file.size)}. Expórtala a CSV, que se procesa por partes sin límite práctico.`,
      });
      return;
    }

    setJob({ status: "working", fileName: file.name, fraction: 0 });
    try {
      const result = await client.processFile(file, mode, (fraction) =>
        setJob((current) =>
          current.status === "working" ? { ...current, fraction } : current,
        ),
      );
      currentUrl.current = URL.createObjectURL(result.blob);
      setJob({
        status: "done",
        sourceName: file.name,
        result,
        downloadUrl: currentUrl.current,
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
        className={`flex flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-input"
        }`}
      >
        <UploadIcon
          className="text-muted-foreground size-6"
          aria-hidden="true"
        />
        <div>
          <p className="font-medium">
            {mode === "sanitize"
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
        <div className="bg-muted/40 flex flex-col gap-3 rounded-xl p-4">
          <Progress value={Math.round(job.fraction * 100)}>
            <ProgressLabel className="max-w-[70%] truncate">
              {job.fileName}
            </ProgressLabel>
            <ProgressValue />
          </Progress>
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={cancel}
          >
            <XIcon /> Cancelar
          </Button>
        </div>
      )}

      {job.status === "error" && (
        <div
          role="alert"
          className="bg-destructive/10 text-destructive flex gap-2 rounded-xl p-4 text-sm"
        >
          <TriangleAlertIcon
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span>{job.message}</span>
        </div>
      )}

      {job.status === "done" && (
        <div className="bg-muted/40 flex flex-col gap-3 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <FileSpreadsheetIcon
              className="text-primary mt-0.5 size-5 shrink-0"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{job.result.fileName}</p>
              <p className="text-muted-foreground text-sm">
                {formatBytes(job.result.blob.size)} · generado desde{" "}
                {job.sourceName}
              </p>
            </div>
            <a
              href={job.downloadUrl}
              download={job.result.fileName}
              className="bg-primary text-primary-foreground hover:bg-primary/80 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium"
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
                  <Badge key={type} variant="secondary">
                    {count.toLocaleString("es-ES")} {ENTITY_LABELS[type]}
                  </Badge>
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

          {/\.xlsx?$/i.test(job.sourceName) && (
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
