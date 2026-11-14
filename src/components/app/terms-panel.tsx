"use client";

import { UserRoundIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface TermsPanelProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Names, companies and anything else that has no format a detector could
 * recognize. This is the answer to "it did not hide the name".
 */
export function TermsPanel({ value, onChange }: TermsPanelProps) {
  const count = value
    .split("\n")
    .filter((line) => line.trim().length > 1).length;

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor="terms"
        className="flex items-center gap-2 text-sm font-medium"
      >
        <UserRoundIcon className="text-pii size-4" aria-hidden="true" />
        Nombres y empresas a ocultar
        {count > 0 && (
          <span className="text-muted-foreground font-normal">
            ({count} {count === 1 ? "término" : "términos"})
          </span>
        )}
      </label>
      <Textarea
        id="terms"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={"Ana García Ruiz\nConstrucciones Levante S.L."}
        className="min-h-20 font-mono"
        spellCheck={false}
        autoComplete="off"
      />
      <p className="text-muted-foreground text-xs">
        Un nombre por línea. Los nombres no tienen formato que se pueda validar,
        así que no se detectan solos: lo que escribas aquí se oculta en el texto
        y en los archivos, sin distinguir mayúsculas. Esta lista no se guarda.
      </p>
    </div>
  );
}
