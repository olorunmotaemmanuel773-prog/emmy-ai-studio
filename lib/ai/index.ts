/**
 * Provider registry.
 *
 * The UI only depends on the interfaces in ./types:
 *   generateImage() · transformImage() · generateVideo() · transformVideo()
 *   generateStoryboard() · regenerateScene()
 *
 * Today they route to Google Gemini (images, storyboards) and Veo (video)
 * through the secure serverless functions in /api. To add or swap an engine,
 * implement the interface and register it here — no UI changes needed.
 */
import { geminiImageProvider } from "./providers/imageProvider";
import { geminiStoryboardProvider } from "./providers/storyboardProvider";
import { veoVideoProvider } from "./providers/videoProvider";
import type { ImageProvider, StoryboardProvider, VideoProvider } from "./types";

export const ai: {
  image: ImageProvider;
  video: VideoProvider;
  storyboard: StoryboardProvider;
} = {
  image: geminiImageProvider,
  video: veoVideoProvider,
  storyboard: geminiStoryboardProvider,
};

export * from "./types";
export * from "./options";
export { fetchStudioHealth, callStudioApi, API_BASE } from "./client";
