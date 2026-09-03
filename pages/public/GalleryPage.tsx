import * as React from "react";
import { Link } from "react-router-dom";
import { Globe, Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, EmptyState, Skeleton } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SignedImage, SignedVideo, VideoThumb } from "@/components/studio/SignedMedia";
import { useAuth } from "@/contexts/AuthContext";
import { listPublicGenerations } from "@/lib/api/generations";
import type { PublicGalleryItem } from "@/lib/database.types";
import { isSupabaseConfigured, NOT_CONFIGURED_MESSAGE } from "@/lib/supabase";
import { formatDate, GENERATION_TYPE_LABELS, isVideoType } from "@/lib/utils";

export default function GalleryPage() {
  const { user } = useAuth();
  const [items, setItems] = React.useState<PublicGalleryItem[]>([]);
  const [page, setPage] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(false);
  const [loading, setLoading] = React.useState(isSupabaseConfigured);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [open, setOpen] = React.useState<PublicGalleryItem | null>(null);

  const load = React.useCallback(async (pageIndex: number, append: boolean) => {
    if (!isSupabaseConfigured) return;
    append ? setLoadingMore(true) : setLoading(true);
    try {
      const res = await listPublicGenerations(pageIndex, 24);
      setItems((prev) => (append ? [...prev, ...res.items] : res.items));
      setHasMore(res.hasMore);
      setPage(pageIndex);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  React.useEffect(() => {
    void load(0, false);
  }, [load]);

  return (
    <div className="relative">
      <div className="aurora opacity-50" />
      <section className="relative mx-auto max-w-7xl px-4 pb-8 pt-16 sm:px-6 lg:px-8 lg:pt-24">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Gallery</p>
            <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">Made in the studio</h1>
            <p className="mt-4 max-w-xl text-muted-foreground leading-relaxed">
              Real creations that members chose to share publicly. Open any creation in your studio and switch on "Share to public gallery" to feature yours.
            </p>
          </div>
          <Button size="lg" asChild>
            <Link to={user ? "/studio/create" : "/signup"}>
              <Sparkles /> Start Creating
            </Link>
          </Button>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        {!isSupabaseConfigured ? (
          <EmptyState icon={Globe} title="Gallery not connected" description={NOT_CONFIGURED_MESSAGE} />
        ) : loading ? (
          <div className="columns-2 gap-4 md:columns-3 xl:columns-4 [&>*]:mb-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className={`w-full rounded-2xl ${i % 3 === 0 ? "h-72" : i % 3 === 1 ? "h-52" : "h-64"}`} />
            ))}
          </div>
        ) : failed ? (
          <EmptyState icon={Globe} title="We couldn't load the gallery" description="Please check your connection and try again." action={<Button variant="outline" onClick={() => load(0, false)}>Retry</Button>} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="The gallery is waiting for its first creation"
            description="Nothing has been shared yet. Be the first — create something in the studio and share it publicly."
            action={
              <Button asChild>
                <Link to={user ? "/studio/create" : "/signup"}>Create the first one</Link>
              </Button>
            }
          />
        ) : (
          <>
            <div className="columns-2 gap-4 md:columns-3 xl:columns-4 [&>*]:mb-4">
              {items.map((g) => {
                const video = isVideoType(g.type);
                const [w, h] = (g.aspect_ratio ?? "1:1").split(":").map(Number);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setOpen(g)}
                    className="group relative block w-full break-inside-avoid overflow-hidden rounded-2xl border border-border bg-card/60 text-left transition-all hover:-translate-y-0.5 hover:shadow-glow"
                    style={{ aspectRatio: `${w}/${h}` }}
                  >
                    {video ? <VideoThumb src={g.result_url} poster={g.thumbnail_url} className="absolute inset-0" /> : <SignedImage src={g.result_url} alt={g.prompt} className="absolute inset-0" imgClassName="transition-transform duration-500 group-hover:scale-[1.03]" />}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="absolute inset-x-0 bottom-0 p-3 text-white opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                      <p className="line-clamp-2 text-xs font-medium">{g.prompt}</p>
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-white/70">
                        <Avatar src={g.creator_avatar} name={g.creator_name} size="sm" className="h-5 w-5 text-[9px]" />
                        <span className="truncate">
                          {user?.id === g.user_id ? "You" : g.creator_name} · {formatDate(g.created_at)}
                        </span>
                      </div>
                    </div>
                    <Badge variant={video ? "magenta" : "violet"} className="absolute left-3 top-3 backdrop-blur-md">
                      {GENERATION_TYPE_LABELS[g.type]}
                    </Badge>
                  </button>
                );
              })}
            </div>
            {hasMore && (
              <div className="mt-8 flex justify-center">
                <Button variant="outline" onClick={() => load(page + 1, true)} loading={loadingMore}>
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      <Dialog open={Boolean(open)} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent size="full" className="overflow-hidden bg-[#070a14] p-0 text-white border-white/10">
          {open && (
            <div className="grid lg:grid-cols-[1fr_320px]">
              <DialogTitle className="sr-only">{GENERATION_TYPE_LABELS[open.type]}</DialogTitle>
              <DialogDescription className="sr-only">{open.prompt}</DialogDescription>
              <div className="flex min-h-[300px] items-center justify-center bg-black/60">
                {isVideoType(open.type) ? (
                  <SignedVideo src={open.result_url} poster={open.thumbnail_url} className="max-h-[80dvh] w-full object-contain" controls autoPlay />
                ) : (
                  <SignedImage src={open.result_url} alt={open.prompt} className="h-full w-full bg-transparent" imgClassName="object-contain max-h-[80dvh]" loading="eager" />
                )}
              </div>
              <aside className="space-y-4 border-t border-white/10 p-5 pr-14 lg:border-l lg:border-t-0">
                <Badge variant={isVideoType(open.type) ? "magenta" : "violet"}>{GENERATION_TYPE_LABELS[open.type]}</Badge>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                  <Avatar src={open.creator_avatar} name={open.creator_name} size="sm" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Created by</p>
                    <p className="truncate text-sm font-semibold text-white/90">{user?.id === open.user_id ? "You" : open.creator_name}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/40">Prompt</p>
                  <p className="mt-2 text-sm leading-relaxed text-white/85">{open.prompt}</p>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Style</dt>
                    <dd className="mt-0.5 capitalize text-white/85">{open.style?.replace(/-/g, " ") ?? "—"}</dd>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Ratio</dt>
                    <dd className="mt-0.5 text-white/85">{open.aspect_ratio ?? "—"}</dd>
                  </div>
                  <div className="col-span-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Shared</dt>
                    <dd className="mt-0.5 text-white/85">{formatDate(open.created_at)}</dd>
                  </div>
                </dl>
                <Button className="w-full" asChild>
                  <Link to={user ? "/studio/create" : "/signup"}>
                    <Sparkles /> Make your own
                  </Link>
                </Button>
              </aside>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
