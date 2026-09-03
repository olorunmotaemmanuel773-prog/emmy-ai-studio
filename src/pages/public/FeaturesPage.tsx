import { Link } from "react-router-dom";
import { ArrowRight, Camera, Clapperboard, Download, Film, FolderHeart, Image as ImageIcon, Images, Layers, Palette, Repeat, Sparkles, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const TOOLS = [
  {
    icon: Type,
    title: "Text to Image",
    mode: "text-to-image",
    accent: "from-electric to-cyan",
    bullets: ["Realistic & 3D Animation presets", "Cinematic, African Cinema, Anime, Fantasy, Portrait, Fashion & more", "1:1, 16:9, 9:16 and 4:5 aspect ratios", "Standard or High Quality, 1–4 images per run"],
  },
  {
    icon: Images,
    title: "Image to Image",
    mode: "image-to-image",
    accent: "from-violet to-electric",
    bullets: ["Drag-and-drop upload with validation", "Prompt-guided transformations", "Adjustable transformation strength", "Original and result shown side by side"],
  },
  {
    icon: Film,
    title: "Text to Video",
    mode: "text-to-video",
    accent: "from-magenta to-violet",
    bullets: ["5, 10 or 15 second clips", "16:9, 9:16 and 1:1 framing", "Ten camera moves from static to handheld cinematic", "Live rendering progress"],
  },
  {
    icon: ImageIcon,
    title: "Image to Video",
    mode: "image-to-video",
    accent: "from-cyan to-violet",
    bullets: ["Start from any still image", "Describe the motion in plain language", "Style, duration and camera controls", "Perfect for portraits and product shots"],
  },
  {
    icon: Repeat,
    title: "Video to Video",
    mode: "video-to-video",
    accent: "from-electric to-magenta",
    bullets: ["Upload MP4, WebM or MOV", "Restyle as Anime, 3D, Fantasy, African Cinema…", "Strength slider for subtle or bold looks", "Before / after comparison"],
  },
  {
    icon: Clapperboard,
    title: "Story to Storyboard",
    mode: "story-to-storyboard",
    accent: "from-violet to-magenta",
    bullets: ["Eleven genres including Nollywood and African Story", "Scenes with characters, location, action & dialogue", "Camera shot, movement and lighting per scene", "Generate an image or video for every scene"],
  },
];

const STUDIO = [
  { icon: FolderHeart, title: "Personal library", text: "My Creations with tabs for images, videos, storyboards and favorites — plus search and filters." },
  { icon: Layers, title: "Full history", text: "Every generation is recorded with its status, so nothing gets lost — even failed or in-progress renders." },
  { icon: Download, title: "Download & share", text: "Download originals, favorite the best, or opt in to the public gallery." },
  { icon: Palette, title: "Dark, light or system", text: "A cinematic dark interface by default, with light and system modes in Settings." },
  { icon: Camera, title: "Media viewer", text: "Full-screen viewer with the prompt, style, ratio, camera and date for every creation." },
  { icon: Sparkles, title: "Provider-agnostic", text: "AI engines are plugged in server-side, so the studio can adopt new models without changes to your workflow." },
];

export default function FeaturesPage() {
  const { user } = useAuth();
  return (
    <div className="relative">
      <div className="aurora opacity-60" />
      <section className="relative mx-auto max-w-7xl px-4 pb-10 pt-16 text-center sm:px-6 lg:px-8 lg:pt-24">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Features</p>
        <h1 className="mx-auto mt-3 max-w-3xl font-display text-4xl font-bold sm:text-5xl">Everything a creative studio needs, free.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-muted-foreground leading-relaxed">
          Six generation tools, a personal library and a storyboard workflow — all behind a single free account.
        </p>
      </section>

      <section className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-2">
          {TOOLS.map((t) => (
            <article key={t.title} className="rounded-3xl border border-border glass p-6 sm:p-8">
              <div className="flex items-center gap-4">
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${t.accent} text-white shadow-lg`}>
                  <t.icon className="h-5 w-5" />
                </span>
                <h2 className="font-display text-xl font-semibold">{t.title}</h2>
              </div>
              <ul className="mt-5 space-y-2.5">
                {t.bullets.map((b) => (
                  <li key={b} className="flex gap-3 text-sm text-muted-foreground">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {b}
                  </li>
                ))}
              </ul>
              <Button variant="outline" size="sm" className="mt-6" asChild>
                <Link to={user ? `/studio/create?mode=${t.mode}` : "/signup"}>
                  Try {t.title} <ArrowRight />
                </Link>
              </Button>
            </article>
          ))}
        </div>
      </section>

      <section className="relative border-t border-border bg-card/30">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">The studio</p>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Organised like a professional workspace</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STUDIO.map((s) => (
              <div key={s.title} className="rounded-3xl border border-border bg-card/60 p-6">
                <s.icon className="h-5 w-5 text-primary" />
                <h3 className="mt-4 font-display text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Button size="lg" asChild>
              <Link to={user ? "/studio" : "/signup"}>
                <Sparkles /> {user ? "Open the studio" : "Create a free account"}
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
