// EmmyAI Studio — Cloudflare Workers AI REST client (server-side only).
//
//   CLOUDFLARE_ACCOUNT_ID     required — Cloudflare dashboard → Workers & Pages (right column)
//   CLOUDFLARE_API_TOKEN      required — My Profile → API Tokens → Create Token (Workers AI: Edit)
//   CLOUDFLARE_IMAGE_MODEL     default "@cf/black-forest-labs/flux-1-schnell"        (Text→Image)
//   CLOUDFLARE_IMG2IMG_MODEL   default "@cf/runwayml/stable-diffusion-v1-5-img2img" (Image→Image)
//
// Workers AI ships a generous free daily allocation (neurons), so it powers
// the studio's image tools without a paid key. The token never leaves this
// process: it is sent only to api.cloudflare.com.
import { env, fromBase64, StudioError, toBase64 } from "./core.js";

const BASE = "https://api.cloudflare.com/client/v4";

export const cloudflare = {
  get accountId() {
    return env("CLOUDFLARE_ACCOUNT_ID");
  },
  get token() {
    return env("CLOUDFLARE_API_TOKEN");
  },
  get configured() {
    return Boolean(env("CLOUDFLARE_ACCOUNT_ID") && env("CLOUDFLARE_API_TOKEN"));
  },
  imageModel: () => env("CLOUDFLARE_IMAGE_MODEL", "@cf/black-forest-labs/flux-1-schnell"),
  img2ImgModel: () => env("CLOUDFLARE_IMG2IMG_MODEL", "@cf/runwayml/stable-diffusion-v1-5-img2img"),
};

/** flux-1-schnell renders 512–1024px canvases in multiples of 8; snap each studio ratio onto the closest supported one. */
const CANVAS: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "16:9": { width: 1024, height: 576 },
  "9:16": { width: 576, height: 1024 },
  "4:5": { width: 816, height: 1024 },
};

/** flux prompts are capped at 2048 characters. */
const MAX_PROMPT = 2048;

function assertConfigured() {
  if (!cloudflare.configured) {
    throw new StudioError("not_configured", "Cloudflare Workers AI isn't configured on the server yet. The studio owner needs to add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to the Vercel environment variables.");
  }
}

export function mapCloudflareError(status: number, body: string): StudioError {
  let message = "";
  try {
    const parsed = JSON.parse(body);
    message = String(parsed?.errors?.[0]?.message ?? parsed?.messages?.[0] ?? "");
  } catch {
    message = body.slice(0, 200);
  }
  const lower = message.toLowerCase();
  if (status === 401 || status === 403) {
    return new StudioError("not_configured", "Cloudflare rejected the configured Workers AI token. Please check CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN on the server.");
  }
  if (status === 429 || lower.includes("quota") || lower.includes("neuron") || lower.includes("rate limit")) {
    return new StudioError("rate_limited", "The free Workers AI allocation is busy or used up for now. Please wait a moment and try again, or connect GEMINI_API_KEY as the premium engine.");
  }
  if (status === 404 || lower.includes("not found") || lower.includes("not allowed") || lower.includes("unable to find")) {
    return new StudioError("unsupported", "The configured Workers AI model isn't available for this account. The studio owner can change the model name in the server settings.");
  }
  if (lower.includes("safety") || lower.includes("nsfw") || lower.includes("blocked") || lower.includes("prohibited")) {
    return new StudioError("content_blocked", "This prompt was declined by the model's safety filter. Try rewording it.");
  }
  if (status >= 500) return new StudioError("unavailable", "Cloudflare's AI service is temporarily unavailable. Please try again shortly.");
  console.error("[cloudflare] request rejected:", status, message);
  return new StudioError("invalid_request", "Workers AI couldn't process this request. Try adjusting your prompt or settings.");
}

/* ---------------------------- Transport ---------------------------- */
/** Runs a Workers AI model and returns the rendered image. Models answer either with JSON ({ result: { image } }) or raw image bytes. */
async function cfRun(model: string, payload: Record<string, unknown>): Promise<{ bytes: Uint8Array; mimeType: string }> {
  assertConfigured();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 110_000);
  try {
    const res = await fetch(`${BASE}/accounts/${cloudflare.accountId}/ai/run/${model}`, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${cloudflare.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw mapCloudflareError(res.status, await res.text());
    const contentType = res.headers.get("content-type") ?? "";
    let bytes: Uint8Array;
    if (contentType.includes("application/json")) {
      const data = (await res.json()) as { success?: boolean; errors?: { message?: string }[]; result?: { image?: string } | string };
      if (data.success === false) throw mapCloudflareError(res.status, JSON.stringify(data));
      const image = typeof data.result === "string" ? data.result : data.result?.image;
      if (!image) throw new StudioError("unknown", "Workers AI returned no image this time. Please try again.");
      bytes = fromBase64(image);
    } else {
      bytes = new Uint8Array(await res.arrayBuffer());
    }
    if (!bytes.byteLength) throw new StudioError("unknown", "Workers AI returned no image this time. Please try again.");
    return { bytes, mimeType: sniffImageMime(bytes) };
  } finally {
    clearTimeout(timer);
  }
}

const sniffImageMime = (bytes: Uint8Array): string => {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  return "image/png"; // Workers AI image models emit PNG unless the model docs say otherwise
};

/* ------------------------------ Images ------------------------------ */
export async function cloudflareGenerateImage(input: {
  prompt: string;
  aspectRatio: string;
  source?: { bytes: Uint8Array; mimeType: string };
  strength?: number;
}): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const prompt = input.prompt.slice(0, MAX_PROMPT);
  if (input.source) {
    // Image→Image: Stable Diffusion img2img keeps the requested strength
    // (lower = closer to the uploaded image) and infers its own canvas size.
    return cfRun(cloudflare.img2ImgModel(), {
      prompt,
      image: toBase64(input.source.bytes),
      strength: Math.min(1, Math.max(0.1, input.strength ?? 0.65)),
    });
  }
  // Text→Image: flux-1-schnell, the fast model included in the free allocation.
  const canvas = CANVAS[input.aspectRatio] ?? CANVAS["1:1"];
  return cfRun(cloudflare.imageModel(), { prompt, width: canvas.width, height: canvas.height });
}
