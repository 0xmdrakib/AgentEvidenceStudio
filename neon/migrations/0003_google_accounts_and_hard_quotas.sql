begin;

-- Every authenticated member receives the same small, administrator-owned plan.
-- Members can create their row with these defaults, but cannot raise or update it.
create table public.account_limits (
  owner_id text primary key default (auth.user_id()),
  storage_limit_bytes bigint not null default 10485760 check (storage_limit_bytes between 1048576 and 104857600),
  bundle_limit_bytes integer not null default 524288 check (bundle_limit_bytes between 65536 and 5242880),
  version_limit integer not null default 100 check (version_limit between 1 and 1000),
  report_limit integer not null default 20 check (report_limit between 0 and 100),
  daily_cloud_write_limit integer not null default 50 check (daily_cloud_write_limit between 1 and 1000),
  daily_hosted_run_limit integer not null default 5 check (daily_hosted_run_limit between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.account_daily_usage (
  owner_id text not null,
  usage_date date not null default current_date,
  cloud_writes integer not null default 0 check (cloud_writes between 0 and 10000),
  updated_at timestamptz not null default now(),
  primary key (owner_id, usage_date)
);

-- Server-only burst buckets keep a valid account from rapidly draining the
-- administrator's hosted provider quota. The daily cap remains authoritative.
create table public.hosted_request_buckets (
  owner_id text not null,
  bucket_start timestamptz not null,
  requests_count integer not null default 0 check (requests_count between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (owner_id, bucket_start)
);

alter table public.published_reports add column object_size bigint;
update public.published_reports
set object_size = octet_length(convert_to(report_json::text, 'UTF8'))
where object_size is null;
alter table public.published_reports alter column object_size set not null;
alter table public.published_reports add constraint published_reports_object_size
  check (object_size > 0 and object_size <= 262144);

create index idx_account_daily_usage_date on public.account_daily_usage(usage_date);
create index idx_hosted_request_buckets_start on public.hosted_request_buckets(bucket_start);

alter table public.account_limits enable row level security;
alter table public.account_daily_usage enable row level security;
alter table public.hosted_request_buckets enable row level security;

create policy account_limits_owner_select on public.account_limits
  for select to authenticated
  using ((select auth.user_id()) = owner_id);

create policy account_limits_owner_create_default on public.account_limits
  for insert to authenticated
  with check (
    (select auth.user_id()) = owner_id
    and storage_limit_bytes = 10485760
    and bundle_limit_bytes = 524288
    and version_limit = 100
    and report_limit = 20
    and daily_cloud_write_limit = 50
    and daily_hosted_run_limit = 5
  );

create policy account_daily_usage_owner_select on public.account_daily_usage
  for select to authenticated
  using ((select auth.user_id()) = owner_id);

revoke all on public.account_limits, public.account_daily_usage, public.hosted_request_buckets from anonymous, authenticated;
grant select, insert on public.account_limits to authenticated;
grant select on public.account_daily_usage to authenticated;

create or replace function public.ensure_default_account_limits(p_owner_id text)
returns public.account_limits
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  limits public.account_limits;
begin
  insert into public.account_limits (owner_id)
  values (p_owner_id)
  on conflict (owner_id) do nothing;

  select * into limits
  from public.account_limits
  where owner_id = p_owner_id
  for update;

  return limits;
end;
$$;

revoke all on function public.ensure_default_account_limits(text) from public, anonymous, authenticated;

create or replace function public.reserve_cloud_write(p_owner_id text, p_limit integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reserved integer;
begin
  insert into public.account_daily_usage (owner_id, usage_date, cloud_writes, updated_at)
  values (p_owner_id, current_date, 1, now())
  on conflict (owner_id, usage_date) do update
  set cloud_writes = public.account_daily_usage.cloud_writes + 1,
      updated_at = now()
  where public.account_daily_usage.cloud_writes < p_limit
  returning cloud_writes into reserved;

  if reserved is null then
    raise exception using errcode = 'P0001', message = 'Daily cloud write limit reached.';
  end if;
end;
$$;

revoke all on function public.reserve_cloud_write(text, integer) from public, anonymous, authenticated;

create or replace function public.enforce_workspace_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  workspace_count integer;
begin
  perform public.ensure_default_account_limits(new.owner_id);
  select count(*) into workspace_count from public.workspaces where owner_id = new.owner_id;
  if workspace_count >= 3 then
    raise exception using errcode = 'P0001', message = 'Workspace limit reached (3).';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_run_metadata_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  run_count integer;
begin
  perform public.ensure_default_account_limits(new.owner_id);
  select count(*) into run_count from public.run_metadata where owner_id = new.owner_id;
  if run_count >= 200 then
    raise exception using errcode = 'P0001', message = 'Stored run limit reached (200).';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_bundle_quota()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  limits public.account_limits;
  used_bytes bigint;
  version_count integer;
begin
  limits := public.ensure_default_account_limits(new.owner_id);
  new.object_size := octet_length(convert_to(new.bundle_data::text, 'UTF8'));

  if new.object_size > limits.bundle_limit_bytes then
    raise exception using errcode = 'P0001', message = 'Encrypted bundle exceeds the 512 KB per-version limit.';
  end if;

  select count(*) into version_count from public.bundle_versions where owner_id = new.owner_id;
  if version_count >= limits.version_limit then
    raise exception using errcode = 'P0001', message = 'Encrypted version limit reached (100).';
  end if;

  select
    coalesce((select sum(object_size) from public.bundle_versions where owner_id = new.owner_id), 0)
    + coalesce((select sum(object_size) from public.published_reports where owner_id = new.owner_id), 0)
  into used_bytes;

  if used_bytes + new.object_size > limits.storage_limit_bytes then
    raise exception using errcode = 'P0001', message = 'Private cloud storage limit reached (10 MB).';
  end if;

  perform public.reserve_cloud_write(new.owner_id, limits.daily_cloud_write_limit);
  return new;
end;
$$;

create or replace function public.enforce_report_quota()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  limits public.account_limits;
  used_bytes bigint;
  report_count integer;
begin
  limits := public.ensure_default_account_limits(new.owner_id);
  new.object_size := octet_length(convert_to(new.report_json::text, 'UTF8'));

  if new.object_size > 262144 then
    raise exception using errcode = 'P0001', message = 'Published report exceeds the 256 KB limit.';
  end if;

  select count(*) into report_count from public.published_reports where owner_id = new.owner_id;
  if report_count >= limits.report_limit then
    raise exception using errcode = 'P0001', message = 'Published report limit reached (20).';
  end if;

  select
    coalesce((select sum(object_size) from public.bundle_versions where owner_id = new.owner_id), 0)
    + coalesce((select sum(object_size) from public.published_reports where owner_id = new.owner_id), 0)
  into used_bytes;

  if used_bytes + new.object_size > limits.storage_limit_bytes then
    raise exception using errcode = 'P0001', message = 'Account storage limit reached (10 MB).';
  end if;

  perform public.reserve_cloud_write(new.owner_id, limits.daily_cloud_write_limit);
  return new;
end;
$$;

revoke all on function public.enforce_workspace_limit() from public, anonymous, authenticated;
revoke all on function public.enforce_run_metadata_limit() from public, anonymous, authenticated;
revoke all on function public.enforce_bundle_quota() from public, anonymous, authenticated;
revoke all on function public.enforce_report_quota() from public, anonymous, authenticated;

create trigger workspaces_hard_limit
before insert on public.workspaces
for each row execute function public.enforce_workspace_limit();

create trigger run_metadata_hard_limit
before insert on public.run_metadata
for each row execute function public.enforce_run_metadata_limit();

create trigger bundle_versions_hard_quota
before insert on public.bundle_versions
for each row execute function public.enforce_bundle_quota();

create trigger published_reports_hard_quota
before insert on public.published_reports
for each row execute function public.enforce_report_quota();

create view public.my_account_usage
with (security_invoker = true)
as
select
  limits.owner_id,
  limits.storage_limit_bytes,
  limits.bundle_limit_bytes,
  limits.version_limit,
  limits.report_limit,
  limits.daily_cloud_write_limit,
  limits.daily_hosted_run_limit,
  limits.created_at,
  coalesce(bundle_usage.bytes, 0) + coalesce(report_usage.bytes, 0) as storage_used_bytes,
  coalesce(bundle_usage.items, 0)::integer as bundle_versions,
  coalesce(report_usage.items, 0)::integer as published_reports,
  coalesce(daily.cloud_writes, 0) as cloud_writes_today,
  coalesce(hosted.runs_count, 0) as hosted_runs_today
from public.account_limits limits
left join lateral (
  select sum(object_size) as bytes, count(*) as items
  from public.bundle_versions
  where owner_id = limits.owner_id
) bundle_usage on true
left join lateral (
  select sum(object_size) as bytes, count(*) as items
  from public.published_reports
  where owner_id = limits.owner_id
) report_usage on true
left join public.account_daily_usage daily
  on daily.owner_id = limits.owner_id and daily.usage_date = current_date
left join public.execution_usage hosted
  on hosted.owner_id = limits.owner_id and hosted.usage_date = current_date
where limits.owner_id = (select auth.user_id());

grant select on public.my_account_usage to authenticated;

commit;
