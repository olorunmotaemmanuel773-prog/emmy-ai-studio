import { BUCKETS, supabase, type BucketName } from "@/lib/supabase";
import { extensionFromMime, uid } from "@/lib/utils";

/* ----------------------------- Validation ----------------------------- */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

export const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

export type UploadKind = "image" | "video" | "avatar";

export function validateFile(file: File, kind: UploadKind): { ok: true } | { ok: false; error: string } {
  const allowed = kind === "video" ? VIDEO_MIME_TYPES : IMAGE_MIME_TYPES;
  const max = kind === "video" ? MAX_VIDEO_BYTES : kind === "avatar" ? MAX_AVATAR_BYTES : MAX_IMAGE_BYTES;
  if (!file) return { ok: false, error: "No file selected." };
  if (!allowed.includes(file.type)) {
    return {
      ok: false,
      error:
        kind === "video"
          ? "Please upload an MP4, WebM or MOV video."
          : "Please upload a PNG, JPG or WebP image.",
    };
  }
  if (file.size > max) {
    const mb = Math.round(max / (1024 * 1024));
    return { ok: false, error: `That file is too large. The maximum size is ${mb} MB.` };
  }
  if (file.size === 0) return { ok: false, error: "That file appears to be empty." };
  return { ok: true };
}

/* ----------------------------- Media refs ----------------------------- */
/**
 * Media references are stored as "bucket/path/to/file.ext" for Supabase Storage
 * objects, or as absolute https URLs for external assets. Private buckets are
 * served through short-lived signed URLs, so nothing is exposed publicly by
 * accident.
 */
export type MediaRef = { kind: "storage"; bucket: BucketName; path: string } | { kind: "url"; url: string };

const BUCKET_NAMES = Object.values(BUCKETS) as string[];

export function parseMediaRef(ref: string | null | undefined): MediaRef | null {
  if (!ref) return null;
  if (/^(https?:)?\/\//.test(ref) || ref.startsWith("data:") || ref.startsWith("blob:")) {
    return { kind: "url", url: ref };
  }
  const idx = ref.indexOf("/");
  if (idx === -1) return null;
  const bucket = ref.slice(0, idx);
  const path = ref.slice(idx + 1);
  if (!BUCKET_NAMES.includes(bucket) || !path) return null;
  return { kind: "storage", bucket: bucket as BucketName, path };
}

export function makeRef(bucket: BucketName, path: string) {
  return `${bucket}/${path}`;
}

/* ------------------------------ Uploads ------------------------------- */
export async function uploadUserFile(
  file: File,
  opts: { kind: "image" | "video"; userId: string; folder?: string },
): Promise<{ ref: string; bucket: BucketName; path: string }> {
  const check = validateFile(file, opts.kind);
  if (!check.ok) throw new Error(check.error);
  const bucket = opts.kind === "video" ? BUCKETS.videos : BUCKETS.images;
  const ext = extensionFromMime(file.type);
  const path = `${opts.userId}/${opts.folder ?? "uploads"}/${uid()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return { ref: makeRef(bucket, path), bucket, path };
}

export async function uploadBlob(
  blob: Blob,
  opts: { bucket: BucketName; path: string; contentType: string; upsert?: boolean },
): Promise<string> {
  const { error } = await supabase.storage.from(opts.bucket).upload(opts.path, blob, {
    contentType: opts.contentType,
    cacheControl: "3600",
    upsert: opts.upsert ?? false,
  });
  if (error) throw error;
  return makeRef(opts.bucket, opts.path);
}

export async function uploadAvatar(file: File, userId: string): Promise<string> {
  const check = validateFile(file, "avatar");
  if (!check.ok) throw new Error(check.error);
  const ext = extensionFromMime(file.type);
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKETS.avatars).upload(path, file, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKETS.avatars).getPublicUrl(path);
  return data.publicUrl;
}

/* --------------------------- Signed URL cache -------------------------- */
const SIGNED_TTL_SECONDS = 60 * 60;
const cache = new Map<string, { url: string; expires: number }>();

function cached(ref: string) {
  const hit = cache.get(ref);
  if (hit && hit.expires > Date.now()) return hit.url;
  return null;
}

function remember(ref: string, url: string) {
  cache.set(ref, { url, expires: Date.now() + (SIGNED_TTL_SECONDS - 300) * 1000 });
}

export async function resolveMediaUrl(ref: string | null | undefined): Promise<string | null> {
  const parsed = parseMediaRef(ref);
  if (!parsed) return null;
  if (parsed.kind === "url") return parsed.url;
  const hit = cached(ref as string);
  if (hit) return hit;
  const { data, error } = await supabase.storage.from(parsed.bucket).createSignedUrl(parsed.path, SIGNED_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  remember(ref as string, data.signedUrl);
  return data.signedUrl;
}

/** Batch-resolve refs (one request per bucket) — used by galleries. */
export async function resolveMediaUrls(refs: (string | null | undefined)[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const byBucket = new Map<BucketName, string[]>();

  for (const ref of refs) {
    if (!ref) continue;
    const parsed = parseMediaRef(ref);
    if (!parsed) continue;
    if (parsed.kind === "url") {
      result.set(ref, parsed.url);
      continue;
    }
    const hit = cached(ref);
    if (hit) {
      result.set(ref, hit);
      continue;
    }
    const list = byBucket.get(parsed.bucket) ?? [];
    if (!list.includes(parsed.path)) list.push(parsed.path);
    byBucket.set(parsed.bucket, list);
  }

  await Promise.all(
    Array.from(byBucket.entries()).map(async ([bucket, paths]) => {
      const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, SIGNED_TTL_SECONDS);
      for (const item of data ?? []) {
        if (item.signedUrl && item.path) {
          const ref = makeRef(bucket, item.path);
          remember(ref, item.signedUrl);
          result.set(ref, item.signedUrl);
        }
      }
    }),
  );

  return result;
}

export async function removeMediaRefs(refs: (string | null | undefined)[]) {
  const byBucket = new Map<BucketName, string[]>();
  for (const ref of refs) {
    const parsed = parseMediaRef(ref);
    if (!parsed || parsed.kind !== "storage") continue;
    const list = byBucket.get(parsed.bucket) ?? [];
    list.push(parsed.path);
    byBucket.set(parsed.bucket, list);
    cache.delete(ref as string);
  }
  await Promise.all(
    Array.from(byBucket.entries()).map(([bucket, paths]) =>
      supabase.storage
        .from(bucket)
        .remove(paths)
        .catch(() => null),
    ),
  );
}

/* ------------------------------ Download ------------------------------ */
export async function downloadMedia(ref: string, filename: string) {
  const url = await resolveMediaUrl(ref);
  if (!url) throw new Error("This file is no longer available.");
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("download failed");
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function extensionFromRef(ref: string | null | undefined, fallback: string) {
  if (!ref) return fallback;
  const clean = ref.split("?")[0];
  const m = clean.match(/\.([a-z0-9]{2,4})$/i);
  return m ? m[1].toLowerCase() : fallback;
}

/* ------------------------- Client-side thumbnails --------------------- */
export function captureVideoThumbnail(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    let done = false;
    const finish = (blob: Blob | null) => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.6, Math.max(0, video.duration / 4));
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        const maxW = 640;
        const scale = Math.min(1, maxW / (video.videoWidth || maxW));
        canvas.width = Math.round((video.videoWidth || maxW) * scale);
        canvas.height = Math.round((video.videoHeight || 360) * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return finish(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => finish(b), "image/jpeg", 0.82);
      } catch {
        finish(null);
      }
    };
    video.onerror = () => finish(null);
    setTimeout(() => finish(null), 8000);
  });
}
