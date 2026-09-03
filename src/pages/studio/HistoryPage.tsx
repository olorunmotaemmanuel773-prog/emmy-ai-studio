import * as React from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Bookmark, CheckCircle2, Clock, Loader2, Maximize2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge, EmptyState, Skeleton } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/select";
import { useCreationActions } from "@/components/studio/CreationActions";
import { MediaViewer } from "@/components/studio/MediaViewer";
import { SignedImage, VideoThumb } from "@/components/studio/SignedMedia";
import { useAuth } from "@/contexts/AuthContext";
import { pollVideoJob } from "@/hooks/useGeneration";
import { getGeneration, listGenerations } from "@/lib/api/generations";
import type { GenerationRecord, GenerationStatus } from "@/lib/database.types";
import { formatDateTime, friendlyError, GENERATION_TYPE_LABELS, isVideoType } from "@/lib/utils";

type Filter = "all" | "completed" | "processing" | "failed";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "processing", label: "In progress" },
  { value: "failed", label: "Failed" },
];

export default function HistoryPage() {
  const { user } = useAuth();
  const [filter, setFilter] = React.useState<Filter>("all");
  const [items, setItems] = React.useState<GenerationRecord[]>([]);
  const [page, setPage] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [viewing, setViewing] = React.useState<GenerationRecord | null>(null);
  const [checking, setChecking] = React.useState<string | null>(null);

  const patch = (gen: GenerationRecord) => {
    setItems((list) => list.map((g) => (g.id === gen.id ? gen : g)));
    setViewing((v) => (v?.id === gen.id ? gen : v));
  };
  const drop = (id: string) => setItems((list) => list.filter((g) => g.id !== id));
  const actions = useCreationActions({ onChange: patch, onDeleted: drop });

  const fetchPage = React.useCallback(
    async (pageIndex: number, append: boolean) => {
      if (!user) return;
      append ? setLoadingMore(true) : setLoading(true);
      try {
        const statuses: GenerationStatus[] | undefined =
          filter === "all" ? undefined : filter === "processing" ? ["pending", "processing"] : [filter];
        const res = await listGenerations({ userId: user.id, statuses, page: pageIndex, pageSize: 20 });
        setItems((prev) => (append ? [...prev, ...res.items] : res.items));
        setHasMore(res.hasMore);
        setPage(pageIndex);
      } catch (err) {
        toast.error(friendlyError(err, "We couldn't load your history."));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user, filter],
  );

  React.useEffect(() => {
    void fetchPage(0, false);
  }, [fetchPage]);

  const checkStatus = async (gen: GenerationRecord) => {
    setChecking(gen.id);
    try {
      if (isVideoType(gen.type)) {
        const result = await pollVideoJob(gen.id, () => false);
        if (result?.ok) patch(result.generation);
        else if (result && !result.ok) {
          toast.error(result.error.message);
          const fresh = await getGeneration(gen.id);
          if (fresh) patch(fresh);
        }
      } else {
        const fresh = await getGeneration(gen.id);
        if (fresh) patch(fresh);
        if (fresh?.status === "completed") toast.success("Your creation is ready.");
        else toast.message("Still working on it.");
      }
    } finally {
      setChecking(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">History</p>
          <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">Every generation, in order</h1>
          <p className="mt-1 text-sm text-muted-foreground">Including results you haven't saved yet, in-progress renders and failed attempts.</p>
        </div>
        <Segmented options={FILTERS} value={filter} onChange={setFilter} size="sm" />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No history yet"
          description="Your generations will be listed here the moment you start creating."
          action={
            <Button asChild>
              <Link to="/studio/create">Create something</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {items.map((gen) => {
            const video = isVideoType(gen.type);
            const thumb = gen.media_files[0]?.file_url ?? gen.result_url;
            const inProgress = gen.status === "pending" || gen.status === "processing";
            return (
              <li key={gen.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card/60 p-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => gen.status === "completed" && setViewing(gen)}
                  className="relative h-24 w-full shrink-0 overflow-hidden rounded-xl bg-muted sm:h-20 sm:w-28"
                  aria-label="Open"
                  disabled={gen.status !== "completed"}
                >
                  {gen.status === "completed" && thumb ? (
                    video ? <VideoThumb src={thumb} poster={gen.media_files[0]?.thumbnail_url ?? gen.thumbnail_url} className="absolute inset-0" /> : <SignedImage src={thumb} alt={gen.prompt} className="absolute inset-0" />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-muted-foreground">
                      {inProgress ? <Loader2 className="h-5 w-5 animate-spin" /> : <AlertCircle className="h-5 w-5" />}
                    </div>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={video ? "magenta" : "violet"}>{GENERATION_TYPE_LABELS[gen.type]}</Badge>
                    <StatusBadge status={gen.status} />
                    {gen.is_saved && <Badge variant="outline">Saved</Badge>}
                    <span className="text-xs text-muted-foreground">{formatDateTime(gen.created_at)}</span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm">{gen.prompt}</p>
                  {gen.status === "failed" && gen.error_message && <p className="mt-1 line-clamp-2 text-xs text-destructive/90">{gen.error_message}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {gen.status === "completed" && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setViewing(gen)}>
                        <Maximize2 /> Open
                      </Button>
                      {!gen.is_saved && (
                        <Button variant="outline" size="sm" onClick={() => actions.save(gen)} loading={actions.busy === `save-${gen.id}`}>
                          <Bookmark /> Save
                        </Button>
                      )}
                    </>
                  )}
                  {inProgress && (
                    <Button variant="outline" size="sm" onClick={() => checkStatus(gen)} loading={checking === gen.id}>
                      <RefreshCw /> Check status
                    </Button>
                  )}
                  {gen.status === "failed" && (
                    <Button variant="outline" size="sm" onClick={() => actions.regenerate(gen)}>
                      <RefreshCw /> Retry
                    </Button>
                  )}
                  <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => actions.remove(gen)} loading={actions.busy === `delete-${gen.id}`} aria-label="Delete">
                    <Trash2 />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && !loading && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => fetchPage(page + 1, true)} loading={loadingMore}>
            Load more
          </Button>
        </div>
      )}

      <MediaViewer generation={viewing} onClose={() => setViewing(null)} onChange={patch} onDeleted={drop} />
    </div>
  );
}

function StatusBadge({ status }: { status: GenerationStatus }) {
  if (status === "completed")
    return (
      <Badge variant="success">
        <CheckCircle2 className="h-3 w-3" /> Completed
      </Badge>
    );
  if (status === "failed")
    return (
      <Badge variant="destructive">
        <AlertCircle className="h-3 w-3" /> Failed
      </Badge>
    );
  return (
    <Badge variant="warning">
      <Loader2 className="h-3 w-3 animate-spin" /> {status === "pending" ? "Queued" : "Rendering"}
    </Badge>
  );
}
