// POST /api/generate-image — Text→Image and Image→Image with Gemini.
//
// body: { action: "generate" | "transform", generationId, prompt, style, aspectRatio,
//         quality?, count?, sourceImage?, strength? }
// The generation row is created by the client (RLS-owned); this function
// renders, stores the files in the caller's private storage folder and marks
// the row completed. Nothing is ever faked: without GEMINI_API_KEY the row is
// marked failed with a clear "not configured" message.
import {
  buildPrompt,
  completeGeneration,
  downloadOwnedFile,
  failGeneration,
  handle,
  loadOwnedGeneration,
  ok,
  oneOf,
  preflight,
  readJson,
  requireUser,
  setGeneration,
  storeBytes,
  str,
  StudioError,
  toStudioError,
} from "./_lib/core.js";
import { gemini, geminiGenerateImage, NOT_CONFIGURED_MESSAGE } from "./_lib/gemini.js";
import type { ImageResultDto } from "../src/types/api.js";

export const maxDuration = 120;

const RATIOS = ["1:1", "16:9", "9:16", "4:5"] as const;
const QUALITY_HINT: Record<string, string> = {
  standard: "",
  high: "extremely detailed, sharp focus, high dynamic range, masterful composition",
};

export const OPTIONS = (request: Request) => preflight(request);

export const POST = handle(async (request) => {
  const body = await readJson(request);
  const action = str(body.action, 40);
  if (action !== "generate" && action !== "transform") throw new StudioError("invalid_request", "Unknown action.", 400);

  const ctx = await requireUser(request);
  const generation = await loadOwnedGeneration(ctx, body.generationId);

  const prompt = str(body.prompt, 2000);
  const style = str(body.style, 60);
  const aspectRatio = oneOf(body.aspectRatio, RATIOS, "1:1");
  const quality = oneOf(body.quality, ["standard", "high"] as const, "standard");
  const count = action === "generate" && [1, 2, 4].includes(Number(body.count)) ? Number(body.count) : 1;
  if (prompt.length < 3) throw new StudioError("invalid_request", "Please enter a prompt.");

  try {
    await setGeneration(ctx, generation.id, { status: "processing" });
    if (!gemini.configured) throw new StudioError("not_configured", NOT_CONFIGURED_MESSAGE);

    let source: { bytes: Uint8Array; mimeType: string } | undefined;
    let fullPrompt = buildPrompt(prompt, style, [QUALITY_HINT[quality]]);
    if (action === "transform") {
      if (!str(body.sourceImage, 400)) throw new StudioError("invalid_request", "Please upload an image to transform.");
      source = await downloadOwnedFile(ctx, body.sourceImage);
      const strength = Math.min(1, Math.max(0.1, Number(body.strength) || 0.65));
      const fidelity =
        strength < 0.4
          ? "Keep the original composition, subject and details almost exactly; apply only subtle changes."
          : strength < 0.75
            ? "Preserve the subject and composition of the provided image while applying the requested transformation."
            : "Use the provided image as loose inspiration; the transformation may change details boldly.";
      fullPrompt = `${fidelity} ${fullPrompt}`;
    }

    // Gemini returns one image per request; render the requested count in parallel.
    const results = await Promise.allSettled(
      Array.from({ length: count }, () => geminiGenerateImage({ prompt: fullPrompt, aspectRatio, source })),
    );
    const images = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    if (!images.length) {
      const first = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      throw first ? toStudioError(first.reason) : new StudioError("unknown", "Gemini returned no image. Please try again.");
    }

    const outputs = [];
    for (let i = 0; i < images.length; i++) {
      const ext = images[i].mimeType.includes("jpeg") ? "jpg" : images[i].mimeType.includes("webp") ? "webp" : "png";
      const ref = await storeBytes(ctx, "images", `${ctx.userId}/${generation.id}/${i + 1}.${ext}`, images[i].bytes, images[i].mimeType);
      outputs.push({ ref, kind: "image" as const, sizeBytes: images[i].bytes.byteLength });
    }
    const model = gemini.imageModel();
    const recorded = await completeGeneration(ctx, generation.id, outputs, model);
    const data: ImageResultDto = { outputs: recorded, provider: "gemini", model };
    return ok(data, request);
  } catch (e) {
    const err = toStudioError(e);
    await failGeneration(ctx, generation.id, err.message);
    throw err;
  }
});
