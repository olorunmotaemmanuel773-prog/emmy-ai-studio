/// <reference types="vite/client" />

/**
 * Public (browser-safe) environment variables only.
 * Secrets such as GEMINI_API_KEY are NEVER declared here — they are read
 * exclusively by the serverless functions in /api via process.env.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** @deprecated use VITE_SUPABASE_PUBLISHABLE_KEY */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_APP_URL?: string;
  /** Optional: only when the /api functions are hosted on another origin. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.jpg" {
  const src: string;
  export default src;
}
declare module "*.png" {
  const src: string;
  export default src;
}
