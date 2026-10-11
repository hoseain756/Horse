import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "harbor-field flex field-sizing-content min-h-16 w-full px-3 py-2 text-base disabled:pointer-events-none md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
