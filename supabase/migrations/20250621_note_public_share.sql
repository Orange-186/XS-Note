-- Public note sharing for WeChat link cards

alter table public.notes
  add column if not exists share_token text,
  add column if not exists is_shared boolean not null default false;

create unique index if not exists notes_share_token_idx
  on public.notes (share_token)
  where share_token is not null;

create policy "Anyone can view shared notes"
  on public.notes for select
  using (is_shared = true and share_token is not null);

create policy "Anyone can view media of shared notes"
  on public.note_media for select
  using (
    exists (
      select 1 from public.notes
      where notes.id = note_media.note_id
        and notes.is_shared = true
        and notes.share_token is not null
    )
  );

create or replace function public.ensure_note_share_token(note_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  token text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.notes
  set
    share_token = coalesce(share_token, encode(gen_random_bytes(9), 'hex')),
    is_shared = true
  where id = note_id and user_id = auth.uid()
  returning share_token into token;

  if token is null then
    raise exception 'Note not found';
  end if;

  return token;
end;
$$;

grant execute on function public.ensure_note_share_token(uuid) to authenticated;

create or replace function public.get_shared_note(p_token text)
returns json
language sql
security definer
stable
set search_path = public
as $$
  select json_build_object(
    'title', n.title,
    'content', n.content,
    'cover_url', n.cover_url,
    'updated_at', n.updated_at,
    'note_media', coalesce((
      select json_agg(
        json_build_object(
          'media_type', m.media_type,
          'public_url', m.public_url,
          'sort_order', m.sort_order
        )
        order by m.sort_order
      )
      from public.note_media m
      where m.note_id = n.id
    ), '[]'::json)
  )
  from public.notes n
  where n.share_token = p_token
    and n.is_shared = true;
$$;

grant execute on function public.get_shared_note(text) to anon, authenticated;
