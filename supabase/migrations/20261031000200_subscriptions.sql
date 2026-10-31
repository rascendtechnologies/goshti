-- GOSHTI paid plan: who has Plus, and until when. Server only (service role).
-- The subject is a hash of the app's anonymous install id (the id RevenueCat knows the parent by),
-- so no name, email or card detail is ever stored here.
create table if not exists public.subscriptions (
  subject text primary key,
  plan text not null default 'PLUS',
  product_id text,
  expires_at timestamptz not null,
  last_event_at timestamptz not null,
  updated_at timestamptz not null default now()
);
comment on table public.subscriptions is 'GOSHTI paid plan per hashed install id (from RevenueCat webhooks). Server only (service role).';
alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, authenticated;

-- Applies a RevenueCat event. Out-of-order or repeated events never move the record backwards.
create or replace function public.apply_subscription_event(
  p_subject text, p_expires timestamptz, p_event_at timestamptz, p_product text
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.subscriptions (subject, plan, product_id, expires_at, last_event_at)
  values (p_subject, 'PLUS', p_product, p_expires, p_event_at)
  on conflict (subject) do update
    set product_id = excluded.product_id,
        expires_at = excluded.expires_at,
        last_event_at = excluded.last_event_at,
        updated_at = now()
    where public.subscriptions.last_event_at <= excluded.last_event_at;
$$;
revoke all on function public.apply_subscription_event(text, timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.apply_subscription_event(text, timestamptz, timestamptz, text) to service_role;

-- 'PLUS' while the paid period has not ended, otherwise 'FREE'.
create or replace function public.get_plan(p_subject text) returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select plan from public.subscriptions where subject = p_subject and expires_at > now()),
    'FREE'
  );
$$;
revoke all on function public.get_plan(text) from public, anon, authenticated;
grant execute on function public.get_plan(text) to service_role;
