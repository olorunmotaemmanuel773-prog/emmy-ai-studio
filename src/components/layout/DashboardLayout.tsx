import * as React from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Clapperboard,
  Clock,
  Film,
  Heart,
  Image as ImageIcon,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  MoreHorizontal,
  Moon,
  Plus,
  Settings,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { EngineStatusPill } from "@/components/studio/EngineStatus";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; end?: boolean };

const PRIMARY_NAV: NavItem[] = [
  { to: "/studio", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/studio/create", label: "Create New", icon: Plus },
  { to: "/studio/creations", label: "My Creations", icon: LayoutGrid },
  { to: "/studio/images", label: "Images", icon: ImageIcon },
  { to: "/studio/videos", label: "Videos", icon: Film },
  { to: "/studio/storyboards", label: "Storyboards", icon: Clapperboard },
  { to: "/studio/favorites", label: "Favorites", icon: Heart },
  { to: "/studio/history", label: "History", icon: Clock },
  { to: "/studio/settings", label: "Settings", icon: Settings },
];

const MOBILE_NAV: NavItem[] = [
  { to: "/studio", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/studio/creations", label: "Creations", icon: LayoutGrid },
  { to: "/studio/create", label: "Create", icon: Plus },
  { to: "/studio/favorites", label: "Favorites", icon: Heart },
];

export function DashboardLayout() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const { resolved, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMoreOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Creator";
  const nav = isAdmin ? [...PRIMARY_NAV, { to: "/studio/admin", label: "Admin", icon: ShieldCheck }] : PRIMARY_NAV;

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="relative min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      {/* Sidebar */}
      <aside className="hidden lg:flex lg:flex-col sticky top-0 h-dvh border-r border-border bg-[var(--sidebar)] backdrop-blur-xl">
        <div className="px-5 pt-5 pb-4">
          <Logo to="/studio" />
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2" aria-label="Studio">
          {nav.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-xl p-2">
            <Avatar src={profile?.avatar_url} name={displayName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={handleSignOut} aria-label="Sign out" title="Sign out">
              <LogOut />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-30 glass border-x-0 border-t-0">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:h-16 lg:px-8">
            <div className="flex items-center gap-3 lg:hidden">
              <Link to="/studio" aria-label="Dashboard">
                <LogoMark />
              </Link>
              <span className="font-display text-sm font-bold">
                Emmy<span className="text-gradient">AI</span>
              </span>
            </div>
            <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{pageTitle(location.pathname)}</span>
              <Badge variant="success" className="ml-2 normal-case tracking-normal">
                Free studio
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <EngineStatusPill />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
                aria-label="Toggle theme"
                title="Toggle theme"
              >
                {resolved === "dark" ? <Sun /> : <Moon />}
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link to="/studio/create">
                  <Plus /> New creation
                </Link>
              </Button>
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="Account menu"
                >
                  <Avatar src={profile?.avatar_url} name={displayName} size="sm" />
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-popover p-1.5 shadow-2xl animate-fade-up"
                  >
                    <div className="px-3 py-2">
                      <p className="truncate text-sm font-semibold">{displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                    <MenuItem to="/studio/settings" icon={Settings} label="Settings" />
                    {isAdmin && <MenuItem to="/studio/admin" icon={ShieldCheck} label="Admin" />}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 glass border-x-0 border-b-0 safe-bottom lg:hidden"
        aria-label="Studio mobile"
      >
        <div className="grid grid-cols-5">
          {MOBILE_NAV.slice(0, 2).map((item) => (
            <MobileLink key={item.to} item={item} />
          ))}
          <NavLink
            to="/studio/create"
            className="flex flex-col items-center justify-center py-2"
            aria-label="Create"
          >
            <span className="grid h-12 w-12 -translate-y-3 place-items-center rounded-2xl bg-brand-gradient text-white shadow-glow">
              <Plus className="h-6 w-6" />
            </span>
          </NavLink>
          <MobileLink item={MOBILE_NAV[3]} />
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground"
          >
            <MoreHorizontal className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>

      {/* Mobile "More" sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Close" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-border bg-popover p-4 pb-8 animate-fade-up">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-sm font-semibold">Studio</p>
              <Button variant="ghost" size="icon-sm" onClick={() => setMoreOpen(false)} aria-label="Close">
                <X />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {nav
                .filter((n) => !["/studio", "/studio/create", "/studio/creations", "/studio/favorites"].includes(n.to))
                .map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "flex flex-col items-center gap-2 rounded-2xl border border-border p-4 text-xs font-medium",
                        isActive ? "bg-primary/10 text-foreground border-primary/40" : "text-muted-foreground",
                      )
                    }
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </NavLink>
                ))}
              <button
                type="button"
                onClick={handleSignOut}
                className="flex flex-col items-center gap-2 rounded-2xl border border-destructive/30 p-4 text-xs font-medium text-destructive"
              >
                <LogOut className="h-5 w-5" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
          isActive
            ? "bg-primary/10 text-foreground shadow-[inset_0_0_0_1px_rgba(61,123,255,0.25)]"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          <item.icon className={cn("h-[18px] w-[18px]", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
          {item.label}
        </>
      )}
    </NavLink>
  );
}

function MobileLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium",
          isActive ? "text-primary" : "text-muted-foreground",
        )
      }
    >
      <item.icon className="h-5 w-5" />
      {item.label}
    </NavLink>
  );
}

function MenuItem({ to, icon: Icon, label }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link to={to} role="menuitem" className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-muted">
      <Icon className="h-4 w-4 text-muted-foreground" /> {label}
    </Link>
  );
}

function pageTitle(pathname: string) {
  if (pathname === "/studio") return "Dashboard";
  if (pathname.startsWith("/studio/create")) return "Create";
  if (pathname.startsWith("/studio/creations")) return "My Creations";
  if (pathname.startsWith("/studio/images")) return "Images";
  if (pathname.startsWith("/studio/videos")) return "Videos";
  if (pathname.startsWith("/studio/storyboards")) return "Storyboards";
  if (pathname.startsWith("/studio/favorites")) return "Favorites";
  if (pathname.startsWith("/studio/history")) return "History";
  if (pathname.startsWith("/studio/settings")) return "Settings";
  if (pathname.startsWith("/studio/admin")) return "Admin";
  return "Studio";
}
