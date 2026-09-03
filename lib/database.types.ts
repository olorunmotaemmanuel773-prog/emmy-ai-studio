/**
 * Row types for the EmmyAI Studio Supabase schema.
 * Keep in sync with supabase/migrations/001_emmyai_schema.sql
 */

export type GenerationType =
  | "text-to-image"
  | "image-to-image"
  | "text-to-video"
  | "image-to-video"
  | "video-to-video"
  | "storyboard-scene-image"
  | "storyboard-scene-video";

export type GenerationStatus = "pending" | "processing" | "completed" | "failed";
export type MediaKind = "image" | "video";
export type AppRole = "admin" | "user";

export interface UserSettings {
  theme?: "dark" | "light" | "system";
  defaultImageStyle?: string;
  defaultVideoStyle?: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  settings: UserSettings | null;
  created_at: string;
  updated_at: string;
}

/** Row of the read-only `public_gallery` view (public creations + creator attribution). */
export interface PublicGalleryItem {
  id: string;
  user_id: string;
  type: GenerationType;
  prompt: string;
  style: string | null;
  aspect_ratio: string | null;
  provider: string | null;
  result_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
  creator_name: string;
  creator_avatar: string | null;
}

export interface Generation {
  id: string;
  user_id: string;
  type: GenerationType;
  prompt: string;
  style: string | null;
  aspect_ratio: string | null;
  status: GenerationStatus;
  provider: string | null;
  /** Storage reference ("images/<uid>/file.png") or absolute https URL */
  result_url: string | null;
  thumbnail_url: string | null;
  is_saved: boolean;
  is_public: boolean;
  error_message: string | null;
  metadata: Record<string, unknown>;
  storyboard_scene_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaFile {
  id: string;
  user_id: string;
  generation_id: string | null;
  file_type: MediaKind;
  file_url: string;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  created_at: string;
}

export interface Storyboard {
  id: string;
  user_id: string;
  title: string;
  idea: string;
  genre: string;
  style: string;
  scene_count: number;
  cover_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoryboardScene {
  id: string;
  storyboard_id: string;
  user_id: string;
  scene_number: number;
  title: string;
  description: string;
  characters: string;
  location: string;
  action: string;
  dialogue: string;
  camera_shot: string;
  camera_movement: string;
  lighting: string;
  image_prompt: string;
  video_prompt: string;
  image_url: string | null;
  video_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  generation_id: string;
  created_at: string;
}

export interface UserRole {
  user_id: string;
  role: AppRole;
}

/** Generation joined with related rows used by the UI. */
export interface GenerationRecord extends Generation {
  media_files: MediaFile[];
  favorites: { id: string }[];
}

export type SceneInput = Omit<
  StoryboardScene,
  "id" | "storyboard_id" | "user_id" | "created_at" | "updated_at" | "image_url" | "video_url"
>;
