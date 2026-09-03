import * as React from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ArrowRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/features", label: "Features" },
  { to: "/studio/create", label: "Create" },
  { to: "/gallery", label: "Gallery" },
  { to: "/about", label: "About" },
];

export function PublicLayout() {
  const { user, loading } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const location = useLocation();

  React.useEffect(() => setOpen(false), [location.pathname]);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative min-h-dvh flex flex-col">
      <header
        className={cn(
          "sticky top-0 z-40 transition-all duration-300",
          scrolled || open ? "glass border-x-0 border-t-0" : "bg-transparent border-b border-transparent",
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                    isActive ? "text-foreground bg-muted/70" : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            {!loading && user ? (
              <Button asChild>
                <Link to="/studio">
                  Open Studio <ArrowRight />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/login">Log in</Link>
                </Button>
                <Button asChild>
                  <Link to="/signup">Sign up free</Link>
                </Button>
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Toggle menu"
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
        {open && (
          <div className="md:hidden border-t border-border px-4 pb-5 pt-3 animate-fade-in">
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "rounded-xl px-4 py-3 text-[15px] font-medium",
                      isActive ? "bg-muted text-foreground" : "text-muted-foreground",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {user ? (
                <Button asChild className="col-span-2">
                  <Link to="/studio">Open Studio</Link>
                </Button>
              ) : (
                <>
                  <Button variant="outline" asChild>
                    <Link to="/login">Log in</Link>
                  </Button>
                  <Button asChild>
                    <Link to="/signup">Sign up free</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="relative border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <Logo />
              <p className="mt-4 max-w-sm text-sm text-muted-foreground leading-relaxed">
                A free AI creative studio for images, cinematic video and storyboards. No paywall, no credits —
                just create.
              </p>
            </div>
            <FooterColumn
              title="Studio"
              links={[
                { to: "/studio/create?mode=text-to-image", label: "Text to Image" },
                { to: "/studio/create?mode=image-to-image", label: "Image to Image" },
                { to: "/studio/create?mode=text-to-video", label: "Text to Video" },
                { to: "/studio/create?mode=story-to-storyboard", label: "Story to Storyboard" },
              ]}
            />
            <FooterColumn
              title="Explore"
              links={[
                { to: "/features", label: "Features" },
                { to: "/gallery", label: "Gallery" },
                { to: "/about", label: "About" },
              ]}
            />
            <FooterColumn
              title="Account"
              links={[
                { to: "/login", label: "Log in" },
                { to: "/signup", label: "Create account" },
                { to: "/forgot-password", label: "Forgot password" },
              ]}
            />
          </div>
          <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} EmmyAI Studio. Free for everyone.</span>
            <span className="font-semibold uppercase tracking-[0.25em]">Imagine • Generate • Create</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterColumn({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <h4 className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{title}</h4>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="text-sm text-foreground/80 transition-colors hover:text-foreground">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
