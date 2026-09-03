import * as React from "react";
import { Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect, OptionPills, RatioIcon } from "@/components/ui/select";
import { UploadDropzone, type UploadedMedia } from "@/components/studio/UploadDropzone";
import { CanvasPlaceholder, PromptField, RunStateView, ToolLayout, type ToolPrefill } from "@/components/studio/Workspace";
import { useVideoGeneration } from "@/hooks/useGeneration";
import { CAMERA_MOVEMENTS, VIDEO_ASPECT_RATIOS, VIDEO_DURATION_NOTE, VIDEO_DURATIONS, VIDEO_STYLES } from "@/lib/ai/options";
import type { AspectRatio, VideoDuration } from "@/lib/ai/types";
import { VIDEO_STAGES } from "./TextToVideoTool";

export default function ImageToVideoTool({ prefill }: { prefill?: ToolPrefill }) {
  const [source, setSource] = React.useState<UploadedMedia | null>(null);
  const [prompt, setPrompt] = React.useState(prefill?.prompt ?? "");
  const [style, setStyle] = React.useState(prefill?.style ?? "realistic");
  const [duration, setDuration] = React.useState<VideoDuration>((prefill?.duration as VideoDuration) ?? 5);
  const [aspectRatio, setAspectRatio] = React.useState<AspectRatio>((prefill?.aspectRatio as AspectRatio) ?? "16:9");
  const [camera, setCamera] = React.useState(prefill?.cameraMovement ?? "dolly-in");
  const [error, setError] = React.useState<string | null>(null);
  const { state, run, reset, cancel, setState } = useVideoGeneration();

  const generate = async () => {
    setError(null);
    if (!source) return setError("Please upload a starting image.");
    if (prompt.trim().length < 3) return setError("Describe the motion you want to see.");
    await run("image-to-video", {
      prompt: prompt.trim(),
      style,
      duration,
      aspectRatio,
      cameraMovement: camera,
      sourceImage: source.ref,
    });
  };

  const running = state.status === "running";

  return (
    <ToolLayout
      controls={
        <>
          <UploadDropzone kind="image" label="Starting Image" value={source} onChange={setSource} />
          <PromptField
            label="Motion Prompt"
            value={prompt}
            onChange={setPrompt}
            placeholder="e.g. Camera slowly moves toward the woman while her hair moves naturally in the wind."
            error={error}
            rows={4}
          />
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
          <NativeSelect id="camera-i2v" label="Camera movement" options={CAMERA_MOVEMENTS} value={camera} onChange={setCamera} />
        </>
      }
      footer={
        <Button size="lg" className="w-full" onClick={generate} loading={running}>
          <Film /> {running ? "Bringing your image to life…" : "Generate Video"}
        </Button>
      }
      canvas={
        <RunStateView
          state={state}
          tool="Image to video"
          loadingTitle="Bringing your image to life…"
          loadingStages={VIDEO_STAGES}
          aspectRatio={aspectRatio}
          idle={
            source ? (
              <div className="overflow-hidden rounded-3xl border border-border bg-black/40">
                <p className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Starting frame</p>
                <img src={source.previewUrl} alt="Starting frame" className="max-h-[520px] w-full object-contain" />
              </div>
            ) : (
              <CanvasPlaceholder
                title="Start from a still"
                description="Upload an image, describe how it should move and choose your camera. Your video will play right here when it's ready."
                aspectRatio={aspectRatio}
              />
            )
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
