import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0 select-none",
  {
    variants: {
      variant: {
        default:
          "bg-brand-gradient text-white shadow-[0_10px_30px_-12px_rgba(99,102,241,0.7)] hover:shadow-[0_14px_36px_-12px_rgba(139,92,246,0.8)] hover:brightness-110",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border",
        outline: "border border-border bg-transparent hover:bg-muted/60 text-foreground",
        ghost: "hover:bg-muted/70 text-foreground",
        glass: "glass text-foreground hover:bg-white/10 dark:hover:bg-white/10",
        destructive: "bg-destructive/15 text-destructive hover:bg-destructive/25 border border-destructive/30",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2 [&_svg]:size-4",
        sm: "h-9 rounded-lg px-3.5 text-[13px] [&_svg]:size-4",
        lg: "h-12 rounded-2xl px-7 text-[15px] [&_svg]:size-5",
        icon: "h-10 w-10 [&_svg]:size-4",
        "icon-sm": "h-8 w-8 rounded-lg [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="animate-spin" />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
