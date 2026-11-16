"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "cn";

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "focus-visible:ring-ring/60 data-checked:bg-primary data-checked:ring-primary/40 relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-white/14 p-0.5 ring-1 ring-white/14 transition-colors outline-none focus-visible:ring-2 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="block size-4 rounded-full bg-white shadow-sm transition-transform duration-200 data-checked:translate-x-4 data-checked:bg-black/85"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
