"use client"

import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "harbor-button inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-transparent px-3 text-sm font-medium hover:bg-[var(--glass-active-fill)] hover:text-ink disabled:pointer-events-none disabled:opacity-60 data-[state=on]:border-accent/35 data-[state=on]:bg-[var(--glass-active-fill)] data-[state=on]:text-accent [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:outline-none whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border-edge-soft bg-[var(--glass-control-fill)]",
      },
      size: {
        default: "h-11 px-3 min-w-11",
        sm: "h-10 px-2 min-w-10",
        lg: "h-12 px-3 min-w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
