import * as React from "react";
import { Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OptionPills, RatioIcon, Slider } from "@/components/ui/select";
import { UploadDropzone, type UploadedMedia } from "@/components/studio/UploadDropzone";
import { CanvasPlaceholder, PromptField, RunStateView, ToolLayout, type ToolPrefill } from "@/components/studio/Workspace";
import { useVideoGeneration } from "@/hooks/useGeneration";
import { VIDEO_ASPECT_RATIOS, VIDEO_TRANSFORM_STYLES } from "@/lib/ai/options";
import type { AspectRatio } from "@/lib/ai/types";

const STAGES = ["Analysing your footage…", "Restyling every frame…", "Keeping motion consistent…", "Encoding the new video…"];

export default function VideoToVideoTool({ prefill }: { prefill?: ToolPrefill }) {
  const [source, setSource] = React.useState<UploadedMedia | null>(null);
  const [prompt, setPrompt] = React.useState(prefill?.prompt ?? "");
  const [style, setStyle] = React.useState(prefill?.style ?? "anime");
  const [strength, setStrength] = React.useState(prefill?.strength ?? 0.6);
  const [aspectRatio, setAspectRatio] = React.useState<AspectRatio>((prefill?.aspectRatio as AspectRatio) ?? "16:9");
  const [error, setError] = React.useState<string | null>(null);
  const { state, run, reset, cancel, setState } = useVideoGeneration();

  const transform = async () => {
    setError(null);
    if (!source) return setError("Please upload a video to transform.");
    if (prompt.trim().length < 3) return setError("Describe how the video should be transformed.");
    await run("video-to-video", { prompt: prompt.trim(), style, strength, aspectRatio, sourceVideo: source.ref });
  };

  const running = state.status === "running";

  return (
    <ToolLayout
      controls={
        <>
          <UploadDropzone kind="video" label="Upload Video" value={source} onChange={setSource} hint="Short clips (under 30 seconds) give the best results." />
          <PromptField
            label="Transformation prompt"
            value={prompt}
            onChange={setPrompt}
            placeholder="e.g. Reimagine this clip as a hand-painted anime with soft evening light and glowing city signs"
            error={error}
            rows={4}
          />
          <OptionPills label="Style" options={VIDEO_TRANSFORM_STYLES} value={style} onChange={setStyle} columns={3} size="sm" />
          <Slider label="Strength" value={strength} onChange={setStrength} min={0.2} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} />
          <OptionPills
            label="Aspect ratio"
            options={VIDEO_ASPECT_RATIOS}
            value={aspectRatio}
            onChange={setAspectRatio}
            columns={3}
            size="sm"
            renderIcon={(o, selected) => <RatioIcon ratio={o.value} selected={selected} />}
          />
        </>
      }
      footer={
        <Button size="lg" className="w-full" onClick={transform} loading={running}>
          <Repeat /> {running ? "Transforming your video…" : "Transform Video"}
        </Button>
      }
      canvas={
        <RunStateView
          state={state}
          tool="Video transformation"
          loadingTitle="Transforming your video…"
          loadingStages={STAGES}
          aspectRatio={aspectRatio}
          before={source ? { ref: source.ref, kind: "video" } : null}
          idle={
            source ? (
              <div className="overflow-hidden rounded-3xl border border-border bg-black/40">
                <p className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Original</p>
                <video src={source.previewUrl} className="max-h-[520px] w-full object-contain" controls muted playsInline />
              </div>
            ) : (
              <CanvasPlaceholder
                title="Upload a video to restyle"
                description="Bring a clip, describe the look you want and set the strength. We'll show the before and after together."
                aspectRatio={aspectRatio}
              />
            )
          }
          onRetry={transform}
          onCancel={cancel}
          onChange={(gen) => setState({ status: "done", generation: gen })}
          onDeleted={reset}
          onRegenerate={transform}
        />
      }
    />
  );
}
