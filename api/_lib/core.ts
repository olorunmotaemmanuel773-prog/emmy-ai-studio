// EmmyAI Studio — shared helpers for the Vercel serverless API (Node.js runtime).
//
// Security model
//  • Secrets (GEMINI_API_KEY) are read from process.env on the server only.
//  • Every request must carry the caller's Supabase access token. We create a
//    Supabase client *as that user*, so all database and storage operations are
//    scoped by Row Level Security. No service-role key is required or used.
//  • Files prefixed with "_" inside /api are never exposed as endpoints.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ApiErrorCode } from "../../src/types/api.js";

/* ------------------------------ Env ------------------------------ */
export const env = (name: string, fallback = ""): string => {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
};

export function supabaseConfig() {
  const url = env("VITE_SUPABASE_URL") || env("SUPABASE_URL");
  const key =
    env("VITE_SUPABASE_PUBLISHABLE_KEY") ||
    env("SUPABASE_PUBLISHABLE_KEY") ||
    env("VITE_SUPABASE_ANON_KEY") ||
    env("SUPABASE_ANON_KEY");
  return { url, key, configured: Boolean(url && key) };
}

/* ----------------------------- Errors ----------------------------- */
export class StudioError extends Error {
  code: ApiErrorCode;
  status: number;
  constructor(code: ApiErrorCode, message: string, status = 200) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function toStudioError(e: unknown): StudioError {
  if (e instanceof StudioError) return e;
  if (e instanceof Error && e.name === "AbortError") {
    return new StudioError("timeout", "The engine took too long to respond. Please try again.");
  }
  console.error("[emmyai] unexpected failure:", e); // server log only — never sent to the browser
  return new StudioError("unknown", "Something went wrong while creating. Please try again.");
}

/* ---------------------------- Responses --------------------------- */
export function corsHeaders(request?: Request): Record<string, string> {
  const allowed = env("ALLOWED_ORIGIN", "*");
  const origin = request?.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowed === "*" ? origin || "*" : allowed,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
}

export function json(body: unknown, status = 200, request?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...corsHeaders(request) },
  });
}
export const ok = <T>(data: T, request?: Request) => json({ ok: true, data }, 200, request);
export const fail = (code: ApiErrorCode, message: string, status = 200, request?: Request) =>
  json({ ok: false, error: { code, message } }, status, request);

export function preflight(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    throw new StudioError("invalid_request", "Invalid request body.", 400);
  }
}

/** Wraps a handler so every failure becomes a friendly JSON error. */
export function handle(fn: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try {
      return await fn(request);
    } catch (e) {
      const err = toStudioError(e);
      return fail(err.code, err.message, err.status, request);
    }
  };
}

/* ------------------------------ Auth ------------------------------ */
export interface Ctx {
  userId: string;
  /** Supabase client acting as the signed-in user (RLS enforced). */
  db: SupabaseClient;
}

export async function requireUser(request: Request): Promise<Ctx> {
  const { url, key, configured } = supabaseConfig();
  if (!configured) throw new StudioError("unavailable", "The studio backend is missing its Supabase configuration.", 500);

  const header = request.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new StudioError("unauthorized", "Please sign in again.", 401);

  const db = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new StudioError("unauthorized", "Your session has expired. Please sign in again.", 401);
  return { userId: data.user.id, db };
}

/* --------------------------- Generations -------------------------- */
export interface GenerationRow {
  id: string;
  user_id: string;
  type: string;
  status: string;
  provider: string | null;
  result_url: string | null;
  thumbnail_url: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

export async function loadOwnedGeneration(ctx: Ctx, generationId: unknown): Promise<GenerationRow> {
  if (typeof generationId !== "string" || !/^[0-9a-f-]{36}$/i.test(generationId)) {
    throw new StudioError("invalid_request", "Missing generation id.");
  }
  // RLS guarantees only the caller's rows are visible.
  const { data, error } = await ctx.db.from("generations").select("*").eq("id", generationId).maybeSingle();
  if (error || !data) throw new StudioError("invalid_request", "Generation not found.");
  return { ...(data as GenerationRow), metadata: ((data as GenerationRow).metadata ?? {}) as Record<string, unknown> };
}

export async function setGeneration(ctx: Ctx, id: string, patch: Record<string, unknown>) {
  await ctx.db.from("generations").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
}

export async function failGeneration(ctx: Ctx, id: string, message: string) {
  await setGeneration(ctx, id, { status: "failed", error_message: message.slice(0, 300) }).catch(() => null);
}

export interface Output {
  ref: string;
  kind: "image" | "video";
  thumbnailRef?: string | null;
  sizeBytes?: number | null;
}

/** Records media_files rows and marks the generation completed. */
export async function completeGeneration(ctx: Ctx, generationId: string, outputs: Output[], provider: string) {
  const rows = outputs.map((o) => ({
    user_id: ctx.userId,
    generation_id: generationId,
    file_type: o.kind,
    file_url: o.ref,
    thumbnail_url: o.thumbnailRef ?? null,
    size_bytes: o.sizeBytes ?? null,
  }));
  const { data, error } = await ctx.db.from("media_files").insert(rows).select("id, file_url");
  if (error) throw new StudioError("unavailable", "The result could not be recorded. Please try again.");
  await setGeneration(ctx, generationId, {
    status: "completed",
    result_url: outputs[0]?.ref ?? null,
    thumbnail_url: outputs[0]?.thumbnailRef ?? null,
    provider,
    error_message: null,
  });
  return (data ?? []).map((m: { id: string; file_url: string }) => ({ mediaFileId: m.id, url: m.file_url }));
}

/* ----------------------------- Storage ---------------------------- */
const BUCKETS = ["images", "videos", "storyboards", "avatars"];

export function parseRef(ref: unknown) {
  if (typeof ref !== "string") throw new StudioError("invalid_request", "Invalid media reference.");
  const idx = ref.indexOf("/");
  const bucket = ref.slice(0, idx);
  const path = ref.slice(idx + 1);
  if (idx < 1 || !BUCKETS.includes(bucket) || !path) throw new StudioError("invalid_request", "Invalid media reference.");
  return { bucket, path };
}

/** Downloads a file the caller owns ("bucket/<user_id>/…"). RLS enforces ownership as well. */
export async function downloadOwnedFile(ctx: Ctx, ref: unknown): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const { bucket, path } = parseRef(ref);
  if (!path.startsWith(`${ctx.userId}/`)) throw new StudioError("invalid_request", "You can only use your own uploads.");
  const { data, error } = await ctx.db.storage.from(bucket).download(path);
  if (error || !data) throw new StudioError("invalid_request", "The uploaded file could not be read. Please upload it again.");
  return { bytes: new Uint8Array(await data.arrayBuffer()), mimeType: data.type || "application/octet-stream" };
}

export async function storeBytes(ctx: Ctx, bucket: string, path: string, bytes: Uint8Array, contentType: string) {
  const { error } = await ctx.db.storage.from(bucket).upload(path, bytes, { contentType, upsert: true, cacheControl: "3600" });
  if (error) throw new StudioError("unavailable", "The result could not be saved to your studio storage.");
  return `${bucket}/${path}`;
}

export const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
export const fromBase64 = (b64: string) => new Uint8Array(Buffer.from(b64, "base64"));

/* ---------------------------- Validation -------------------------- */
export const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;

/* ------------------------- Prompt engineering --------------------- */
export const STYLE_PROMPTS: Record<string, string> = {
  realistic: "realistic, natural lighting, true-to-life textures and colours",
  "3d-animation": "high-end 3D animated film look, stylised characters, soft global illumination, subsurface scattering",
  cinematic: "cinematic film still, anamorphic lens, dramatic motivated lighting, shallow depth of field, subtle film grain",
  "african-cinema": "contemporary African cinema aesthetic, rich warm skin tones, vibrant fabrics and textures, authentic locations, golden natural light",
  anime: "anime style, clean line art, expressive characters, painterly backgrounds, vibrant palette",
  fantasy: "epic fantasy concept, magical atmosphere, intricate detail, dramatic scale",
  photorealistic: "ultra photorealistic, 50mm lens, accurate skin and material detail, professional photography",
  portrait: "professional portrait photography, 85mm lens, soft key light, creamy bokeh, sharp eyes",
  fashion: "editorial fashion photography, studio lighting, bold styling, magazine quality",
  commercial: "polished commercial advertising visual, clean composition, product-hero lighting",
  "film-still": "35mm film still, cinematic colour grade, natural imperfection, storytelling frame",
  "concept-art": "digital concept art, painterly brushwork, strong silhouette and mood, production design quality",
  film: "narrative film look, cinematic colour grading, motivated lighting, professional cinematography",
};

export const CAMERA_PROMPTS: Record<string, string> = {
  static: "static locked-off camera",
  "slow-zoom": "slow smooth zoom in",
  "dolly-in": "smooth dolly in towards the subject",
  "dolly-out": "smooth dolly out revealing the scene",
  "pan-left": "slow pan left",
  "pan-right": "slow pan right",
  "tilt-up": "slow tilt up",
  "tilt-down": "slow tilt down",
  orbit: "smooth orbit around the subject",
  handheld: "handheld cinematic camera with subtle natural shake",
};

export function buildPrompt(prompt: string, style?: string, extras: string[] = []) {
  const parts = [prompt.trim()];
  if (style && STYLE_PROMPTS[style]) parts.push(STYLE_PROMPTS[style]);
  parts.push(...extras.filter(Boolean));
  return parts.join(". ");
}
