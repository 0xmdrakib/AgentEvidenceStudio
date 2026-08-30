begin;

alter table public.bundle_versions
  add column if not exists bundle_data jsonb;

alter table public.bundle_versions
  alter column bundle_data set not null;

alter table public.bundle_versions
  add constraint bundle_versions_bundle_data_object
  check (jsonb_typeof(bundle_data) = 'object');

commit;
