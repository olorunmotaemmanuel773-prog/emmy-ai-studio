import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { Clapperboard, Film, ImageIcon, Images, Repeat, Type } from "lucide-react";
import { Skeleton } from "@/components/ui/card";
import { DemoBanner } from "@/components/studio/EngineStatus";
import { prefillFromGeneration, type ToolPrefill } from "@/components/studio/Workspace";
import { getGeneration } from "@/lib/api/generations";
import { cn } from "@/lib/utils";
import TextToImageTool from "./tools/TextToImageTool";
import ImageToImageTool from "./tools/ImageToImageTool";
import TextToVideoTool from "./tools/TextToVideoTool";
import ImageToVideoTool from "./tools/ImageToVideoTool";
import VideoToVideoTool from "./tools/VideoToVideoTool";
import StoryboardTool from "./tools/StoryboardTool";

export type CreateMode =
  | "text-to-image"
  | "image-to-image"
  | "text-to-video"
  | "image-to-video"
  | "video-to-video"
  | "story-to-storyboard";

export const CREATE_MODES: {
  id: CreateMode;
  label: string;
  short: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}[] = [
  { id: "text-to-image", label: "Text to Image", short: "Image", description: "Describe a scene and render it in any style.", icon: Type, accent: "from-electric to-cyan" },
  { id: "image-to-image", label: "Image to Image", short: "Restyle", description: "Transform an existing image with a prompt.", icon: Images, accent: "from-violet to-electric" },
  { id: "text-to-video", label: "Text to Video", short: "Video", description: "Turn words into a cinematic clip.", icon: Film, accent: "from-magenta to-violet" },
  { id: "image-to-video", label: "Image to Video", short: "Animate", description: "Bring a still image to life with motion.", icon: ImageIcon, accent: "from-cyan to-violet" },
  { id: "video-to-video", label: "Video to Video", short: "Transform", description: "Restyle footage while keeping the motion.", icon: Repeat, accent: "from-electric to-magenta" },
  { id: "story-to-storyboard", label: "Story to Storyboard", short: "Storyboard", description: "Break a story into director-ready scenes.", icon: Clapperboard, accent: "from-violet to-magenta" },
];

const VALID = new Set(CREATE_MODES.map((m) => m.id));

export default function CreatePage() {
  const [params, setParams] = useSearchParams();
  const modeParam = params.get("mode");
  const mode: CreateMode = VALID.has(modeParam as CreateMode) ? (modeParam as CreateMode) : "text-to-image";
  const regenId = params.get("regen");
  const [prefill, setPrefill] = React.useState<ToolPrefill | undefined>();
  const [loadingPrefill, setLoadingPrefill] = React.useState(Boolean(regenId));

  React.useEffect(() => {
    if (!regenId) {
      setPrefill(undefined);
      setLoadingPrefill(false);
      return;
    }
    let active = true;
    setLoadingPrefill(true);
    getGeneration(regenId)
      .then((gen) => active && setPrefill(gen ? prefillFromGeneration(gen) : undefined))
      .catch(() => active && setPrefill(undefined))
      .finally(() => active && setLoadingPrefill(false));
    return () => {
      active = false;
    };
  }, [regenId]);

  const setMode = (next: CreateMode) => {
    const p = new URLSearchParams();
    p.set("mode", next);
    setParams(p);
  };

  const current = CREATE_MODES.find((m) => m.id === mode)!;
  // Remount the tool when mode or prefill source changes so its local state resets.
  const toolKey = `${mode}-${regenId ?? "new"}`;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Create</p>
        <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">What will you make today?</h1>
      </div>

      {/* Mode switcher */}
      <div className="-mx-4 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:px-0">
        <div className="grid min-w-[640px] grid-cols-6 gap-2 sm:min-w-0 sm:grid-cols-3 xl:grid-cols-6" role="tablist" aria-label="Creation mode">
          {CREATE_MODES.map((m) => {
            const active = m.id === mode;
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMode(m.id)}
                className={cn(
                  "group relative flex flex-col items-start gap-2 rounded-2xl border p-3.5 text-left transition-all duration-200",
                  active
                    ? "border-primary/50 bg-primary/10 shadow-[inset_0_0_0_1px_rgba(61,123,255,0.3)]"
                    : "border-border bg-card/50 hover:border-foreground/20 hover:bg-card",
                )}
              >
                <span className={cn("grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br text-white", m.accent, !active && "opacity-80")}>
                  <m.icon className="h-4 w-4" />
                </span>
                <span className="text-[13px] font-semibold leading-tight">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{current.description}</p>

      <DemoBanner mode={mode} />

      {loadingPrefill ? (
        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <Skeleton className="h-[520px] rounded-3xl" />
          <Skeleton className="h-[520px] rounded-3xl" />
        </div>
      ) : (
        <div key={toolKey} className="animate-fade-in">
          {mode === "text-to-image" && <TextToImageTool prefill={prefill} />}
          {mode === "image-to-image" && <ImageToImageTool prefill={prefill} />}
          {mode === "text-to-video" && <TextToVideoTool prefill={prefill} />}
          {mode === "image-to-video" && <ImageToVideoTool prefill={prefill} />}
          {mode === "video-to-video" && <VideoToVideoTool prefill={prefill} />}
          {mode === "story-to-storyboard" && <StoryboardTool />}
        </div>
      )}
    </div>
  );
}
