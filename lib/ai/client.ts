import { isSupabaseConfigured, NOT_CONFIGURED_MESSAGE, supabase } from "@/lib/supabase";
import type { ApiErrorCode, ApiResponse, StudioHealth } from "@/types/api";
import { PROVIDER_MESSAGES, type ProviderError, type ProviderResult } from "./types";

/**
 * Bridge between the browser and the secure serverless API in /api.
 *
 * The browser never talks to Google directly and never sees GEMINI_API_KEY.
 * Every call carries the user's Supabase access token so the server can act
 * on their behalf under Row Level Security.
 */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
export const apiUrl = (endpoint: string) => `${API_BASE}/api/${endpoint.replace(/^\/+/, "")}`;

const KNOWN_CODES: ApiErrorCode[] = [
  "not_configured",
  "unsupported",
  "unavailable",
  "invalid_request",
  "unauthorized",
  "rate_limited",
  "content_blocked",
  "timeout",
  "unknown",
];

export const BACKEND_UNREACHABLE_MESSAGE =
  "The AI backend (/api) isn't reachable. On Vercel it deploys automatically with the site; locally run `vercel dev` instead of `vite` to serve it.";

function normalizeError(raw: unknown): ProviderError {
  if (raw && typeof raw === "object") {
    const r = raw as { code?: string; message?: string };
    const code = (KNOWN_CODES.includes(r.code as ApiErrorCode) ? r.code : "unknown") as ApiErrorCode;
    return { code, message: r.message && r.message.length < 260 ? r.message : PROVIDER_MESSAGES[code] };
  }
  return { code: "unknown", message: PROVIDER_MESSAGES.unknown };
}

async function parseResponse<T>(res: Response): Promise<ProviderResult<T>> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    // An HTML page here means the SPA fallback answered — the API isn't deployed/served.
    return { ok: false, error: { code: "unavailable", message: BACKEND_UNREACHABLE_MESSAGE } };
  }
  const payload = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!payload) return { ok: false, error: { code: "unavailable", message: PROVIDER_MESSAGES.unavailable } };
  if (payload.ok === false) return { ok: false, error: normalizeError(payload.error) };
  if (payload.ok === true) return { ok: true, data: payload.data };
  if (res.status === 401) return { ok: false, error: normalizeError({ code: "unauthorized" }) };
  return { ok: false, error: normalizeError({ code: "unknown" }) };
}

export async function callStudioApi<T>(
  endpoint: string,
  body: Record<string, unknown>,
  opts: { timeoutMs?: number } = {},
): Promise<ProviderResult<T>> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: { code: "unavailable", message: NOT_CONFIGURED_MESSAGE } };
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { ok: false, error: normalizeError({ code: "unauthorized" }) };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 130_000);
  try {
    const res = await fetch(apiUrl(endpoint), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (res.status === 404 || res.status === 405) {
      return { ok: false, error: { code: "unavailable", message: BACKEND_UNREACHABLE_MESSAGE } };
    }
    return await parseResponse<T>(res);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: { code: "timeout", message: PROVIDER_MESSAGES.timeout } };
    }
    return { ok: false, error: { code: "unavailable", message: PROVIDER_MESSAGES.unavailable } };
  } finally {
    clearTimeout(timer);
  }
}

/** Engine status — public, contains no secrets. Returns null when the API can't be reached. */
export async function fetchStudioHealth(timeoutMs = 8000): Promise<StudioHealth | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(apiUrl("health"), { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const result = await parseResponse<StudioHealth>(res);
    return result.ok ? result.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
