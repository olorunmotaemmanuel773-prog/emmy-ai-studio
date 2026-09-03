import * as React from "react";
import { Film, ImageOff, Play } from "lucide-react";
import { resolveMediaUrl } from "@/lib/api/storage";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/card";

/** Resolves a storage reference (or URL) to a displayable, short-lived URL. */
export function useMediaUrl(ref: string | null | undefined) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(Boolean(ref));
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    if (!ref) {
      setUrl(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    resolveMediaUrl(ref)
      .then((u) => {
        if (!active) return;
        setUrl(u);
        setError(!u);
      })
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [ref]);

  return { url, loading, error };
}

export function SignedImage({
  src,
  alt,
  className,
  imgClassName,
  fallbackIcon: Fallback = ImageOff,
  loading = "lazy",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  imgClassName?: string;
  fallbackIcon?: React.ComponentType<{ className?: string }>;
  loading?: "lazy" | "eager";
}) {
  const { url, loading: resolving, error } = useMediaUrl(src);
  const [loaded, setLoaded] = React.useState(false);
  const [broken, setBroken] = React.useState(false);

  React.useEffect(() => {
    setLoaded(false);
    setBroken(false);
  }, [url]);

  return (
    <div className={cn("relative overflow-hidden bg-muted/40", className)}>
      {(resolving || (url && !loaded && !broken)) && <Skeleton className="absolute inset-0 rounded-none" />}
      {url && !broken ? (
        <img
          src={url}
          alt={alt}
          loading={loading}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setBroken(true)}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-500",
            loaded ? "opacity-100" : "opacity-0",
            imgClassName,
          )}
        />
      ) : (
        !resolving && (error || broken || !src) && (
          <div className="absolute inset-0 grid place-items-center text-muted-foreground/60">
            <Fallback className="h-6 w-6" />
          </div>
        )
      )}
    </div>
  );
}

export function SignedVideo({
  src,
  poster,
  className,
  controls = true,
  autoPlay,
  muted,
  loop,
  preload = "metadata",
}: {
  src: string | null | undefined;
  poster?: string | null;
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  preload?: "none" | "metadata" | "auto";
}) {
  const { url, loading, error } = useMediaUrl(src);
  const posterState = useMediaUrl(poster);

  if (loading) return <Skeleton className={cn("rounded-none", className)} />;
  if (!url || error) {
    return (
      <div className={cn("grid place-items-center bg-muted/40 text-muted-foreground/60", className)}>
        <Film className="h-6 w-6" />
      </div>
    );
  }
  return (
    <video
      src={url}
      poster={posterState.url ?? undefined}
      className={className}
      controls={controls}
      autoPlay={autoPlay}
      muted={muted}
      loop={loop}
      playsInline
      preload={preload}
    />
  );
}

/** Lightweight video thumbnail for cards: poster if available, else first frame. */
export function VideoThumb({ src, poster, className }: { src: string | null | undefined; poster?: string | null; className?: string }) {
  const { url } = useMediaUrl(poster ? null : src);
  return (
    <div className={cn("relative overflow-hidden bg-muted/40", className)}>
      {poster ? (
        <SignedImage src={poster} alt="Video thumbnail" className="absolute inset-0" />
      ) : url ? (
        <video src={`${url}#t=0.5`} className="h-full w-full object-cover" muted playsInline preload="metadata" />
      ) : (
        <Skeleton className="absolute inset-0 rounded-none" />
      )}
      <div className="absolute inset-0 grid place-items-center">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm">
          <Play className="h-5 w-5 translate-x-px" />
        </span>
      </div>
    </div>
  );
}
