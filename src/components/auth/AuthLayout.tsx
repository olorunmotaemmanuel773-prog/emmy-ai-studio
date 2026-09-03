import * as React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { NOT_CONFIGURED_MESSAGE } from "@/lib/supabase";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { configured } = useAuth();
  return (
    <div className="relative grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070a14] via-[#070a14]/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#070a14]/80" />
        <div className="relative flex h-full flex-col justify-between p-10 text-white">
          <Logo />
          <div className="max-w-md">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/60">Free AI creative studio</p>
            <h2 className="mt-3 font-display text-4xl font-bold leading-tight">
              Imagine • Generate • <span className="text-gradient">Create</span>
            </h2>
            <p className="mt-4 text-white/70 leading-relaxed">
              Turn your ideas, images and stories into stunning AI-generated visuals and cinematic videos. Every
              tool is included with your free account.
            </p>
          </div>
        </div>
      </div>

      <div className="relative flex flex-col px-5 py-8 sm:px-10 lg:px-16 lg:py-12">
        <div className="aurora lg:hidden" />
        <div className="relative flex items-center justify-between">
          <Logo className="lg:hidden" />
          <Link to="/" className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to site
          </Link>
        </div>
        <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>

          {!configured && (
            <div className="mt-6 flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-muted-foreground">{NOT_CONFIGURED_MESSAGE}</p>
            </div>
          )}

          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
