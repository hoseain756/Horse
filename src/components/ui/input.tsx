import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "harbor-field file:text-foreground selection:bg-primary selection:text-primary-foreground flex h-9 w-full min-w-0 px-3 py-1 text-base file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
