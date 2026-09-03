import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Option } from "@/lib/ai/options";
import { Label } from "./input";

/* ---------------------------- Option pills ---------------------------- */
export function OptionPills<T extends string | number>({
  label,
  options,
  value,
  onChange,
  columns,
  size = "md",
  renderIcon,
  className,
}: {
  label?: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  columns?: 2 | 3 | 4;
  size?: "sm" | "md";
  renderIcon?: (option: Option<T>, selected: boolean) => React.ReactNode;
  className?: string;
}) {
  const featured = options.filter((o) => o.featured);
  const rest = options.filter((o) => !o.featured);

  const renderPill = (opt: Option<T>, big?: boolean) => {
    const selected = opt.value === value;
    return (
      <button
        key={String(opt.value)}
        type="button"
        onClick={() => onChange(opt.value)}
        aria-pressed={selected}
        className={cn(
          "group relative flex items-center gap-2 rounded-xl border text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          size === "sm" ? "px-3 py-2 text-[13px]" : "px-3.5 py-2.5 text-sm",
          big && "py-3.5",
          selected
            ? "border-primary/60 bg-primary/10 text-foreground shadow-[inset_0_0_0_1px_rgba(61,123,255,0.35)]"
            : "border-border bg-background/40 dark:bg-white/[0.03] text-muted-foreground hover:border-foreground/20 hover:text-foreground",
        )}
      >
        {renderIcon?.(opt, selected)}
        <span className="flex-1 min-w-0">
          <span className={cn("block font-semibold truncate", big && "text-[15px]")}>{opt.label}</span>
          {opt.hint && <span className="block text-[11px] text-muted-foreground">{opt.hint}</span>}
        </span>
        {selected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
      </button>
    );
  };

  return (
    <div className={cn("space-y-2.5", className)}>
      {label && <Label>{label}</Label>}
      {featured.length > 0 && <div className="grid grid-cols-2 gap-2">{featured.map((o) => renderPill(o, true))}</div>}
      {rest.length > 0 && (
        <div
          className={cn(
            "grid gap-2",
            columns === 2 && "grid-cols-2",
            columns === 3 && "grid-cols-2 sm:grid-cols-3",
            columns === 4 && "grid-cols-2 sm:grid-cols-4",
            !columns && "grid-cols-2 sm:grid-cols-3",
          )}
        >
          {rest.map((o) => renderPill(o))}
        </div>
      )}
    </div>
  );
}

/* --------------------------- Aspect ratio icon ------------------------ */
export function RatioIcon({ ratio, selected }: { ratio: string; selected?: boolean }) {
  const [w, h] = ratio.split(":").map(Number);
  const max = 18;
  const scale = max / Math.max(w, h);
  return (
    <span className="grid h-5 w-5 place-items-center shrink-0">
      <span
        className={cn("rounded-[3px] border-2", selected ? "border-primary" : "border-muted-foreground/60")}
        style={{ width: w * scale, height: h * scale }}
      />
    </span>
  );
}

/* ---------------------------- Native select --------------------------- */
export function NativeSelect<T extends string | number>({
  label,
  options,
  value,
  onChange,
  className,
  id,
}: {
  label?: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  id?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="relative">
        <select
          id={id}
          value={String(value)}
          onChange={(e) => {
            const raw = e.target.value;
            const match = options.find((o) => String(o.value) === raw);
            if (match) onChange(match.value);
          }}
          className="h-11 w-full appearance-none rounded-xl border border-input bg-background/60 dark:bg-white/[0.03] px-4 pr-10 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {options.map((o) => (
            <option key={String(o.value)} value={String(o.value)} className="bg-popover text-popover-foreground">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );
}

/* --------------------------- Segmented control ------------------------ */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "md",
}: {
  options: { value: T; label: React.ReactNode; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-xl border border-border bg-muted/50 p-1 overflow-x-auto scrollbar-none",
        className,
      )}
      role="tablist"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-lg font-semibold transition-all",
              size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
              active ? "bg-card text-foreground shadow-sm dark:bg-white/10" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
            {typeof o.count === "number" && (
              <span className={cn("rounded-md px-1.5 text-[11px]", active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------- Switch ------------------------------ */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  id,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-50",
        checked ? "bg-brand-gradient" : "bg-muted-foreground/30",
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

/* -------------------------------- Slider ------------------------------ */
export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
  format,
  className,
}: {
  label?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
  className?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={cn("space-y-2.5", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <Label>{label}</Label>
          <span className="text-xs font-semibold text-primary">{format ? format(value) : value}</span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full accent-primary"
        style={{
          background: `linear-gradient(90deg, #3d7bff 0%, #8b5cf6 ${pct}%, var(--muted) ${pct}%, var(--muted) 100%)`,
        }}
      />
    </div>
  );
}
