import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Check, KeyRound, LogOut, Monitor, Moon, Sun, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, type ThemePreference } from "@/contexts/ThemeContext";
import { saveUserSettings, updateProfile } from "@/lib/api/profiles";
import { uploadAvatar, validateFile } from "@/lib/api/storage";
import { supabase } from "@/lib/supabase";
import { cn, friendlyError } from "@/lib/utils";

const THEMES: { value: ThemePreference; label: string; icon: React.ComponentType<{ className?: string }>; hint: string }[] = [
  { value: "dark", label: "Dark", icon: Moon, hint: "Cinematic studio look" },
  { value: "light", label: "Light", icon: Sun, hint: "Bright and airy" },
  { value: "system", label: "System", icon: Monitor, hint: "Match your device" },
];

export default function SettingsPage() {
  const { user, profile, setProfile, signOut, updatePassword } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [name, setName] = React.useState(profile?.full_name ?? "");
  const [savingName, setSavingName] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [savingPassword, setSavingPassword] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => setName(profile?.full_name ?? ""), [profile?.full_name]);

  /** Applies the theme locally and remembers it on the user's profile (Supabase). */
  const chooseTheme = async (next: ThemePreference) => {
    setTheme(next);
    if (!profile) return;
    try {
      const updated = await saveUserSettings(profile, { theme: next });
      setProfile(updated);
    } catch {
      /* local preference still applies; sync is best-effort */
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (name.trim().length < 2) return toast.error("Please enter your name.");
    setSavingName(true);
    try {
      const updated = await updateProfile(user.id, { full_name: name.trim() });
      setProfile(updated);
      await supabase.auth.updateUser({ data: { full_name: name.trim() } }).catch(() => null);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSavingName(false);
    }
  };

  const changeAvatar = async (file: File | undefined) => {
    if (!file || !user) return;
    const check = validateFile(file, "avatar");
    if (!check.ok) return toast.error(check.error);
    setUploading(true);
    try {
      const url = await uploadAvatar(file, user.id);
      const updated = await updateProfile(user.id, { avatar_url: url });
      setProfile(updated);
      toast.success("Avatar updated");
    } catch (err) {
      toast.error(friendlyError(err, "We couldn't upload your avatar."));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    if (password.length < 8) return toast.error("Your new password should be at least 8 characters.");
    if (password !== confirm) return toast.error("The new passwords don't match.");
    setSavingPassword(true);
    try {
      // Re-authenticate before changing the password.
      const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (error) throw new Error("Your current password is incorrect.");
      await updatePassword(password);
      setCurrentPassword("");
      setPassword("");
      setConfirm("");
      toast.success("Password changed");
    } catch (err) {
      toast.error(friendlyError(err, "We couldn't change your password."));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Settings</p>
        <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">Your studio, your way</h1>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-primary" /> Profile
          </CardTitle>
          <CardDescription>How you appear across EmmyAI Studio.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar src={profile?.avatar_url} name={name || profile?.full_name} size="xl" />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-foreground shadow-lg hover:bg-muted"
                aria-label="Change avatar"
              >
                <Camera className={cn("h-4 w-4", uploading && "animate-pulse")} />
              </button>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => changeAvatar(e.target.files?.[0])} />
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">Profile photo</p>
              <p>PNG, JPG or WebP up to 2 MB.</p>
            </div>
          </div>
          <form onSubmit={saveProfile} className="mt-6 grid gap-4 sm:grid-cols-2">
            <FormField label="Full name" htmlFor="name">
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </FormField>
            <FormField label="Email" htmlFor="email" hint="Email changes are managed through account recovery.">
              <Input id="email" value={user?.email ?? ""} readOnly className="opacity-70" />
            </FormField>
            <div className="sm:col-span-2">
              <Button type="submit" loading={savingName}>
                <Check /> Save profile
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-primary" /> Appearance
          </CardTitle>
          <CardDescription>Choose how the studio looks on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {THEMES.map((t) => {
              const active = theme === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => void chooseTheme(t.value)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border p-4 text-left transition-all",
                    active ? "border-primary/60 bg-primary/10 shadow-[inset_0_0_0_1px_rgba(61,123,255,0.35)]" : "border-border hover:border-foreground/20",
                  )}
                  aria-pressed={active}
                >
                  <span className={cn("grid h-10 w-10 place-items-center rounded-xl", active ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                    <t.icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{t.label}</span>
                    <span className="block text-xs text-muted-foreground">{t.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> Account
          </CardTitle>
          <CardDescription>Change your password or sign out of the studio.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <form onSubmit={changePassword} className="grid gap-4 sm:grid-cols-3">
            <FormField label="Current password" htmlFor="current">
              <Input id="current" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </FormField>
            <FormField label="New password" htmlFor="new">
              <Input id="new" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </FormField>
            <FormField label="Confirm new password" htmlFor="confirm">
              <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </FormField>
            <div className="sm:col-span-3">
              <Button type="submit" variant="secondary" loading={savingPassword}>
                Change password
              </Button>
            </div>
          </form>
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Sign out</p>
              <p className="text-xs text-muted-foreground">You can log back in any time — your creations stay safe.</p>
            </div>
            <Button
              variant="destructive"
              onClick={async () => {
                await signOut();
                navigate("/", { replace: true });
              }}
            >
              <LogOut /> Log out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
