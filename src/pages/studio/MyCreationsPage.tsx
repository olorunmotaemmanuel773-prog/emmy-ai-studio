import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Clapperboard, Filter, Heart, LayoutGrid, Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, Skeleton } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, Segmented } from "@/components/ui/select";
import { CreationCard, StoryboardCard } from "@/components/studio/CreationCard";
import { MediaViewer } from "@/components/studio/MediaViewer";
import { useAuth } from "@/contexts/AuthContext";
import { listGenerations, PAGE_SIZE } from "@/lib/api/generations";
import { listStoryboards, type StoryboardSummary } from "@/lib/api/storyboards";
import type { GenerationRecord, GenerationType } from "@/lib/database.types";
import { friendlyError } from "@/lib/utils";

export type CreationsTab = "all" | "images" | "videos" | "storyboards" | "favorites";

const TABS: { value: CreationsTab; label: string; to: string }[] = [
  { value: "all", label: "All", to: "/studio/creations" },
  { value: "images", label: "Images", to: "/studio/images" },
  { value: "videos", label: "Videos", to: "/studio/videos" },
  { value: "storyboards", label: "Storyboards", to: "/studio/storyboards" },
  { value: "favorites", label: "Favorites", to: "/studio/favorites" },
];

const TYPE_FILTERS: Record<"all" | "images" | "videos" | "favorites", { value: string; label: string }[]> = {
  all: [
    { value: "", label: "All types" },
    { value: "text-to-image", label: "Text to Image" },
    { value: "image-to-image", label: "Image to Image" },
    { value: "text-to-video", label: "Text to Video" },
    { value: "image-to-video", label: "Image to Video" },
    { value: "video-to-video", label: "Video to Video" },
    { value: "storyboard-scene-image", label: "Storyboard scenes" },
  ],
  images: [
    { value: "", label: "All image types" },
    { value: "text-to-image", label: "Text to Image" },
    { value: "image-to-image", label: "Image to Image" },
    { value: "storyboard-scene-image", label: "Storyboard scenes" },
  ],
  videos: [
    { value: "", label: "All video types" },
    { value: "text-to-video", label: "Text to Video" },
    { value: "image-to-video", label: "Image to Video" },
    { value: "video-to-video", label: "Video to Video" },
    { value: "storyboard-scene-video", label: "Storyboard videos" },
  ],
  favorites: [
    { value: "", label: "All types" },
    { value: "text-to-image", label: "Text to Image" },
    { value: "image-to-image", label: "Image to Image" },
    { value: "text-to-video", label: "Text to Video" },
    { value: "image-to-video", label: "Image to Video" },
    { value: "video-to-video", label: "Video to Video" },
  ],
};

function useDebounced<T>(value: T, delay = 350) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function MyCreationsPage({ tab }: { tab: CreationsTab }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("");
  const [showFilters, setShowFilters] = React.useState(false);
  const debounced = useDebounced(search);

  const [items, setItems] = React.useState<GenerationRecord[]>([]);
  const [storyboards, setStoryboards] = React.useState<StoryboardSummary[]>([]);
  const [page, setPage] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(false);
  const [total, setTotal] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [viewing, setViewing] = React.useState<GenerationRecord | null>(null);

  React.useEffect(() => {
    setTypeFilter("");
  }, [tab]);

  const fetchPage = React.useCallback(
    async (pageIndex: number, append: boolean) => {
      if (!user) return;
      append ? setLoadingMore(true) : setLoading(true);
      try {
        if (tab === "storyboards") {
          const res = await listStoryboards(user.id, { page: pageIndex, pageSize: 12, search: debounced });
          setStoryboards((prev) => (append ? [...prev, ...res.items] : res.items));
          setHasMore(res.hasMore);
          setTotal(res.total);
        } else {
          const res = await listGenerations({
            userId: user.id,
            kind: tab === "images" ? "image" : tab === "videos" ? "video" : "all",
            types: typeFilter ? [typeFilter as GenerationType] : undefined,
            favoritesOnly: tab === "favorites",
            savedOnly: true,
            statuses: ["completed"],
            search: debounced,
            page: pageIndex,
            pageSize: PAGE_SIZE,
          });
          setItems((prev) => (append ? [...prev, ...res.items] : res.items));
          setHasMore(res.hasMore);
          setTotal(res.total);
          if (tab === "all" && pageIndex === 0) {
            const sb = await listStoryboards(user.id, { pageSize: 4, search: debounced }).catch(() => ({ items: [] as StoryboardSummary[] }));
            setStoryboards(sb.items);
          }
        }
        setPage(pageIndex);
      } catch (err) {
        toast.error(friendlyError(err, "We couldn't load your creations."));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user, tab, debounced, typeFilter],
  );

  React.useEffect(() => {
    void fetchPage(0, false);
  }, [fetchPage]);

  const patch = (gen: GenerationRecord) => {
    setItems((list) => list.map((g) => (g.id === gen.id ? gen : g)).filter((g) => (tab === "favorites" ? g.favorites.length > 0 : g.is_saved)));
    setViewing((v) => (v?.id === gen.id ? gen : v));
  };
  const drop = (id: string) => {
    setItems((list) => list.filter((g) => g.id !== id));
    setTotal((t) => (t === null ? t : Math.max(0, t - 1)));
  };

  const heading = TABS.find((t) => t.value === tab)!;
  const filterOptions = tab !== "storyboards" ? TYPE_FILTERS[tab] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">My Creations</p>
          <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
            {heading.label}
            {total !== null && <span className="ml-3 align-middle text-base font-medium text-muted-foreground">{total}</span>}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 lg:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === "storyboards" ? "Search storyboards…" : "Search prompts…"}
              className="pl-10 pr-9"
              aria-label="Search"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear search">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {filterOptions && (
            <Button variant={showFilters || typeFilter ? "secondary" : "outline"} size="icon" onClick={() => setShowFilters((v) => !v)} aria-label="Filters" title="Filters">
              <Filter />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented options={TABS.map((t) => ({ value: t.value, label: t.label }))} value={tab} onChange={(v) => navigate(TABS.find((t) => t.value === v)!.to)} />
        {showFilters && filterOptions && (
          <div className="w-full sm:w-64 animate-fade-in">
            <NativeSelect options={filterOptions} value={typeFilter} onChange={setTypeFilter} />
          </div>
        )}
      </div>

      {tab === "storyboards" ? (
        loading ? (
          <GridSkeleton />
        ) : storyboards.length === 0 ? (
          <EmptyState
            icon={Clapperboard}
            title={debounced ? "No storyboards match your search" : "No storyboards yet"}
            description="Turn a story idea into director-ready scenes with the Story to Storyboard tool."
            action={
              <Button asChild>
                <Link to="/studio/create?mode=story-to-storyboard">Create a storyboard</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {storyboards.map((s) => (
              <StoryboardCard key={s.id} storyboard={s} />
            ))}
          </div>
        )
      ) : (
        <>
          {tab === "all" && storyboards.length > 0 && !loading && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Storyboards</h2>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/studio/storyboards">
                    View all <ArrowRight />
                  </Link>
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                {storyboards.map((s) => (
                  <StoryboardCard key={s.id} storyboard={s} />
                ))}
              </div>
            </section>
          )}
          {loading ? (
            <GridSkeleton />
          ) : items.length === 0 ? (
            <EmptyState
              icon={tab === "favorites" ? Heart : tab === "all" ? LayoutGrid : Sparkles}
              title={debounced || typeFilter ? "Nothing matches your search" : tab === "favorites" ? "No favorites yet" : "No saved creations yet"}
              description={
                tab === "favorites"
                  ? "Tap the heart on any creation to keep it close."
                  : "Generate something in the studio and press Save to keep it here. Unsaved results stay in your History."
              }
              action={
                <Button asChild>
                  <Link to="/studio/create">Start creating</Link>
                </Button>
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {items.map((g) => (
                  <CreationCard key={g.id} generation={g} onOpen={setViewing} onChange={patch} onDeleted={drop} />
                ))}
              </div>
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <Button variant="outline" onClick={() => fetchPage(page + 1, true)} loading={loadingMore}>
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      <MediaViewer generation={viewing} onClose={() => setViewing(null)} onChange={patch} onDeleted={drop} />
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />
      ))}
    </div>
  );
}
