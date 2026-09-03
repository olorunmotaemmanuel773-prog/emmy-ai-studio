import * as React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  deleteGeneration,
  deleteMediaFile,
  setGenerationPublic,
  setGenerationSaved,
  toggleFavorite,
} from "@/lib/api/generations";
import { downloadMedia, extensionFromRef } from "@/lib/api/storage";
import type { GenerationRecord, MediaFile } from "@/lib/database.types";
import { cn, friendlyError, isVideoType } from "@/lib/utils";

export function modeForType(type: GenerationRecord["type"]) {
  switch (type) {
    case "storyboard-scene-image":
    case "storyboard-scene-video":
      return null;
    default:
      return type;
  }
}

export function useCreationActions(opts: {
  onChange?: (gen: GenerationRecord) => void;
  onDeleted?: (id: string) => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = React.useState<string | null>(null);

  const wrap = async (key: string, fn: () => Promise<void>, fallback: string) => {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      toast.error(friendlyError(err, fallback));
    } finally {
      setBusy(null);
    }
  };

  return {
    busy,

    download: (gen: GenerationRecord, file?: MediaFile | null, index = 0) => {
      const ref = file?.file_url ?? gen.result_url;
      if (!ref) return toast.error("This file is not available to download.");
      const ext = extensionFromRef(ref, isVideoType(gen.type) ? "mp4" : "png");
      const name = `emmyai-${gen.type}-${gen.id.slice(0, 8)}${index ? `-${index + 1}` : ""}.${ext}`;
      return wrap(`download-${file?.id ?? gen.id}`, () => downloadMedia(ref, name), "We couldn't download that file.");
    },

    favorite: (gen: GenerationRecord) =>
      wrap(
        `fav-${gen.id}`,
        async () => {
          if (!user) return;
          const isFav = await toggleFavorite(gen, user.id);
          opts.onChange?.({
            ...gen,
            is_saved: isFav ? true : gen.is_saved,
            favorites: isFav ? [{ id: "local" }] : [],
          });
          toast.success(isFav ? "Added to favorites" : "Removed from favorites");
        },
        "We couldn't update your favorites.",
      ),

    save: (gen: GenerationRecord) =>
      wrap(
        `save-${gen.id}`,
        async () => {
          const next = !gen.is_saved;
          await setGenerationSaved(gen.id, next);
          opts.onChange?.({ ...gen, is_saved: next });
          toast.success(next ? "Saved to My Creations" : "Removed from My Creations");
        },
        "We couldn't save this creation.",
      ),

    share: (gen: GenerationRecord, isPublic: boolean) =>
      wrap(
        `share-${gen.id}`,
        async () => {
          await setGenerationPublic(gen.id, isPublic);
          opts.onChange?.({ ...gen, is_public: isPublic, is_saved: isPublic ? true : gen.is_saved });
          toast.success(isPublic ? "Shared to the public gallery" : "Removed from the public gallery");
        },
        "We couldn't update sharing.",
      ),

    remove: (gen: GenerationRecord) =>
      wrap(
        `delete-${gen.id}`,
        async () => {
          await deleteGeneration(gen);
          opts.onDeleted?.(gen.id);
          toast.success("Creation deleted");
        },
        "We couldn't delete this creation.",
      ),

    removeFile: (gen: GenerationRecord, file: MediaFile) =>
      wrap(
        `delete-file-${file.id}`,
        async () => {
          const remaining = gen.media_files.filter((m) => m.id !== file.id);
          if (remaining.length === 0) {
            await deleteGeneration(gen);
            opts.onDeleted?.(gen.id);
          } else {
            await deleteMediaFile(file);
            const patched: GenerationRecord = {
              ...gen,
              media_files: remaining,
              result_url: gen.result_url === file.file_url ? remaining[0].file_url : gen.result_url,
            };
            opts.onChange?.(patched);
          }
          toast.success("Image deleted");
        },
        "We couldn't delete this image.",
      ),

    regenerate: (gen: GenerationRecord) => {
      const mode = modeForType(gen.type);
      if (!mode) {
        const sceneId = gen.storyboard_scene_id;
        toast.message("Open the storyboard to regenerate this scene.");
        navigate(sceneId ? "/studio/storyboards" : "/studio/storyboards");
        return;
      }
      navigate(`/studio/create?mode=${mode}&regen=${gen.id}`);
    },
  };
}

export function ActionIcon({
  icon: Icon,
  label,
  onClick,
  active,
  loading,
  destructive,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  active?: boolean;
  loading?: boolean;
  destructive?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={loading}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-black/55 text-white backdrop-blur-md transition-all hover:bg-black/75 hover:scale-105 disabled:opacity-60",
        active && "bg-magenta/80 border-magenta/60 hover:bg-magenta",
        destructive && "hover:bg-destructive/80",
        className,
      )}
    >
      <Icon className={cn("h-4 w-4", loading && "animate-pulse", active && "fill-current")} />
    </button>
  );
}
