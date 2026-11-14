"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const CONFIRMATION_MS = 1800;

/** Copies text and confirms it on the button itself, not only in a toast. */
export function CopyButton({
  getText,
  disabled,
}: {
  getText: () => string | undefined;
  disabled: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    const text = getText();
    if (text === undefined) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), CONFIRMATION_MS);
    } catch {
      toast.error("No se pudo copiar. Selecciona el texto y cópialo a mano.");
    }
  }

  return (
    <Button
      size="sm"
      variant={copied ? "secondary" : "default"}
      disabled={disabled}
      onClick={copy}
      className="min-w-24"
    >
      {copied ? (
        <CheckIcon className="text-primary animate-in zoom-in-50 duration-200" />
      ) : (
        <CopyIcon />
      )}
      {copied ? "Copiado" : "Copiar"}
    </Button>
  );
}
