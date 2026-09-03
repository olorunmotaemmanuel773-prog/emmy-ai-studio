import * as React from "react";
import { Navigate } from "react-router-dom";
import { Activity, CheckCircle2, Database, Film, Image as ImageIcon, Loader2, ShieldCheck, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useEngineStatus } from "@/contexts/EngineStatusContext";
import { adminListGenerations, adminListProfiles, adminStats } from "@/lib/api/profiles";
import type { Generation, Profile } from "@/lib/database.types";
import { isSupabaseConfigured } from "@/lib/supabase";
import { formatDateTime, friendlyError, GENERATION_TYPE_LABELS, truncate } from "@/lib/utils";

type Stats = Awaited<ReturnType<typeof adminStats>>;

export default function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [profiles, setProfiles] = React.useState<Profile[] | null>(null);
  const [generations, setGenerations] = React.useState<Generation[] | null>(null);
  const { state: engineState, health: studioHealth, refresh } = useEngineStatus();
  const [checking, setChecking] = React.useState(false);
  const health: Partial<NonNullable<typeof studioHealth>["engines"]> = studioHealth?.engines ?? {};
  const engineDetail = (kind: "image" | "video" | "storyboard") => {
    const info = studioHealth?.engines[kind];
    if (engineState === "loading") return "Checking…";
    if (engineState === "unreachable") return "API unreachable";
    if (!info) return "Not checked";
    return info.configured ? `${info.provider} · ${info.model ?? ""}` : "Not configured — demo mode";
  };

  React.useEffect(() => {
    if (!isAdmin) return;
    Promise.all([adminStats(), adminListProfiles(0, 20), adminListGenerations(0, 20)])
      .then(([s, p, g]) => {
        setStats(s);
        setProfiles(p.items);
        setGenerations(g.items);
      })
      .catch((err) => toast.error(friendlyError(err, "We couldn't load admin data.")));
  }, [isAdmin]);

  const checkHealth = async () => {
    setChecking(true);
    await refresh();
    setChecking(false);
  };

  if (loading) return <Skeleton className="h-64 rounded-3xl" />;
  if (!isAdmin) return <Navigate to="/studio" replace />;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Admin</p>
        <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">Studio overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Visible only to accounts with the admin role. Access is enforced by database policies.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={Users} label="Users" value={stats?.users} />
        <StatCard icon={Database} label="Generations" value={stats?.generations} />
        <StatCard icon={CheckCircle2} label="Completed" value={stats?.completed} />
        <StatCard icon={Loader2} label="In progress" value={stats?.processing} />
        <StatCard icon={XCircle} label="Failed" value={stats?.failed} />
        <StatCard icon={Film} label="Storyboards" value={stats?.storyboards} />
      </div>

      {/* System status */}
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> System status
            </CardTitle>
            <CardDescription>Connectivity and AI engine configuration. Keys are never shown here.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={checkHealth} loading={checking}>
            Check engines
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatusRow label="Supabase" ok={isSupabaseConfigured} detail={isSupabaseConfigured ? "Connected" : "Not configured"} />
          <StatusRow label="Image engine (Gemini)" ok={engineState === "ready" ? Boolean(health.image?.configured) : false} detail={engineDetail("image")} />
          <StatusRow label="Video engine (Veo)" ok={engineState === "ready" ? Boolean(health.video?.configured) : false} detail={engineDetail("video")} />
          <StatusRow label="Story engine (Gemini)" ok={engineState === "ready" ? Boolean(health.storyboard?.configured) : false} detail={engineDetail("storyboard")} />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Recent users
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profiles === null ? (
              <Skeleton className="h-40" />
            ) : profiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {profiles.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-3">
                    <Avatar src={p.avatar_url} name={p.full_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.full_name ?? "Unnamed"}</p>
                      <p className="truncate text-xs text-muted-foreground">Joined {formatDateTime(p.created_at)}</p>
                    </div>
                    <Badge variant="outline" className="font-mono normal-case tracking-normal">{p.user_id.slice(0, 8)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" /> Recent generations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {generations === null ? (
              <Skeleton className="h-40" />
            ) : generations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No generations yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {generations.map((g) => (
                  <li key={g.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{truncate(g.prompt, 70)}</p>
                      <p className="text-xs text-muted-foreground">
                        {GENERATION_TYPE_LABELS[g.type]} · {formatDateTime(g.created_at)}
                      </p>
                    </div>
                    <Badge variant={g.status === "completed" ? "success" : g.status === "failed" ? "destructive" : "warning"}>{g.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" /> Grant admin access with SQL: <code className="rounded bg-muted px-1.5 py-0.5">insert into user_roles (user_id, role) values ('&lt;uuid&gt;', 'admin');</code>
      </p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value?: number }) {
  return (
    <div className="rounded-2xl border border-border glass p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      {value === undefined ? <Skeleton className="mt-2 h-7 w-12" /> : <p className="mt-1 font-display text-2xl font-bold">{value}</p>}
    </div>
  );
}

function StatusRow({ label, ok, detail }: { label: string; ok?: boolean; detail: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-background/50 p-3.5">
      <span className={`h-2.5 w-2.5 rounded-full ${ok === undefined ? "bg-muted-foreground/40" : ok ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]" : "bg-amber-500"}`} />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="truncate text-xs capitalize text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
