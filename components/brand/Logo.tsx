import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#070a14] border border-white/10 shadow-[0_0_24px_-6px_rgba(139,92,246,0.8)]",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 64 64" className="h-5 w-5">
        <defs>
          <linearGradient id="emmy-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3D7BFF" />
            <stop offset="0.5" stopColor="#8B5CF6" />
            <stop offset="1" stopColor="#E23DC5" />
          </linearGradient>
        </defs>
        <path d="M14 50V14h34v8H24v6h20v8H24v6h25v8z" fill="url(#emmy-g)" />
        <circle cx="52" cy="14" r="4" fill="#38d6ff" />
      </svg>
    </span>
  );
}

export function Logo({ className, to = "/", compact = false }: { className?: string; to?: string; compact?: boolean }) {
  return (
    <Link to={to} className={cn("group inline-flex items-center gap-2.5", className)} aria-label="EmmyAI Studio home">
      <LogoMark className="transition-transform duration-300 group-hover:rotate-[-6deg]" />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[15px] font-bold tracking-tight">
            Emmy<span className="text-gradient">AI</span> Studio
          </span>
          <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Imagine • Generate • Create
          </span>
        </span>
      )}
    </Link>
  );
}
