/**
 * Wire contract shared by the browser (src/) and the Vercel serverless
 * functions (api/). Types only — nothing here runs at runtime, so the API
 * functions can `import type` from this file safely.
 */

export type ApiErrorCode =
  | "not_configured" // GEMINI_API_KEY missing on the server
  | "unsupported" // the connected engine cannot do this (e.g. Veo video-to-video)
  | "unavailable" // backend/API unreachable or vendor outage
  | "invalid_request"
  | "unauthorized"
  | "rate_limited"
  | "content_blocked"
  | "timeout"
  | "unknown";

export interface ApiError {
  code: ApiErrorCode;
  message: string;
}

export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/* ------------------------------ Health ------------------------------ */
export type EngineKind = "image" | "video" | "storyboard";

export interface EngineHealth {
  /** True when the server holds a key for this engine. */
  configured: boolean;
  provider: "gemini" | "veo";
  model: string | null;
  /** Per-mode capabilities, e.g. { "video-to-video": false } */
  capabilities: Record<string, boolean>;
  message?: string;
}

export interface StudioHealth {
  /** True when at least one engine is configured. */
  configured: boolean;
  supabase: boolean;
  engines: Record<EngineKind, EngineHealth>;
  checkedAt: string;
}

/* ------------------------------ Images ------------------------------ */
export interface ImageOutputDto {
  mediaFileId: string;
  /** Storage reference "images/<uid>/<gen>/1.png" */
  url: string;
}

export interface ImageResultDto {
  outputs: ImageOutputDto[];
  provider: string;
  model: string;
}

/* ------------------------------ Video ------------------------------- */
export interface VideoJobDto {
  jobId: string;
  status: "processing" | "completed" | "failed";
  progress?: number;
  url?: string;
  thumbnailUrl?: string;
  mediaFileId?: string;
  provider: string;
  model?: string;
  /** What the engine actually rendered (Veo caps duration / ratio). */
  rendered?: { aspectRatio: string; durationSeconds: number };
  error?: ApiError;
}

/* ---------------------------- Storyboard ---------------------------- */
export interface StoryboardSceneDto {
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
}

export interface StoryboardResultDto {
  logline?: string;
  scenes: StoryboardSceneDto[];
  provider: string;
  model: string;
}
