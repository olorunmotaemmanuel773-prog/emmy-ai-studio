import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { GenerationType } from "@/lib/database.types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string | Date, opts?: Intl.DateTimeFormatOptions) {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...opts,
  });
}

export function formatDateTime(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function timeAgo(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr${h > 1 ? "s" : ""} ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
  return formatDate(d);
}

export function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function truncate(text: string, max = 80) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function uid(prefix = "") {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix ? `${prefix}-${id}` : id;
}

export function extensionFromMime(mime: string) {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };
  return map[mime] ?? "bin";
}

export const GENERATION_TYPE_LABELS: Record<GenerationType, string> = {
  "text-to-image": "Text to Image",
  "image-to-image": "Image to Image",
  "text-to-video": "Text to Video",
  "image-to-video": "Image to Video",
  "video-to-video": "Video to Video",
  "storyboard-scene-image": "Storyboard Scene",
  "storyboard-scene-video": "Storyboard Video",
};

export function isVideoType(type: GenerationType) {
  return type.includes("video");
}

export function getInitials(name?: string | null, fallback = "E") {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || fallback;
}

/** Friendly error message that never leaks internals. */
export function friendlyError(err: unknown, fallback = "Something went wrong. Please try again.") {
  if (!err) return fallback;
  const message =
    typeof err === "string"
      ? err
      : err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "";
  if (!message) return fallback;
  const lower = message.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "We couldn't reach the server. Please check your connection and try again.";
  }
  if (lower.includes("invalid login credentials")) return "Incorrect email or password.";
  if (lower.includes("email not confirmed")) return "Please confirm your email address before signing in.";
  if (lower.includes("user already registered")) return "An account with this email already exists.";
  if (lower.includes("password should be at least")) return "Your password should be at least 8 characters.";
  if (lower.includes("rate limit")) return "Too many attempts. Please wait a moment and try again.";
  if (lower.includes("jwt") || lower.includes("token")) return "Your session has expired. Please sign in again.";
  if (lower.includes("row-level security") || lower.includes("permission")) {
    return "You don't have permission to do that.";
  }
  if (lower.includes("payload too large") || lower.includes("exceeded the maximum allowed size")) {
    return "That file is too large. Please choose a smaller file.";
  }
  if (message.length > 160) return fallback;
  return message;
}
