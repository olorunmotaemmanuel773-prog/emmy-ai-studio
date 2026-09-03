import * as React from "react";
import { CheckCircle2, Film, ImagePlus, Loader2, RefreshCw, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { BUCKETS } from "@/lib/supabase";
import {
  captureVideoThumbnail,
  IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  uploadBlob,
  uploadUserFile,
  validateFile,
  VIDEO_MIME_TYPES,
} from "@/lib/api/storage";
import { cn, formatBytes, friendlyError } from "@/lib/utils";

export interface UploadedMedia {
  ref: string;
  thumbnailRef?: string | null;
  previewUrl: string;
  name: string;
  size: number;
  type: string;
}

export function UploadDropzone({
  kind,
  label,
  value,
  onChange,
  className,
  hint,
}: {
  kind: "image" | "video";
  label?: string;
  value: UploadedMedia | null;
  onChange: (media: UploadedMedia | null) => void;
  className?: string;
  hint?: string;
}) {
  const { user } = useAuth();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const accept = (kind === "video" ? VIDEO_MIME_TYPES : IMAGE_MIME_TYPES).join(",");
  const maxLabel = formatBytes(kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES);

  const handleFile = async (file: File | undefined | null) => {
    if (!file || !user) return;
    setError(null);
    const check = validateFile(file, kind);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setUploading(true);
    const previewUrl = URL.createObjectURL(file);
    try {
      const { ref } = await uploadUserFile(file, { kind, userId: user.id, folder: "uploads" });
      let thumbnailRef: string | null = null;
      if (kind === "video") {
        const thumb = await captureVideoThumbnail(file);
        if (thumb) {
          const path = `${user.id}/uploads/${ref.split("/").pop()?.replace(/\.\w+$/, "")}-thumb.jpg`;
          thumbnailRef = await uploadBlob(thumb, { bucket: BUCKETS.images, path, contentType: "image/jpeg" }).catch(() => null);
        }
      }
      onChange({ ref, thumbnailRef, previewUrl, name: file.name, size: file.size, type: file.type });
    } catch (err) {
      URL.revokeObjectURL(previewUrl);
      const message = friendlyError(err, "We couldn't upload that file. Please try again.");
      setError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const clear = () => {
    if (value) URL.revokeObjectURL(value.previewUrl);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className={cn("space-y-2.5", className)}>
      {label && <Label>{label}</Label>}
      {value ? (
        <div className="relative overflow-hidden rounded-2xl border border-border bg-black/40">
          {kind === "video" ? (
            <video src={value.previewUrl} className="max-h-72 w-full object-contain" controls muted playsInline />
          ) : (
            <img src={value.previewUrl} alt="Uploaded preview" className="max-h-72 w-full object-contain" />
          )}
          <div className="flex items-center justify-between gap-3 border-t border-border bg-card/80 px-3 py-2 text-xs">
            <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              <span className="truncate">{value.name}</span>
              <span className="shrink-0">· {formatBytes(value.size)}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
                <RefreshCw /> Replace
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={clear} aria-label="Remove file">
                <X />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void handleFile(e.dataTransfer.files?.[0]);
          }}
          disabled={uploading}
          className={cn(
            "relative flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all",
            dragging ? "border-primary bg-primary/10" : "border-border bg-background/40 dark:bg-white/[0.02] hover:border-primary/50 hover:bg-primary/5",
          )}
        >
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : kind === "video" ? <Film className="h-5 w-5" /> : <ImagePlus className="h-5 w-5" />}
          </div>
          <div>
            <p className="text-sm font-semibold">
              {uploading ? "Uploading securely…" : `Drop ${kind === "video" ? "a video" : "an image"} here or click to browse`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {kind === "video" ? "MP4, WebM or MOV" : "PNG, JPG or WebP"} · up to {maxLabel}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
            <UploadCloud className="h-3.5 w-3.5" /> Upload {kind}
          </span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
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
