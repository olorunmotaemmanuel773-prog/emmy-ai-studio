import * as React from "react";
import { ai } from "@/lib/ai";
import type {
  ImageGenerationRequest,
  ImageTransformRequest,
  ProviderError,
  VideoGenerationRequest,
  VideoTransformRequest,
} from "@/lib/ai/types";
import { createGeneration, getGeneration, markGenerationFailed, updateGeneration } from "@/lib/api/generations";
import type { GenerationRecord, GenerationType } from "@/lib/database.types";
import { useAuth } from "@/contexts/AuthContext";
import { decideFromSnapshot, MODE_ENGINE } from "@/contexts/EngineStatusContext";
import { friendlyError, sleep } from "@/lib/utils";

/** Everything the UI needs to show an honest "DEMO · API NOT CONNECTED" preview. */
export interface DemoRequest {
  kind: "image" | "video";
  type: GenerationType;
  prompt: string;
  style: string;
  aspectRatio: string;
  details: { label: string; value: string }[];
  reason: string;
  reasonKind: "not_connected" | "unsupported" | "unreachable";
  model: string | null;
}

export type RunState =
  | { status: "idle" }
  | { status: "running"; generationId: string | null; progress?: number; message?: string }
  | { status: "done"; generation: GenerationRecord }
  | { status: "demo"; request: DemoRequest }
  | { status: "error"; error: ProviderError; generationId: string | null };

export type ExecResult =
  | { ok: true; generation: GenerationRecord }
  | { ok: false; error: ProviderError; generationId: string | null; demo?: DemoRequest };

/**
 * Checks the engine snapshot before touching the database. When the engine is
 * not connected we return a demo request instead of creating a failed record —
 * the studio never records or displays a generation that didn't happen.
 */
function demoGate(
  type: GenerationType,
  base: Omit<DemoRequest, "reason" | "reasonKind" | "model">,
): Extract<ExecResult, { ok: false }> | null {
  const target = MODE_ENGINE[type];
  const decision = decideFromSnapshot(target.engine, target.capability);
  if (decision.connected) return null;
  const reasonKind = decision.kind === "unsupported" ? "unsupported" : decision.kind === "unreachable" ? "unreachable" : "not_connected";
  return {
    ok: false,
    generationId: null,
    error: { code: reasonKind === "unsupported" ? "unsupported" : "not_configured", message: decision.reason },
    demo: { ...base, reason: decision.reason, reasonKind, model: decision.model },
  };
}

interface CommonOptions {
  metadata?: Record<string, unknown>;
  storyboardSceneId?: string | null;
  isSaved?: boolean;
}

type ImageType = Extract<GenerationType, "text-to-image" | "image-to-image" | "storyboard-scene-image">;
type VideoType = Extract<GenerationType, "text-to-video" | "image-to-video" | "video-to-video" | "storyboard-scene-video">;

const GENERIC_VIDEO_ERROR: ProviderError = {
  code: "unknown",
  message: "Something went wrong while creating your video. Please try again.",
};

/* ------------------------- Imperative executors ----------------------- */
/**
 * Creates the generation record, calls the provider and returns the finished
 * record. Used by the hooks below and by the storyboard workspace.
 */
export async function executeImageGeneration(
  userId: string,
  type: ImageType,
  request: ImageGenerationRequest | ImageTransformRequest,
  options: CommonOptions = {},
  onStart?: (generationId: string) => void,
): Promise<ExecResult> {
  const gated = demoGate(type, {
    kind: "image",
    type,
    prompt: request.prompt,
    style: request.style,
    aspectRatio: request.aspectRatio,
    details: [
      ...("count" in request
        ? [
            { label: "Images", value: String(request.count) },
            { label: "Quality", value: request.quality === "high" ? "High Quality" : "Standard" },
          ]
        : [{ label: "Strength", value: `${Math.round((request.strength ?? 0.65) * 100)}%` }]),
    ],
  });
  if (gated) return gated;

  let generationId: string;
  try {
    const gen = await createGeneration({
      userId,
      type,
      prompt: request.prompt,
      style: request.style,
      aspectRatio: request.aspectRatio,
      provider: ai.image.id,
      metadata: {
        ...("count" in request ? { count: request.count, quality: request.quality } : {}),
        ...("sourceImage" in request ? { sourceImage: request.sourceImage, strength: request.strength } : {}),
        ...options.metadata,
      },
      storyboardSceneId: options.storyboardSceneId ?? null,
      isSaved: options.isSaved ?? false,
    });
    generationId = gen.id;
  } catch (err) {
    return { ok: false, error: { code: "unknown", message: friendlyError(err) }, generationId: null };
  }
  onStart?.(generationId);

  const ctx = { generationId };
  const result =
    "sourceImage" in request ? await ai.image.transformImage(request, ctx) : await ai.image.generateImage(request, ctx);

  if (!result.ok) {
    await markGenerationFailed(generationId, result.error.message);
    return { ok: false, error: result.error, generationId };
  }

  let full = await getGeneration(generationId).catch(() => null);
  if (!full || full.status !== "completed") {
    // The Edge Function normally finalises the row; keep the UI consistent regardless.
    await updateGeneration(generationId, {
      status: "completed",
      result_url: result.data.outputs[0]?.url ?? null,
      provider: result.data.provider,
    }).catch(() => null);
    full = await getGeneration(generationId).catch(() => null);
  }
  if (!full) {
    return {
      ok: false,
      error: { code: "unknown", message: "Your image was created but couldn't be loaded. Check My Creations." },
      generationId,
    };
  }
  return { ok: true, generation: full };
}

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_MS = 25 * 60 * 1000;

export async function pollVideoJob(
  generationId: string,
  isCancelled: () => boolean,
  onProgress?: (progress: number | undefined) => void,
): Promise<ExecResult | null> {
  const started = Date.now();
  while (!isCancelled() && Date.now() - started < MAX_POLL_MS) {
    await sleep(POLL_INTERVAL_MS);
    if (isCancelled()) return null;
    const status = await ai.video.getJobStatus({ generationId });
    if (!status.ok) {
      if (status.error.code === "unavailable") continue; // transient network hiccup — keep polling
      await markGenerationFailed(generationId, status.error.message);
      return { ok: false, error: status.error, generationId };
    }
    const job = status.data;
    if (job.status === "completed") {
      const full = await getGeneration(generationId).catch(() => null);
      if (full) return { ok: true, generation: full };
    } else if (job.status === "failed") {
      const error = job.error ?? GENERIC_VIDEO_ERROR;
      await markGenerationFailed(generationId, error.message);
      return { ok: false, error, generationId };
    } else {
      onProgress?.(job.progress);
    }
  }
  if (isCancelled()) return null;
  return {
    ok: false,
    error: {
      code: "timeout",
      message: "Your video is still rendering. We'll keep it in History — check back in a few minutes.",
    },
    generationId,
  };
}

export async function executeVideoGeneration(
  userId: string,
  type: VideoType,
  request: VideoGenerationRequest | VideoTransformRequest,
  options: CommonOptions = {},
  hooks: { onStart?: (id: string) => void; onProgress?: (p: number | undefined) => void; isCancelled?: () => boolean } = {},
): Promise<ExecResult | null> {
  const isCancelled = hooks.isCancelled ?? (() => false);
  const gated = demoGate(type, {
    kind: "video",
    type,
    prompt: request.prompt,
    style: request.style,
    aspectRatio: request.aspectRatio,
    details:
      "duration" in request
        ? [
            { label: "Duration", value: `${request.duration} seconds` },
            { label: "Camera", value: request.cameraMovement.replace(/-/g, " ") },
          ]
        : [{ label: "Strength", value: `${Math.round(request.strength * 100)}%` }],
  });
  if (gated) return gated;

  let generationId: string;
  try {
    const gen = await createGeneration({
      userId,
      type,
      prompt: request.prompt,
      style: request.style,
      aspectRatio: request.aspectRatio,
      provider: ai.video.id,
      metadata: {
        ...("duration" in request
          ? { duration: request.duration, cameraMovement: request.cameraMovement, sourceImage: request.sourceImage ?? null }
          : { strength: request.strength, sourceVideo: request.sourceVideo }),
        ...options.metadata,
      },
      storyboardSceneId: options.storyboardSceneId ?? null,
      isSaved: options.isSaved ?? false,
    });
    generationId = gen.id;
  } catch (err) {
    return { ok: false, error: { code: "unknown", message: friendlyError(err) }, generationId: null };
  }
  hooks.onStart?.(generationId);

  const ctx = { generationId };
  const started =
    "sourceVideo" in request ? await ai.video.transformVideo(request, ctx) : await ai.video.generateVideo(request, ctx);

  if (!started.ok) {
    await markGenerationFailed(generationId, started.error.message);
    return { ok: false, error: started.error, generationId };
  }
  if (started.data.status === "completed") {
    const full = await getGeneration(generationId).catch(() => null);
    return full ? { ok: true, generation: full } : { ok: false, error: GENERIC_VIDEO_ERROR, generationId };
  }
  if (started.data.status === "failed") {
    const error = started.data.error ?? GENERIC_VIDEO_ERROR;
    await markGenerationFailed(generationId, error.message);
    return { ok: false, error, generationId };
  }
  hooks.onProgress?.(started.data.progress);
  return pollVideoJob(generationId, isCancelled, hooks.onProgress);
}

/* -------------------------------- Hooks ------------------------------- */
export function useImageGeneration() {
  const { user } = useAuth();
  const [state, setState] = React.useState<RunState>({ status: "idle" });

  const run = React.useCallback(
    async (type: ImageType, request: ImageGenerationRequest | ImageTransformRequest, options: CommonOptions = {}) => {
      if (!user) return null;
      setState({ status: "running", generationId: null });
      const result = await executeImageGeneration(user.id, type, request, options, (id) =>
        setState({ status: "running", generationId: id }),
      );
      if (result.ok) {
        setState({ status: "done", generation: result.generation });
        return result.generation;
      }
      setState(result.demo ? { status: "demo", request: result.demo } : { status: "error", error: result.error, generationId: result.generationId });
      return null;
    },
    [user],
  );

  const reset = React.useCallback(() => setState({ status: "idle" }), []);
  return { state, run, reset, setState };
}

export function useVideoGeneration() {
  const { user } = useAuth();
  const [state, setState] = React.useState<RunState>({ status: "idle" });
  const cancelled = React.useRef(false);

  const applyResult = (result: ExecResult | null) => {
    if (!result) return null;
    if (result.ok) {
      setState({ status: "done", generation: result.generation });
      return result.generation;
    }
    setState(result.demo ? { status: "demo", request: result.demo } : { status: "error", error: result.error, generationId: result.generationId });
    return null;
  };

  const run = React.useCallback(
    async (type: VideoType, request: VideoGenerationRequest | VideoTransformRequest, options: CommonOptions = {}) => {
      if (!user) return null;
      cancelled.current = false;
      setState({ status: "running", generationId: null, message: "Preparing your shot…" });
      const result = await executeVideoGeneration(user.id, type, request, options, {
        onStart: (id) => setState({ status: "running", generationId: id, message: "Sending your prompt to the motion engine…" }),
        onProgress: (progress) =>
          setState((s) => (s.status === "running" ? { ...s, progress, message: "Rendering your cinematic video…" } : s)),
        isCancelled: () => cancelled.current,
      });
      return applyResult(result);
    },
    [user],
  );

  /** Resume polling for a generation that is still processing (e.g. from History). */
  const resume = React.useCallback(async (generationId: string) => {
    cancelled.current = false;
    setState({ status: "running", generationId, message: "Checking on your video…" });
    const result = await pollVideoJob(generationId, () => cancelled.current, (progress) =>
      setState((s) => (s.status === "running" ? { ...s, progress } : s)),
    );
    return applyResult(result);
  }, []);

  const cancel = React.useCallback(() => {
    cancelled.current = true;
    setState({ status: "idle" });
  }, []);

  const reset = cancel;

  React.useEffect(
    () => () => {
      cancelled.current = true;
    },
    [],
  );

  return { state, run, resume, cancel, reset, setState };
}
