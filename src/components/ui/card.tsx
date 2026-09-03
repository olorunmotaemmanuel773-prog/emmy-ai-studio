import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { glass?: boolean }>(
  ({ className, glass = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl text-card-foreground shadow-soft",
        glass ? "glass" : "border border-border bg-card",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

export const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
);

export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("font-display text-lg font-semibold leading-tight", className)} {...props} />
);

export const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-sm text-muted-foreground leading-relaxed", className)} {...props} />
);

export const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6 pt-0", className)} {...props} />
);

export const CardFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex items-center p-6 pt-0", className)} {...props} />
);

/* ------------------------------- Badge -------------------------------- */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/15 text-primary",
        violet: "border-transparent bg-violet/15 text-violet dark:text-[#c4b5fd]",
        magenta: "border-transparent bg-magenta/15 text-magenta dark:text-[#f9a8d4]",
        success: "border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
        warning: "border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-300",
        destructive: "border-transparent bg-destructive/15 text-destructive",
        outline: "border-border text-muted-foreground",
        glass: "glass text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/* ------------------------------ Skeleton ------------------------------ */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-xl bg-muted-foreground/10 dark:bg-white/[0.06]", className)}
      {...props}
    />
  );
}

/* ----------------------------- Empty state ---------------------------- */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center rounded-3xl border border-dashed border-border px-6 py-14 text-center overflow-hidden",
        className,
      )}
    >
      <div className="absolute inset-0 grid-fade opacity-60 pointer-events-none" />
      {Icon && (
        <div className="relative mb-5 grid h-14 w-14 place-items-center rounded-2xl glass">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      )}
      <h3 className="relative font-display text-lg font-semibold">{title}</h3>
      {description && <p className="relative mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">{description}</p>}
      {action && <div className="relative mt-6">{action}</div>}
    </div>
  );
}

/* ----------------------------- Section head --------------------------- */
export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div>
        {eyebrow && (
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-primary/90">{eyebrow}</p>
        )}
        <h2 className="font-display text-xl font-semibold sm:text-2xl">{title}</h2>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
