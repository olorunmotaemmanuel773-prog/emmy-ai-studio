import type { SceneInput } from "@/lib/database.types";
import { callStudioApi, fetchStudioHealth } from "../client";
import type {
  ProviderHealth,
  SceneRegenerateRequest,
  StoryboardProvider,
  StoryboardRequest,
  StoryboardResult,
} from "../types";

/**
 * Storyboard provider adapter → Google Gemini text model (via /api/generate-storyboard).
 * The server asks Gemini for structured JSON so every scene arrives with all
 * twelve fields (title, description, characters, location, action, dialogue,
 * camera shot, camera movement, lighting, image prompt, video prompt).
 */
export const geminiStoryboardProvider: StoryboardProvider = {
  id: "gemini",
  name: "Gemini Story Engine",

  generateStoryboard(req: StoryboardRequest) {
    return callStudioApi<StoryboardResult>("generate-storyboard", { action: "generate", ...req });
  },

  regenerateScene(req: SceneRegenerateRequest) {
    return callStudioApi<SceneInput>("generate-storyboard", {
      action: "regenerate-scene",
      storyboard: req.storyboard,
      scene: req.scene,
      instructions: req.instructions ?? null,
    });
  },

  async health(): Promise<ProviderHealth> {
    const health = await fetchStudioHealth();
    return (
      health?.engines.storyboard ?? {
        configured: false,
        provider: "gemini",
        model: null,
        capabilities: {},
        message: "The AI backend isn't reachable.",
      }
    );
  },
};
