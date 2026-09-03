import * as React from "react";
import { Bookmark, Download, Heart, Maximize2, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Textarea } from "@/components/ui/input";
import { GenerationLoader, ProviderNotice } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { MAX_PROMPT_LENGTH } from "@/lib/ai/options";
import type { RunState } from "@/hooks/useGeneration";
import type { GenerationRecord, MediaFile } from "@/lib/database.types";
import { cn, isVideoType } from "@/lib/utils";
import { ActionIcon, useCreationActions } from "./CreationActions";
import { DemoPreview } from "./EngineStatus";
import { MediaViewer } from "./MediaViewer";
import { SignedImage, SignedVideo } from "./SignedMedia";

/** Values used to pre-fill a tool when regenerating an existing creation. */
export interface ToolPrefill {
  prompt?: string;
  style?: string;
  aspectRatio?: string;
  quality?: string;
  count?: number;
  duration?: number;
  cameraMovement?: string;
  strength?: number;
}

export function prefillFromGeneration(gen: GenerationRecord): ToolPrefill {
  const meta = (gen.metadata ?? {}) as Record<string, unknown>;
  return {
    prompt: gen.prompt,
    style: gen.style ?? undefined,
    aspectRatio: gen.aspect_ratio ?? undefined,
    quality: typeof meta.quality === "string" ? meta.quality : undefined,
    count: typeof meta.count === "number" ? meta.count : undefined,
    duration: typeof meta.duration === "number" ? meta.duration : undefined,
    cameraMovement: typeof meta.cameraMovement === "string" ? meta.cameraMovement : undefined,
    strength: typeof meta.strength === "number" ? meta.strength : undefined,
  };
}

/* ------------------------------ Layout ------------------------------- */
export function ToolLayout({
  controls,
  canvas,
  footer,
}: {
  controls: React.ReactNode;
  canvas: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr] xl:grid-cols-[460px_1fr]">
      <div className="order-2 lg:order-1">
        <div className="glass rounded-3xl p-5 sm:p-6 space-y-6">
          {controls}
          <div className="sticky bottom-24 lg:static pt-2">{footer}</div>
        </div>
      </div>
      <div className="order-1 lg:order-2 min-w-0">{canvas}</div>
    </div>
  );
}

export function PromptField({
  id = "prompt",
  label = "Prompt",
  value,
  onChange,
  placeholder,
  error,
  rows = 5,
}: {
  id?: string;
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  error?: string | null;
  rows?: number;
}) {
  return (
    <FormField label={label} htmlFor={id} error={error} right={<span>{value.length}/{MAX_PROMPT_LENGTH}</span>}>
      <Textarea
        id={id}
        value={value}
        rows={rows}
        maxLength={MAX_PROMPT_LENGTH}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-[15px]"
      />
    </FormField>
  );
}

/* --------------------------- Canvas states ---------------------------- */
export function CanvasPlaceholder({
  title,
  description,
  aspectRatio = "16:9",
}: {
  title: string;
  description: string;
  aspectRatio?: string;
}) {
  const [w, h] = aspectRatio.split(":").map(Number);
  return (
    <div className="relative flex min-h-[320px] flex-col items-center justify-center overflow-hidden rounded-3xl border border-dashed border-border bg-card/40 p-8 text-center lg:min-h-[520px]">
      <div className="absolute inset-0 grid-fade opacity-70" />
      <div
        className="relative mb-6 rounded-2xl border border-white/10 bg-gradient-to-br from-electric/10 via-violet/10 to-magenta/10"
        style={{ width: 140, aspectRatio: `${w}/${h}` }}
      >
        <Sparkles className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-primary" />
      </div>
      <h3 className="relative font-display text-lg font-semibold">{title}</h3>
      <p className="relative mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

export function RunStateView({
  state,
  tool,
  loadingTitle,
  loadingStages,
  aspectRatio,
  idle,
  onRetry,
  onCancel,
  onChange,
  onDeleted,
  onRegenerate,
  before,
}: {
  state: RunState;
  tool: string;
  loadingTitle: string;
  loadingStages?: string[];
  aspectRatio: string;
  idle: React.ReactNode;
  onRetry: () => void;
  onCancel?: () => void;
  onChange: (gen: GenerationRecord) => void;
  onDeleted: () => void;
  onRegenerate: () => void;
  before?: { ref: string; kind: "image" | "video" } | null;
}) {
  const { isAdmin } = useAuth();
  if (state.status === "running") {
    return (
      <GenerationLoader
        title={loadingTitle}
        stages={loadingStages}
        aspectRatio={aspectRatio}
        progress={state.progress}
        onCancel={onCancel}
        className="min-h-[320px] lg:min-h-[520px] flex flex-col justify-center"
      />
    );
  }
  if (state.status === "demo") {
    return <DemoPreview request={state.request} onRetry={onRetry} onDismiss={onDeleted} />;
  }
  if (state.status === "error") {
    return <ProviderNotice error={state.error} tool={tool} onRetry={onRetry} isAdmin={isAdmin} />;
  }
  if (state.status === "done") {
    return (
      <ResultPanel generation={state.generation} onChange={onChange} onDeleted={onDeleted} onRegenerate={onRegenerate} before={before} />
    );
  }
  return <>{idle}</>;
}

/* ------------------------------ Results ------------------------------- */
export function ResultPanel({
  generation,
  onChange,
  onDeleted,
  onRegenerate,
  before,
}: {
  generation: GenerationRecord;
  onChange: (gen: GenerationRecord) => void;
  onDeleted: () => void;
  onRegenerate: () => void;
  before?: { ref: string; kind: "image" | "video" } | null;
}) {
  const gen = generation;
  const [viewer, setViewer] = React.useState(false);
  const actions = useCreationActions({ onChange, onDeleted: () => onDeleted() });
  const video = isVideoType(gen.type);
  const files: MediaFile[] = gen.media_files.length
    ? gen.media_files
    : gen.result_url
      ? [
          {
            id: "primary",
            user_id: gen.user_id,
            generation_id: gen.id,
            file_type: video ? "video" : "image",
            file_url: gen.result_url,
            thumbnail_url: gen.thumbnail_url,
            width: null,
            height: null,
            size_bytes: null,
            created_at: gen.created_at,
          },
        ]
      : [];
  const isFav = gen.favorites.length > 0;
  const ratio = gen.aspect_ratio ?? "1:1";
  const [w, h] = ratio.split(":").map(Number);

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="success">Completed</Badge>
          <span className="text-sm text-muted-foreground">
            {files.length} {video ? "video" : files.length === 1 ? "image" : "images"} · {ratio}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => actions.save(gen)} loading={actions.busy === `save-${gen.id}`} className={cn(gen.is_saved && "border-primary/50 text-primary")}>
            <Bookmark className={cn(gen.is_saved && "fill-current")} /> {gen.is_saved ? "Saved" : "Save"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => actions.favorite(gen)} loading={actions.busy === `fav-${gen.id}`} className={cn(isFav && "border-magenta/50 text-magenta")}>
            <Heart className={cn(isFav && "fill-current")} /> {isFav ? "Favorited" : "Favorite"}
          </Button>
          <Button variant="outline" size="sm" onClick={onRegenerate}>
            <RefreshCw /> Regenerate
          </Button>
        </div>
      </div>

      {before && (
        <div className="grid gap-4 md:grid-cols-2">
          <figure className="overflow-hidden rounded-2xl border border-border bg-black/40">
            <figcaption className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Before</figcaption>
            {before.kind === "video" ? (
              <SignedVideo src={before.ref} className="max-h-[420px] w-full object-contain" controls muted />
            ) : (
              <SignedImage src={before.ref} alt="Original" className="aspect-square" imgClassName="object-contain" />
            )}
          </figure>
          <figure className="overflow-hidden rounded-2xl border border-primary/40 bg-black/40 shadow-glow">
            <figcaption className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">After</figcaption>
            {video ? (
              <SignedVideo src={files[0]?.file_url} poster={files[0]?.thumbnail_url} className="max-h-[420px] w-full object-contain" controls autoPlay muted loop />
            ) : (
              <SignedImage src={files[0]?.file_url} alt={gen.prompt} className="aspect-square" imgClassName="object-contain" loading="eager" />
            )}
          </figure>
        </div>
      )}

      {video ? (
        !before && (
          <div className="overflow-hidden rounded-3xl border border-border bg-black shadow-glow">
            <SignedVideo src={files[0]?.file_url} poster={files[0]?.thumbnail_url} className="max-h-[70dvh] w-full object-contain" controls autoPlay />
          </div>
        )
      ) : (
        !before && (
          <div className={cn("grid gap-3", files.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
            {files.map((file, i) => (
              <figure key={file.id} className="group relative overflow-hidden rounded-2xl border border-border bg-black/40" style={{ aspectRatio: `${w}/${h}` }}>
                <SignedImage src={file.file_url} alt={`${gen.prompt} — ${i + 1}`} className="absolute inset-0" imgClassName="object-contain" loading="eager" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 p-3 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                  <ActionIcon icon={Maximize2} label="Open" onClick={() => setViewer(true)} />
                  <ActionIcon icon={Download} label="Download" loading={actions.busy === `download-${file.id}`} onClick={() => actions.download(gen, file.id === "primary" ? null : file, i)} />
                  <ActionIcon icon={Bookmark} label={gen.is_saved ? "Saved" : "Save"} active={gen.is_saved} onClick={() => actions.save(gen)} />
                  <ActionIcon icon={Heart} label="Favorite" active={isFav} onClick={() => actions.favorite(gen)} />
                  <ActionIcon icon={RefreshCw} label="Regenerate" onClick={onRegenerate} />
                  <ActionIcon icon={Trash2} label="Delete" destructive loading={actions.busy === `delete-file-${file.id}`} onClick={() => (file.id === "primary" ? actions.remove(gen) : actions.removeFile(gen, file))} />
                </div>
              </figure>
            ))}
          </div>
        )
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setViewer(true)}>
          <Maximize2 /> Open viewer
        </Button>
        <Button variant="outline" size="sm" onClick={() => actions.download(gen)} loading={actions.busy === `download-${gen.id}`}>
          <Download /> Download
        </Button>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => actions.remove(gen)} loading={actions.busy === `delete-${gen.id}`}>
          <Trash2 /> Delete
        </Button>
      </div>

      {viewer && <MediaViewer generation={gen} onClose={() => setViewer(false)} onChange={onChange} onDeleted={() => onDeleted()} />}
    </div>
  );
}
