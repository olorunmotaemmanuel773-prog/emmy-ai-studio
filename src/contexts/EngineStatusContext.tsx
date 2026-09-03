import * as React from "react";
import { fetchStudioHealth } from "@/lib/ai/client";
import type { EngineKind, StudioHealth } from "@/types/api";

/**
 * Tracks whether the AI engines (Gemini / Veo) are actually connected.
 *
 * The studio never pretends: when an engine isn't configured, tools switch to
 * a clearly labelled "DEMO · API NOT CONNECTED" state and nothing is generated
 * or recorded.
 */
export type EngineState = "loading" | "ready" | "unreachable";

export interface EngineDecision {
  connected: boolean;
  /** Human-readable reason when not connected. */
  reason: string;
  /** "not_connected" | "unsupported" | "unreachable" | "checking" */
  kind: "connected" | "not_connected" | "unsupported" | "unreachable" | "checking";
  model: string | null;
}

interface EngineStatusValue {
  state: EngineState;
  health: StudioHealth | null;
  decide: (engine: EngineKind, capability?: string) => EngineDecision;
  refresh: () => Promise<void>;
}

const EngineStatusContext = React.createContext<EngineStatusValue | undefined>(undefined);

const UNREACHABLE_REASON =
  "The AI backend (/api) isn't reachable from this build, so the studio is running in demo mode. On Vercel the functions deploy with the site; locally use `vercel dev`.";
const CHECKING_REASON = "Checking the AI engines…";

/* Module-level snapshot so non-React code (generation executors) can consult it synchronously. */
let snapshot: { state: EngineState; health: StudioHealth | null } = { state: "loading", health: null };

export function decideFromSnapshot(engine: EngineKind, capability?: string): EngineDecision {
  const { state, health } = snapshot;
  if (state === "loading") return { connected: true, reason: CHECKING_REASON, kind: "checking", model: null };
  if (state === "unreachable" || !health) return { connected: false, reason: UNREACHABLE_REASON, kind: "unreachable", model: null };
  const info = health.engines[engine];
  if (!info?.configured) {
    return {
      connected: false,
      kind: "not_connected",
      model: info?.model ?? null,
      reason:
        info?.message ??
        "The Gemini API key hasn't been added on the server yet. The studio owner can connect it from the Vercel environment settings.",
    };
  }
  if (capability && info.capabilities?.[capability] === false) {
    return {
      connected: false,
      kind: "unsupported",
      model: info.model,
      reason: info.message ?? "The connected engine doesn't support this tool yet.",
    };
  }
  return { connected: true, kind: "connected", reason: "", model: info.model };
}

export function EngineStatusProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<EngineState>("loading");
  const [health, setHealth] = React.useState<StudioHealth | null>(null);

  const refresh = React.useCallback(async () => {
    const result = await fetchStudioHealth();
    const nextState: EngineState = result ? "ready" : "unreachable";
    snapshot = { state: nextState, health: result };
    setHealth(result);
    setState(nextState);
  }, []);

  React.useEffect(() => {
    void refresh();
    // Re-check occasionally so a freshly added key is picked up without a reload.
    const timer = setInterval(() => void refresh(), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [refresh]);

  const value = React.useMemo<EngineStatusValue>(
    () => ({ state, health, refresh, decide: (engine, capability) => decideFromSnapshot(engine, capability) }),
    [state, health, refresh],
  );

  return <EngineStatusContext.Provider value={value}>{children}</EngineStatusContext.Provider>;
}

export function useEngineStatus() {
  const ctx = React.useContext(EngineStatusContext);
  if (!ctx) throw new Error("useEngineStatus must be used inside <EngineStatusProvider>");
  return ctx;
}

/** Engine + capability used by each creation mode. */
export const MODE_ENGINE: Record<string, { engine: EngineKind; capability?: string }> = {
  "text-to-image": { engine: "image", capability: "text-to-image" },
  "image-to-image": { engine: "image", capability: "image-to-image" },
  "storyboard-scene-image": { engine: "image", capability: "storyboard-scene-image" },
  "text-to-video": { engine: "video", capability: "text-to-video" },
  "image-to-video": { engine: "video", capability: "image-to-video" },
  "video-to-video": { engine: "video", capability: "video-to-video" },
  "storyboard-scene-video": { engine: "video", capability: "storyboard-scene-video" },
  "story-to-storyboard": { engine: "storyboard", capability: "generate" },
};
