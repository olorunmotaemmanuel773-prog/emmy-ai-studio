import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { AppRole, Generation, Profile } from "@/lib/database.types";
import type { Paged } from "./generations";

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data as Profile) ?? null;
}

/**
 * Profiles are normally created by a database trigger when the auth user is
 * created (see the SQL migration). This is a safety net for projects where the
 * trigger was not installed.
 */
export async function ensureProfile(user: User): Promise<Profile | null> {
  const existing = await getProfile(user.id).catch(() => null);
  if (existing) return existing;
  const meta = (user.user_metadata ?? {}) as { full_name?: string; avatar_url?: string };
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: user.id,
        full_name: meta.full_name ?? user.email?.split("@")[0] ?? null,
        avatar_url: meta.avatar_url ?? null,
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();
  if (error) return null;
  return data as Profile;
}

export async function updateProfile(userId: string, patch: Partial<Pick<Profile, "full_name" | "avatar_url" | "settings">>) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Profile;
}

/** Merges a partial settings object into the profile's `settings` JSON. */
export async function saveUserSettings(profile: Profile, patch: Partial<NonNullable<Profile["settings"]>>) {
  return updateProfile(profile.user_id, { settings: { ...(profile.settings ?? {}), ...patch } });
}

export async function getUserRole(userId: string): Promise<AppRole> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  if (error || !data) return "user";
  return (data.role as AppRole) ?? "user";
}

/* ------------------------------- Admin -------------------------------- */
/* These queries only return data when the caller has the admin role — the
   database policies (is_admin()) enforce it, not the UI. */

export async function adminStats() {
  const head = { count: "exact" as const, head: true };
  const [users, generations, completed, failed, processing, storyboards] = await Promise.all([
    supabase.from("profiles").select("id", head),
    supabase.from("generations").select("id", head),
    supabase.from("generations").select("id", head).eq("status", "completed"),
    supabase.from("generations").select("id", head).eq("status", "failed"),
    supabase.from("generations").select("id", head).in("status", ["pending", "processing"]),
    supabase.from("storyboards").select("id", head),
  ]);
  return {
    users: users.count ?? 0,
    generations: generations.count ?? 0,
    completed: completed.count ?? 0,
    failed: failed.count ?? 0,
    processing: processing.count ?? 0,
    storyboards: storyboards.count ?? 0,
  };
}

export async function adminListProfiles(page = 0, pageSize = 20): Promise<Paged<Profile>> {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  const items = (data ?? []) as Profile[];
  return { items, hasMore: count !== null ? to + 1 < count : items.length === pageSize, total: count };
}

export async function adminListGenerations(page = 0, pageSize = 20): Promise<Paged<Generation>> {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabase
    .from("generations")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  const items = (data ?? []) as Generation[];
  return { items, hasMore: count !== null ? to + 1 < count : items.length === pageSize, total: count };
}
