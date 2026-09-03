import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, NOT_CONFIGURED_MESSAGE, supabase } from "@/lib/supabase";
import type { AppRole, Profile } from "@/lib/database.types";
import { ensureProfile, getUserRole } from "@/lib/api/profiles";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole;
  isAdmin: boolean;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  setProfile: (profile: Profile | null) => void;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

function appUrl() {
  const configured = import.meta.env.VITE_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  return window.location.origin;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [role, setRole] = React.useState<AppRole>("user");
  const [loading, setLoading] = React.useState(true);

  const user = session?.user ?? null;

  const loadProfile = React.useCallback(async (u: User | null) => {
    if (!u) {
      setProfile(null);
      setRole("user");
      return;
    }
    const [p, r] = await Promise.all([ensureProfile(u).catch(() => null), getUserRole(u.id).catch(() => "user" as AppRole)]);
    setProfile(p);
    setRole(r);
  }, []);

  React.useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    let active = true;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active) return;
        setSession(data.session);
        await loadProfile(data.session?.user ?? null);
      })
      .finally(() => active && setLoading(false));

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!active) return;
      setSession(newSession);
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setRole("user");
      } else if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED") {
        // Defer Supabase calls out of the auth callback (avoids deadlocks).
        setTimeout(() => void loadProfile(newSession?.user ?? null), 0);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const guard = () => {
    if (!isSupabaseConfigured) throw new Error(NOT_CONFIGURED_MESSAGE);
  };

  const value: AuthContextValue = {
    user,
    session,
    profile,
    role,
    isAdmin: role === "admin",
    loading,
    configured: isSupabaseConfigured,

    async signIn(email, password) {
      guard();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    },

    async signUp(fullName, email, password) {
      guard();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: `${appUrl()}/login`,
        },
      });
      if (error) throw error;
      // If email confirmation is disabled, a session is returned immediately.
      return { needsConfirmation: !data.session };
    },

    async signOut() {
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      setRole("user");
    },

    async requestPasswordReset(email) {
      guard();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${appUrl()}/reset-password`,
      });
      if (error) throw error;
    },

    async updatePassword(password) {
      guard();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },

    async refreshProfile() {
      await loadProfile(user);
    },

    setProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
