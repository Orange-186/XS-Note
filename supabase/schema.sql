-- ShadowNote Supabase Schema
-- Run this in Supabase SQL Editor after creating your project

-- Notes table
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default '',
  content text not null default '',
  cover_url text,
  is_pinned boolean not null default false,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Note media table
create table if not exists public.note_media (
  id uuid primary key default gen_random_uuid(),
  note_id uuid references public.notes(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  media_type text not null check (media_type in ('image', 'video')),
  storage_path text not null,
  public_url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists notes_user_id_updated_at_idx on public.notes (user_id, updated_at desc);
create index if not exists notes_user_id_pinned_idx on public.notes (user_id, is_pinned desc, updated_at desc);
create index if not exists note_media_note_id_idx on public.note_media (note_id, sort_order);

-- Updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists notes_updated_at on public.notes;
create trigger notes_updated_at
  before update on public.notes
  for each row execute function public.handle_updated_at();

-- RLS
alter table public.notes enable row level security;
alter table public.note_media enable row level security;

create policy "Users can view own notes"
  on public.notes for select
  using (auth.uid() = user_id);

create policy "Users can insert own notes"
  on public.notes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own notes"
  on public.notes for update
  using (auth.uid() = user_id);

create policy "Users can delete own notes"
  on public.notes for delete
  using (auth.uid() = user_id);

create policy "Users can view own media"
  on public.note_media for select
  using (auth.uid() = user_id);

create policy "Users can insert own media"
  on public.note_media for insert
  with check (auth.uid() = user_id);

create policy "Users can update own media"
  on public.note_media for update
  using (auth.uid() = user_id);

create policy "Users can delete own media"
  on public.note_media for delete
  using (auth.uid() = user_id);

-- Storage bucket (create via Supabase Dashboard or API)
-- Bucket name: note-media
-- Public: true (or use signed URLs)
-- Policies:
insert into storage.buckets (id, name, public)
values ('note-media', 'note-media', true)
on conflict (id) do nothing;

create policy "Users can upload own media"
  on storage.objects for insert
  with check (
    bucket_id = 'note-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can view own media files"
  on storage.objects for select
  using (
    bucket_id = 'note-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own media files"
  on storage.objects for delete
  using (
    bucket_id = 'note-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
