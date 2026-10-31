-- GOSHTI abuse limits: hashed device / IP / global counters per day or month. Server only (service role).
create table if not exists public.usage_counters (
  scope text not null,
  kind text not null,
  period text not null,
  n integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (scope, kind, period)
);
comment on table public.usage_counters is 'GOSHTI abuse limits: hashed device / IP / global counters per day or month. Server only (service role).';
alter table public.usage_counters enable row level security;
revoke all on public.usage_counters from anon, authenticated;

-- Adds one use and returns the new count, or -1 when the limit is already reached (no change then).
create or replace function public.take_usage(p_scope text, p_kind text, p_period text, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v integer;
begin
  if p_limit is null or p_limit <= 0 then return -1; end if;
  insert into public.usage_counters (scope, kind, period, n)
  values (p_scope, p_kind, p_period, 1)
  on conflict (scope, kind, period)
  do update set n = public.usage_counters.n + 1, updated_at = now()
  where public.usage_counters.n < p_limit
  returning n into v;
  return coalesce(v, -1);
end $$;
revoke all on function public.take_usage(text, text, text, integer) from public, anon, authenticated;
grant execute on function public.take_usage(text, text, text, integer) to service_role;

create or replace function public.purge_usage(p_keep_days integer default 70)
returns integer
language sql
security definer
set search_path = public
as $$
  with d as (delete from public.usage_counters where updated_at < now() - make_interval(days => p_keep_days) returning 1)
  select count(*)::integer from d;
$$;
revoke all on function public.purge_usage(integer) from public, anon, authenticated;
grant execute on function public.purge_usage(integer) to service_role;
