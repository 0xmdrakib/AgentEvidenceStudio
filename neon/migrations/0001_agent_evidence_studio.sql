begin;

create extension if not exists pgcrypto;

create table public.profiles (
  id text primary key default (auth.user_id()),
  display_name text check (char_length(display_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null default (auth.user_id()),
  name text not null check (char_length(name) between 1 and 120),
  key_fingerprint text not null check (key_fingerprint ~ '^[a-f0-9]{64}$'),
  recovery_confirmed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table public.run_metadata (
  owner_id text not null default (auth.user_id()),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id text not null check (char_length(run_id) between 1 and 160),
  module text not null check (module in ('recorder', 'memory', 'jury')),
  state text not null check (state in ('draft', 'awaiting_approval', 'running', 'blocked', 'completed', 'failed', 'canceled')),
  title text not null check (char_length(title) between 1 and 240),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (workspace_id, run_id)
);

create table public.bundle_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null default (auth.user_id()),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id text not null,
  object_path text not null unique,
  object_digest text not null check (object_digest ~ '^[a-f0-9]{64}$'),
  object_size bigint not null check (object_size > 0 and object_size <= 52428800),
  format text not null check (format = 'aesrun/v1'),
  bundle_data jsonb not null check (jsonb_typeof(bundle_data) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (workspace_id, run_id) references public.run_metadata(workspace_id, run_id) on delete cascade,
  unique (workspace_id, run_id, object_digest)
);

create table public.published_reports (
  id text primary key check (id ~ '^report_[a-f0-9]{32}$'),
  owner_id text not null default (auth.user_id()),
  run_id text not null,
  title text not null check (char_length(title) between 1 and 240),
  object_digest text not null check (object_digest ~ '^[a-f0-9]{64}$'),
  report_json jsonb not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (jsonb_typeof(report_json) = 'object'),
  check (revoked_at is null or revoked_at >= created_at)
);

create table public.execution_usage (
  owner_id text not null,
  usage_date date not null default current_date,
  runs_count integer not null default 0 check (runs_count between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (owner_id, usage_date)
);

create index idx_workspaces_owner on public.workspaces(owner_id);
create index idx_run_metadata_owner_updated on public.run_metadata(owner_id, updated_at desc);
create index idx_bundle_versions_owner_run on public.bundle_versions(owner_id, run_id, created_at desc);
create index idx_published_reports_owner on public.published_reports(owner_id, created_at desc);
create index idx_published_reports_live on public.published_reports(id) where revoked_at is null;
create index idx_execution_usage_date on public.execution_usage(usage_date);

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.run_metadata enable row level security;
alter table public.bundle_versions enable row level security;
alter table public.published_reports enable row level security;
alter table public.execution_usage enable row level security;

create policy profiles_owner_select on public.profiles for select to authenticated using ((select auth.user_id()) = id);
create policy profiles_owner_insert on public.profiles for insert to authenticated with check ((select auth.user_id()) = id);
create policy profiles_owner_update on public.profiles for update to authenticated using ((select auth.user_id()) = id) with check ((select auth.user_id()) = id);

create policy workspaces_owner_select on public.workspaces for select to authenticated using ((select auth.user_id()) = owner_id);
create policy workspaces_owner_insert on public.workspaces for insert to authenticated with check ((select auth.user_id()) = owner_id);
create policy workspaces_owner_update on public.workspaces for update to authenticated using ((select auth.user_id()) = owner_id) with check ((select auth.user_id()) = owner_id);
create policy workspaces_owner_delete on public.workspaces for delete to authenticated using ((select auth.user_id()) = owner_id);

create policy run_metadata_owner_select on public.run_metadata for select to authenticated using ((select auth.user_id()) = owner_id);
create policy run_metadata_owner_insert on public.run_metadata for insert to authenticated with check ((select auth.user_id()) = owner_id and exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.user_id())));
create policy run_metadata_owner_update on public.run_metadata for update to authenticated using ((select auth.user_id()) = owner_id) with check ((select auth.user_id()) = owner_id);

create policy bundle_versions_owner_select on public.bundle_versions for select to authenticated using ((select auth.user_id()) = owner_id);
create policy bundle_versions_owner_insert on public.bundle_versions for insert to authenticated with check ((select auth.user_id()) = owner_id and exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.user_id())));

create policy reports_public_select_live on public.published_reports for select to anonymous using (revoked_at is null);
create policy reports_owner_select on public.published_reports for select to authenticated using ((select auth.user_id()) = owner_id);
create policy reports_owner_insert on public.published_reports for insert to authenticated with check ((select auth.user_id()) = owner_id);
create policy reports_owner_update on public.published_reports for update to authenticated using ((select auth.user_id()) = owner_id) with check ((select auth.user_id()) = owner_id);

revoke all on public.profiles, public.workspaces, public.run_metadata, public.bundle_versions, public.published_reports from anonymous, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update on public.run_metadata to authenticated;
grant select, insert on public.bundle_versions to authenticated;
grant select on public.published_reports to anonymous;
grant select, insert, update on public.published_reports to authenticated;

-- Hosted usage is written only through the server-side DATABASE_URL role.
-- It is intentionally not exposed through the browser Data API.
revoke all on public.execution_usage from anonymous, authenticated;

commit;
