import { supabase } from "@/lib/supabase";
import type {
  Generation,
  GenerationRecord,
  GenerationStatus,
  GenerationType,
  MediaFile,
  PublicGalleryItem,
} from "@/lib/database.types";
import { removeMediaRefs } from "./storage";

export const IMAGE_TYPES: GenerationType[] = ["text-to-image", "image-to-image", "storyboard-scene-image"];
export const VIDEO_TYPES: GenerationType[] = ["text-to-video", "image-to-video", "video-to-video", "storyboard-scene-video"];

const SELECT = "*, media_files(*), favorites(id)";
export const PAGE_SIZE = 24;

export type GenerationKind = "all" | "image" | "video";

export interface ListGenerationsParams {
  userId: string;
  kind?: GenerationKind;
  types?: GenerationType[];
  favoritesOnly?: boolean;
  savedOnly?: boolean;
  statuses?: GenerationStatus[];
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface Paged<T> {
  items: T[];
  hasMore: boolean;
  total: number | null;
}

function normalize(row: Record<string, unknown>): GenerationRecord {
  return {
    ...(row as unknown as Generation),
    media_files: ((row.media_files as MediaFile[]) ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    favorites: (row.favorites as { id: string }[]) ?? [],
  };
}

export async function listGenerations(params: ListGenerationsParams): Promise<Paged<GenerationRecord>> {
  const page = params.page ?? 0;
  const pageSize = params.pageSize ?? PAGE_SIZE;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("generations")
    .select(params.favoritesOnly ? "*, media_files(*), favorites!inner(id)" : SELECT, { count: "exact" })
    .eq("user_id", params.userId);

  if (params.types?.length) query = query.in("type", params.types);
  else if (params.kind === "image") query = query.in("type", IMAGE_TYPES);
  else if (params.kind === "video") query = query.in("type", VIDEO_TYPES);

  if (params.savedOnly) query = query.eq("is_saved", true);
  if (params.statuses?.length) query = query.in("status", params.statuses);
  if (params.search?.trim()) {
    const term = params.search.trim().replace(/[%_,]/g, " ");
    query = query.or(`prompt.ilike.%${term}%,style.ilike.%${term}%`);
  }

  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) throw error;
  const items = (data ?? []).map((r) => normalize(r as Record<string, unknown>));
  return { items, hasMore: count !== null ? to + 1 < count : items.length === pageSize, total: count };
}

export async function listRecentGenerations(userId: string, types: GenerationType[] | null, limit = 6) {
  let query = supabase
    .from("generations")
    .select(SELECT)
    .eq("user_id", userId)
    .eq("status", "completed")
    .eq("is_saved", true);
  if (types) query = query.in("type", types);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
}

export async function getGeneration(id: string): Promise<GenerationRecord | null> {
  const { data, error } = await supabase.from("generations").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? normalize(data as Record<string, unknown>) : null;
}

export interface CreateGenerationInput {
  userId: string;
  type: GenerationType;
  prompt: string;
  style?: string | null;
  aspectRatio?: string | null;
  provider?: string | null;
  metadata?: Record<string, unknown>;
  storyboardSceneId?: string | null;
  isSaved?: boolean;
}

export async function createGeneration(input: CreateGenerationInput): Promise<Generation> {
  const { data, error } = await supabase
    .from("generations")
    .insert({
      user_id: input.userId,
      type: input.type,
      prompt: input.prompt,
      style: input.style ?? null,
      aspect_ratio: input.aspectRatio ?? null,
      provider: input.provider ?? null,
      status: "pending",
      metadata: input.metadata ?? {},
      storyboard_scene_id: input.storyboardSceneId ?? null,
      is_saved: input.isSaved ?? false,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Generation;
}

export async function updateGeneration(id: string, patch: Partial<Generation>): Promise<Generation> {
  const { data, error } = await supabase
    .from("generations")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Generation;
}

export async function markGenerationFailed(id: string, message: string) {
  try {
    await updateGeneration(id, { status: "failed", error_message: message.slice(0, 300) });
  } catch {
    /* non-critical */
  }
}

export async function setGenerationSaved(id: string, saved: boolean) {
  return updateGeneration(id, { is_saved: saved });
}

export async function setGenerationPublic(id: string, isPublic: boolean) {
  return updateGeneration(id, { is_public: isPublic, is_saved: isPublic ? true : undefined } as Partial<Generation>);
}

/** Returns the new favorite state. Favoriting also keeps the creation. */
export async function toggleFavorite(gen: GenerationRecord, userId: string): Promise<boolean> {
  if (gen.favorites.length > 0) {
    const { error } = await supabase.from("favorites").delete().eq("generation_id", gen.id).eq("user_id", userId);
    if (error) throw error;
    return false;
  }
  const { error } = await supabase.from("favorites").insert({ user_id: userId, generation_id: gen.id });
  if (error) throw error;
  if (!gen.is_saved) await setGenerationSaved(gen.id, true);
  return true;
}

export async function deleteGeneration(gen: GenerationRecord) {
  const refs = [
    gen.result_url,
    gen.thumbnail_url,
    ...gen.media_files.flatMap((m) => [m.file_url, m.thumbnail_url]),
  ];
  const { error } = await supabase.from("generations").delete().eq("id", gen.id);
  if (error) throw error;
  await removeMediaRefs(refs);
}

export async function deleteMediaFile(file: MediaFile) {
  const { error } = await supabase.from("media_files").delete().eq("id", file.id);
  if (error) throw error;
  await removeMediaRefs([file.file_url, file.thumbnail_url]);
}

export interface GenerationCounts {
  images: number;
  videos: number;
  favorites: number;
  storyboards: number;
}

export async function getGenerationCounts(userId: string): Promise<GenerationCounts> {
  const head = { count: "exact" as const, head: true };
  const [images, videos, favorites, storyboards] = await Promise.all([
    supabase.from("generations").select("id", head).eq("user_id", userId).eq("status", "completed").in("type", IMAGE_TYPES),
    supabase.from("generations").select("id", head).eq("user_id", userId).eq("status", "completed").in("type", VIDEO_TYPES),
    supabase.from("favorites").select("id", head).eq("user_id", userId),
    supabase.from("storyboards").select("id", head).eq("user_id", userId),
  ]);
  return {
    images: images.count ?? 0,
    videos: videos.count ?? 0,
    favorites: favorites.count ?? 0,
    storyboards: storyboards.count ?? 0,
  };
}

/** Public gallery: creations their owners chose to share, with creator attribution. */
export async function listPublicGenerations(page = 0, pageSize = PAGE_SIZE): Promise<Paged<PublicGalleryItem>> {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabase
    .from("public_gallery")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  const items = (data ?? []) as PublicGalleryItem[];
  return { items, hasMore: count !== null ? to + 1 < count : items.length === pageSize, total: count };
}
