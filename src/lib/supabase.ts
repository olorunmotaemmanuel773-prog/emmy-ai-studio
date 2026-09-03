import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client.
 *
 * Only the *publishable* key lives in the frontend. It is safe to ship to
 * browsers because every table and bucket is protected with Row Level
 * Security. Privileged keys (service role) and AI keys (GEMINI_API_KEY) are
 * never read here — they exist only on the server (see /api).
 */
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim();

export const isSupabaseConfigured = Boolean(
  url && publishableKey && /^https?:\/\//.test(url) && !url.includes("your-project"),
);

export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured && url ? url : "https://placeholder-project.supabase.co",
  isSupabaseConfigured && publishableKey ? publishableKey : "publishable-key-not-configured",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storageKey: "emmyai-auth",
    },
  },
);

export const BUCKETS = {
  images: "images",
  videos: "videos",
  avatars: "avatars",
  storyboards: "storyboards",
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

export const NOT_CONFIGURED_MESSAGE =
  "EmmyAI Studio is not connected to Supabase yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your environment to enable accounts and creations.";
