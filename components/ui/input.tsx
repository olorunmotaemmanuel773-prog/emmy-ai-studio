import * as React from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "flex w-full rounded-xl border border-input bg-background/60 dark:bg-white/[0.03] px-4 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring/60 disabled:cursor-not-allowed disabled:opacity-50";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input type={type} className={cn(fieldBase, "h-11", className)} ref={ref} {...props} />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea className={cn(fieldBase, "min-h-[120px] py-3 leading-relaxed resize-y", className)} ref={ref} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("text-[13px] font-semibold tracking-wide text-foreground/90 leading-none", className)}
      {...props}
    />
  ),
);
Label.displayName = "Label";

export function FormField({
  label,
  hint,
  error,
  htmlFor,
  right,
  className,
  children,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  htmlFor?: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {(label || right) && (
        <div className="flex items-center justify-between gap-3">
          {label && <Label htmlFor={htmlFor}>{label}</Label>}
          {right && <div className="text-xs text-muted-foreground">{right}</div>}
        </div>
      )}
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
