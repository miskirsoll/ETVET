-- Stubs the parts of Supabase's managed `auth`/`storage` schemas that our
-- migrations and RLS policies depend on (auth.uid(), auth.role(),
-- auth.users, storage.buckets/objects/foldername()), plus the anon/
-- authenticated roles -- so migrations written against a real Supabase
-- project can be applied and exercised against a plain local Postgres.
-- There is no Docker available in this repo's dev/CI sandbox, which is
-- why this harness exists instead of `supabase start` + pgTAP.

create schema if not exists auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create or replace function auth.uid() returns uuid as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$ language sql stable;

create or replace function auth.role() returns text as $$
  select nullif(current_setting('request.jwt.claim.role', true), '')
$$ language sql stable;

create schema if not exists storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz default now()
);
create or replace function storage.foldername(name text) returns text[] as $$
  select string_to_array(name, '/')
$$ language sql immutable;

-- A real Supabase project has RLS already enabled on storage.objects;
-- migration 0008 only adds policies to it on that assumption, the same
-- way it never has to CREATE the table. Without this, the stub's plain
-- table would let every policy's WITH CHECK be silently bypassed.
alter table storage.objects enable row level security;

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$$;

grant usage on schema auth, storage, public to anon, authenticated;

-- A real Supabase project provisions these storage.* grants itself as
-- part of the platform (RLS is the actual boundary, same model as the
-- public schema) -- our migrations never touch them, so the stub has to
-- set them up manually for storage.objects RLS to be exercisable at all.
grant select, insert, update, delete on storage.objects, storage.buckets to anon, authenticated;

create extension if not exists pgcrypto;
