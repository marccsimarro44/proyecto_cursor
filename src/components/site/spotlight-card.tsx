"use client";

import { cn } from "cn";
import type { ComponentProps } from "react";

/**
 * A card whose border lights up under the pointer. Only two CSS variables
 * change on move; the effect itself lives in `.spotlight` (effects.css).
 */
export function SpotlightCard({
  className,
  onPointerMove,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn("spotlight rounded-2xl ring-1 ring-white/8", className)}
      onPointerMove={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty(
          "--mx",
          `${event.clientX - box.left}px`,
        );
        event.currentTarget.style.setProperty(
          "--my",
          `${event.clientY - box.top}px`,
        );
        onPointerMove?.(event);
      }}
    />
  );
}
