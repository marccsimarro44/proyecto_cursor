"use client";

import { MenuIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface MobileNavProps {
  items: readonly { href: string; label: string }[];
}

/** The section links on small screens, where the header has no room. */
export function MobileNav({ items }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={root} className="relative md:hidden">
      <Button
        ref={toggle}
        variant="ghost"
        size="icon"
        aria-label="Menú"
        aria-expanded={open}
        aria-controls="menu-movil"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <XIcon /> : <MenuIcon />}
      </Button>
      {open && (
        <nav
          id="menu-movil"
          aria-label="Principal"
          className="bg-popover animate-in fade-in slide-in-from-top-1 absolute top-11 right-0 z-30 flex w-56 flex-col rounded-xl p-1.5 shadow-2xl ring-1 ring-white/10 duration-150"
        >
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-white/6"
            >
              {item.label}
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}
