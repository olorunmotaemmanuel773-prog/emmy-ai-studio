# EmmyAI Studio

**Imagine • Generate • Create**

A free AI creative studio for images, cinematic video and storyboards.
React + TypeScript + Vite + Tailwind CSS + shadcn-style UI · Supabase (Auth, PostgreSQL, Storage) · Vercel (hosting + serverless API) · Google Gemini & Veo.

> EmmyAI Studio is **free for users**. There is no pricing page, no credits, no subscriptions, no wallet, no checkout and no payment gateway anywhere in the codebase.

---

## Architecture

```
Browser (React)  ──►  /api/* (Vercel serverless, Node)  ──►  Google Gemini / Veo
      │                        │
      └──────────────►  Supabase (Auth · Postgres + RLS · Storage)
```

- The browser holds only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (safe: every table/bucket is behind Row Level Security).
- `GEMINI_API_KEY` exists **only** on the server (`process.env` inside `/api`). It is never sent to the browser.
- The API functions act **as the signed-in user** (they forward the user's Supabase JWT), so RLS applies to every database and storage operation. No service-role key is needed.
- **Demo mode**: until `GEMINI_API_KEY` is set, every tool is clearly labelled **DEMO · API NOT CONNECTED**. Pressing generate shows a labelled preview of the prepared brief — nothing is generated, saved or claimed to be AI output.

## Project structure

```
api/                               Vercel serverless functions (secrets live here)
  _lib/core.ts                     auth (user JWT → RLS), storage, errors, prompt building
  _lib/gemini.ts                   Gemini image/text + Veo REST client
  health.ts                        GET  /api/health  → engine status (no secrets)
  generate-image.ts                POST Text→Image, Image→Image (Gemini)
  generate-video.ts                POST Text→Video, Image→Video (Veo, async + polling)
  generate-storyboard.ts           POST Story→Storyboard, scene rewrite (Gemini JSON)
supabase/migrations/
  001_emmyai_schema.sql            tables, triggers, RLS, storage buckets & policies
  002_gallery_ownership_and_settings.sql  public_gallery view, creator attribution, profile settings
src/
  types/api.ts                     wire contract shared by browser and /api
  lib/supabase.ts                  Supabase client (publishable key only)
  lib/ai/                          provider abstraction
    types.ts                       ImageProvider / VideoProvider / StoryboardProvider interfaces
    client.ts                      fetch bridge to /api (adds the user's token)
    providers/*.ts                 Gemini image, Veo video, Gemini storyboard adapters
    index.ts                       registry — swap engines here, UI untouched
    options.ts                     styles, ratios, durations, camera moves, genres
  lib/api/                         database + storage operations (generations, storyboards, profiles, storage)
  contexts/                        AuthContext · ThemeContext · EngineStatusContext (demo-mode source of truth)
  hooks/useGeneration.ts           generation runners (demo gate → create row → call provider → poll)
  components/ui, layout, studio    reusable UI, layouts, creation cards, media viewer, upload dropzone, engine status
  pages/public, auth, studio       Home · Features · Gallery · About · auth pages · dashboard, create, creations,
                                   storyboards, history, settings, admin · tools/ (six creation modes)
```

## Environment variables

| Name | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Vercel + `.env.local` | Supabase project URL (public) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Vercel + `.env.local` | Supabase publishable/anon key (public, RLS-protected) |
| `GEMINI_API_KEY` | **Vercel only (server)** | Google AI Studio key for Gemini + Veo — never `VITE_` |
| `VITE_APP_URL` | optional | deployed URL for auth email redirects |
| `GEMINI_IMAGE_MODEL`, `GEMINI_TEXT_MODEL`, `VEO_MODEL`, `VEO_DURATIONS`, `VEO_RESOLUTION`, `ALLOWED_ORIGIN` | optional, server | model overrides / CORS origin |

See `.env.example` (placeholders only).

## Setup

1. **Supabase** — create a project, run `supabase/migrations/001_emmyai_schema.sql` then `002_gallery_ownership_and_settings.sql` in the SQL editor. In *Authentication → URL Configuration* add your local and production URLs as redirect URLs. Optional admin: `insert into public.user_roles (user_id, role) values ('<uuid>', 'admin') on conflict (user_id) do update set role = 'admin';`
2. **Local development**
   ```bash
   npm install
   cp .env.example .env.local      # fill in the two VITE_SUPABASE_* values
   npm run dev                     # UI only — tools run in demo mode
   npx vercel dev                  # UI + /api functions (add GEMINI_API_KEY to .env.local to go live)
   ```
3. **Vercel** — import the repo (framework: Vite; `vercel.json` sets the SPA rewrite that excludes `/api`), add the environment variables above, deploy. The `/api` functions deploy automatically with the site.
4. **Connect Gemini & Veo** — add `GEMINI_API_KEY` in Vercel → Settings → Environment Variables, redeploy, then open the engine status pill in the studio header and press *Check again*.

## Security summary

- RLS on every table; private buckets with per-user folder policies; signed URLs for private media.
- `/api` verifies the caller's JWT, checks that generations and uploaded files belong to the caller, whitelists all inputs (styles, ratios, durations, genres), and maps vendor errors to friendly messages (raw errors are logged server-side only).
- Uploads validated client-side and by bucket policy (images ≤ 10 MB, avatars ≤ 2 MB, videos ≤ 100 MB).
- Admin pages are gated by the `is_admin()` database policy, not by the UI.
- Video→Video is not offered by Veo through the Gemini API; the tool stays in labelled demo mode rather than faking output.
