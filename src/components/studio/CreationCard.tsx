import * as React from "react";
import { Link } from "react-router-dom";
import { Clapperboard, Download, Heart, Images, Maximize2, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import type { GenerationRecord } from "@/lib/database.types";
import type { StoryboardSummary } from "@/lib/api/storyboards";
import { cn, GENERATION_TYPE_LABELS, isVideoType, timeAgo, truncate } from "@/lib/utils";
import { labelFor, STORY_GENRES } from "@/lib/ai/options";
import { ActionIcon, useCreationActions } from "./CreationActions";
import { SignedImage, VideoThumb } from "./SignedMedia";

export function CreationCard({
  generation,
  onOpen,
  onChange,
  onDeleted,
  className,
}: {
  generation: GenerationRecord;
  onOpen: (gen: GenerationRecord) => void;
  onChange?: (gen: GenerationRecord) => void;
  onDeleted?: (id: string) => void;
  className?: string;
}) {
  const gen = generation;
  const { user, profile } = useAuth();
  const actions = useCreationActions({ onChange, onDeleted });
  const [confirm, setConfirm] = React.useState(false);
  const video = isVideoType(gen.type);
  const ownerName = gen.user_id === user?.id ? "You" : "Creator";
  const isFav = gen.favorites.length > 0;
  const thumb = gen.media_files[0]?.file_url ?? gen.result_url;
  const poster = gen.media_files[0]?.thumbnail_url ?? gen.thumbnail_url;
  const ratio = gen.aspect_ratio ?? "1:1";
  const [w, h] = ratio.split(":").map(Number);
  const tall = h > w;

  return (
    <>
      <article
        className={cn(
          "group relative overflow-hidden rounded-2xl border border-border bg-card/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glow cursor-pointer",
          className,
        )}
        onClick={() => onOpen(gen)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onOpen(gen)}
        aria-label={`Open ${GENERATION_TYPE_LABELS[gen.type]}: ${truncate(gen.prompt, 60)}`}
      >
        <div className={cn("relative w-full", tall ? "aspect-[4/5]" : "aspect-[4/3]")}>
          {video ? (
            <VideoThumb src={thumb} poster={poster} className="absolute inset-0" />
          ) : (
            <SignedImage src={thumb} alt={gen.prompt} className="absolute inset-0" imgClassName="transition-transform duration-500 group-hover:scale-[1.03]" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent opacity-80" />
          <div className="absolute left-3 top-3 flex items-center gap-1.5">
            <Badge variant={video ? "magenta" : "violet"} className="backdrop-blur-md">
              {GENERATION_TYPE_LABELS[gen.type]}
            </Badge>
            {gen.media_files.length > 1 && (
              <Badge variant="glass" className="text-white">
                <Images className="h-3 w-3" /> {gen.media_files.length}
              </Badge>
            )}
          </div>
          <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
            <ActionIcon icon={Maximize2} label="Open" onClick={() => onOpen(gen)} />
            <ActionIcon icon={Download} label="Download" loading={actions.busy === `download-${gen.id}`} onClick={() => actions.download(gen)} />
            <ActionIcon icon={Heart} label={isFav ? "Unfavorite" : "Favorite"} active={isFav} loading={actions.busy === `fav-${gen.id}`} onClick={() => actions.favorite(gen)} />
            <ActionIcon icon={Trash2} label="Delete" destructive onClick={() => setConfirm(true)} />
          </div>
          <div className="absolute inset-x-0 bottom-0 p-3.5 text-white">
            <p className="line-clamp-2 text-[13px] font-medium leading-snug drop-shadow">{gen.prompt}</p>
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-white/60">
              <Avatar src={gen.user_id === user?.id ? profile?.avatar_url : null} name={gen.user_id === user?.id ? profile?.full_name : ownerName} size="sm" className="h-4 w-4 text-[8px]" />
              <span className="truncate">
                {ownerName} · {timeAgo(gen.created_at)}
              </span>
              {gen.is_public && <span className="rounded-md bg-emerald-500/25 px-1.5 text-[9px] font-bold uppercase tracking-wider text-emerald-200">Public</span>}
            </div>
          </div>
        </div>
      </article>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this creation?"
        description="This permanently removes it from your studio."
        confirmLabel="Delete"
        destructive
        loading={actions.busy === `delete-${gen.id}`}
        onConfirm={async () => {
          await actions.remove(gen);
          setConfirm(false);
        }}
      />
    </>
  );
}

export function StoryboardCard({ storyboard, className }: { storyboard: StoryboardSummary; className?: string }) {
  const scenes = storyboard.storyboard_scenes ?? [];
  const withImages = scenes.filter((s) => s.image_url);
  const cover = storyboard.cover_url ?? withImages[0]?.image_url ?? null;
  return (
    <Link
      to={`/studio/storyboards/${storyboard.id}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glow",
        className,
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {cover ? (
          <SignedImage src={cover} alt={storyboard.title} className="absolute inset-0" imgClassName="transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-electric/30 via-violet/20 to-magenta/30">
            <div className="absolute inset-0 grid-fade" />
            <Clapperboard className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-white/70" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          <Badge variant="default" className="backdrop-blur-md">Storyboard</Badge>
          <Badge variant="glass" className="text-white">{scenes.length} scenes</Badge>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-3.5 text-white">
          <p className="font-display text-[15px] font-semibold leading-snug">{storyboard.title}</p>
          <p className="mt-0.5 text-[11px] text-white/60">
            {labelFor(STORY_GENRES, storyboard.genre)} · {timeAgo(storyboard.created_at)}
          </p>
        </div>
      </div>
      {scenes.length > 0 && (
        <div className="flex gap-1 p-2">
          {scenes.slice(0, 6).map((s) => (
            <div key={s.id} className="relative h-8 flex-1 overflow-hidden rounded-md bg-muted">
              {s.image_url && <SignedImage src={s.image_url} alt={s.title} className="absolute inset-0" />}
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}
