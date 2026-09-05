-- =====================================================================
--  EmmyAI Studio — migration 003
--  REPAIR / RE-RUNNABLE BASELINE
--
--  Purpose
--  -------
--  Fixes: "Could not find the table 'public.generations' in the schema cache"
--
--  Migration 001 is correct, but it is NOT idempotent: its `create trigger`
--  and `create policy` statements have no `drop ... if exists` guard. In the
--  Supabase SQL editor the whole script runs as ONE transaction, so the first
--  statement that hits an already-existing trigger/policy raises an error and
--  the ENTIRE transaction is rolled back — leaving the database with no
--  `public.generations` table at all. PostgREST then reports the table as
--  missing from the schema cache.
--
--  This migration re-creates every object migration 001 + 002 define, using
--  only idempotent statements. It is safe to run on an empty database, on a
--  partially-migrated database, and on a fully-migrated one. It never drops a
--  table, never drops a column and never deletes a row, so existing data is
--  preserved.
--
--  001 and 002 are left untouched on purpose.
--
--  Run in: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
--  Helper functions (create or replace = already idempotent)
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
--  PROFILES
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- from migration 002
alter table public.profiles
  add column if not exists settings jsonb not null default '{}'::jsonb;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
--  USER ROLES
-- ---------------------------------------------------------------------
create table if not exists public.user_roles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'user' check (role in ('user', 'admin')),
  created_at  timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
--  GENERATIONS   <-- the table reported as missing
--  Columns match src/lib/database.types.ts (interface Generation) and the
--  insert in src/lib/api/generations.ts -> createGeneration().
-- ---------------------------------------------------------------------
create table if not exists public.generations (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  type                text not null check (type in (
                        'text-to-image', 'image-to-image',
                        'text-to-video', 'image-to-video', 'video-to-video',
                        'storyboard-scene-image', 'storyboard-scene-video')),
  prompt              text not null check (char_length(prompt) between 1 and 2000),
  style               text,
  aspect_ratio        text,
  status              text not null default 'pending'
                        check (status in ('pending', 'processing', 'completed', 'failed')),
  provider            text,
  result_url          text,
  thumbnail_url       text,
  is_saved            boolean not null default false,
  is_public           boolean not null default false,
  error_message       text,
  metadata            jsonb not null default '{}'::jsonb,
  storyboard_scene_id uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Self-heal a partially created table (e.g. an older/aborted run).
alter table public.generations
  add column if not exists style               text,
  add column if not exists aspect_ratio        text,
  add column if not exists provider            text,
  add column if not exists result_url          text,
  add column if not exists thumbnail_url       text,
  add column if not exists is_saved            boolean not null default false,
  add column if not exists is_public           boolean not null default false,
  add column if not exists error_message       text,
  add column if not exists metadata            jsonb not null default '{}'::jsonb,
  add column if not exists storyboard_scene_id uuid,
  add column if not exists created_at          timestamptz not null default now(),
  add column if not exists updated_at          timestamptz not null default now();

create index if not exists generations_user_created_idx on public.generations (user_id, created_at desc);
create index if not exists generations_user_type_idx    on public.generations (user_id, type);
create index if not exists generations_public_idx       on public.generations (is_public, created_at desc) where is_public = true;

drop trigger if exists generations_updated_at on public.generations;
create trigger generations_updated_at before update on public.generations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
--  MEDIA FILES
--  Matches api/_lib/core.ts -> completeGeneration() insert.
-- ---------------------------------------------------------------------
create table if not exists public.media_files (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  generation_id  uuid references public.generations(id) on delete cascade,
  file_type      text not null check (file_type in ('image', 'video')),
  file_url       text not null,
  thumbnail_url  text,
  width          integer,
  height         integer,
  size_bytes     bigint,
  created_at     timestamptz not null default now()
);
create index if not exists media_files_generation_idx on public.media_files (generation_id);
create index if not exists media_files_user_idx       on public.media_files (user_id, created_at desc);

-- ---------------------------------------------------------------------
--  STORYBOARDS
-- ---------------------------------------------------------------------
create table if not exists public.storyboards (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 160),
  idea         text not null,
  genre        text not null,
  style        text not null,
  scene_count  integer not null default 0,
  cover_url    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists storyboards_user_created_idx on public.storyboards (user_id, created_at desc);

drop trigger if exists storyboards_updated_at on public.storyboards;
create trigger storyboards_updated_at before update on public.storyboards
  for each row execute function public.set_updated_at();

create table if not exists public.storyboard_scenes (
  id               uuid primary key default gen_random_uuid(),
  storyboard_id    uuid not null references public.storyboards(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  scene_number     integer not null,
  title            text not null default '',
  description      text not null default '',
  characters       text not null default '',
  location         text not null default '',
  action           text not null default '',
  dialogue         text not null default '',
  camera_shot      text not null default '',
  camera_movement  text not null default '',
  lighting         text not null default '',
  image_prompt     text not null default '',
  video_prompt     text not null default '',
  image_url        text,
  video_url        text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists storyboard_scenes_board_idx on public.storyboard_scenes (storyboard_id, scene_number);

drop trigger if exists storyboard_scenes_updated_at on public.storyboard_scenes;
create trigger storyboard_scenes_updated_at before update on public.storyboard_scenes
  for each row execute function public.set_updated_at();

-- Deferred FK: generations.storyboard_scene_id -> storyboard_scenes.id
alter table public.generations
  drop constraint if exists generations_storyboard_scene_fk;
alter table public.generations
  add constraint generations_storyboard_scene_fk
    foreign key (storyboard_scene_id) references public.storyboard_scenes(id) on delete set null;

-- ---------------------------------------------------------------------
--  FAVORITES
-- ---------------------------------------------------------------------
create table if not exists public.favorites (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  generation_id  uuid not null references public.generations(id) on delete cascade,
  created_at     timestamptz not null default now(),
  unique (user_id, generation_id)
);
create index if not exists favorites_user_idx on public.favorites (user_id, created_at desc);

-- =====================================================================
--  ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles          enable row level security;
alter table public.user_roles        enable row level security;
alter table public.generations       enable row level security;
alter table public.media_files       enable row level security;
alter table public.storyboards       enable row level security;
alter table public.storyboard_scenes enable row level security;
alter table public.favorites         enable row level security;

-- profiles ------------------------------------------------------------
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own" on public.profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- from migration 002: creator attribution for the public gallery
drop policy if exists "profiles: creators of public creations are visible" on public.profiles;
create policy "profiles: creators of public creations are visible" on public.profiles for select
  using (
    exists (
      select 1 from public.generations g
      where g.user_id = profiles.user_id
        and g.is_public = true
        and g.status = 'completed'
    )
  );

-- user_roles ----------------------------------------------------------
drop policy if exists "user_roles: read own" on public.user_roles;
create policy "user_roles: read own" on public.user_roles for select
  using (auth.uid() = user_id or public.is_admin());

-- generations ---------------------------------------------------------
drop policy if exists "generations: read own or public" on public.generations;
create policy "generations: read own or public" on public.generations for select
  using (auth.uid() = user_id or is_public = true or public.is_admin());

drop policy if exists "generations: insert own" on public.generations;
create policy "generations: insert own" on public.generations for insert
  with check (auth.uid() = user_id);

drop policy if exists "generations: update own" on public.generations;
create policy "generations: update own" on public.generations for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "generations: delete own" on public.generations;
create policy "generations: delete own" on public.generations for delete
  using (auth.uid() = user_id);

-- media_files ---------------------------------------------------------
drop policy if exists "media_files: read own or public" on public.media_files;
create policy "media_files: read own or public" on public.media_files for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.generations g where g.id = media_files.generation_id and g.is_public = true)
    or public.is_admin()
  );

drop policy if exists "media_files: insert own" on public.media_files;
create policy "media_files: insert own" on public.media_files for insert
  with check (auth.uid() = user_id);

drop policy if exists "media_files: update own" on public.media_files;
create policy "media_files: update own" on public.media_files for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "media_files: delete own" on public.media_files;
create policy "media_files: delete own" on public.media_files for delete
  using (auth.uid() = user_id);

-- storyboards ---------------------------------------------------------
drop policy if exists "storyboards: read own" on public.storyboards;
create policy "storyboards: read own" on public.storyboards for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "storyboards: insert own" on public.storyboards;
create policy "storyboards: insert own" on public.storyboards for insert
  with check (auth.uid() = user_id);

drop policy if exists "storyboards: update own" on public.storyboards;
create policy "storyboards: update own" on public.storyboards for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "storyboards: delete own" on public.storyboards;
create policy "storyboards: delete own" on public.storyboards for delete
  using (auth.uid() = user_id);

-- storyboard_scenes ---------------------------------------------------
drop policy if exists "scenes: read own" on public.storyboard_scenes;
create policy "scenes: read own" on public.storyboard_scenes for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "scenes: insert own" on public.storyboard_scenes;
create policy "scenes: insert own" on public.storyboard_scenes for insert
  with check (auth.uid() = user_id);

drop policy if exists "scenes: update own" on public.storyboard_scenes;
create policy "scenes: update own" on public.storyboard_scenes for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "scenes: delete own" on public.storyboard_scenes;
create policy "scenes: delete own" on public.storyboard_scenes for delete
  using (auth.uid() = user_id);

-- favorites -----------------------------------------------------------
drop policy if exists "favorites: read own" on public.favorites;
create policy "favorites: read own" on public.favorites for select
  using (auth.uid() = user_id);

drop policy if exists "favorites: insert own" on public.favorites;
create policy "favorites: insert own" on public.favorites for insert
  with check (auth.uid() = user_id);

drop policy if exists "favorites: delete own" on public.favorites;
create policy "favorites: delete own" on public.favorites for delete
  using (auth.uid() = user_id);

-- =====================================================================
--  PUBLIC GALLERY VIEW (migration 002)
-- =====================================================================
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

-- =====================================================================
--  STORAGE BUCKETS + POLICIES
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('images',      'images',      false, 10485760,  array['image/png','image/jpeg','image/webp']),
  ('videos',      'videos',      false, 104857600, array['video/mp4','video/webm','video/quicktime']),
  ('avatars',     'avatars',     true,  2097152,   array['image/png','image/jpeg','image/webp']),
  ('storyboards', 'storyboards', false, 10485760,  array['image/png','image/jpeg','image/webp','video/mp4','video/webm'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "storage: owners read own files" on storage.objects;
create policy "storage: owners read own files" on storage.objects for select to authenticated
  using (bucket_id in ('images','videos','avatars','storyboards') and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "storage: owners upload own files" on storage.objects;
create policy "storage: owners upload own files" on storage.objects for insert to authenticated
  with check (bucket_id in ('images','videos','avatars','storyboards') and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "storage: owners update own files" on storage.objects;
create policy "storage: owners update own files" on storage.objects for update to authenticated
  using (bucket_id in ('images','videos','avatars','storyboards') and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "storage: owners delete own files" on storage.objects;
create policy "storage: owners delete own files" on storage.objects for delete to authenticated
  using (bucket_id in ('images','videos','avatars','storyboards') and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "storage: avatars are public" on storage.objects;
create policy "storage: avatars are public" on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "storage: public gallery media" on storage.objects;
create policy "storage: public gallery media" on storage.objects for select
  using (
    bucket_id in ('images','videos','storyboards')
    and (
      exists (
        select 1 from public.generations g
        where g.is_public = true
          and (g.result_url = bucket_id || '/' || name or g.thumbnail_url = bucket_id || '/' || name)
      )
      or exists (
        select 1 from public.media_files m
        join public.generations g on g.id = m.generation_id
        where g.is_public = true
          and (m.file_url = bucket_id || '/' || name or m.thumbnail_url = bucket_id || '/' || name)
      )
    )
  );

-- =====================================================================
--  Force PostgREST to reload its schema cache immediately.
--  Without this the API can keep reporting "Could not find the table
--  'public.generations' in the schema cache" for up to a minute.
-- =====================================================================
notify pgrst, 'reload schema';

-- =====================================================================
--  Verify (optional) — should return 7 rows:
--    select table_name from information_schema.tables
--    where table_schema = 'public' order by table_name;
--
--  Grant yourself admin (optional):
--    insert into public.user_roles (user_id, role)
--    values ('<your-auth-user-uuid>', 'admin')
--    on conflict (user_id) do update set role = 'admin';
-- =====================================================================
