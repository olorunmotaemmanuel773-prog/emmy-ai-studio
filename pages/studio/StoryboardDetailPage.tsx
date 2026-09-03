import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  Clapperboard,
  Film,
  ImagePlus,
  Lightbulb,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Badge, EmptyState, Skeleton } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField, Input, Textarea } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { ProviderNotice } from "@/components/ui/progress";
import { SignedImage, SignedVideo } from "@/components/studio/SignedMedia";
import { useAuth } from "@/contexts/AuthContext";
import { ai } from "@/lib/ai";
import { CAMERA_SHOTS, labelFor, STORY_GENRES, STORYBOARD_STYLES } from "@/lib/ai/options";
import type { ProviderError } from "@/lib/ai/types";
import { executeImageGeneration, executeVideoGeneration } from "@/hooks/useGeneration";
import { addScene, blankScene, deleteScene, deleteStoryboard, getStoryboard, updateScene, updateStoryboard } from "@/lib/api/storyboards";
import type { SceneInput, Storyboard, StoryboardScene } from "@/lib/database.types";
import { cn, friendlyError, formatDate } from "@/lib/utils";

type Busy = "image" | "video" | "regen" | "delete";

function cameraMovementValue(text: string) {
  const t = (text || "").toLowerCase();
  if (t.includes("zoom")) return "slow-zoom";
  if (t.includes("dolly in") || t.includes("push")) return "dolly-in";
  if (t.includes("dolly out") || t.includes("pull")) return "dolly-out";
  if (t.includes("pan left")) return "pan-left";
  if (t.includes("pan right") || t.includes("pan")) return "pan-right";
  if (t.includes("tilt up")) return "tilt-up";
  if (t.includes("tilt")) return "tilt-down";
  if (t.includes("orbit") || t.includes("arc")) return "orbit";
  if (t.includes("handheld")) return "handheld";
  return "static";
}

function composedPrompt(scene: StoryboardScene, style: string) {
  return [scene.description, scene.action, scene.location && `Location: ${scene.location}`, scene.characters && `Characters: ${scene.characters}`, scene.camera_shot, scene.lighting, `Style: ${style}`]
    .filter(Boolean)
    .join(". ");
}

export default function StoryboardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [storyboard, setStoryboard] = React.useState<Storyboard | null>(null);
  const [scenes, setScenes] = React.useState<StoryboardScene[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [busy, setBusy] = React.useState<Record<string, Busy | undefined>>({});
  const [errors, setErrors] = React.useState<Record<string, ProviderError | undefined>>({});
  const [editing, setEditing] = React.useState<StoryboardScene | null>(null);
  const [deletingScene, setDeletingScene] = React.useState<StoryboardScene | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = React.useState(false);
  const [batch, setBatch] = React.useState<{ current: number; total: number } | null>(null);
  const batchCancelled = React.useRef(false);

  React.useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    getStoryboard(id)
      .then((res) => {
        if (!active) return;
        if (!res) return setNotFound(true);
        setStoryboard(res.storyboard);
        setScenes(res.scenes);
      })
      .catch(() => active && setNotFound(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  const setSceneBusy = (sceneId: string, value: Busy | undefined) => setBusy((b) => ({ ...b, [sceneId]: value }));
  const setSceneError = (sceneId: string, value: ProviderError | undefined) => setErrors((e) => ({ ...e, [sceneId]: value }));
  const patchScene = (updated: StoryboardScene) => setScenes((list) => list.map((s) => (s.id === updated.id ? updated : s)));

  const generateImage = async (scene: StoryboardScene) => {
    if (!user || !storyboard) return;
    setSceneBusy(scene.id, "image");
    setSceneError(scene.id, undefined);
    const result = await executeImageGeneration(
      user.id,
      "storyboard-scene-image",
      { prompt: scene.image_prompt?.trim() || composedPrompt(scene, storyboard.style), style: storyboard.style, aspectRatio: "16:9", quality: "standard", count: 1 },
      { storyboardSceneId: scene.id, isSaved: true, metadata: { storyboardId: storyboard.id, sceneNumber: scene.scene_number } },
    );
    if (!result.ok) {
      setSceneError(scene.id, result.error);
    } else {
      try {
        const url = result.generation.media_files[0]?.file_url ?? result.generation.result_url;
        const updated = await updateScene(scene.id, { image_url: url });
        patchScene(updated);
        if (!storyboard.cover_url && url) {
          const sb = await updateStoryboard(storyboard.id, { cover_url: url }).catch(() => null);
          if (sb) setStoryboard(sb);
        }
        toast.success(`Scene ${scene.scene_number} image ready`);
      } catch (err) {
        toast.error(friendlyError(err));
      }
    }
    setSceneBusy(scene.id, undefined);
  };

  const generateVideo = async (scene: StoryboardScene): Promise<boolean> => {
    if (!user || !storyboard) return false;
    setSceneBusy(scene.id, "video");
    setSceneError(scene.id, undefined);
    const result = await executeVideoGeneration(
      user.id,
      "storyboard-scene-video",
      {
        prompt: scene.video_prompt?.trim() || composedPrompt(scene, storyboard.style),
        style: storyboard.style,
        duration: 5,
        aspectRatio: "16:9",
        cameraMovement: cameraMovementValue(scene.camera_movement),
        sourceImage: scene.image_url ?? undefined,
      },
      { storyboardSceneId: scene.id, isSaved: true, metadata: { storyboardId: storyboard.id, sceneNumber: scene.scene_number } },
      { isCancelled: () => batchCancelled.current },
    );
    let ok = false;
    if (result && !result.ok) setSceneError(scene.id, result.error);
    else if (result?.ok) {
      try {
        const updated = await updateScene(scene.id, { video_url: result.generation.result_url });
        patchScene(updated);
        toast.success(`Scene ${scene.scene_number} video ready`);
        ok = true;
      } catch (err) {
        toast.error(friendlyError(err));
      }
    }
    setSceneBusy(scene.id, undefined);
    return ok;
  };

  const createAllVideos = async () => {
    const pending = scenes.filter((s) => !s.video_url);
    if (!pending.length) return toast.message("Every scene already has a video.");
    batchCancelled.current = false;
    setBatch({ current: 1, total: pending.length });
    for (let i = 0; i < pending.length; i++) {
      if (batchCancelled.current) break;
      setBatch({ current: i + 1, total: pending.length });
      const ok = await generateVideo(pending[i]);
      if (!ok) break; // stop on first failure (e.g. provider not configured)
    }
    setBatch(null);
  };

  const regenerateScene = async (scene: StoryboardScene) => {
    if (!storyboard) return;
    setSceneBusy(scene.id, "regen");
    setSceneError(scene.id, undefined);
    const { id: _id, storyboard_id: _sb, user_id: _u, created_at: _c, updated_at: _up, image_url: _img, video_url: _vid, ...sceneInput } = scene;
    const result = await ai.storyboard.regenerateScene({
      storyboard: { title: storyboard.title, idea: storyboard.idea, genre: storyboard.genre, style: storyboard.style, sceneCount: scenes.length },
      scene: sceneInput,
    });
    if (!result.ok) setSceneError(scene.id, result.error);
    else {
      try {
        const { scene_number: _n, ...fields } = result.data;
        const updated = await updateScene(scene.id, fields);
        patchScene(updated);
        toast.success(`Scene ${scene.scene_number} rewritten`);
      } catch (err) {
        toast.error(friendlyError(err));
      }
    }
    setSceneBusy(scene.id, undefined);
  };

  const removeScene = async (scene: StoryboardScene) => {
    setSceneBusy(scene.id, "delete");
    try {
      await deleteScene(scene, scenes);
      setScenes((list) => list.filter((s) => s.id !== scene.id).map((s, i) => ({ ...s, scene_number: i + 1 })));
      setStoryboard((sb) => (sb ? { ...sb, scene_count: sb.scene_count - 1 } : sb));
      toast.success("Scene removed");
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSceneBusy(scene.id, undefined);
      setDeletingScene(null);
    }
  };

  const addNewScene = async () => {
    if (!user || !storyboard) return;
    try {
      const scene = await addScene(storyboard.id, user.id, blankScene(scenes.length + 1));
      setScenes((list) => [...list, scene]);
      setEditing(scene);
    } catch (err) {
      toast.error(friendlyError(err));
    }
  };

  const removeStoryboard = async () => {
    if (!storyboard) return;
    try {
      await deleteStoryboard(storyboard, scenes);
      toast.success("Storyboard deleted");
      navigate("/studio/storyboards", { replace: true });
    } catch (err) {
      toast.error(friendlyError(err));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-28 w-full rounded-3xl" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-64 w-full rounded-3xl" />
        ))}
      </div>
    );
  }

  if (notFound || !storyboard) {
    return (
      <EmptyState
        icon={Clapperboard}
        title="Storyboard not found"
        description="It may have been deleted, or you may not have access to it."
        action={
          <Button asChild>
            <Link to="/studio/storyboards">Back to storyboards</Link>
          </Button>
        }
      />
    );
  }

  const withImages = scenes.filter((s) => s.image_url).length;
  const withVideos = scenes.filter((s) => s.video_url).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to="/studio/storyboards" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All storyboards
      </Link>

      {/* Header */}
      <header className="relative overflow-hidden rounded-3xl border border-border glass p-6 sm:p-8">
        <div className="aurora opacity-40" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Storyboard</Badge>
              <Badge variant="violet">{labelFor(STORY_GENRES, storyboard.genre)}</Badge>
              <Badge variant="magenta">{labelFor(STORYBOARD_STYLES, storyboard.style)}</Badge>
              <span className="text-xs text-muted-foreground">Created {formatDate(storyboard.created_at)}</span>
            </div>
            <h1 className="mt-3 font-display text-2xl font-bold sm:text-3xl">{storyboard.title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground leading-relaxed">{storyboard.idea}</p>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span><strong className="text-foreground">{scenes.length}</strong> scenes</span>
              <span><strong className="text-foreground">{withImages}</strong> images</span>
              <span><strong className="text-foreground">{withVideos}</strong> videos</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={addNewScene}>
              <Plus /> Add scene
            </Button>
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmDeleteAll(true)}>
              <Trash2 /> Delete
            </Button>
            {batch ? (
              <Button
                variant="secondary"
                onClick={() => {
                  batchCancelled.current = true;
                  setBatch(null);
                }}
              >
                <Loader2 className="animate-spin" /> Rendering {batch.current}/{batch.total} · Stop
              </Button>
            ) : (
              <Button onClick={createAllVideos} disabled={!scenes.length}>
                <Video /> Create Video
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Scenes */}
      {scenes.length === 0 ? (
        <EmptyState icon={Clapperboard} title="No scenes yet" description="Add your first scene to start building this storyboard." action={<Button onClick={addNewScene}><Plus /> Add scene</Button>} />
      ) : (
        <ol className="space-y-5">
          {scenes.map((scene) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              busy={busy[scene.id]}
              error={errors[scene.id]}
              isAdmin={isAdmin}
              onGenerateImage={() => generateImage(scene)}
              onGenerateVideo={() => generateVideo(scene)}
              onEdit={() => setEditing(scene)}
              onRegenerate={() => regenerateScene(scene)}
              onDelete={() => setDeletingScene(scene)}
              onDismissError={() => setSceneError(scene.id, undefined)}
            />
          ))}
        </ol>
      )}

      {editing && (
        <SceneEditor
          scene={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            patchScene(updated);
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deletingScene)}
        onOpenChange={(o) => !o && setDeletingScene(null)}
        title={`Delete scene ${deletingScene?.scene_number ?? ""}?`}
        description="The scene and its details will be removed from this storyboard."
        confirmLabel="Delete scene"
        destructive
        loading={deletingScene ? busy[deletingScene.id] === "delete" : false}
        onConfirm={async () => {
          if (deletingScene) await removeScene(deletingScene);
        }}
      />
      <ConfirmDialog
        open={confirmDeleteAll}
        onOpenChange={setConfirmDeleteAll}
        title="Delete this storyboard?"
        description="All scenes will be permanently removed. Scene images and videos stay in My Creations."
        confirmLabel="Delete storyboard"
        destructive
        onConfirm={removeStoryboard}
      />
    </div>
  );
}

/* ------------------------------ Scene card ---------------------------- */
function SceneCard({
  scene,
  busy,
  error,
  isAdmin,
  onGenerateImage,
  onGenerateVideo,
  onEdit,
  onRegenerate,
  onDelete,
  onDismissError,
}: {
  scene: StoryboardScene;
  busy?: Busy;
  error?: ProviderError;
  isAdmin: boolean;
  onGenerateImage: () => void;
  onGenerateVideo: () => void;
  onEdit: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
  onDismissError: () => void;
}) {
  const [showPrompts, setShowPrompts] = React.useState(false);
  const rendering = busy === "image" || busy === "video";

  return (
    <li className="overflow-hidden rounded-3xl border border-border bg-card/60 shadow-soft">
      <div className="grid lg:grid-cols-[380px_1fr]">
        {/* Media */}
        <div className="relative aspect-video bg-black/50 lg:aspect-auto lg:min-h-[260px]">
          {scene.video_url ? (
            <SignedVideo src={scene.video_url} poster={scene.image_url} className="absolute inset-0 h-full w-full object-cover" controls />
          ) : scene.image_url ? (
            <SignedImage src={scene.image_url} alt={scene.title} className="absolute inset-0" />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-electric/10 via-violet/10 to-magenta/10">
              <div className="absolute inset-0 grid-fade opacity-60" />
              {!rendering && (
                <Button variant="glass" onClick={onGenerateImage} className="relative">
                  <ImagePlus /> Generate Scene Image
                </Button>
              )}
            </div>
          )}
          {rendering && (
            <div className="absolute inset-0 grid place-items-center bg-black/60 backdrop-blur-sm text-white">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-7 w-7 animate-spin" />
                <p className="text-sm font-medium">{busy === "image" ? "Creating scene image…" : "Creating scene video…"}</p>
              </div>
            </div>
          )}
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <span className="grid h-9 min-w-9 place-items-center rounded-xl bg-black/60 px-2 font-display text-sm font-bold text-white backdrop-blur">
              {String(scene.scene_number).padStart(2, "0")}
            </span>
            {scene.video_url && <Badge variant="magenta">Video</Badge>}
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Scene {scene.scene_number}</p>
              <h3 className="mt-1 font-display text-xl font-semibold">{scene.title || "Untitled scene"}</h3>
            </div>
            <div className="flex shrink-0 gap-1">
              <IconBtn icon={Pencil} label="Edit" onClick={onEdit} />
              <IconBtn icon={RefreshCw} label="Regenerate scene" onClick={onRegenerate} loading={busy === "regen"} />
              <IconBtn icon={Trash2} label="Delete scene" onClick={onDelete} destructive />
            </div>
          </div>

          {scene.description && <p className="mt-3 text-sm leading-relaxed text-foreground/85">{scene.description}</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            {scene.location && <Chip icon={MapPin} text={scene.location} />}
            {scene.characters && <Chip icon={Users} text={scene.characters} />}
            {scene.camera_shot && <Chip icon={Camera} text={`${scene.camera_shot}${scene.camera_movement ? ` · ${scene.camera_movement}` : ""}`} />}
            {scene.lighting && <Chip icon={Lightbulb} text={scene.lighting} />}
          </div>

          {(scene.action || scene.dialogue) && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {scene.action && (
                <div className="rounded-2xl border border-border bg-background/50 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Action</p>
                  <p className="mt-1 text-sm leading-relaxed">{scene.action}</p>
                </div>
              )}
              {scene.dialogue && (
                <div className="rounded-2xl border border-border bg-background/50 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Dialogue</p>
                  <p className="mt-1 text-sm italic leading-relaxed text-foreground/85 whitespace-pre-wrap">{scene.dialogue}</p>
                </div>
              )}
            </div>
          )}

          <button type="button" onClick={() => setShowPrompts((v) => !v)} className="mt-4 self-start text-xs font-semibold text-primary hover:underline">
            {showPrompts ? "Hide" : "Show"} image & video prompts
          </button>
          {showPrompts && (
            <div className="mt-2 grid gap-3 sm:grid-cols-2 animate-fade-in">
              <PromptBox label="Image prompt" text={scene.image_prompt} />
              <PromptBox label="Video prompt" text={scene.video_prompt} />
            </div>
          )}

          {error && (
            <div className="mt-4">
              <ProviderNotice error={error} tool={busy === "video" ? "Scene video" : "Scene generation"} isAdmin={isAdmin} onRetry={onDismissError} className="p-4 sm:p-5" />
            </div>
          )}

          <div className="mt-auto flex flex-wrap gap-2 pt-5">
            <Button size="sm" variant={scene.image_url ? "outline" : "default"} onClick={onGenerateImage} disabled={rendering}>
              <ImagePlus /> {scene.image_url ? "Regenerate image" : "Generate Scene Image"}
            </Button>
            <Button size="sm" variant={scene.video_url ? "outline" : "secondary"} onClick={onGenerateVideo} disabled={rendering}>
              <Film /> {scene.video_url ? "Recreate video" : "Create Video"}
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

function Chip({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs">
      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span className="truncate">{text}</span>
    </span>
  );
}

function PromptBox({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text || "Not written yet — edit the scene to add one."}</p>
    </div>
  );
}

function IconBtn({ icon: Icon, label, onClick, loading, destructive }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; loading?: boolean; destructive?: boolean }) {
  return (
    <Button variant="ghost" size="icon-sm" onClick={onClick} aria-label={label} title={label} disabled={loading} className={cn(destructive && "text-destructive hover:text-destructive")}>
      <Icon className={cn(loading && "animate-spin")} />
    </Button>
  );
}

/* ------------------------------ Scene editor -------------------------- */
function SceneEditor({ scene, onClose, onSaved }: { scene: StoryboardScene; onClose: () => void; onSaved: (s: StoryboardScene) => void }) {
  const [form, setForm] = React.useState<SceneInput>({
    scene_number: scene.scene_number,
    title: scene.title,
    description: scene.description,
    characters: scene.characters,
    location: scene.location,
    action: scene.action,
    dialogue: scene.dialogue,
    camera_shot: scene.camera_shot,
    camera_movement: scene.camera_movement,
    lighting: scene.lighting,
    image_prompt: scene.image_prompt,
    video_prompt: scene.video_prompt,
  });
  const [saving, setSaving] = React.useState(false);
  const set = <K extends keyof SceneInput>(key: K, value: SceneInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form.title.trim()) return toast.error("Give the scene a title.");
    setSaving(true);
    try {
      const { scene_number: _n, ...fields } = form;
      const updated = await updateScene(scene.id, fields);
      toast.success("Scene updated");
      onSaved(updated);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const shotOptions = CAMERA_SHOTS.map((s) => ({ value: s, label: s }));
  if (form.camera_shot && !CAMERA_SHOTS.includes(form.camera_shot)) shotOptions.unshift({ value: form.camera_shot, label: form.camera_shot });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Edit scene {scene.scene_number}</DialogTitle>
          <DialogDescription>Refine any detail — your changes are saved to the storyboard.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 px-6 pb-2 sm:grid-cols-2">
          <FormField label="Scene title" className="sm:col-span-2">
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
          </FormField>
          <FormField label="Description" className="sm:col-span-2">
            <Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </FormField>
          <FormField label="Characters">
            <Input value={form.characters} onChange={(e) => set("characters", e.target.value)} placeholder="Amaka, Uncle Tunde" />
          </FormField>
          <FormField label="Location">
            <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Balogun Market, Lagos — late afternoon" />
          </FormField>
          <FormField label="Action" className="sm:col-span-2">
            <Textarea rows={2} value={form.action} onChange={(e) => set("action", e.target.value)} />
          </FormField>
          <FormField label="Dialogue" className="sm:col-span-2">
            <Textarea rows={2} value={form.dialogue} onChange={(e) => set("dialogue", e.target.value)} placeholder={`AMAKA: "You kept this from me for twenty years?"`} />
          </FormField>
          <NativeSelect label="Camera shot" options={shotOptions} value={form.camera_shot} onChange={(v) => set("camera_shot", v)} />
          <FormField label="Camera movement">
            <Input value={form.camera_movement} onChange={(e) => set("camera_movement", e.target.value)} placeholder="Slow dolly in" />
          </FormField>
          <FormField label="Lighting" className="sm:col-span-2">
            <Input value={form.lighting} onChange={(e) => set("lighting", e.target.value)} placeholder="Golden hour, warm backlight, soft haze" />
          </FormField>
          <FormField label="Image prompt" className="sm:col-span-2">
            <Textarea rows={3} value={form.image_prompt} onChange={(e) => set("image_prompt", e.target.value)} />
          </FormField>
          <FormField label="Video prompt" className="sm:col-span-2">
            <Textarea rows={3} value={form.video_prompt} onChange={(e) => set("video_prompt", e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save scene
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
