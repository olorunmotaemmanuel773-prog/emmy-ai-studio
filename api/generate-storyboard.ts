// POST /api/generate-storyboard — Story→Storyboard with Gemini (structured JSON output).
//
// action "generate":         { title, idea, genre, style, sceneCount }
// action "regenerate-scene": { storyboard: {…}, scene: {…}, instructions? }
import { handle, ok, oneOf, preflight, readJson, requireUser, str, StudioError } from "./_lib/core.js";
import { gemini, geminiGenerateJson, NOT_CONFIGURED_MESSAGE } from "./_lib/gemini.js";
import type { StoryboardResultDto, StoryboardSceneDto } from "../src/types/api.js";

export const maxDuration = 120;

const GENRES = ["romance", "drama", "comedy", "action", "thriller", "fantasy", "adventure", "african-story", "nollywood", "family", "mystery"] as const;
const STYLES = ["realistic", "3d-animation", "cinematic", "anime", "african-cinema"] as const;

const STYLE_NOTES: Record<string, string> = {
  realistic: "grounded, realistic live-action look with natural light",
  "3d-animation": "polished 3D animated feature film look",
  cinematic: "cinematic anamorphic film look with dramatic, motivated lighting",
  anime: "expressive anime look with painterly backgrounds",
  "african-cinema": "contemporary African cinema look — rich skin tones, vibrant fabrics, authentic locations, golden light",
};

interface StoryRequest {
  title: string;
  idea: string;
  genre: string;
  style: string;
  sceneCount: number;
}

const SCENE_SCHEMA = {
  type: "OBJECT",
  properties: {
    scene_number: { type: "INTEGER" },
    title: { type: "STRING" },
    description: { type: "STRING" },
    characters: { type: "STRING" },
    location: { type: "STRING" },
    action: { type: "STRING" },
    dialogue: { type: "STRING" },
    camera_shot: { type: "STRING" },
    camera_movement: { type: "STRING" },
    lighting: { type: "STRING" },
    image_prompt: { type: "STRING" },
    video_prompt: { type: "STRING" },
  },
  required: ["scene_number", "title", "description", "characters", "location", "action", "dialogue", "camera_shot", "camera_movement", "lighting", "image_prompt", "video_prompt"],
};

const STORYBOARD_SCHEMA = {
  type: "OBJECT",
  properties: { logline: { type: "STRING" }, scenes: { type: "ARRAY", items: SCENE_SCHEMA } },
  required: ["logline", "scenes"],
};

function systemPrompt(req: StoryRequest) {
  return `You are an award-winning film director and storyboard artist. You turn story ideas into vivid, production-ready storyboards.
Visual style for every scene: ${STYLE_NOTES[req.style] ?? req.style}. Genre: ${req.genre.replace(/-/g, " ")}.
Keep character names, wardrobe and locations consistent across scenes. Write with specificity, sensory detail and emotional clarity.
Field guidance:
- description: 1–2 sentences of what the audience sees.
- characters: comma-separated names with a short descriptor each.
- action: what physically happens, present tense.
- dialogue: 1–3 short lines formatted as NAME: "line" (empty string if the scene is silent).
- camera_shot: one of Wide Shot, Establishing Shot, Medium Shot, Close-Up, Extreme Close-Up, Over-the-Shoulder, Two Shot, Low Angle, High Angle, Point of View.
- camera_movement: e.g. Static, Slow zoom in, Dolly in, Pan right, Orbit, Handheld.
- lighting: light source, quality and mood.
- image_prompt: one rich paragraph for a text-to-image model (subject, setting, wardrobe, lighting, lens, mood), no dialogue.
- video_prompt: one paragraph for a text-to-video model describing motion and camera movement over about 6 seconds.`;
}

const s = (v: unknown, max = 1500) => (typeof v === "string" ? v.trim().slice(0, max) : v == null ? "" : String(v).slice(0, max));

function normalizeScene(raw: unknown, index: number): StoryboardSceneDto {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    scene_number: index + 1,
    title: s(r.title, 120) || `Scene ${index + 1}`,
    description: s(r.description),
    characters: s(r.characters, 400),
    location: s(r.location, 300),
    action: s(r.action),
    dialogue: s(r.dialogue),
    camera_shot: s(r.camera_shot, 60) || "Medium Shot",
    camera_movement: s(r.camera_movement, 80) || "Static",
    lighting: s(r.lighting, 300),
    image_prompt: s(r.image_prompt, 2000),
    video_prompt: s(r.video_prompt, 2000),
  };
}

function parseJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.search(/[[{]/);
    const end = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
    if (start === -1 || end <= start) throw new StudioError("unknown", "Gemini returned an unreadable storyboard. Please try again.");
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      throw new StudioError("unknown", "Gemini returned an unreadable storyboard. Please try again.");
    }
  }
}

function pickScenes(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    for (const key of ["scenes", "storyboard", "shots"]) if (Array.isArray(o[key])) return o[key] as unknown[];
    if (o.title !== undefined || o.scene_number !== undefined) return [o];
  }
  return [];
}

function parseRequest(raw: unknown): StoryRequest {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const title = str(r.title, 160);
  const idea = str(r.idea, 3000);
  if (!title || idea.length < 12) throw new StudioError("invalid_request", "Please provide a story title and a short story idea.");
  return {
    title,
    idea,
    genre: oneOf(r.genre, GENRES, "drama"),
    style: oneOf(r.style, STYLES, "cinematic"),
    sceneCount: Math.min(12, Math.max(1, Math.round(Number(r.sceneCount) || 6))),
  };
}

export const OPTIONS = (request: Request) => preflight(request);

export const POST = handle(async (request) => {
  const body = await readJson(request);
  const action = str(body.action, 40);
  await requireUser(request);
  if (!gemini.configured) throw new StudioError("not_configured", NOT_CONFIGURED_MESSAGE);
  const model = gemini.textModel();

  if (action === "generate") {
    const story = parseRequest(body);
    const text = await geminiGenerateJson({
      system: systemPrompt(story),
      user: `Title: ${story.title}\nStory idea: ${story.idea}\n\nCreate exactly ${story.sceneCount} scenes that tell this story with a clear beginning, middle and end. Return {"logline": string, "scenes": Scene[]}.`,
      schema: STORYBOARD_SCHEMA,
      maxOutputTokens: Math.min(16000, 900 * story.sceneCount + 600),
    });
    const parsed = parseJson(text);
    const scenes = pickScenes(parsed).slice(0, story.sceneCount).map(normalizeScene);
    if (!scenes.length) throw new StudioError("unknown", "Gemini didn't return any scenes. Please try again.");
    const logline = parsed && typeof parsed === "object" ? s((parsed as Record<string, unknown>).logline, 300) : "";
    const data: StoryboardResultDto = { logline, scenes, provider: "gemini", model };
    return ok(data, request);
  }

  if (action === "regenerate-scene") {
    const story = parseRequest(body.storyboard);
    const rawScene = (body.scene ?? {}) as Record<string, unknown>;
    const current = normalizeScene(rawScene, Math.max(0, Number(rawScene.scene_number || 1) - 1));
    const instructions = str(body.instructions, 600);
    const text = await geminiGenerateJson({
      system: systemPrompt(story),
      user: `Title: ${story.title}\nStory idea: ${story.idea}\n\nRewrite scene ${current.scene_number} of ${story.sceneCount} with a fresh, stronger take that stays consistent with the story.\nCurrent version for reference: ${JSON.stringify(current)}\n${instructions ? `Director's notes: ${instructions}\n` : ""}Return a single Scene object.`,
      schema: SCENE_SCHEMA,
      maxOutputTokens: 2500,
    });
    const parsed = parseJson(text);
    const scene = normalizeScene(pickScenes(parsed)[0] ?? parsed, current.scene_number - 1);
    return ok(scene, request);
  }

  throw new StudioError("invalid_request", "Unknown action.", 400);
});
