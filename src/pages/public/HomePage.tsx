import { Link } from "react-router-dom";
import { ArrowRight, Check, Clapperboard, Film, Image as ImageIcon, Images, Repeat, ShieldCheck, Sparkles, Type, Zap } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

const TOOLS = [
  { icon: Type, title: "Text to Image", text: "Describe any scene and render it in realistic, 3D, anime, cinematic and African cinema styles.", mode: "text-to-image", accent: "from-electric to-cyan" },
  { icon: Images, title: "Image to Image", text: "Upload a photo or sketch and transform it with a prompt while keeping its composition.", mode: "image-to-image", accent: "from-violet to-electric" },
  { icon: Film, title: "Text to Video", text: "Turn words into cinematic clips with duration, aspect ratio and camera movement controls.", mode: "text-to-video", accent: "from-magenta to-violet" },
  { icon: ImageIcon, title: "Image to Video", text: "Animate a still image with natural motion and directed camera moves.", mode: "image-to-video", accent: "from-cyan to-violet" },
  { icon: Repeat, title: "Video to Video", text: "Restyle existing footage — anime, 3D, fantasy — while preserving its motion.", mode: "video-to-video", accent: "from-electric to-magenta" },
  { icon: Clapperboard, title: "Story to Storyboard", text: "Break a story idea into director-ready scenes with shots, lighting, dialogue and prompts.", mode: "story-to-storyboard", accent: "from-violet to-magenta" },
];

const STEPS = [
  { n: "01", title: "Imagine", text: "Start with a prompt, an image, a clip or a full story idea." },
  { n: "02", title: "Generate", text: "Pick a style, aspect ratio and camera. Watch it render in the studio." },
  { n: "03", title: "Create", text: "Save, favorite, download and build storyboards into films." },
];

export default function HomePage() {
  const { user } = useAuth();
  const startTo = user ? "/studio/create" : "/signup";

  return (
    <div className="relative overflow-hidden">
      {/* Hero */}
      <section className="relative">
        <div className="aurora" />
        <div className="absolute inset-0 grid-fade opacity-70" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:px-8 lg:pb-28 lg:pt-24">
          <div className="animate-fade-up">
            <Badge variant="glass" className="gap-2 py-1.5 pl-1.5 pr-3 normal-case tracking-normal text-[12px]">
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-500">Free</span>
              A complete AI creative studio, no paywall
            </Badge>
            <h1 className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl">
              Imagine <span className="text-muted-foreground/50">•</span> Generate <span className="text-muted-foreground/50">•</span>{" "}
              <span className="text-gradient">Create</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground leading-relaxed">
              Turn your ideas, images and stories into stunning AI-generated visuals and cinematic videos.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link to={startTo}>
                  <Sparkles /> Start Creating
                </Link>
              </Button>
              <Button size="lg" variant="glass" asChild>
                <Link to="/gallery">
                  Explore Gallery <ArrowRight />
                </Link>
              </Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["No credits", "No subscriptions", "Every tool included"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500" /> {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative animate-fade-up [animation-delay:150ms]">
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 shadow-[0_40px_120px_-40px_rgba(139,92,246,0.7)]">
              <img src={hero} alt="Cinematic light particles forming a human silhouette" className="aspect-[4/3] w-full object-cover lg:aspect-[5/4]" loading="eager" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#070a14]/80 via-transparent to-transparent" />
              <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3 text-white">
                <div className="glass rounded-2xl px-4 py-3 border-white/10">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/60">Studio mode</p>
                  <p className="mt-0.5 font-display text-sm font-semibold">Text to Video · Cinematic · 16:9</p>
                </div>
                <div className="hidden glass rounded-2xl px-3 py-2 text-xs sm:block border-white/10">
                  <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Rendering
                </div>
              </div>
            </div>
            <div className="absolute -left-6 top-10 hidden animate-float rounded-2xl glass px-4 py-3 text-xs shadow-soft lg:block border-white/10">
              <p className="font-semibold">Storyboard</p>
              <p className="text-muted-foreground">6 scenes · Nollywood · Cinematic</p>
            </div>
            <div className="absolute -right-4 bottom-24 hidden animate-float [animation-delay:2s] rounded-2xl glass px-4 py-3 text-xs shadow-soft lg:block border-white/10">
              <p className="font-semibold">Camera</p>
              <p className="text-muted-foreground">Dolly in · 10 seconds</p>
            </div>
          </div>
        </div>
      </section>

      {/* Tools */}
      <section className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Creative tools</p>
          <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Six ways to bring an idea to life</h2>
          <p className="mt-4 text-muted-foreground">One studio for stills, motion and story. Every tool is free with your account.</p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t) => (
            <Link
              key={t.title}
              to={user ? `/studio/create?mode=${t.mode}` : "/signup"}
              className="group relative overflow-hidden rounded-3xl border border-border bg-card/60 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-glow"
            >
              <span className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${t.accent} text-white shadow-lg`}>
                <t.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold">{t.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{t.text}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                Open tool <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative border-y border-border bg-card/30">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">How it works</p>
              <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">From a spark to a finished scene</h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                EmmyAI Studio keeps the whole creative loop in one place: generate, refine, save, favorite and organise everything in your personal library.
              </p>
              <Button className="mt-8" size="lg" asChild>
                <Link to={startTo}>
                  Create your free account <ArrowRight />
                </Link>
              </Button>
            </div>
            <ol className="grid gap-4 sm:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="rounded-3xl border border-border glass p-6">
                  <span className="font-display text-3xl font-bold text-gradient">{s.n}</span>
                  <h3 className="mt-4 font-display text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Free + secure */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Zap, title: "Completely free", text: "No pricing page, no credits, no checkout. Sign up and every feature is yours." },
            { icon: ShieldCheck, title: "Private by default", text: "Your uploads and creations are protected with row-level security and private storage." },
            { icon: Sparkles, title: "Built to grow", text: "A modular AI engine layer means new image and video models can be added without changing the studio." },
          ].map((f) => (
            <div key={f.title} className="rounded-3xl border border-border bg-card/50 p-6">
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>

        <div className="relative mt-16 overflow-hidden rounded-[2rem] border border-border p-10 text-center sm:p-16">
          <div className="aurora" />
          <div className="relative">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">Your studio is waiting.</h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">Imagine • Generate • Create — free, for everyone.</p>
            <Button size="lg" className="mt-8" asChild>
              <Link to={startTo}>
                <Sparkles /> Start Creating
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
