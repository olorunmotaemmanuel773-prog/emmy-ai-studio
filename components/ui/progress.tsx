import * as React from "react";
import { Cable, KeyRound, Loader2, RefreshCw, Sparkles, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProviderError } from "@/lib/ai/types";
import { Button } from "./button";

export function Progress({ value, className, indeterminate }: { value?: number; className?: string; indeterminate?: boolean }) {
  return (
    <div className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      {indeterminate ? (
        <div
          className="absolute inset-y-0 w-1/3 rounded-full bg-brand-gradient"
          style={{ animation: "progress-slide 1.6s ease-in-out infinite" }}
        />
      ) : (
        <div
          className="h-full rounded-full bg-brand-gradient transition-[width] duration-500 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }}
        />
      )}
      <style>{`@keyframes progress-slide{0%{left:-35%}100%{left:105%}}`}</style>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-primary", className)} />;
}

/* --------------------------- Generation loader ------------------------ */
const DEFAULT_STAGES = ["Reading your prompt…", "Composing the scene…", "Rendering details…", "Polishing the final look…"];

export function GenerationLoader({
  title,
  stages = DEFAULT_STAGES,
  progress,
  aspectRatio = "16:9",
  className,
  onCancel,
}: {
  title: string;
  stages?: string[];
  progress?: number;
  aspectRatio?: string;
  className?: string;
  onCancel?: () => void;
}) {
  const [stage, setStage] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      const secs = Math.floor((Date.now() - started) / 1000);
      setElapsed(secs);
      setStage(Math.min(stages.length - 1, Math.floor(secs / 6)));
    }, 1000);
    return () => clearInterval(timer);
  }, [stages.length]);

  const [w, h] = aspectRatio.split(":").map(Number);

  return (
    <div className={cn("relative overflow-hidden rounded-3xl border border-border bg-card/60", className)}>
      <div className="aurora opacity-70" />
      <div className="relative flex flex-col items-center justify-center px-6 py-10 text-center">
        <div className="relative mb-8 grid place-items-center">
          <div
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
            style={{ width: 160, height: (160 * h) / w > 220 ? 220 : (160 * h) / w, aspectRatio: `${w}/${h}` }}
          >
            <div className="absolute inset-0 shimmer-bg animate-shimmer" />
            <div className="absolute inset-x-0 h-1/2 bg-gradient-to-b from-transparent via-primary/25 to-transparent animate-scan" />
            <Sparkles className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-white/80" />
          </div>
          <span className="absolute -inset-4 rounded-[28px] border border-primary/30 animate-pulse-ring" />
        </div>
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        <p className="mt-1.5 text-sm text-muted-foreground min-h-[20px] transition-all">{stages[stage]}</p>
        <div className="mt-6 w-full max-w-xs">
          <Progress value={progress} indeterminate={progress === undefined} />
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>{progress !== undefined ? `${Math.round(progress)}%` : "Working"}</span>
            <span>{elapsed}s</span>
          </div>
        </div>
        {onCancel && (
          <Button variant="ghost" size="sm" className="mt-5 text-muted-foreground" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- Provider notice ------------------------- */
export function ProviderNotice({
  error,
  tool,
  onRetry,
  isAdmin,
  className,
}: {
  error: ProviderError;
  tool: string;
  onRetry?: () => void;
  isAdmin?: boolean;
  className?: string;
}) {
  const notConfigured = error.code === "not_configured" || error.code === "unsupported";
  const unsupported = error.code === "unsupported";
  const unavailable = error.code === "unavailable";
  const Icon = notConfigured ? KeyRound : unavailable ? WifiOff : Cable;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border p-6 sm:p-8",
        notConfigured ? "border-amber-500/30 bg-amber-500/[0.06]" : "border-destructive/30 bg-destructive/[0.06]",
        className,
      )}
      role="status"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div
          className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-2xl",
            notConfigured ? "bg-amber-500/15 text-amber-500" : "bg-destructive/15 text-destructive",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          {notConfigured && (
            <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-500">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" /> Demo · API not connected
            </span>
          )}
          <h3 className="font-display text-base font-semibold">
            {unsupported
              ? `${tool} isn't supported by the connected engine yet`
              : notConfigured
                ? `${tool} isn't connected yet`
                : `We couldn't finish your ${tool.toLowerCase()}`}
          </h3>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{error.message}</p>
          {notConfigured && (
            <div className="mt-4 rounded-xl border border-border bg-background/60 p-4 text-xs leading-relaxed text-muted-foreground">
              <p className="font-semibold text-foreground">
                {isAdmin ? "How to connect Gemini & Veo" : "Nothing to do on your side"}
              </p>
              {isAdmin ? (
                <ol className="mt-2 list-decimal space-y-1 pl-4">
                  <li>Create an API key in Google AI Studio.</li>
                  <li>
                    Add it as <code className="rounded bg-muted px-1">GEMINI_API_KEY</code> in Vercel → Project → Settings →
                    Environment Variables (server-side only — never a <code className="rounded bg-muted px-1">VITE_*</code> variable).
                  </li>
                  <li>Redeploy. Optional model overrides are listed in the README.</li>
                </ol>
              ) : (
                <p className="mt-1">
                  EmmyAI Studio is free to use. The studio owner is still connecting this creative engine — no result was
                  faked and nothing was saved.
                </p>
              )}
            </div>
          )}
          {onRetry && (
            <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
              <RefreshCw /> Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
