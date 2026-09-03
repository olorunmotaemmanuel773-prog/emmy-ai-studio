import * as React from "react";
import { Bookmark, ChevronLeft, ChevronRight, Download, Globe, Heart, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/select";
import { labelFor } from "@/lib/ai/options";
import { IMAGE_STYLES, VIDEO_STYLES, CAMERA_MOVEMENTS } from "@/lib/ai/options";
import type { GenerationRecord } from "@/lib/database.types";
import { formatDateTime, GENERATION_TYPE_LABELS, isVideoType } from "@/lib/utils";
import { useCreationActions } from "./CreationActions";
import { SignedImage, SignedVideo } from "./SignedMedia";

export function MediaViewer({
  generation,
  onClose,
  onChange,
  onDeleted,
}: {
  generation: GenerationRecord | null;
  onClose: () => void;
  onChange?: (gen: GenerationRecord) => void;
  onDeleted?: (id: string) => void;
}) {
  const [index, setIndex] = React.useState(0);
  const [confirm, setConfirm] = React.useState(false);
  const actions = useCreationActions({
    onChange,
    onDeleted: (id) => {
      onDeleted?.(id);
      onClose();
    },
  });

  React.useEffect(() => setIndex(0), [generation?.id]);

  if (!generation) return null;
  const gen = generation;
  const video = isVideoType(gen.type);
  const files = gen.media_files.length ? gen.media_files : gen.result_url ? [{ id: "primary", file_url: gen.result_url, thumbnail_url: gen.thumbnail_url }] : [];
  const current = files[Math.min(index, Math.max(0, files.length - 1))];
  const currentFile = gen.media_files.find((m) => m.id === current?.id) ?? null;
  const isFav = gen.favorites.length > 0;
  const meta = gen.metadata ?? {};
  const styleLabel = labelFor(video ? VIDEO_STYLES : IMAGE_STYLES, gen.style ?? "");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="full" className="p-0 overflow-hidden bg-[#070a14] text-white border-white/10 max-h-[94dvh]">
        <DialogTitle className="sr-only">{GENERATION_TYPE_LABELS[gen.type]}</DialogTitle>
        <DialogDescription className="sr-only">{gen.prompt}</DialogDescription>
        <div className="grid max-h-[94dvh] lg:grid-cols-[1fr_340px]">
          {/* Media */}
          <div className="relative flex min-h-[280px] items-center justify-center bg-black/60 lg:min-h-[560px]">
            {current ? (
              video ? (
                <SignedVideo src={current.file_url} poster={current.thumbnail_url} className="max-h-[70dvh] w-full object-contain lg:max-h-[94dvh]" controls autoPlay />
              ) : (
                <SignedImage
                  src={current.file_url}
                  alt={gen.prompt}
                  className="h-full w-full bg-transparent"
                  imgClassName="object-contain max-h-[70dvh] lg:max-h-[94dvh]"
                  loading="eager"
                />
              )
            ) : (
              <p className="p-10 text-sm text-white/60">This creation has no media file.</p>
            )}
            {files.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setIndex((i) => (i - 1 + files.length) % files.length)}
                  className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/60 backdrop-blur hover:bg-black/80"
                  aria-label="Previous"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIndex((i) => (i + 1) % files.length)}
                  className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/60 backdrop-blur hover:bg-black/80"
                  aria-label="Next"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/60 p-1.5 backdrop-blur">
                  {files.map((f, i) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setIndex(i)}
                      className={`h-2 w-2 rounded-full ${i === index ? "bg-white" : "bg-white/40"}`}
                      aria-label={`Image ${i + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Info panel */}
          <aside className="flex max-h-[50dvh] flex-col overflow-y-auto border-t border-white/10 lg:max-h-[94dvh] lg:border-l lg:border-t-0">
            <div className="space-y-5 p-5 pr-14">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={video ? "magenta" : "violet"}>{GENERATION_TYPE_LABELS[gen.type]}</Badge>
                {gen.is_public && (
                  <Badge variant="success">
                    <Globe className="h-3 w-3" /> Public
                  </Badge>
                )}
                {files.length > 1 && <Badge variant="glass">{index + 1} / {files.length}</Badge>}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <PanelButton icon={Download} label="Download" loading={actions.busy?.startsWith("download")} onClick={() => actions.download(gen, currentFile, index)} />
                <PanelButton icon={Heart} label={isFav ? "Favorited" : "Favorite"} active={isFav} loading={actions.busy === `fav-${gen.id}`} onClick={() => actions.favorite(gen)} />
                <PanelButton icon={Bookmark} label={gen.is_saved ? "Saved" : "Save"} active={gen.is_saved} loading={actions.busy === `save-${gen.id}`} onClick={() => actions.save(gen)} />
                <PanelButton icon={RefreshCw} label="Regenerate" onClick={() => actions.regenerate(gen)} />
                <PanelButton icon={Trash2} label="Delete" destructive onClick={() => setConfirm(true)} />
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">Share to public gallery</p>
                  <p className="text-xs text-white/50">Visible to everyone on the Gallery page.</p>
                </div>
                <Switch checked={gen.is_public} onCheckedChange={(v) => actions.share(gen, v)} disabled={gen.status !== "completed"} aria-label="Share publicly" />
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/40">Prompt</p>
                <p className="mt-2 text-sm leading-relaxed text-white/85 whitespace-pre-wrap">{gen.prompt}</p>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Owner" value="You" />
                <Info label="Style" value={styleLabel || "—"} />
                <Info label="Aspect ratio" value={gen.aspect_ratio ?? "—"} />
                {typeof meta.duration === "number" && <Info label="Duration" value={`${meta.duration}s`} />}
                {typeof meta.cameraMovement === "string" && <Info label="Camera" value={labelFor(CAMERA_MOVEMENTS, meta.cameraMovement)} />}
                {typeof meta.quality === "string" && <Info label="Quality" value={meta.quality === "high" ? "High" : "Standard"} />}
                <Info label="Created" value={formatDateTime(gen.created_at)} />
                <Info label="Status" value={gen.status} />
                {gen.provider && <Info label="Engine" value={gen.provider} />}
              </dl>
            </div>
          </aside>
        </div>
      </DialogContent>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this creation?"
        description="This permanently removes the file from your studio. This can't be undone."
        confirmLabel="Delete"
        destructive
        loading={actions.busy === `delete-${gen.id}`}
        onConfirm={async () => {
          await actions.remove(gen);
          setConfirm(false);
        }}
      />
    </Dialog>
  );
}

function PanelButton({
  icon: Icon,
  label,
  onClick,
  active,
  loading,
  destructive,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  active?: boolean;
  loading?: boolean;
  destructive?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="glass"
      onClick={onClick}
      loading={loading}
      className={`h-auto flex-col gap-1.5 rounded-2xl py-3 text-[11px] font-semibold text-white border-white/10 ${
        active ? "bg-magenta/25 border-magenta/40" : ""
      } ${destructive ? "hover:bg-destructive/30 hover:text-white" : ""}`}
    >
      {!loading && <Icon className={active ? "fill-current" : ""} />}
      {label}
    </Button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{label}</dt>
      <dd className="mt-0.5 truncate text-[13px] capitalize text-white/85" title={value}>
        {value}
      </dd>
    </div>
  );
}
