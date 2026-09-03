import { callStudioApi, fetchStudioHealth } from "../client";
import type {
  GenerationContext,
  ImageGenerationRequest,
  ImageProvider,
  ImageResult,
  ImageTransformRequest,
  ProviderHealth,
} from "../types";

/**
 * Image provider adapter → Google Gemini (via /api/generate-image).
 *
 * The browser only sends prompts and storage references. The serverless
 * function holds GEMINI_API_KEY, calls Gemini's image model, stores the
 * result in the user's private storage folder and finalises the generation.
 *
 * To connect a different engine later, implement `ImageProvider` and register
 * it in src/lib/ai/index.ts — no UI changes are required.
 */
export const geminiImageProvider: ImageProvider = {
  id: "gemini",
  name: "Gemini Image",

  generateImage(req: ImageGenerationRequest, ctx: GenerationContext) {
    return callStudioApi<ImageResult>("generate-image", {
      action: "generate",
      generationId: ctx.generationId,
      prompt: req.prompt,
      style: req.style,
      aspectRatio: req.aspectRatio,
      quality: req.quality,
      count: req.count,
    });
  },

  transformImage(req: ImageTransformRequest, ctx: GenerationContext) {
    return callStudioApi<ImageResult>("generate-image", {
      action: "transform",
      generationId: ctx.generationId,
      prompt: req.prompt,
      style: req.style,
      aspectRatio: req.aspectRatio,
      sourceImage: req.sourceImage,
      strength: req.strength ?? 0.65,
    });
  },

  async health(): Promise<ProviderHealth> {
    const health = await fetchStudioHealth();
    return (
      health?.engines.image ?? {
        configured: false,
        provider: "gemini",
        model: null,
        capabilities: {},
        message: "The AI backend isn't reachable.",
      }
    );
  },
};
