import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clapperboard, Film, Heart, Image as ImageIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, SectionHeading, Skeleton } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreationCard, StoryboardCard } from "@/components/studio/CreationCard";
import { MediaViewer } from "@/components/studio/MediaViewer";
import { useAuth } from "@/contexts/AuthContext";
import { getGenerationCounts, IMAGE_TYPES, listRecentGenerations, VIDEO_TYPES, type GenerationCounts } from "@/lib/api/generations";
import { listStoryboards, type StoryboardSummary } from "@/lib/api/storyboards";
import type { GenerationRecord } from "@/lib/database.types";
import { cn, friendlyError } from "@/lib/utils";
import { CREATE_MODES } from "./CreatePage";

export default function DashboardHome() {
  const { user, profile } = useAuth();
  const [counts, setCounts] = React.useState<GenerationCounts | null>(null);
  const [recent, setRecent] = React.useState<GenerationRecord[] | null>(null);
  const [images, setImages] = React.useState<GenerationRecord[] | null>(null);
  const [videos, setVideos] = React.useState<GenerationRecord[] | null>(null);
  const [storyboards, setStoryboards] = React.useState<StoryboardSummary[] | null>(null);
  const [viewing, setViewing] = React.useState<GenerationRecord | null>(null);

  const load = React.useCallback(async () => {
    if (!user) return;
    try {
      const [c, r, i, v, s] = await Promise.all([
        getGenerationCounts(user.id),
        listRecentGenerations(user.id, null, 8),
        listRecentGenerations(user.id, IMAGE_TYPES, 4),
        listRecentGenerations(user.id, VIDEO_TYPES, 4),
        listStoryboards(user.id, { pageSize: 4 }),
      ]);
      setCounts(c);
      setRecent(r);
      setImages(i);
      setVideos(v);
      setStoryboards(s.items);
    } catch (err) {
      toast.error(friendlyError(err, "We couldn't load your studio. Please refresh."));
      setRecent([]);
      setImages([]);
      setVideos([]);
      setStoryboards([]);
    }
  }, [user]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const patch = (gen: GenerationRecord) => {
    const map = (list: GenerationRecord[] | null) => list?.map((g) => (g.id === gen.id ? gen : g)) ?? null;
    setRecent(map);
    setImages(map);
    setVideos(map);
    setViewing((v) => (v?.id === gen.id ? gen : v));
  };
  const drop = (id: string) => {
    const filter = (list: GenerationRecord[] | null) => list?.filter((g) => g.id !== id) ?? null;
    setRecent(filter);
    setImages(filter);
    setVideos(filter);
    void load();
  };

  const firstName = (profile?.full_name || user?.user_metadata?.full_name || "Creator").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-10">
      {/* Welcome */}
      <section className="relative overflow-hidden rounded-3xl border border-border glass p-6 sm:p-8">
        <div className="aurora opacity-60" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">{greeting}</p>
            <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
              Welcome back, {firstName}. <span className="text-gradient">Ready to create?</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Every tool in the studio is free and ready. Pick a starting point below or continue where you left off.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-auto">
            <Stat icon={ImageIcon} label="Images" value={counts?.images} to="/studio/images" />
            <Stat icon={Film} label="Videos" value={counts?.videos} to="/studio/videos" />
            <Stat icon={Clapperboard} label="Storyboards" value={counts?.storyboards} to="/studio/storyboards" />
            <Stat icon={Heart} label="Favorites" value={counts?.favorites} to="/studio/favorites" />
          </div>
        </div>
      </section>

      {/* Quick create */}
      <section>
        <SectionHeading eyebrow="Quick create" title="Start something new" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {CREATE_MODES.map((m) => (
            <Link
              key={m.id}
              to={`/studio/create?mode=${m.id}`}
              className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-border bg-card/60 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow"
            >
              <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg", m.accent)}>
                <m.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[15px] font-semibold uppercase tracking-wide">{m.label}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">{m.description}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </section>

      {/* Recent creations */}
      <RecentSection
        title="Recent creations"
        to="/studio/creations"
        items={recent}
        onOpen={setViewing}
        onChange={patch}
        onDeleted={drop}
        empty={
          <EmptyState
            icon={Sparkles}
            title="Nothing here yet"
            description="Your saved creations will appear here. Generate something and hit Save to keep it."
            action={
              <Button asChild>
                <Link to="/studio/create">Start creating</Link>
              </Button>
            }
          />
        }
      />

      <div className="grid gap-10 xl:grid-cols-2">
        <RecentSection title="Recent images" to="/studio/images" items={images} onOpen={setViewing} onChange={patch} onDeleted={drop} compact empty={<MiniEmpty text="No images yet." to="/studio/create?mode=text-to-image" />} />
        <RecentSection title="Recent videos" to="/studio/videos" items={videos} onOpen={setViewing} onChange={patch} onDeleted={drop} compact empty={<MiniEmpty text="No videos yet." to="/studio/create?mode=text-to-video" />} />
      </div>

      <section>
        <SectionHeading
          title="Recent storyboards"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/studio/storyboards">
                View all <ArrowRight />
              </Link>
            </Button>
          }
        />
        <div className="mt-5">
          {storyboards === null ? (
            <CardSkeletons count={4} />
          ) : storyboards.length === 0 ? (
            <MiniEmpty text="No storyboards yet." to="/studio/create?mode=story-to-storyboard" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {storyboards.map((s) => (
                <StoryboardCard key={s.id} storyboard={s} />
              ))}
            </div>
          )}
        </div>
      </section>

      <MediaViewer generation={viewing} onClose={() => setViewing(null)} onChange={patch} onDeleted={drop} />
    </div>
  );
}

function Stat({ icon: Icon, label, value, to }: { icon: React.ComponentType<{ className?: string }>; label: string; value?: number; to: string }) {
  return (
    <Link to={to} className="rounded-2xl border border-border bg-background/50 px-4 py-3 transition-colors hover:border-primary/40">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      {value === undefined ? <Skeleton className="mt-1.5 h-6 w-10" /> : <p className="mt-1 font-display text-xl font-bold">{value}</p>}
    </Link>
  );
}

function RecentSection({
  title,
  to,
  items,
  onOpen,
  onChange,
  onDeleted,
  empty,
  compact,
}: {
  title: string;
  to: string;
  items: GenerationRecord[] | null;
  onOpen: (g: GenerationRecord) => void;
  onChange: (g: GenerationRecord) => void;
  onDeleted: (id: string) => void;
  empty: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section>
      <SectionHeading
        title={title}
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link to={to}>
              View all <ArrowRight />
            </Link>
          </Button>
        }
      />
      <div className="mt-5">
        {items === null ? (
          <CardSkeletons count={compact ? 2 : 4} />
        ) : items.length === 0 ? (
          empty
        ) : (
          <div className={cn("grid gap-4", compact ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4")}>
            {items.map((g) => (
              <CreationCard key={g.id} generation={g} onOpen={onOpen} onChange={onChange} onDeleted={onDeleted} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function MiniEmpty({ text, to }: { text: string; to: string }) {
  return (
    <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-dashed border-border px-5 py-6 text-sm text-muted-foreground sm:flex-row">
      <span>{text}</span>
      <Button variant="outline" size="sm" asChild>
        <Link to={to}>Create one</Link>
      </Button>
    </div>
  );
}

function CardSkeletons({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />
      ))}
    </div>
  );
}
