import * as React from "react";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OptionPills, RatioIcon } from "@/components/ui/select";
import { CanvasPlaceholder, PromptField, RunStateView, ToolLayout, type ToolPrefill } from "@/components/studio/Workspace";
import { useImageGeneration } from "@/hooks/useGeneration";
import { IMAGE_ASPECT_RATIOS, IMAGE_COUNTS, IMAGE_QUALITIES, IMAGE_STYLES } from "@/lib/ai/options";
import type { AspectRatio, ImageCount, ImageQuality } from "@/lib/ai/types";

const STAGES = ["Reading your prompt…", "Composing the scene…", "Rendering details…", "Polishing the final look…"];

export default function TextToImageTool({ prefill }: { prefill?: ToolPrefill }) {
  const [prompt, setPrompt] = React.useState(prefill?.prompt ?? "");
  const [style, setStyle] = React.useState(prefill?.style ?? "realistic");
  const [aspectRatio, setAspectRatio] = React.useState<AspectRatio>((prefill?.aspectRatio as AspectRatio) ?? "1:1");
  const [quality, setQuality] = React.useState<ImageQuality>((prefill?.quality as ImageQuality) ?? "standard");
  const [count, setCount] = React.useState<ImageCount>((prefill?.count as ImageCount) ?? 1);
  const [error, setError] = React.useState<string | null>(null);
  const { state, run, reset, setState } = useImageGeneration();

  const generate = async () => {
    setError(null);
    if (prompt.trim().length < 3) {
      setError("Please describe the scene you want to create.");
      return;
    }
    await run("text-to-image", { prompt: prompt.trim(), style, aspectRatio, quality, count });
  };

  const running = state.status === "running";

  return (
    <ToolLayout
      controls={
        <>
          <PromptField value={prompt} onChange={setPrompt} placeholder="Describe your scene… e.g. A Lagos street market at golden hour, rain-soaked pavement reflecting neon signs, cinematic 35mm film look" error={error} />
          <OptionPills label="Style" options={IMAGE_STYLES} value={style} onChange={setStyle} columns={3} size="sm" />
          <OptionPills
            label="Aspect ratio"
            options={IMAGE_ASPECT_RATIOS}
            value={aspectRatio}
            onChange={setAspectRatio}
            columns={4}
            size="sm"
            renderIcon={(o, selected) => <RatioIcon ratio={o.value} selected={selected} />}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <OptionPills label="Image quality" options={IMAGE_QUALITIES} value={quality} onChange={setQuality} columns={2} size="sm" />
            <OptionPills label="Number of images" options={IMAGE_COUNTS} value={count} onChange={setCount} columns={3} size="sm" />
          </div>
        </>
      }
      footer={
        <Button size="lg" className="w-full" onClick={generate} loading={running}>
          <Wand2 /> {running ? "Creating your image…" : "Generate Image"}
        </Button>
      }
      canvas={
        <RunStateView
          state={state}
          tool="Image generation"
          loadingTitle="Creating your image…"
          loadingStages={STAGES}
          aspectRatio={aspectRatio}
          idle={
            <CanvasPlaceholder
              title="Your canvas is ready"
              description="Describe a scene, pick a style and aspect ratio, then hit Generate Image. Your results will appear here."
              aspectRatio={aspectRatio}
            />
          }
          onRetry={generate}
          onChange={(gen) => setState({ status: "done", generation: gen })}
          onDeleted={reset}
          onRegenerate={generate}
        />
      }
    />
  );
}
