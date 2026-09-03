// EmmyAI Studio — Google Gemini / Veo REST client (server-side only).
//
//   GEMINI_API_KEY      required — from https://aistudio.google.com/apikey
//   GEMINI_IMAGE_MODEL  default "gemini-2.5-flash-image"   (Text→Image, Image→Image)
//   GEMINI_TEXT_MODEL   default "gemini-2.5-flash"         (Story→Storyboard)
//   VEO_MODEL           default "veo-3.1-generate-preview" (Text→Video, Image→Video)
//   VEO_DURATIONS       default "4,6,8" — seconds the model accepts
//   VEO_RESOLUTION      optional, e.g. "720p" | "1080p"
//
// The key never leaves this process: it is sent only to generativelanguage.googleapis.com.
import { env, fromBase64, StudioError } from "./core.js";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export const gemini = {
  get key() {
    return env("GEMINI_API_KEY");
  },
  get configured() {
    return Boolean(env("GEMINI_API_KEY"));
  },
  imageModel: () => env("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image"),
  textModel: () => env("GEMINI_TEXT_MODEL", "gemini-2.5-flash"),
  veoModel: () => env("VEO_MODEL", "veo-3.1-generate-preview"),
  veoDurations: () =>
    env("VEO_DURATIONS", "4,6,8")
      .split(",")
      .map((n) => Number(n.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b),
};

export const NOT_CONFIGURED_MESSAGE =
  "The Gemini API key is not configured on the server yet. The studio owner needs to add GEMINI_API_KEY to the Vercel environment variables.";

function assertConfigured() {
  if (!gemini.configured) throw new StudioError("not_configured", NOT_CONFIGURED_MESSAGE);
}

/* ---------------------------- Transport ---------------------------- */
async function gfetch<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  assertConfigured();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 90_000);
  try {
    const res = await fetch(path.startsWith("http") ? path : `${BASE}/${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "x-goog-api-key": gemini.key, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    const text = await res.text();
    if (!res.ok) throw mapGoogleError(res.status, text);
    return (text ? JSON.parse(text) : {}) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function mapGoogleError(status: number, body: string): StudioError {
  let message = "";
  try {
    message = String(JSON.parse(body)?.error?.message ?? "");
  } catch {
    message = body.slice(0, 200);
  }
  const lower = message.toLowerCase();
  if (status === 401 || status === 403) {
    return new StudioError("not_configured", "Google rejected the configured Gemini API key. Please check GEMINI_API_KEY on the server.");
  }
  if (status === 429 || lower.includes("quota") || lower.includes("resource_exhausted")) {
    return new StudioError("rate_limited", "The Gemini API quota is busy right now. Please wait a moment and try again.");
  }
  if (status === 404 || lower.includes("not found") || lower.includes("is not supported")) {
    return new StudioError("unsupported", "The configured model isn't available for this Gemini API key. The studio owner can change the model name in the server settings.");
  }
  if (lower.includes("safety") || lower.includes("blocked") || lower.includes("prohibited") || lower.includes("sensitive")) {
    return new StudioError("content_blocked", "This prompt was declined by Google's safety filter. Try rewording it.");
  }
  if (status >= 500) return new StudioError("unavailable", "Google's AI service is temporarily unavailable. Please try again shortly.");
  console.error("[gemini] request rejected:", status, message);
  return new StudioError("invalid_request", "Gemini couldn't process this request. Try adjusting your prompt or settings.");
}

/* ------------------------------ Images ------------------------------ */
interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}
interface GenerateContentResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

const BLOCKED_FINISH = ["SAFETY", "IMAGE_SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"];

export async function geminiGenerateImage(input: {
  prompt: string;
  aspectRatio: string;
  source?: { bytes: Uint8Array; mimeType: string };
}): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const parts: Record<string, unknown>[] = [{ text: input.prompt }];
  if (input.source) {
    parts.push({ inline_data: { mime_type: input.source.mimeType, data: Buffer.from(input.source.bytes).toString("base64") } });
  }
  const data = await gfetch<GenerateContentResponse>(`models/${gemini.imageModel()}:generateContent`, {
    method: "POST",
    timeoutMs: 110_000,
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: input.aspectRatio },
      },
    }),
  });

  if (data.promptFeedback?.blockReason) {
    throw new StudioError("content_blocked", "This prompt was declined by Google's safety filter. Try rewording it.");
  }
  const candidate = data.candidates?.[0];
  const image = candidate?.content?.parts?.find((p) => p.inlineData?.data);
  if (!image?.inlineData) {
    if (candidate?.finishReason && BLOCKED_FINISH.includes(candidate.finishReason)) {
      throw new StudioError("content_blocked", "The generated image was blocked by Google's safety filter. Try a different prompt.");
    }
    throw new StudioError("unknown", "Gemini returned no image this time. Please try again.");
  }
  return { bytes: fromBase64(image.inlineData.data), mimeType: image.inlineData.mimeType || "image/png" };
}

/* -------------------------------- Text ------------------------------- */
export async function geminiGenerateJson(input: {
  system: string;
  user: string;
  schema?: Record<string, unknown>;
  maxOutputTokens?: number;
  temperature?: number;
}): Promise<string> {
  const data = await gfetch<GenerateContentResponse>(`models/${gemini.textModel()}:generateContent`, {
    method: "POST",
    timeoutMs: 110_000,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.system }] },
      contents: [{ role: "user", parts: [{ text: input.user }] }],
      generationConfig: {
        responseMimeType: "application/json",
        ...(input.schema ? { responseSchema: input.schema } : {}),
        temperature: input.temperature ?? 0.9,
        maxOutputTokens: input.maxOutputTokens ?? 8192,
      },
    }),
  });
  if (data.promptFeedback?.blockReason) {
    throw new StudioError("content_blocked", "This story idea was declined by Google's safety filter. Try rewording it.");
  }
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) {
    if (candidate?.finishReason && BLOCKED_FINISH.includes(candidate.finishReason)) {
      throw new StudioError("content_blocked", "The response was blocked by Google's safety filter. Try a different story idea.");
    }
    throw new StudioError("unknown", "Gemini returned an empty response. Please try again.");
  }
  return text;
}

/* -------------------------------- Veo -------------------------------- */
export const VEO_ASPECT_RATIOS = ["16:9", "9:16"] as const;

/** Veo renders fixed clip lengths; pick the closest supported to the request. */
export function resolveVeoDuration(requested: number) {
  const allowed = gemini.veoDurations();
  if (!allowed.length) return { durationSeconds: undefined, capped: false };
  const fit = [...allowed].reverse().find((d) => d <= requested) ?? allowed[0];
  return { durationSeconds: fit, capped: fit !== requested };
}

export function resolveVeoAspectRatio(requested: string) {
  const ratio = (VEO_ASPECT_RATIOS as readonly string[]).includes(requested) ? requested : "16:9";
  return { aspectRatio: ratio, mapped: ratio !== requested };
}

export async function veoStart(input: {
  prompt: string;
  aspectRatio: string;
  durationSeconds?: number;
  image?: { bytes: Uint8Array; mimeType: string };
}): Promise<string> {
  const instance: Record<string, unknown> = { prompt: input.prompt };
  if (input.image) {
    instance.image = { bytesBase64Encoded: Buffer.from(input.image.bytes).toString("base64"), mimeType: input.image.mimeType };
  }
  const parameters: Record<string, unknown> = { aspectRatio: input.aspectRatio, sampleCount: 1 };
  if (input.durationSeconds) parameters.durationSeconds = input.durationSeconds;
  if (env("VEO_RESOLUTION")) parameters.resolution = env("VEO_RESOLUTION");
  if (input.image) parameters.personGeneration = "allow_adult";

  const start = (params: Record<string, unknown>) =>
    gfetch<{ name?: string }>(`models/${gemini.veoModel()}:predictLongRunning`, {
      method: "POST",
      timeoutMs: 60_000,
      body: JSON.stringify({ instances: [instance], parameters: params }),
    });

  let data: { name?: string };
  try {
    data = await start(parameters);
  } catch (e) {
    // Some Veo versions only accept their default duration — retry without it.
    if (e instanceof StudioError && e.code === "invalid_request" && parameters.durationSeconds) {
      const { durationSeconds: _omit, ...rest } = parameters;
      data = await start(rest);
    } else throw e;
  }
  if (!data.name) throw new StudioError("unknown", "Veo didn't start the render. Please try again.");
  return data.name;
}

interface VeoOperation {
  done?: boolean;
  error?: { message?: string; code?: number };
  response?: {
    generateVideoResponse?: {
      generatedSamples?: { video?: { uri?: string } }[];
      raiMediaFilteredCount?: number;
      raiMediaFilteredReasons?: string[];
    };
  };
}

export async function veoPoll(
  operationName: string,
): Promise<{ status: "processing" } | { status: "completed"; uri: string } | { status: "failed"; message: string }> {
  const op = await gfetch<VeoOperation>(operationName, { method: "GET", timeoutMs: 30_000 });
  if (!op.done) return { status: "processing" };
  if (op.error) {
    console.error("[veo] operation failed:", op.error);
    return { status: "failed", message: "Veo could not render this video. Please try a different prompt." };
  }
  const response = op.response?.generateVideoResponse;
  const uri = response?.generatedSamples?.[0]?.video?.uri;
  if (!uri) {
    const filtered = (response?.raiMediaFilteredCount ?? 0) > 0;
    return {
      status: "failed",
      message: filtered
        ? "This video was blocked by Google's safety filter. Try rewording the prompt."
        : "Veo finished without returning a video. Please try again.",
    };
  }
  return { status: "completed", uri };
}

export async function veoDownload(uri: string): Promise<Uint8Array> {
  assertConfigured();
  const res = await fetch(uri, { headers: { "x-goog-api-key": gemini.key }, redirect: "follow" });
  if (!res.ok) throw new StudioError("unavailable", "The finished video could not be downloaded from Google. Please try again.");
  return new Uint8Array(await res.arrayBuffer());
}
