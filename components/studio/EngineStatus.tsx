import * as React from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, KeyRound, Loader2, PlugZap, RefreshCw, Sparkles, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { MODE_ENGINE, useEngineStatus } from "@/contexts/EngineStatusContext";
import type { DemoRequest } from "@/hooks/useGeneration";
import { labelFor, IMAGE_STYLES, VIDEO_STYLES } from "@/lib/ai/options";
import { cn, GENERATION_TYPE_LABELS } from "@/lib/utils";
import type { EngineKind } from "@/types/api";

const ENGINE_LABELS: Record<EngineKind, string> = { image: "Image engine", video: "Video engine", storyboard: "Story engine" };
const ENGINE_TOOLS: Record<EngineKind, string> = {
  image: "Text to Image · Image to Image · Scene images",
  video: "Text to Video · Image to Video · Scene videos",
  storyboard: "Story to Storyboard",
};

/* ------------------------------ Demo tag ------------------------------ */
export function DemoTag({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-500",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
      {compact ? "Demo" : "Demo · API not connected"}
    </span>
  );
}

/* ---------------------------- Header pill ----------------------------- */
export function EngineStatusPill({ className }: { className?: string }) {
  const { state, health } = useEngineStatus();
  const [open, setOpen] = React.useState(false);
  const connected = state === "ready" && Boolean(health?.configured);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors",
          state === "loading"
            ? "border-border text-muted-foreground"
            : connected
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/15"
              : "border-amber-500/40 bg-amber-500/10 text-amber-500 hover:bg-amber-500/15",
          className,
        )}
        aria-label="AI engine status"
        title="AI engine status"
      >
        {state === "loading" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : connected ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">
          {state === "loading" ? "Checking engines…" : connected ? "Gemini & Veo connected" : "Demo · API not connected"}
        </span>
        <span className="sm:hidden">{state === "loading" ? "…" : connected ? "Live" : "Demo"}</span>
      </button>
      <EngineStatusDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

/* --------------------------- Status dialog ---------------------------- */
export function EngineStatusDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { state, health, refresh } = useEngineStatus();
  const { isAdmin } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);

  const doRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlugZap className="h-4 w-4 text-primary" /> AI engine status
          </DialogTitle>
          <DialogDescription>
            EmmyAI Studio only shows real results. While an engine is disconnected, its tools run in a clearly labelled demo
            mode and nothing is generated or saved.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 px-6 pb-2">
          {state === "unreachable" && (
            <div className="flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
              <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-muted-foreground">
                The <code className="rounded bg-muted px-1">/api</code> backend isn't reachable from this build. On Vercel the
                functions deploy with the site; locally run <code className="rounded bg-muted px-1">vercel dev</code>.
              </p>
            </div>
          )}
          {(["image", "video", "storyboard"] as EngineKind[]).map((kind) => {
            const info = health?.engines[kind];
            const ok = state === "ready" && Boolean(info?.configured);
            return (
              <div key={kind} className="flex items-start gap-3 rounded-2xl border border-border bg-background/50 p-3.5">
                <span
                  className={cn(
                    "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                    state === "loading" ? "bg-muted-foreground/40" : ok ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]" : "bg-amber-500",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{ENGINE_LABELS[kind]}</p>
                    <Badge variant={ok ? "success" : "warning"}>{state === "loading" ? "Checking" : ok ? "Connected" : "Demo"}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{ENGINE_TOOLS[kind]}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {info?.provider === "veo" ? "Google Veo" : "Google Gemini"}
                    {info?.model ? ` · ${info.model}` : ""}
                  </p>
                  {kind === "video" && info?.capabilities?.["video-to-video"] === false && (
                    <p className="mt-1 text-xs text-amber-500/90">Video to Video isn't offered by Veo yet — demo only.</p>
                  )}
                </div>
              </div>
            );
          })}
          {isAdmin && (
            <div className="rounded-2xl border border-dashed border-border p-4 text-xs leading-relaxed text-muted-foreground">
              <p className="flex items-center gap-2 font-semibold text-foreground">
                <KeyRound className="h-3.5 w-3.5 text-primary" /> Connect Gemini &amp; Veo (owner only)
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>Create a key at Google AI Studio.</li>
                <li>
                  In Vercel → Project → Settings → Environment Variables add <code className="rounded bg-muted px-1">GEMINI_API_KEY</code>.
                  Never put it in the frontend or in <code className="rounded bg-muted px-1">VITE_*</code> variables.
                </li>
                <li>Redeploy, then press “Check again”.</li>
              </ol>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 p-6 pt-3">
          <p className="text-[11px] text-muted-foreground">
            {health?.checkedAt ? `Checked ${new Date(health.checkedAt).toLocaleTimeString()}` : ""}
          </p>
          <Button variant="outline" size="sm" onClick={doRefresh} loading={refreshing}>
            <RefreshCw /> Check again
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- Demo banner ---------------------------- */
export function DemoBanner({ mode, className }: { mode: string; className?: string }) {
  const { decide, state } = useEngineStatus();
  const [open, setOpen] = React.useState(false);
  const target = MODE_ENGINE[mode];
  if (!target || state === "loading") return null;
  const decision = decide(target.engine, target.capability);
  if (decision.connected) return null;

  return (
    <>
      <div
        className={cn(
          "flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
          className,
        )}
        role="status"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <DemoTag />
              <p className="text-sm font-semibold">
                {decision.kind === "unsupported" ? "Not supported by the connected engine yet" : "This tool is in demo mode"}
              </p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              You can explore the full workflow, but pressing generate will show a labelled preview instead of a real
              result. Nothing is generated or saved until the engine is connected.
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="shrink-0 self-start sm:self-auto" onClick={() => setOpen(true)}>
          Engine status <ChevronRight />
        </Button>
      </div>
      <EngineStatusDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

/* ----------------------------- Demo preview --------------------------- */
export function DemoPreview({ request, onRetry, onDismiss }: { request: DemoRequest; onRetry?: () => void; onDismiss?: () => void }) {
  const { isAdmin } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [w, h] = request.aspectRatio.split(":").map(Number);
  const styleLabel = labelFor(request.kind === "video" ? VIDEO_STYLES : IMAGE_STYLES, request.style) || request.style;
  const engine = request.kind === "video" ? "Google Veo" : "Google Gemini";

  return (
    <div className="space-y-4 animate-fade-up" role="status" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <DemoTag />
          <span className="text-sm text-muted-foreground">
            {GENERATION_TYPE_LABELS[request.type]} · {request.aspectRatio}
          </span>
        </div>
        <div className="flex gap-2">
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw /> Try again
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
            Engine status
          </Button>
        </div>
      </div>

      {/* Labelled placeholder frame — deliberately not a fake result */}
      <div
        className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-3xl border border-dashed border-amber-500/40 bg-card/60"
        style={{ aspectRatio: `${w}/${h}`, maxHeight: "60dvh" }}
      >
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 18px)" }}
        />
        <div className="absolute inset-0 grid-fade opacity-50" />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-500">
            {request.kind === "video" ? <Sparkles className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
          </span>
          <p className="mt-4 font-display text-lg font-semibold">Demo preview — nothing was generated</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {request.reasonKind === "unsupported"
              ? `This tool isn't supported by ${engine} yet.`
              : `${engine} isn't connected to this studio yet.`}{" "}
            This frame shows the exact brief that will be sent once it is.
          </p>
        </div>
        <span className="absolute left-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/80 backdrop-blur">
          Not AI output
        </span>
      </div>

      {/* The brief that would be sent */}
      <div className="glass rounded-2xl p-4 sm:p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Prepared brief</p>
        <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{request.prompt}</p>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Detail label="Engine" value={request.model ? `${engine} · ${request.model}` : engine} />
          <Detail label="Style" value={styleLabel} />
          <Detail label="Aspect ratio" value={request.aspectRatio} />
          {request.details.map((d) => (
            <Detail key={d.label} label={d.label} value={d.value} />
          ))}
        </dl>
        <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
          {request.reason}
          {isAdmin ? " Open Engine status for the connection steps." : ""}
        </p>
        {onDismiss && (
          <Button variant="ghost" size="sm" className="mt-3 text-muted-foreground" onClick={onDismiss}>
            Clear preview
          </Button>
        )}
      </div>
      <EngineStatusDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/50 px-3 py-2">
      <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate capitalize text-foreground" title={value}>
        {value}
      </dd>
    </div>
  );
}
