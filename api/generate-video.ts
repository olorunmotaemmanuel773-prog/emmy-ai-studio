// POST /api/generate-video — Text→Video and Image→Video with Veo (async).
//
// action "start":  { generationId, mode, prompt, style, aspectRatio, duration, cameraMovement, sourceImage? }
//                  → starts a Veo long-running operation, stores it in generations.metadata.job
// action "status": { generationId }
//                  → polls the operation; on completion downloads the MP4 into the
//                    caller's private "videos" bucket folder and marks the row completed.
//
// Video→Video is not offered by Veo through the Gemini API, so that mode
// returns "unsupported" (the UI keeps it in demo mode — nothing is faked).
import {
  buildPrompt,
  CAMERA_PROMPTS,
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
import { gemini, NOT_CONFIGURED_MESSAGE, resolveVeoAspectRatio, resolveVeoDuration, veoDownload, veoPoll, veoStart } from "./_lib/gemini.js";
import type { VideoJobDto } from "../src/types/api.js";

export const maxDuration = 120;

const MODES = ["text-to-video", "image-to-video", "video-to-video", "storyboard-scene-video"] as const;
const RATIOS = ["16:9", "9:16", "1:1", "4:5"] as const;

interface Job {
  vendor: "veo";
  model: string;
  operation: string;
  startedAt: string;
  rendered: { aspectRatio: string; durationSeconds: number };
  thumbnailRef: string | null;
}

export const OPTIONS = (request: Request) => preflight(request);

export const POST = handle(async (request) => {
  const body = await readJson(request);
  const action = str(body.action, 40);
  if (action !== "start" && action !== "status") throw new StudioError("invalid_request", "Unknown action.", 400);

  const ctx = await requireUser(request);
  const generation = await loadOwnedGeneration(ctx, body.generationId);
  const provider = gemini.veoModel();

  /* ------------------------------ status ------------------------------ */
  if (action === "status") {
    const job = (generation.metadata.job ?? null) as Job | null;
    if (generation.status === "completed") {
      const data: VideoJobDto = { jobId: generation.id, status: "completed", url: generation.result_url ?? undefined, provider, rendered: job?.rendered };
      return ok(data, request);
    }
    if (generation.status === "failed") {
      const data: VideoJobDto = {
        jobId: generation.id,
        status: "failed",
        provider,
        error: { code: "unknown", message: generation.error_message ?? "This video could not be created." },
      };
      return ok(data, request);
    }
    if (!job?.operation) {
      const message = "This render can't be tracked anymore. Please start it again.";
      await failGeneration(ctx, generation.id, message);
      return ok({ jobId: generation.id, status: "failed", provider, error: { code: "unknown", message } } satisfies VideoJobDto, request);
    }

    try {
      const polled = await veoPoll(job.operation);
      if (polled.status === "processing") {
        const elapsed = (Date.now() - new Date(job.startedAt).getTime()) / 1000;
        const progress = Math.min(90, Math.round((elapsed / 150) * 90)); // Veo exposes no progress; estimate ~2.5 min
        return ok({ jobId: job.operation, status: "processing", progress, provider, rendered: job.rendered } satisfies VideoJobDto, request);
      }
      if (polled.status === "failed") {
        await failGeneration(ctx, generation.id, polled.message);
        return ok({ jobId: job.operation, status: "failed", provider, error: { code: "content_blocked", message: polled.message } } satisfies VideoJobDto, request);
      }
      const bytes = await veoDownload(polled.uri);
      const ref = await storeBytes(ctx, "videos", `${ctx.userId}/${generation.id}/video.mp4`, bytes, "video/mp4");
      const [media] = await completeGeneration(ctx, generation.id, [{ ref, kind: "video", thumbnailRef: job.thumbnailRef, sizeBytes: bytes.byteLength }], job.model);
      return ok(
        { jobId: job.operation, status: "completed", url: ref, thumbnailUrl: job.thumbnailRef ?? undefined, mediaFileId: media?.mediaFileId, provider, model: job.model, rendered: job.rendered } satisfies VideoJobDto,
        request,
      );
    } catch (e) {
      const err = toStudioError(e);
      if (err.code === "unavailable" || err.code === "timeout") throw err; // transient — the client keeps polling
      await failGeneration(ctx, generation.id, err.message);
      throw err;
    }
  }

  /* ------------------------------- start ------------------------------ */
  const mode = oneOf(body.mode, MODES, "text-to-video");
  const prompt = str(body.prompt, 2000);
  if (prompt.length < 3) throw new StudioError("invalid_request", "Please describe your video.");
  const style = str(body.style, 60);
  const requestedRatio = oneOf(body.aspectRatio, RATIOS, "16:9");
  const requestedDuration = [5, 10, 15].includes(Number(body.duration)) ? Number(body.duration) : 5;
  const camera = str(body.cameraMovement, 40) || "static";
  const sourceImage = str(body.sourceImage, 400) || null;

  try {
    await setGeneration(ctx, generation.id, { status: "processing" });
    if (mode === "video-to-video") {
      throw new StudioError("unsupported", "Video to Video isn't offered by Veo through the Gemini API yet. This tool stays in demo mode until a compatible engine is connected.");
    }
    if (!gemini.configured) throw new StudioError("not_configured", NOT_CONFIGURED_MESSAGE);
    if (mode === "image-to-video" && !sourceImage) throw new StudioError("invalid_request", "Please upload a starting image.");

    const image = sourceImage ? await downloadOwnedFile(ctx, sourceImage) : undefined;
    const { aspectRatio } = resolveVeoAspectRatio(requestedRatio);
    const { durationSeconds } = resolveVeoDuration(requestedDuration);
    const fullPrompt = buildPrompt(prompt, style, [CAMERA_PROMPTS[camera] ?? "", "smooth natural motion, cinematic quality"]);

    const operation = await veoStart({ prompt: fullPrompt, aspectRatio, durationSeconds, image });
    const job: Job = {
      vendor: "veo",
      model: provider,
      operation,
      startedAt: new Date().toISOString(),
      rendered: { aspectRatio, durationSeconds: durationSeconds ?? 8 },
      thumbnailRef: sourceImage,
    };
    await setGeneration(ctx, generation.id, {
      status: "processing",
      provider,
      metadata: { ...generation.metadata, job, requested: { aspectRatio: requestedRatio, duration: requestedDuration } },
    });
    return ok({ jobId: operation, status: "processing", progress: 2, provider, model: provider, rendered: job.rendered } satisfies VideoJobDto, request);
  } catch (e) {
    const err = toStudioError(e);
    await failGeneration(ctx, generation.id, err.message);
    throw err;
  }
});
