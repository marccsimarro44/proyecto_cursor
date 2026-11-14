"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 450;

/** A number that counts up to its new value instead of jumping. */
export function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const current = useRef(value);

  useEffect(() => {
    const from = current.current;
    if (from === value) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      current.current = value;
      const frame = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(frame);
    }

    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - (1 - progress) ** 3;
      current.current = Math.round(from + (value - from) * eased);
      setShown(current.current);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{shown.toLocaleString("es-ES")}</>;
}
