import type { AspectRatio, ImageCount, ImageQuality, VideoDuration } from "./types";

export interface Option<T extends string | number = string> {
  value: T;
  label: string;
  hint?: string;
  featured?: boolean;
}

export const IMAGE_STYLES: Option[] = [
  { value: "realistic", label: "Realistic", featured: true },
  { value: "3d-animation", label: "3D Animation", featured: true },
  { value: "cinematic", label: "Cinematic" },
  { value: "african-cinema", label: "African Cinema" },
  { value: "anime", label: "Anime" },
  { value: "fantasy", label: "Fantasy" },
  { value: "photorealistic", label: "Photorealistic" },
  { value: "portrait", label: "Portrait" },
  { value: "fashion", label: "Fashion" },
  { value: "commercial", label: "Commercial" },
  { value: "film-still", label: "Film Still" },
  { value: "concept-art", label: "Concept Art" },
];

export const IMAGE_TRANSFORM_STYLES: Option[] = IMAGE_STYLES.filter((s) =>
  ["realistic", "3d-animation", "cinematic", "african-cinema", "anime", "fantasy", "photorealistic", "portrait", "fashion"].includes(
    s.value,
  ),
);

export const VIDEO_STYLES: Option[] = [
  { value: "realistic", label: "Realistic", featured: true },
  { value: "3d-animation", label: "3D Animation", featured: true },
  { value: "cinematic", label: "Cinematic" },
  { value: "african-cinema", label: "African Cinema" },
  { value: "anime", label: "Anime" },
  { value: "fantasy", label: "Fantasy" },
  { value: "commercial", label: "Commercial" },
  { value: "film", label: "Film" },
];

export const VIDEO_TRANSFORM_STYLES: Option[] = [
  { value: "realistic", label: "Realistic" },
  { value: "3d-animation", label: "3D Animation" },
  { value: "cinematic", label: "Cinematic" },
  { value: "anime", label: "Anime" },
  { value: "fantasy", label: "Fantasy" },
  { value: "african-cinema", label: "African Cinema" },
];

export const STORYBOARD_STYLES: Option[] = [
  { value: "realistic", label: "Realistic" },
  { value: "3d-animation", label: "3D Animation" },
  { value: "cinematic", label: "Cinematic" },
  { value: "anime", label: "Anime" },
  { value: "african-cinema", label: "African Cinema" },
];

export const IMAGE_ASPECT_RATIOS: Option<AspectRatio>[] = [
  { value: "1:1", label: "1:1", hint: "Square" },
  { value: "16:9", label: "16:9", hint: "Landscape" },
  { value: "9:16", label: "9:16", hint: "Portrait" },
  { value: "4:5", label: "4:5", hint: "Social" },
];

export const VIDEO_ASPECT_RATIOS: Option<AspectRatio>[] = [
  { value: "16:9", label: "16:9", hint: "Cinematic" },
  { value: "9:16", label: "9:16", hint: "Vertical" },
  { value: "1:1", label: "1:1", hint: "Veo renders 16:9" },
];

export const IMAGE_QUALITIES: Option<ImageQuality>[] = [
  { value: "standard", label: "Standard", hint: "Faster" },
  { value: "high", label: "High Quality", hint: "More detail" },
];

export const IMAGE_COUNTS: Option<ImageCount>[] = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 4, label: "4" },
];

export const VIDEO_DURATIONS: Option<VideoDuration>[] = [
  { value: 5, label: "5 seconds", hint: "Veo: 4 s" },
  { value: 10, label: "10 seconds", hint: "Veo: 8 s" },
  { value: 15, label: "15 seconds", hint: "Veo: 8 s" },
];

/** Shown under the duration picker in the video tools. */
export const VIDEO_DURATION_NOTE =
  "Veo currently renders clips of up to 8 seconds; longer selections render at the closest supported length.";

export const CAMERA_MOVEMENTS: Option[] = [
  { value: "static", label: "Static" },
  { value: "slow-zoom", label: "Slow Zoom" },
  { value: "dolly-in", label: "Dolly In" },
  { value: "dolly-out", label: "Dolly Out" },
  { value: "pan-left", label: "Pan Left" },
  { value: "pan-right", label: "Pan Right" },
  { value: "tilt-up", label: "Tilt Up" },
  { value: "tilt-down", label: "Tilt Down" },
  { value: "orbit", label: "Orbit" },
  { value: "handheld", label: "Handheld Cinematic" },
];

export const STORY_GENRES: Option[] = [
  { value: "romance", label: "Romance" },
  { value: "drama", label: "Drama" },
  { value: "comedy", label: "Comedy" },
  { value: "action", label: "Action" },
  { value: "thriller", label: "Thriller" },
  { value: "fantasy", label: "Fantasy" },
  { value: "adventure", label: "Adventure" },
  { value: "african-story", label: "African Story" },
  { value: "nollywood", label: "Nollywood" },
  { value: "family", label: "Family" },
  { value: "mystery", label: "Mystery" },
];

export const SCENE_COUNTS: Option<number>[] = [3, 4, 6, 8, 10, 12].map((n) => ({ value: n, label: `${n} scenes` }));

export const CAMERA_SHOTS = [
  "Wide Shot",
  "Establishing Shot",
  "Medium Shot",
  "Close-Up",
  "Extreme Close-Up",
  "Over-the-Shoulder",
  "Two Shot",
  "Low Angle",
  "High Angle",
  "Point of View",
];

export function labelFor<T extends string | number>(options: Option<T>[], value: T | null | undefined) {
  if (value === null || value === undefined) return "";
  return options.find((o) => o.value === value)?.label ?? String(value);
}

export const MAX_PROMPT_LENGTH = 1500;
