-- =====================================================================
--  EmmyAI Studio — database schema, Row Level Security and Storage
--  Run this in the Supabase SQL editor (or `supabase db push`).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
--  Helpers
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
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
--  USER ROLES (optional admin role) — only writable with the service role
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

-- Create a profile + default role whenever an auth user is created
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
--  GENERATIONS
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
  result_url          text,          -- "bucket/path" storage reference or https URL
  thumbnail_url       text,
  is_saved            boolean not null default false,
  is_public           boolean not null default false,
  error_message       text,
  metadata            jsonb not null default '{}'::jsonb,
  storyboard_scene_id uuid,          -- FK added after storyboard_scenes exists
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists generations_user_created_idx on public.generations (user_id, created_at desc);
create index if not exists generations_user_type_idx    on public.generations (user_id, type);
create index if not exists generations_public_idx       on public.generations (is_public, created_at desc) where is_public = true;
create trigger generations_updated_at before update on public.generations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
--  MEDIA FILES
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
create trigger storyboard_scenes_updated_at before update on public.storyboard_scenes
  for each row execute function public.set_updated_at();

alter table public.generations
  drop constraint if exists generations_storyboard_scene_fk,
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
--  ROW LEVEL SECURITY — users only ever touch their own rows
-- =====================================================================
alter table public.profiles          enable row level security;
alter table public.user_roles        enable row level security;
alter table public.generations       enable row level security;
alter table public.media_files       enable row level security;
alter table public.storyboards       enable row level security;
alter table public.storyboard_scenes enable row level security;
alter table public.favorites         enable row level security;

-- profiles
create policy "profiles: read own"   on public.profiles for select using (auth.uid() = user_id or public.is_admin());
create policy "profiles: insert own" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles: update own" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- user_roles: readable by the owner (and admins). No insert/update/delete policies →
-- roles can only be granted with the service role / SQL editor.
create policy "user_roles: read own" on public.user_roles for select using (auth.uid() = user_id or public.is_admin());

-- generations
create policy "generations: read own or public" on public.generations for select
  using (auth.uid() = user_id or is_public = true or public.is_admin());
create policy "generations: insert own" on public.generations for insert with check (auth.uid() = user_id);
create policy "generations: update own" on public.generations for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "generations: delete own" on public.generations for delete using (auth.uid() = user_id);

-- media_files
create policy "media_files: read own or public" on public.media_files for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.generations g where g.id = media_files.generation_id and g.is_public = true)
    or public.is_admin()
  );
create policy "media_files: insert own" on public.media_files for insert with check (auth.uid() = user_id);
create policy "media_files: update own" on public.media_files for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "media_files: delete own" on public.media_files for delete using (auth.uid() = user_id);

-- storyboards
create policy "storyboards: read own"   on public.storyboards for select using (auth.uid() = user_id or public.is_admin());
create policy "storyboards: insert own" on public.storyboards for insert with check (auth.uid() = user_id);
create policy "storyboards: update own" on public.storyboards for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "storyboards: delete own" on public.storyboards for delete using (auth.uid() = user_id);

-- storyboard_scenes
create policy "scenes: read own"   on public.storyboard_scenes for select using (auth.uid() = user_id or public.is_admin());
create policy "scenes: insert own" on public.storyboard_scenes for insert with check (auth.uid() = user_id);
create policy "scenes: update own" on public.storyboard_scenes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "scenes: delete own" on public.storyboard_scenes for delete using (auth.uid() = user_id);

-- favorites
create policy "favorites: read own"   on public.favorites for select using (auth.uid() = user_id);
create policy "favorites: insert own" on public.favorites for insert with check (auth.uid() = user_id);
create policy "favorites: delete own" on public.favorites for delete using (auth.uid() = user_id);

-- =====================================================================
--  STORAGE — private buckets; files live under "<user_id>/..."
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

-- Owners manage files inside their own folder
create policy "storage: owners read own files" on storage.objects for select to authenticated
  using (bucket_id in ('images','videos','avatars','storyboards') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage: owners upload own files" on storage.objects for insert to authenticated
  with check (bucket_id in ('images','videos','avatars','storyboards') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage: owners update own files" on storage.objects for update to authenticated
  using (bucket_id in ('images','videos','avatars','storyboards') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage: owners delete own files" on storage.objects for delete to authenticated
  using (bucket_id in ('images','videos','avatars','storyboards') and (storage.foldername(name))[1] = auth.uid()::text);

-- Avatars are public (bucket is public); allow anonymous reads explicitly
create policy "storage: avatars are public" on storage.objects for select
  using (bucket_id = 'avatars');

-- Files that belong to a generation shared to the public gallery are readable by anyone
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
--  Grant an admin (run manually, replace the uuid):
--    insert into public.user_roles (user_id, role) values ('<auth-user-uuid>', 'admin')
--    on conflict (user_id) do update set role = 'admin';
-- =====================================================================
