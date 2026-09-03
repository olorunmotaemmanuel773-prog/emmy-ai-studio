import * as React from "react";
import { Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect, OptionPills, RatioIcon } from "@/components/ui/select";
import { CanvasPlaceholder, PromptField, RunStateView, ToolLayout, type ToolPrefill } from "@/components/studio/Workspace";
import { useVideoGeneration } from "@/hooks/useGeneration";
import { CAMERA_MOVEMENTS, VIDEO_ASPECT_RATIOS, VIDEO_DURATION_NOTE, VIDEO_DURATIONS, VIDEO_STYLES } from "@/lib/ai/options";
import type { AspectRatio, VideoDuration } from "@/lib/ai/types";

export const VIDEO_STAGES = [
  "Blocking the shot…",
  "Lighting the scene…",
  "Rendering motion frames…",
  "Adding cinematic polish…",
  "Encoding your video…",
];

export default function TextToVideoTool({ prefill }: { prefill?: ToolPrefill }) {
  const [prompt, setPrompt] = React.useState(prefill?.prompt ?? "");
  const [style, setStyle] = React.useState(prefill?.style ?? "cinematic");
  const [duration, setDuration] = React.useState<VideoDuration>((prefill?.duration as VideoDuration) ?? 5);
  const [aspectRatio, setAspectRatio] = React.useState<AspectRatio>((prefill?.aspectRatio as AspectRatio) ?? "16:9");
  const [camera, setCamera] = React.useState(prefill?.cameraMovement ?? "slow-zoom");
  const [error, setError] = React.useState<string | null>(null);
  const { state, run, reset, cancel, setState } = useVideoGeneration();

  const generate = async () => {
    setError(null);
    if (prompt.trim().length < 3) return setError("Please describe the video you want to create.");
    await run("text-to-video", { prompt: prompt.trim(), style, duration, aspectRatio, cameraMovement: camera });
  };

  const running = state.status === "running";

  return (
    <ToolLayout
      controls={
        <>
          <PromptField value={prompt} onChange={setPrompt} placeholder="Describe your video… e.g. A lone fisherman paddles across a misty lagoon at dawn, birds lift off the water, warm sunlight breaks through" error={error} />
          <OptionPills label="Style" options={VIDEO_STYLES} value={style} onChange={setStyle} columns={3} size="sm" />
          <div className="grid gap-5 sm:grid-cols-2">
            <OptionPills label="Duration" options={VIDEO_DURATIONS} value={duration} onChange={setDuration} columns={3} size="sm" />
            <OptionPills
              label="Aspect ratio"
              options={VIDEO_ASPECT_RATIOS}
              value={aspectRatio}
              onChange={setAspectRatio}
              columns={3}
              size="sm"
              renderIcon={(o, selected) => <RatioIcon ratio={o.value} selected={selected} />}
            />
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">{VIDEO_DURATION_NOTE}</p>
          <NativeSelect id="camera" label="Camera movement" options={CAMERA_MOVEMENTS} value={camera} onChange={setCamera} />
        </>
      }
      footer={
        <Button size="lg" className="w-full" onClick={generate} loading={running}>
          <Clapperboard /> {running ? "Creating your cinematic video…" : "Generate Video"}
        </Button>
      }
      canvas={
        <RunStateView
          state={state}
          tool="Video generation"
          loadingTitle="Creating your cinematic video…"
          loadingStages={VIDEO_STAGES}
          aspectRatio={aspectRatio}
          idle={
            <CanvasPlaceholder
              title="Set the scene"
              description="Describe the shot, choose duration, aspect ratio and camera movement. Video rendering can take a few minutes — we'll keep you posted."
              aspectRatio={aspectRatio}
            />
          }
          onRetry={generate}
          onCancel={cancel}
          onChange={(gen) => setState({ status: "done", generation: gen })}
          onDeleted={reset}
          onRegenerate={generate}
        />
      }
    />
  );
}
