import { supabase } from "@/lib/supabase";
import type { SceneInput, Storyboard, StoryboardScene } from "@/lib/database.types";
import type { Paged } from "./generations";
import { removeMediaRefs } from "./storage";

export interface StoryboardSummary extends Storyboard {
  storyboard_scenes: Pick<StoryboardScene, "id" | "scene_number" | "title" | "image_url">[];
}

export interface CreateStoryboardInput {
  userId: string;
  title: string;
  idea: string;
  genre: string;
  style: string;
  scenes: SceneInput[];
}

export async function createStoryboard(input: CreateStoryboardInput): Promise<Storyboard> {
  const { data: storyboard, error } = await supabase
    .from("storyboards")
    .insert({
      user_id: input.userId,
      title: input.title.trim(),
      idea: input.idea.trim(),
      genre: input.genre,
      style: input.style,
      scene_count: input.scenes.length,
    })
    .select("*")
    .single();
  if (error) throw error;

  const rows = input.scenes.map((s, i) => ({
    ...s,
    scene_number: i + 1,
    storyboard_id: storyboard.id,
    user_id: input.userId,
  }));
  const { error: sceneError } = await supabase.from("storyboard_scenes").insert(rows);
  if (sceneError) {
    await supabase.from("storyboards").delete().eq("id", storyboard.id);
    throw sceneError;
  }
  return storyboard as Storyboard;
}

export async function listStoryboards(
  userId: string,
  opts: { page?: number; pageSize?: number; search?: string } = {},
): Promise<Paged<StoryboardSummary>> {
  const page = opts.page ?? 0;
  const pageSize = opts.pageSize ?? 12;
  const from = page * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from("storyboards")
    .select("*, storyboard_scenes(id, scene_number, title, image_url)", { count: "exact" })
    .eq("user_id", userId);
  if (opts.search?.trim()) {
    const term = opts.search.trim().replace(/[%_,]/g, " ");
    query = query.or(`title.ilike.%${term}%,idea.ilike.%${term}%`);
  }
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) throw error;
  const items = ((data ?? []) as StoryboardSummary[]).map((s) => ({
    ...s,
    storyboard_scenes: [...(s.storyboard_scenes ?? [])].sort((a, b) => a.scene_number - b.scene_number),
  }));
  return { items, hasMore: count !== null ? to + 1 < count : items.length === pageSize, total: count };
}

export async function getStoryboard(id: string): Promise<{ storyboard: Storyboard; scenes: StoryboardScene[] } | null> {
  const { data, error } = await supabase.from("storyboards").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: scenes, error: sceneError } = await supabase
    .from("storyboard_scenes")
    .select("*")
    .eq("storyboard_id", id)
    .order("scene_number", { ascending: true });
  if (sceneError) throw sceneError;
  return { storyboard: data as Storyboard, scenes: (scenes ?? []) as StoryboardScene[] };
}

export async function updateStoryboard(id: string, patch: Partial<Storyboard>) {
  const { data, error } = await supabase
    .from("storyboards")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Storyboard;
}

export async function updateScene(id: string, patch: Partial<StoryboardScene>): Promise<StoryboardScene> {
  const { data, error } = await supabase
    .from("storyboard_scenes")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as StoryboardScene;
}

export async function addScene(storyboardId: string, userId: string, scene: SceneInput): Promise<StoryboardScene> {
  const { data, error } = await supabase
    .from("storyboard_scenes")
    .insert({ ...scene, storyboard_id: storyboardId, user_id: userId })
    .select("*")
    .single();
  if (error) throw error;
  await supabase
    .from("storyboards")
    .update({ scene_count: scene.scene_number, updated_at: new Date().toISOString() })
    .eq("id", storyboardId);
  return data as StoryboardScene;
}

export async function deleteScene(scene: StoryboardScene, remaining: StoryboardScene[]) {
  const { error } = await supabase.from("storyboard_scenes").delete().eq("id", scene.id);
  if (error) throw error;
  // Keep scene numbers contiguous
  const renumber = remaining
    .filter((s) => s.id !== scene.id)
    .sort((a, b) => a.scene_number - b.scene_number)
    .map((s, i) => ({ id: s.id, scene_number: i + 1 }))
    .filter((s) => remaining.find((r) => r.id === s.id)?.scene_number !== s.scene_number);
  await Promise.all(renumber.map((r) => supabase.from("storyboard_scenes").update({ scene_number: r.scene_number }).eq("id", r.id)));
  await supabase
    .from("storyboards")
    .update({ scene_count: remaining.length - 1, updated_at: new Date().toISOString() })
    .eq("id", scene.storyboard_id);
}

export async function deleteStoryboard(storyboard: Storyboard, scenes: Pick<StoryboardScene, "image_url" | "video_url">[] = []) {
  const { error } = await supabase.from("storyboards").delete().eq("id", storyboard.id);
  if (error) throw error;
  await removeMediaRefs([storyboard.cover_url, ...scenes.flatMap((s) => [s.image_url, s.video_url])]);
}

/* ------------------------------ Helpers ------------------------------- */
export function blankScene(sceneNumber: number, overrides: Partial<SceneInput> = {}): SceneInput {
  return {
    scene_number: sceneNumber,
    title: `Scene ${sceneNumber}`,
    description: "",
    characters: "",
    location: "",
    action: "",
    dialogue: "",
    camera_shot: "Medium Shot",
    camera_movement: "Static",
    lighting: "Natural light",
    image_prompt: "",
    video_prompt: "",
    ...overrides,
  };
}

export function makeBlankScenes(count: number): SceneInput[] {
  return Array.from({ length: count }, (_, i) => blankScene(i + 1));
}
