import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldSelect } from "@/lib/form-field-classes";

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(fieldSelect, "w-full py-2", className)}
      {...props}
    >
      {children}
    </select>
  );
}
