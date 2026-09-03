-- =====================================================================
--  EmmyAI Studio — migration 002
--  • Creator attribution for the public gallery (without weakening RLS)
--  • Per-user settings stored on the profile (theme, defaults)
--  Run after 001_emmyai_schema.sql
-- =====================================================================

-- ---------------------------------------------------------------------
--  User settings (synced from the Settings page; theme, tool defaults…)
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists settings jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------
--  Creator attribution
--  Profiles stay private, except that the display name/avatar of someone
--  who has shared a creation publicly may be read (needed for "by …").
-- ---------------------------------------------------------------------
drop policy if exists "profiles: creators of public creations are visible" on public.profiles;
create policy "profiles: creators of public creations are visible" on public.profiles
  for select
  using (
    exists (
      select 1 from public.generations g
      where g.user_id = profiles.user_id
        and g.is_public = true
        and g.status = 'completed'
    )
  );

-- A read-only view for the Gallery page. security_invoker keeps the caller's
-- RLS in force: only public, completed generations and their creators appear.
create or replace view public.public_gallery
  with (security_invoker = true) as
  select
    g.id,
    g.user_id,
    g.type,
    g.prompt,
    g.style,
    g.aspect_ratio,
    g.provider,
    g.result_url,
    g.thumbnail_url,
    g.created_at,
    coalesce(nullif(p.full_name, ''), 'EmmyAI creator') as creator_name,
    p.avatar_url                                        as creator_avatar
  from public.generations g
  left join public.profiles p on p.user_id = g.user_id
  where g.is_public = true
    and g.status = 'completed'
    and g.result_url is not null;

grant select on public.public_gallery to anon, authenticated;
