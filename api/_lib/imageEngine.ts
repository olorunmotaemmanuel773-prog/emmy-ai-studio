// EmmyAI Studio — image engine selection (server-side only).
//
// Cloudflare Workers AI is the default (free) text-to-image engine; Google
// Gemini remains the premium engine and handles image-to-image when both are
// configured (its instruction following keeps uploaded compositions intact).
// If only one engine is configured, that engine serves every request — the
// studio never fakes a result.
import { StudioError } from "./core.js";
import { cloudflare, cloudflareGenerateImage } from "./cloudflare.js";
import { gemini, geminiGenerateImage } from "./gemini.js";
import type { EngineHealth } from "../../src/types/api.js";

export const IMAGE_NOT_CONFIGURED_MESSAGE =
  "No image engine is configured on the server yet. The studio owner can add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (free daily allocation) or GEMINI_API_KEY to the Vercel environment variables.";

export interface ImageEngineInput {
  prompt: string;
  aspectRatio: string;
  source?: { bytes: Uint8Array; mimeType: string };
  strength?: number;
}

export interface SelectedImageEngine {
  provider: "cloudflare" | "gemini";
  model: string;
  generate: (input: ImageEngineInput) => Promise<{ bytes: Uint8Array; mimeType: string }>;
}

/** Picks the engine for a request: Workers AI for free text→image, Gemini for transforms when available. */
export function selectImageEngine(hasSource: boolean): SelectedImageEngine {
  if (cloudflare.configured && (!hasSource || !gemini.configured)) {
    return {
      provider: "cloudflare",
      model: cloudflare.imageModel(),
      generate: (input) => cloudflareGenerateImage(input),
    };
  }
  if (gemini.configured) {
    return {
      provider: "gemini",
      model: gemini.imageModel(),
      generate: (input) => geminiGenerateImage({ prompt: input.prompt, aspectRatio: input.aspectRatio, source: input.source }),
    };
  }
  throw new StudioError("not_configured", IMAGE_NOT_CONFIGURED_MESSAGE);
}

/** Health entry for the image engine — reports whichever engine text→image will actually use. */
export function imageEngineHealth(): EngineHealth {
  const free = cloudflare.configured;
  const configured = free || gemini.configured;
  return {
    configured,
    provider: free ? "cloudflare" : "gemini",
    model: free ? cloudflare.imageModel() : gemini.imageModel(),
    capabilities: { "text-to-image": configured, "image-to-image": configured, "storyboard-scene-image": configured },
    message: configured ? undefined : IMAGE_NOT_CONFIGURED_MESSAGE,
  };
}
