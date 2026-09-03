/**
 * AI provider abstraction.
 *
 * The frontend NEVER talks to an AI vendor directly and never holds secret keys.
 * Providers here are adapters that call the secure serverless functions in
 * /api (Vercel). Server-side, Google Gemini (images, storyboards) and Veo
 * (video) are used via GEMINI_API_KEY; the model names are configurable, and
 * other engines can be
 * added or swapped without touching the UI.
 */
import type { SceneInput } from "@/lib/database.types";
import type { ApiError, ApiErrorCode, EngineHealth } from "@/types/api";

export type ProviderErrorCode = ApiErrorCode;
export type ProviderError = ApiError;

export type ProviderResult<T> = { ok: true; data: T } | { ok: false; error: ProviderError };

export type ProviderHealth = EngineHealth;

/** Context the server uses to update the correct database row. */
export interface GenerationContext {
  generationId: string;
}

export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:5";
export type ImageQuality = "standard" | "high";
export type ImageCount = 1 | 2 | 4;
export type VideoDuration = 5 | 10 | 15;

/* ------------------------------ Images ------------------------------ */
export interface ImageGenerationRequest {
  prompt: string;
  style: string;
  aspectRatio: AspectRatio;
  quality: ImageQuality;
  count: ImageCount;
}

export interface ImageTransformRequest {
  prompt: string;
  style: string;
  aspectRatio: AspectRatio;
  /** Storage reference of the uploaded source image, e.g. "images/<uid>/uploads/x.png" */
  sourceImage: string;
  strength?: number;
}

export interface ImageOutput {
  mediaFileId: string;
  /** Storage reference or https URL */
  url: string;
}

export interface ImageResult {
  outputs: ImageOutput[];
  provider: string;
}

export interface ImageProvider {
  id: string;
  name: string;
  generateImage(req: ImageGenerationRequest, ctx: GenerationContext): Promise<ProviderResult<ImageResult>>;
  transformImage(req: ImageTransformRequest, ctx: GenerationContext): Promise<ProviderResult<ImageResult>>;
  health(): Promise<ProviderHealth>;
}

/* ------------------------------ Video ------------------------------- */
export interface VideoGenerationRequest {
  prompt: string;
  style: string;
  duration: VideoDuration;
  aspectRatio: AspectRatio;
  cameraMovement: string;
  /** Optional starting image (image-to-video) */
  sourceImage?: string;
}

export interface VideoTransformRequest {
  prompt: string;
  style: string;
  /** 0–1: how strongly to restyle the source video */
  strength: number;
  aspectRatio: AspectRatio;
  sourceVideo: string;
}

export type VideoJobStatus = "processing" | "completed" | "failed";

export interface VideoJob {
  jobId: string;
  status: VideoJobStatus;
  /** 0–100 when the vendor exposes progress */
  progress?: number;
  url?: string;
  thumbnailUrl?: string;
  mediaFileId?: string;
  provider: string;
  error?: ProviderError;
}

export interface VideoProvider {
  id: string;
  name: string;
  generateVideo(req: VideoGenerationRequest, ctx: GenerationContext): Promise<ProviderResult<VideoJob>>;
  transformVideo(req: VideoTransformRequest, ctx: GenerationContext): Promise<ProviderResult<VideoJob>>;
  getJobStatus(ctx: GenerationContext): Promise<ProviderResult<VideoJob>>;
  health(): Promise<ProviderHealth>;
}

/* ---------------------------- Storyboard ---------------------------- */
export interface StoryboardRequest {
  title: string;
  idea: string;
  genre: string;
  style: string;
  sceneCount: number;
}

export interface StoryboardResult {
  logline?: string;
  scenes: SceneInput[];
  provider: string;
}

export interface SceneRegenerateRequest {
  storyboard: StoryboardRequest;
  scene: SceneInput;
  instructions?: string;
}

export interface StoryboardProvider {
  id: string;
  name: string;
  generateStoryboard(req: StoryboardRequest): Promise<ProviderResult<StoryboardResult>>;
  regenerateScene(req: SceneRegenerateRequest): Promise<ProviderResult<SceneInput>>;
  health(): Promise<ProviderHealth>;
}

export function providerError(code: ProviderErrorCode, message: string): ProviderError {
  return { code, message };
}

export const PROVIDER_MESSAGES: Record<ProviderErrorCode, string> = {
  not_configured:
    "The Gemini API isn't connected yet. The studio owner needs to add GEMINI_API_KEY to the server environment (Vercel → Environment Variables).",
  unsupported: "The connected engine can't do this yet. This tool stays in demo mode until a compatible engine is connected.",
  unavailable: "The AI service isn't reachable right now. Please try again in a moment.",
  invalid_request: "That request couldn't be processed. Please check your prompt and settings.",
  unauthorized: "Your session has expired. Please sign in again.",
  rate_limited: "The studio is busy right now. Please wait a moment and try again.",
  content_blocked: "This prompt was declined by the safety filter. Try rewording it.",
  timeout: "This is taking longer than expected. Please try again.",
  unknown: "Something went wrong while creating. Please try again.",
};
