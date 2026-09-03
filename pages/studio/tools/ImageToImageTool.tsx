import * as React from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OptionPills, RatioIcon, Slider } from "@/components/ui/select";
import { UploadDropzone, type UploadedMedia } from "@/components/studio/UploadDropzone";
import { CanvasPlaceholder, PromptField, RunStateView, ToolLayout, type ToolPrefill } from "@/components/studio/Workspace";
import { useImageGeneration } from "@/hooks/useGeneration";
import { IMAGE_ASPECT_RATIOS, IMAGE_TRANSFORM_STYLES } from "@/lib/ai/options";
import type { AspectRatio } from "@/lib/ai/types";

const STAGES = ["Studying your image…", "Applying the new style…", "Blending details…", "Finishing touches…"];

export default function ImageToImageTool({ prefill }: { prefill?: ToolPrefill }) {
  const [source, setSource] = React.useState<UploadedMedia | null>(null);
  const [prompt, setPrompt] = React.useState(prefill?.prompt ?? "");
  const [style, setStyle] = React.useState(prefill?.style ?? "cinematic");
  const [aspectRatio, setAspectRatio] = React.useState<AspectRatio>((prefill?.aspectRatio as AspectRatio) ?? "1:1");
  const [strength, setStrength] = React.useState(prefill?.strength ?? 0.65);
  const [error, setError] = React.useState<string | null>(null);
  const { state, run, reset, setState } = useImageGeneration();

  const transform = async () => {
    setError(null);
    if (!source) return setError("Please upload an image to transform.");
    if (prompt.trim().length < 3) return setError("Describe how you want to transform this image.");
    await run("image-to-image", { prompt: prompt.trim(), style, aspectRatio, sourceImage: source.ref, strength });
  };

  const running = state.status === "running";

  return (
    <ToolLayout
      controls={
        <>
          <UploadDropzone kind="image" label="Upload Image" value={source} onChange={setSource} hint="Your image is stored privately in your studio." />
          <PromptField value={prompt} onChange={setPrompt} placeholder="Describe how you want to transform this image… e.g. Turn this portrait into a Pixar-style 3D character with soft studio lighting" error={error} rows={4} />
          <OptionPills label="Style" options={IMAGE_TRANSFORM_STYLES} value={style} onChange={setStyle} columns={3} size="sm" />
          <OptionPills
            label="Aspect ratio"
            options={IMAGE_ASPECT_RATIOS}
            value={aspectRatio}
            onChange={setAspectRatio}
            columns={4}
            size="sm"
            renderIcon={(o, selected) => <RatioIcon ratio={o.value} selected={selected} />}
          />
          <Slider label="Transformation strength" value={strength} onChange={setStrength} min={0.2} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} />
        </>
      }
      footer={
        <Button size="lg" className="w-full" onClick={transform} loading={running}>
          <Sparkles /> {running ? "Transforming…" : "Transform Image"}
        </Button>
      }
      canvas={
        <RunStateView
          state={state}
          tool="Image transformation"
          loadingTitle="Transforming your image…"
          loadingStages={STAGES}
          aspectRatio={aspectRatio}
          before={source ? { ref: source.ref, kind: "image" } : null}
          idle={
            source ? (
              <div className="overflow-hidden rounded-3xl border border-border bg-black/40">
                <p className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Original</p>
                <img src={source.previewUrl} alt="Original upload" className="max-h-[520px] w-full object-contain" />
              </div>
            ) : (
              <CanvasPlaceholder
                title="Upload an image to begin"
                description="Drop in a photo or artwork, describe the transformation and choose a style. We'll show the original and the result side by side."
                aspectRatio={aspectRatio}
              />
            )
          }
          onRetry={transform}
          onChange={(gen) => setState({ status: "done", generation: gen })}
          onDeleted={reset}
          onRegenerate={transform}
        />
      }
    />
  );
}
