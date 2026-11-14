import { cn } from "cn";
import { useId } from "react";

/**
 * The PromptShield mark: a shield holding a redaction bar between two
 * brackets, which is what the product does to your data. The same drawing
 * is the favicon (`app/icon.svg`).
 */
export function LogoMark({ className }: { className?: string }) {
  const id = `ps-logo-${useId().replace(/:/g, "")}`;
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("size-6", className)}
    >
      <defs>
        <linearGradient id={id} x1="6" y1="4" x2="26" y2="28">
          <stop stopColor="oklch(0.92 0.17 160)" />
          <stop offset="1" stopColor="oklch(0.78 0.14 215)" />
        </linearGradient>
      </defs>
      <path
        d="M16 3.5 5.5 7.4v8.2c0 6.2 4.2 11.3 10.5 13.3 6.3-2 10.5-7.1 10.5-13.3V7.4L16 3.5Z"
        stroke={`url(#${id})`}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M12 11.5h-1.8v9H12M20 11.5h1.8v9H20"
        stroke={`url(#${id})`}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="13.1"
        y="14.6"
        width="5.8"
        height="2.8"
        rx="1.4"
        fill={`url(#${id})`}
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-heading flex items-center gap-2 text-[1.05rem] font-semibold tracking-tight",
        className,
      )}
    >
      <LogoMark />
      PromptShield
    </span>
  );
}
