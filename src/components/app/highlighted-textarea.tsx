"use client";

import { ChevronDownIcon, ChevronUpIcon, EyeIcon } from "lucide-react";
import { cn } from "cn";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Detection } from "@/core-engine/types";
import { entityStyle } from "@/lib/entity-style";
import { ENTITY_LABELS } from "@/lib/format";

/** Past this, drawing one element per detection costs more than it helps. */
const HIGHLIGHT_MAX_CHARS = 50_000;
const HIGHLIGHT_MAX_DETECTIONS = 1_500;

/**
 * Everything that decides where a glyph lands. The textarea and the layer
 * behind it must share it exactly, or highlights drift off their text.
 */
const METRICS =
  "mirror-scroll border border-transparent px-2.5 py-2.5 font-mono text-base leading-7 break-words whitespace-pre-wrap md:text-sm";

interface HighlightedTextareaProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Ranges to highlight, valid for `value`: ordered and not overlapping. */
  detections: readonly Detection[];
  /** Leaves a guessed name visible; offered for people and companies. */
  onIgnore?: (value: string) => void;
}

function shorten(value: string): string {
  return value.length > 24 ? `${value.slice(0, 22)}…` : value;
}

/** Types found by guessing, which the user may overrule. */
const GUESSED: ReadonlySet<Detection["type"]> = new Set(["PERSON", "ORG"]);

/**
 * A textarea that paints what the engine found behind the text you typed.
 *
 * The highlights live in a layer under a transparent textarea, so the text
 * stays a real, editable, accessible control; the layer is decoration and
 * hidden from assistive technology. Detections are also reachable without a
 * pointer through the previous/next buttons, which select each one in the
 * textarea, bring it into view and announce it without taking the focus.
 */
export function HighlightedTextarea({
  id,
  label,
  value,
  onChange,
  placeholder,
  detections,
  onIgnore,
}: HighlightedTextareaProps) {
  const field = useRef<HTMLTextAreaElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const [cursor, setCursor] = useState(-1);

  const highlighting =
    value.length <= HIGHLIGHT_MAX_CHARS &&
    detections.length <= HIGHLIGHT_MAX_DETECTIONS;
  const marks = highlighting ? detections : [];
  const active = cursor >= 0 && cursor < marks.length ? cursor : -1;

  function syncScroll() {
    if (!field.current || !layer.current) return;
    layer.current.style.transform = `translateY(${-field.current.scrollTop}px)`;
  }

  function go(step: 1 | -1) {
    const textarea = field.current;
    if (!textarea || marks.length === 0) return;
    const next =
      active === -1
        ? step === 1
          ? 0
          : marks.length - 1
        : (active + step + marks.length) % marks.length;
    const target = marks[next];

    setCursor(next);
    // The selection is set but the focus stays on the button: pressing Enter
    // again moves to the next one, and Tab into the field lands on this one.
    textarea.setSelectionRange(target.start, target.end);

    // The layer is laid out like the text, so its mark says where the text is.
    const mark = layer.current?.querySelector<HTMLElement>(
      `[data-index="${next}"]`,
    );
    if (mark) {
      const top = mark.offsetTop;
      const visible = top >= textarea.scrollTop + 24;
      const room = top + 28 <= textarea.scrollTop + textarea.clientHeight;
      if (!visible || !room) {
        textarea.scrollTop = Math.max(0, top - textarea.clientHeight / 3);
      }
    }
  }

  const segments: React.ReactNode[] = [];
  let position = 0;
  marks.forEach((detection, index) => {
    if (detection.start > position) {
      segments.push(value.slice(position, detection.start));
    }
    segments.push(
      <mark
        key={detection.start}
        data-index={index}
        data-active={index === active}
        style={entityStyle(detection.type)}
        className="tok-src"
      >
        {value.slice(detection.start, detection.end)}
      </mark>,
    );
    position = detection.end;
  });
  segments.push(value.slice(position));

  const current = active === -1 ? undefined : marks[active];

  function ignoreCurrent() {
    if (!current || !onIgnore) return;
    onIgnore(current.value);
    // The next press of "siguiente" lands on what followed the ignored one,
    // and the focus moves there because this button is about to go away.
    setCursor(active - 1);
    nextButton.current?.focus();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative rounded-xl bg-black/25 ring-1 ring-white/14">
        <div
          aria-hidden="true"
          className={cn(
            METRICS,
            "pointer-events-none absolute inset-0 overflow-hidden text-transparent",
          )}
        >
          <div ref={layer}>{segments}</div>
        </div>
        <Textarea
          ref={field}
          id={id}
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onScroll={syncScroll}
          onInput={syncScroll}
          placeholder={placeholder}
          spellCheck={false}
          className={cn(
            METRICS,
            "relative min-h-52 rounded-xl bg-transparent md:max-h-96 dark:bg-transparent",
          )}
        />
      </div>

      {marks.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Dato anterior"
              onClick={() => go(-1)}
            >
              <ChevronUpIcon />
            </Button>
            <Button
              ref={nextButton}
              variant="outline"
              size="icon-sm"
              aria-label="Dato siguiente"
              onClick={() => go(1)}
            >
              <ChevronDownIcon />
            </Button>
          </div>
          <span
            role="status"
            className="text-muted-foreground min-w-0 truncate tabular-nums"
          >
            {current
              ? `${active + 1} de ${marks.length}: ${ENTITY_LABELS[current.type]}`
              : `${marks.length} ${marks.length === 1 ? "dato resaltado" : "datos resaltados"}. Recórrelos con los botones.`}
          </span>
          {current && onIgnore && GUESSED.has(current.type) && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 text-xs"
              onClick={ignoreCurrent}
            >
              <EyeIcon /> No ocultar «{shorten(current.value)}»
            </Button>
          )}
        </div>
      )}
      {!highlighting && detections.length > 0 && (
        <p className="text-muted-foreground text-xs">
          El texto es muy largo para resaltarlo aquí. La protección sigue
          aplicándose entera.
        </p>
      )}
    </div>
  );
}
