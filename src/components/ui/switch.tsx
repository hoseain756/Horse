"use client";

// Harbor Web — M3 switch (shared, RTL-safe).
// Spec: touch target 48dp (the root button itself), visual track 52×32dp,
// thumb 16dp (off) → 24dp (on), positioned with LOGICAL inset-inline-start so
// the thumb mirrors in RTL automatically (the old shadcn translate-x transform
// pushed the thumb OUT of the track in RTL).
// States: on/off, disabled (M3 0.38 opacity), loading (spinner in track),
// visible focus ring.
import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

function Switch({
  className,
  loading = false,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & { loading?: boolean }) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-loading={loading ? "" : undefined}
      disabled={props.disabled || loading}
      className={cn("md-switch harbor-tv-focus", className)}
      {...props}
    >
      <span className="md-switch-track" aria-hidden>
        <SwitchPrimitive.Thumb
          data-slot="switch-thumb"
          className="md-switch-thumb flex items-center justify-center"
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
        </SwitchPrimitive.Thumb>
      </span>
    </SwitchPrimitive.Root>
  );
}

export { Switch };
