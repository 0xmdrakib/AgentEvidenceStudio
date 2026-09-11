begin;

-- Reservations survive sign-out and account recreation. No email, question,
-- source text or credential is stored in this server-only operational ledger.
create table public.ai_run_reservations (
  id uuid primary key,
  identity_hash text not null check (length(identity_hash) = 64),
  owner_id text not null,
  request_id uuid not null,
  input_digest text not null check (length(input_digest) = 64),
  created_at timestamptz not null default now(),
  lease_until timestamptz not null default (now() + interval '6 minutes'),
  state text not null default 'running' check (state in ('running', 'completed', 'failed')),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  calls integer not null default 0 check (calls between 0 and 4),
  unique (identity_hash, request_id)
);
create index ai_runs_identity_created on public.ai_run_reservations(identity_hash, created_at);
create index ai_runs_created on public.ai_run_reservations(created_at);
alter table public.ai_run_reservations enable row level security;
revoke all on public.ai_run_reservations from public, anonymous, authenticated;

create function public.ai_google_identity(p_owner text) returns text
language sql stable security invoker set search_path = pg_catalog, public
as $$
  select encode(sha256(convert_to('google:' || a."accountId", 'UTF8')), 'hex')
  from neon_auth.account a join neon_auth."user" u on u.id = a."userId"
  where u.id::text = p_owner and a."providerId" = 'google'
    and u."emailVerified" = true
    and (u.banned is not true or u."banExpires" < now())
  limit 1
$$;
revoke all on function public.ai_google_identity(text) from public, anonymous, authenticated;

create function public.ai_member_usage(p_owner text) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public
as $$
declare
  identity_key text := public.ai_google_identity(p_owner);
  day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  month_start timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  day_limit integer;
begin
  if identity_key is null then raise exception 'AI_GOOGLE_REQUIRED'; end if;
  select least(coalesce(daily_hosted_run_limit, 2), 2) into day_limit from public.account_limits where owner_id = p_owner;
  return (select jsonb_build_object(
    'usedToday', count(*) filter (where created_at >= day_start),
    'usedThisMonth', count(*), 'dailyLimit', coalesce(day_limit, 2), 'monthlyLimit', 10,
    'dailyResetAt', day_start + interval '1 day',
    'monthlyResetAt', month_start + interval '1 month'
  ) from public.ai_run_reservations where identity_hash = identity_key and created_at >= month_start);
end
$$;
revoke all on function public.ai_member_usage(text) from public, anonymous, authenticated;

create function public.reserve_ai_run(p_owner text, p_id uuid, p_request uuid, p_digest text) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public
as $$
declare
  identity_key text := public.ai_google_identity(p_owner);
  usage jsonb;
  day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  month_start timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
begin
  if identity_key is null then raise exception 'AI_GOOGLE_REQUIRED'; end if;
  -- Serialize only this short transaction across every app instance.
  perform pg_advisory_xact_lock(741029, 4);
  if exists(select 1 from public.ai_run_reservations where identity_hash = identity_key and request_id = p_request) then raise exception 'AI_DUPLICATE'; end if;
  if exists(select 1 from public.ai_run_reservations where identity_hash = identity_key and state = 'running' and lease_until > now()) then raise exception 'AI_BUSY'; end if;
  if exists(select 1 from public.ai_run_reservations where identity_hash = identity_key and created_at > now() - interval '60 seconds') then raise exception 'AI_COOLDOWN'; end if;
  if exists(select 1 from public.ai_run_reservations where identity_hash = identity_key and input_digest = p_digest and created_at > now() - interval '10 minutes') then raise exception 'AI_DUPLICATE'; end if;
  usage := public.ai_member_usage(p_owner);
  if (usage->>'usedToday')::integer >= (usage->>'dailyLimit')::integer then raise exception 'AI_DAILY_LIMIT'; end if;
  if (usage->>'usedThisMonth')::integer >= 10 then raise exception 'AI_MONTHLY_LIMIT'; end if;
  if (select count(*) from public.ai_run_reservations where created_at >= day_start) >= 20 then raise exception 'AI_SITE_DAILY_LIMIT'; end if;
  if (select count(*) from public.ai_run_reservations where created_at >= month_start) >= 200 then raise exception 'AI_SITE_MONTHLY_LIMIT'; end if;
  if (select count(*) from public.ai_run_reservations where state = 'running' and lease_until > now()) >= 3 then raise exception 'AI_SITE_BUSY'; end if;

  insert into public.account_limits(owner_id) values (p_owner) on conflict do nothing;
  insert into public.ai_run_reservations(id, identity_hash, owner_id, request_id, input_digest)
  values (p_id, identity_key, p_owner, p_request, p_digest);
  insert into public.execution_usage(owner_id, usage_date, runs_count, updated_at)
  values (p_owner, (day_start at time zone 'UTC')::date, 1, now())
  on conflict (owner_id, usage_date) do update set runs_count = public.execution_usage.runs_count + 1, updated_at = now();
  -- Bounded maintenance of our operational ledger, never saved evidence.
  delete from public.ai_run_reservations where created_at < month_start - interval '2 months';
  return public.ai_member_usage(p_owner);
end
$$;
revoke all on function public.reserve_ai_run(text, uuid, uuid, text) from public, anonymous, authenticated;
commit;
