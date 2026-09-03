import { callStudioApi, fetchStudioHealth } from "../client";
import type {
  GenerationContext,
  ProviderHealth,
  VideoGenerationRequest,
  VideoJob,
  VideoProvider,
  VideoTransformRequest,
} from "../types";

/**
 * Video provider adapter → Google Veo (via /api/generate-video).
 *
 * Video generation is asynchronous: `start` creates a Veo long-running
 * operation that the server records on the generation row; the UI then polls
 * `getJobStatus` until the server has downloaded the finished MP4 into the
 * user's private storage and marked the generation completed.
 *
 * Video→Video is not offered by Veo through the Gemini API — the server
 * answers with `unsupported` and the UI keeps that tool in demo mode.
 */
export const veoVideoProvider: VideoProvider = {
  id: "veo",
  name: "Veo",

  generateVideo(req: VideoGenerationRequest, ctx: GenerationContext) {
    return callStudioApi<VideoJob>("generate-video", {
      action: "start",
      mode: req.sourceImage ? "image-to-video" : "text-to-video",
      generationId: ctx.generationId,
      prompt: req.prompt,
      style: req.style,
      duration: req.duration,
      aspectRatio: req.aspectRatio,
      cameraMovement: req.cameraMovement,
      sourceImage: req.sourceImage ?? null,
    });
  },

  transformVideo(req: VideoTransformRequest, ctx: GenerationContext) {
    return callStudioApi<VideoJob>("generate-video", {
      action: "start",
      mode: "video-to-video",
      generationId: ctx.generationId,
      prompt: req.prompt,
      style: req.style,
      strength: req.strength,
      aspectRatio: req.aspectRatio,
      sourceVideo: req.sourceVideo,
    });
  },

  getJobStatus(ctx: GenerationContext) {
    return callStudioApi<VideoJob>("generate-video", { action: "status", generationId: ctx.generationId }, { timeoutMs: 60_000 });
  },

  async health(): Promise<ProviderHealth> {
    const health = await fetchStudioHealth();
    return (
      health?.engines.video ?? {
        configured: false,
        provider: "veo",
        model: null,
        capabilities: {},
        message: "The AI backend isn't reachable.",
      }
    );
  },
};
