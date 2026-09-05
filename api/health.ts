// GET /api/health — engine configuration status (no secrets, no auth needed).
// The studio uses this to switch between live generation and the clearly
// labelled "DEMO · API NOT CONNECTED" mode.
import { handle, ok, preflight, supabaseConfig } from "./_lib/core.js";
import { gemini, NOT_CONFIGURED_MESSAGE } from "./_lib/gemini.js";
import { imageEngineHealth } from "./_lib/imageEngine.js";
import type { StudioHealth } from "../src/types/api.js";

export function buildHealth(): StudioHealth {
  const image = imageEngineHealth();
  const geminiConfigured = gemini.configured;
  return {
    configured: image.configured || geminiConfigured,
    supabase: supabaseConfig().configured,
    checkedAt: new Date().toISOString(),
    engines: {
      image,
      video: {
        configured: geminiConfigured,
        provider: "veo",
        model: gemini.veoModel(),
        capabilities: { "text-to-video": true, "image-to-video": true, "storyboard-scene-video": true, "video-to-video": false },
        message: geminiConfigured
          ? "Video to Video isn't offered by Veo through the Gemini API yet, so that tool stays in demo mode."
          : NOT_CONFIGURED_MESSAGE,
      },
      storyboard: {
        configured: geminiConfigured,
        provider: "gemini",
        model: gemini.textModel(),
        capabilities: { generate: true, "regenerate-scene": true },
        message: geminiConfigured ? undefined : NOT_CONFIGURED_MESSAGE,
      },
    },
  };
}

export const GET = handle(async (request) => ok(buildHealth(), request));
export const POST = GET;
export const OPTIONS = (request: Request) => preflight(request);
