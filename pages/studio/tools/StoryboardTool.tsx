import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Clapperboard, FilePlus2, Lightbulb, MapPin, MessageSquareQuote, Users, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { GenerationLoader, ProviderNotice } from "@/components/ui/progress";
import { OptionPills } from "@/components/ui/select";
import { PromptField, ToolLayout } from "@/components/studio/Workspace";
import { useAuth } from "@/contexts/AuthContext";
import { useEngineStatus } from "@/contexts/EngineStatusContext";
import { ai } from "@/lib/ai";
import { SCENE_COUNTS, STORY_GENRES, STORYBOARD_STYLES } from "@/lib/ai/options";
import type { ProviderError } from "@/lib/ai/types";
import { createStoryboard, makeBlankScenes } from "@/lib/api/storyboards";
import { friendlyError } from "@/lib/utils";

const STAGES = ["Reading your story idea…", "Breaking it into scenes…", "Casting characters and locations…", "Planning camera and lighting…", "Writing image and video prompts…"];

const ANATOMY = [
  { icon: Users, label: "Characters & location", text: "Who is in the scene and where it takes place." },
  { icon: Camera, label: "Camera shot & movement", text: "Framing and motion for a cinematic feel." },
  { icon: Lightbulb, label: "Lighting", text: "The mood and light source of the shot." },
  { icon: MessageSquareQuote, label: "Action & dialogue", text: "What happens and what is said." },
  { icon: Video, label: "Image & video prompts", text: "Ready-to-use prompts to render every scene." },
];

export default function StoryboardTool() {
  const { user, isAdmin } = useAuth();
  const { decide } = useEngineStatus();
  const navigate = useNavigate();
  const [title, setTitle] = React.useState("");
  const [idea, setIdea] = React.useState("");
  const [genre, setGenre] = React.useState("drama");
  const [style, setStyle] = React.useState("cinematic");
  const [sceneCount, setSceneCount] = React.useState(6);
  const [errors, setErrors] = React.useState<{ title?: string; idea?: string }>({});
  const [phase, setPhase] = React.useState<"idle" | "running" | "error">("idle");
  const [providerError, setProviderError] = React.useState<ProviderError | null>(null);
  const [creatingBlank, setCreatingBlank] = React.useState(false);

  const validate = () => {
    const next: { title?: string; idea?: string } = {};
    if (title.trim().length < 2) next.title = "Give your story a title.";
    if (idea.trim().length < 12) next.idea = "Tell us a little more about your story (at least a sentence).";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const generate = async () => {
    if (!user || !validate()) return;
    setProviderError(null);
    // Demo gate: never call the engine (or pretend) when it isn't connected.
    const decision = decide("storyboard", "generate");
    if (!decision.connected) {
      setProviderError({ code: decision.kind === "unsupported" ? "unsupported" : "not_configured", message: decision.reason });
      setPhase("error");
      return;
    }
    setPhase("running");
    const req = { title: title.trim(), idea: idea.trim(), genre, style, sceneCount };
    const result = await ai.storyboard.generateStoryboard(req);
    if (!result.ok) {
      setProviderError(result.error);
      setPhase("error");
      return;
    }
    try {
      const scenes = result.data.scenes.slice(0, sceneCount).map((s, i) => ({ ...s, scene_number: i + 1 }));
      const storyboard = await createStoryboard({ userId: user.id, ...req, scenes });
      toast.success("Your storyboard is ready.");
      navigate(`/studio/storyboards/${storyboard.id}`);
    } catch (err) {
      setProviderError({ code: "unknown", message: friendlyError(err, "We couldn't save your storyboard. Please try again.") });
      setPhase("error");
    }
  };

  const createBlank = async () => {
    if (!user || !validate()) return;
    setCreatingBlank(true);
    try {
      const storyboard = await createStoryboard({
        userId: user.id,
        title: title.trim(),
        idea: idea.trim(),
        genre,
        style,
        scenes: makeBlankScenes(sceneCount),
      });
      toast.success("Blank storyboard created — start writing your scenes.");
      navigate(`/studio/storyboards/${storyboard.id}`);
    } catch (err) {
      toast.error(friendlyError(err, "We couldn't create the storyboard."));
    } finally {
      setCreatingBlank(false);
    }
  };

  return (
    <ToolLayout
      controls={
        <>
          <FormField label="Story Title" htmlFor="sb-title" error={errors.title}>
            <Input id="sb-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The Last Ferry to Badagry" maxLength={120} />
          </FormField>
          <PromptField
            id="sb-idea"
            label="Story Idea"
            value={idea}
            onChange={setIdea}
            placeholder="Describe your story… A young market trader discovers her late grandmother's letters and sets out to find the sister she never knew she had."
            error={errors.idea}
            rows={5}
          />
          <OptionPills label="Genre" options={STORY_GENRES} value={genre} onChange={setGenre} columns={3} size="sm" />
          <OptionPills label="Visual Style" options={STORYBOARD_STYLES} value={style} onChange={setStyle} columns={3} size="sm" />
          <OptionPills label="Number of Scenes" options={SCENE_COUNTS} value={sceneCount} onChange={setSceneCount} columns={3} size="sm" />
        </>
      }
      footer={
        <div className="space-y-2">
          <Button size="lg" className="w-full" onClick={generate} loading={phase === "running"}>
            <Clapperboard /> {phase === "running" ? "Building your storyboard…" : "Generate Storyboard"}
          </Button>
          <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={createBlank} loading={creatingBlank}>
            <FilePlus2 /> Or start with a blank storyboard
          </Button>
        </div>
      }
      canvas={
        phase === "running" ? (
          <GenerationLoader title="Building your storyboard…" stages={STAGES} aspectRatio="16:9" className="min-h-[320px] lg:min-h-[520px] flex flex-col justify-center" />
        ) : phase === "error" && providerError ? (
          <div className="space-y-4">
            <ProviderNotice error={providerError} tool="Storyboard generation" onRetry={generate} isAdmin={isAdmin} />
            <div className="glass rounded-3xl p-6">
              <p className="text-sm font-semibold">You can still build your storyboard by hand</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create the scenes now, write them yourself, and generate images for each scene whenever an engine is connected.
              </p>
              <Button variant="outline" className="mt-4" onClick={createBlank} loading={creatingBlank}>
                <FilePlus2 /> Create {sceneCount} blank scenes
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card/50 p-6 sm:p-8 lg:min-h-[520px]">
            <div className="aurora opacity-50" />
            <div className="relative">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Story to Storyboard</p>
              <h3 className="mt-2 font-display text-2xl font-semibold">From one idea to a full shot list</h3>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground leading-relaxed">
                Give us a title and a story idea. We'll break it into numbered scenes, each with everything a director
                needs — then you can render every scene as an image or a video.
              </p>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {ANATOMY.map((a) => (
                  <li key={a.label} className="flex gap-3 rounded-2xl border border-border bg-background/50 p-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <a.icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{a.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{a.text}</p>
                    </div>
                  </li>
                ))}
                <li className="flex gap-3 rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0 text-magenta" />
                  Storyboards are saved to your studio and can be edited scene by scene at any time.
                </li>
              </ul>
            </div>
          </div>
        )
      }
    />
  );
}
