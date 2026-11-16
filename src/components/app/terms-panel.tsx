"use client";

import { UserRoundIcon, XIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { entityStyle } from "@/lib/entity-style";

interface TermsPanelProps {
  value: string;
  onChange: (value: string) => void;
  /** Whether names of people and companies are found automatically. */
  autoNames: boolean;
  onAutoNamesChange: (enabled: boolean) => void;
  /** Names the user chose to leave visible. */
  ignored: readonly string[];
  onUnignore: (value: string) => void;
}

/**
 * Names of people and companies: found automatically from context, with a
 * list of their own for whatever the rules miss and a way back for what they
 * hide by mistake.
 */
export function TermsPanel({
  value,
  onChange,
  autoNames,
  onAutoNamesChange,
  ignored,
  onUnignore,
}: TermsPanelProps) {
  const count = value
    .split("\n")
    .filter((line) => line.trim().length > 1).length;

  return (
    <section
      aria-labelledby="names-title"
      className="flex flex-col gap-4 rounded-xl border border-white/8 bg-black/20 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex max-w-xl flex-col gap-1">
          <h3
            id="names-title"
            className="flex items-center gap-2 text-sm font-medium"
          >
            <UserRoundIcon className="text-pii size-4" aria-hidden="true" />
            Nombres y empresas
          </h3>
          <p className="text-muted-foreground text-xs text-pretty">
            Se reconocen por el contexto: un nombre de pila con apellidos, un
            tratamiento como «Sra.» o «Dr.», un saludo o una firma, y las
            empresas por su forma jurídica (S.L., S.A.…) o su sector
            («Gestoría…»). Revisa el resaltado antes de enviar.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <Switch
            checked={autoNames}
            onCheckedChange={(checked) => onAutoNamesChange(checked)}
          />
          Ocultarlos automáticamente
        </label>
      </div>

      {ignored.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Se dejan visibles:</span>
          {ignored.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => onUnignore(name)}
              aria-label={`Volver a ocultar «${name}»`}
              className="focus-visible:ring-ring/60 inline-flex h-6 items-center gap-1 rounded-full bg-white/8 px-2.5 ring-1 ring-white/10 outline-none hover:bg-white/12 focus-visible:ring-2"
            >
              {name}
              <XIcon className="size-3 opacity-70" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label
          htmlFor="terms"
          className="flex items-center gap-2 text-sm font-medium"
        >
          {autoNames ? "¿Se escapa alguno? Añádelo" : "Nombres a ocultar"}
          {count > 0 && (
            <span
              className="tok animate-in fade-in zoom-in-90 rounded-full px-2 py-0.5 text-xs font-normal tabular-nums"
              style={entityStyle("TERM")}
            >
              ({count} {count === 1 ? "término" : "términos"})
            </span>
          )}
        </label>
        <Textarea
          id="terms"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={"Proyecto Atlas\nCalle Mayor 12"}
          className="min-h-20 rounded-xl border-white/14 bg-black/25 py-2.5 font-mono leading-7 dark:bg-black/25"
          spellCheck={false}
          autoComplete="off"
        />
        <p className="text-muted-foreground text-xs">
          Uno por línea: nombres, apodos, direcciones, proyectos o lo que sea.
          Se oculta en el texto y en los archivos, sin distinguir mayúsculas. Ni
          esta lista ni los nombres se guardan.
        </p>
      </div>
    </section>
  );
}
