import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "harbor-button inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "harbor-button-primary",
        destructive: "harbor-button-danger",
        outline: "harbor-button-outline",
        secondary: "harbor-button-secondary",
        ghost: "harbor-button-ghost",
        link: "harbor-button-link",
      },
      size: {
        default: "h-11 min-w-11 px-5 py-2 has-[>svg]:px-4",
        sm: "h-10 min-w-10 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-12 min-w-12 px-6 has-[>svg]:px-5",
        icon: "harbor-button-icon size-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant ?? "default"}
      data-size={size ?? "default"}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
