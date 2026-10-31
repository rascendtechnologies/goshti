-- Public bucket for the ready-made library stories' Aaji voice (made once, downloaded by every phone).
-- Only the library-prerender workflow writes to it (service role); anyone can read the audio.
insert into storage.buckets (id, name, public, file_size_limit)
values ('library-voice', 'library-voice', true, 41943040)
on conflict (id) do update set public = true, file_size_limit = 41943040;
