"use client";

import { EyeIcon, EyeOffIcon, RotateCcwIcon, WifiOffIcon } from "lucide-react";
import { cn } from "cn";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { PiiEntityType } from "@/core-engine/types";
import { entityStyle } from "@/lib/entity-style";

type Sensitive = {
  text: string;
  token: string;
  type: PiiEntityType;
};
type Part = string | Sensitive;
/** A piece of the message, with its position among the sensitive ones. */
type Piece = { text: string } | { sensitive: Sensitive; order: number };

const PARTS: Part[] = [
  "Hola, soy ",
  { text: "Ana García Ruiz", token: "[PERSON_1]", type: "PERSON" },
  " (DNI ",
  { text: "12345678Z", token: "[DNI_1]", type: "DNI" },
  ") y te escribo por la factura de ",
  { text: "Construcciones Levante S.L.", token: "[ORG_1]", type: "ORG" },
  ". Pagadla a ",
  { text: "ES91 2100 0418 4502 0005 1332", token: "[IBAN_1]", type: "IBAN" },
  " o escríbeme a ",
  { text: "ana.garcia@example.com", token: "[EMAIL_1]", type: "EMAIL" },
  ".",
];

const MESSAGE: Piece[] = (() => {
  let order = 0;
  return PARTS.map((part) =>
    typeof part === "string"
      ? { text: part }
      : { sensitive: part, order: order++ },
  );
})();

const SENSITIVE = PARTS.filter((part) => typeof part !== "string").length;

/** One beat every `TICK_MS`; a full loop is `CYCLE` beats. */
const TICK_MS = 600;
const CYCLE = 20;
const PROTECT_START = 3;
const RESTORE_START = 13;
/** Frame shown when motion is reduced: everything protected. */
const STILL_FRAME = 10;

type Phase = "original" | "protecting" | "protected" | "restoring";

function phaseAt(beat: number): Phase {
  if (beat < PROTECT_START || beat >= RESTORE_START + SENSITIVE) {
    return "original";
  }
  if (beat < PROTECT_START + SENSITIVE) return "protecting";
  if (beat < RESTORE_START) return "protected";
  return "restoring";
}

const PHASES: Record<Phase, { label: string; hint: string; step: 0 | 1 | 2 }> =
  {
    original: {
      label: "Original",
      hint: "Esto es lo que tienes en tu equipo",
      step: 0,
    },
    protecting: {
      label: "Protegiendo…",
      hint: "Cada dato se cambia por un marcador",
      step: 1,
    },
    protected: {
      label: "Protegido",
      hint: "Esto es lo único que ve la IA",
      step: 1,
    },
    restoring: {
      label: "Restaurando…",
      hint: "La respuesta recupera tus datos reales",
      step: 2,
    },
  };

const STEPS = ["Original", "Protegido", "Restaurado"];

function subscribeReducedMotion(notify: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}

function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/**
 * A looping miniature of the product: the message is protected piece by
 * piece, then restored. It is a decoration, so it is hidden from assistive
 * technology, and it stands still for people who prefer reduced motion.
 */
export function HeroDemo() {
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || !visible) return;
    const timer = setInterval(() => setTick((value) => value + 1), TICK_MS);
    return () => clearInterval(timer);
  }, [reduced, visible]);

  const beat = reduced ? STILL_FRAME : tick % CYCLE;
  const phase = PHASES[phaseAt(beat)];
  return (
    <div
      ref={root}
      aria-hidden="true"
      className="surface ring-gradient mx-auto w-full max-w-3xl rounded-2xl text-left"
    >
      <div className="flex items-center gap-3 border-b border-white/8 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-white/12" />
          <span className="size-2.5 rounded-full bg-white/12" />
          <span className="size-2.5 rounded-full bg-white/12" />
        </div>
        <span className="text-muted-foreground font-mono text-xs">
          mensaje.txt
        </span>
        <span
          className={cn(
            "ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors duration-300",
            phase.step === 1
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground bg-white/6",
          )}
        >
          {phase.step === 1 ? (
            <EyeOffIcon className="size-3.5" />
          ) : (
            <EyeIcon className="size-3.5" />
          )}
          {phase.label}
        </span>
      </div>

      <p className="min-h-36 px-5 py-5 font-mono text-[0.9rem] leading-8 sm:text-base sm:leading-9">
        {MESSAGE.map((piece, index) => {
          if ("text" in piece)
            return <Fragment key={index}>{piece.text}</Fragment>;
          const part = piece.sensitive;
          const isToken =
            beat >= PROTECT_START + piece.order &&
            beat < RESTORE_START + piece.order;
          return (
            <span
              key={`${index}-${isToken}`}
              style={entityStyle(part.type)}
              className={cn(
                "animate-in fade-in zoom-in-95 rounded-md px-1.5 py-0.5 duration-300",
                isToken ? "tok" : "pii-raw",
              )}
            >
              {isToken ? part.token : part.text}
            </span>
          );
        })}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/8 px-4 py-3">
        <ol className="flex items-center gap-1.5">
          {STEPS.map((step, index) => (
            <li
              key={step}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-all duration-300",
                index === phase.step
                  ? "text-foreground bg-white/10 font-medium"
                  : "text-muted-foreground/70",
              )}
            >
              {index === 2 && <RotateCcwIcon className="size-3" />}
              {step}
            </li>
          ))}
        </ol>
        <p className="text-muted-foreground text-xs">{phase.hint}</p>
        <p className="text-muted-foreground ml-auto flex items-center gap-1.5 text-xs">
          <WifiOffIcon className="text-primary size-3.5" />0 bytes enviados
        </p>
      </div>
    </div>
  );
}
