import { Link } from "react-router-dom";
import { ArrowRight, Globe2, HeartHandshake, Lock, Sparkles } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const VALUES = [
  { icon: HeartHandshake, title: "Free means free", text: "There is no pricing page, no credits and no checkout anywhere in the studio. Every member gets the same tools." },
  { icon: Lock, title: "Your work stays yours", text: "Uploads and generations live in private storage protected by row-level security. Only you can see them unless you choose to share." },
  { icon: Globe2, title: "Made for every storyteller", text: "From Nollywood scripts and African cinema looks to anime and 3D animation — the presets reflect the stories people actually tell." },
  { icon: Sparkles, title: "Honest about AI", text: "When an engine isn't connected yet, the studio says so clearly. We never fake a result." },
];

export default function AboutPage() {
  const { user } = useAuth();
  return (
    <div className="relative">
      <div className="aurora opacity-50" />
      <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:pt-24">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">About</p>
          <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">A creative studio that belongs to everyone.</h1>
          <p className="mt-6 text-muted-foreground leading-relaxed">
            EmmyAI Studio started with a simple frustration: the most exciting creative tools were locked behind credits, tiers and paywalls. We wanted a place where anyone with an idea could imagine it, generate it and create something real — without reaching for a card.
          </p>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            The result is one studio for images, cinematic video and storyboards, built on a secure Supabase backend and a modular AI engine layer that can adopt new models as they arrive.
          </p>
          <Button size="lg" className="mt-8" asChild>
            <Link to={user ? "/studio" : "/signup"}>
              {user ? "Open the studio" : "Join for free"} <ArrowRight />
            </Link>
          </Button>
        </div>
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 shadow-soft">
          <img src={hero} alt="" className="aspect-[4/3] w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070a14]/70 to-transparent" />
          <p className="absolute bottom-5 left-5 font-display text-sm font-semibold uppercase tracking-[0.3em] text-white/80">Imagine • Generate • Create</p>
        </div>
      </section>

      <section className="relative border-t border-border bg-card/30">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">What we stand for</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {VALUES.map((v) => (
              <div key={v.title} className="rounded-3xl border border-border glass p-6 sm:p-8">
                <v.icon className="h-5 w-5 text-primary" />
                <h3 className="mt-4 font-display text-lg font-semibold">{v.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">How it's built</p>
            <h2 className="mt-3 font-display text-2xl font-bold">Modern, secure, modular</h2>
          </div>
          <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
            {[
              ["Frontend", "React, TypeScript, Vite, Tailwind CSS and shadcn/ui components."],
              ["Backend", "Supabase Authentication, PostgreSQL with row-level security and private Storage buckets."],
              ["AI engines", "Google Gemini for images and storyboards, Veo for video — called only from secure serverless functions; the API key never reaches the browser."],
              ["Workflow", "Generations, favorites, storyboards and scenes are real database records you own."],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-border bg-card/60 p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{k}</p>
                <p className="mt-2 text-sm leading-relaxed">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
