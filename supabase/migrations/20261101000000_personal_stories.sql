-- GOSHTI story catalogue: personal stories (the child's name is a placeholder) that can be added or
-- corrected here WITHOUT shipping an app update. The app and the backend read published rows first
-- and fall back to the stories built into the code.
--
-- Add or edit rows in the Supabase dashboard (Table editor) or with `npm run catalog:push`.
-- A row is only used if it passes the same checks as the stories in the code (story-engine/personal/catalog.ts);
-- a row that fails them is ignored, so a typo cannot break the app.
create table if not exists public.personal_stories (
  id text primary key check (id ~ '^[a-z0-9-]{3,60}$'),
  title text not null,
  age_band text not null check (age_band in ('2-3', '4-5', '6-7', '8-9')),
  category text not null,
  positive_value text not null default '',
  -- {"बाळ": "OLDER_CHILD", "कावळा": "GRUFF_KIND", "आजी": "AAJI"}
  voices jsonb not null default '{}'::jsonb,
  -- who says each "quoted" line, in order: ["बाळ", "आजी", ...]
  quote_speakers jsonb not null default '[]'::jsonb,
  ambience text,
  template text not null,
  -- Only published rows reach children. Draft first, publish when the checks and the voices are ready.
  published boolean not null default false,
  updated_at timestamptz not null default now()
);
comment on table public.personal_stories is 'GOSHTI personal story catalogue. Anyone may read published rows; only the service role writes.';

alter table public.personal_stories enable row level security;
drop policy if exists "read published personal stories" on public.personal_stories;
create policy "read published personal stories" on public.personal_stories
  for select to anon, authenticated using (published);
revoke all on public.personal_stories from anon, authenticated;
grant select on public.personal_stories to anon, authenticated;

create or replace function public.touch_personal_story() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists personal_stories_touch on public.personal_stories;
create trigger personal_stories_touch before update on public.personal_stories
  for each row execute function public.touch_personal_story();
