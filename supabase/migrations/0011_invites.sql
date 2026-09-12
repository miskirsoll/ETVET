-- §7.12: team invite flow. Every sign-up today creates a brand-new org
-- (migration 0002) -- there's no way to invite a teammate into an
-- *existing* org as Author/Trainer/Reviewer. This adds link-based invites
-- (no outbound email in this build -- an ORG_ADMIN generates a link and
-- shares it themselves) that the sign-up trigger consumes to join the
-- inviting org instead of minting a new one.

create table org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  role org_role not null,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_by uuid references users (id),
  email text,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references users (id),
  created_at timestamptz not null default now()
);

create index org_invites_org_id_idx on org_invites (org_id);
create index org_invites_token_idx on org_invites (token);

alter table org_invites enable row level security;

-- Only ORG_ADMINs manage invites for their own org -- no public read policy
-- at all (unlike publish_slug/publish_password, a bare `using (true)`
-- policy would let anyone enumerate every org's pending invite tokens via
-- a full-table select, not just look up the one they were given). A
-- token lookup instead goes through get_invite_by_token() below, which
-- returns only the single matching row's non-sensitive summary.
create policy "org admins manage own invites" on org_invites
  for all using (
    org_id = current_org_id()
    and exists (select 1 from users u where u.id = auth.uid() and u.role = 'ORG_ADMIN')
  ) with check (
    org_id = current_org_id()
    and exists (select 1 from users u where u.id = auth.uid() and u.role = 'ORG_ADMIN')
  );

-- Lets the sign-up page show "You're joining <org> as <role>" before the
-- person has an account (and therefore no org_id/current_org_id() yet).
create function get_invite_by_token(p_token text)
returns table (org_name text, role org_role, valid boolean)
language sql
stable
security definer
set search_path = public
as $$
  select o.name, i.role, (i.expires_at > now() and i.accepted_at is null)
  from org_invites i
  join organizations o on o.id = i.org_id
  where i.token = p_token
$$;

grant execute on function get_invite_by_token(text) to anon, authenticated;

-- Joins an accepted invite's org+role instead of creating a new org, when
-- the new auth.users row carries a valid invite_token in its metadata.
-- Falls back to the original create-a-new-org behavior for a
-- missing/expired/already-accepted token rather than blocking sign-up
-- outright, since a stale invite link shouldn't be able to lock someone
-- out of creating an account at all.
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  invite_token text;
  invite org_invites%rowtype;
begin
  invite_token := new.raw_user_meta_data ->> 'invite_token';

  if invite_token is not null then
    select * into invite from org_invites
      where token = invite_token
        and expires_at > now()
        and accepted_at is null
      for update;
  end if;

  if invite.id is not null then
    insert into users (id, org_id, role, display_name)
    values (new.id, invite.org_id, invite.role, new.raw_user_meta_data ->> 'display_name');

    update org_invites set accepted_at = now(), accepted_by = new.id where id = invite.id;
  else
    insert into organizations (name, subscription_tier)
    values (coalesce(new.raw_user_meta_data ->> 'org_name', 'My Organization'), 'FREE')
    returning id into new_org_id;

    insert into users (id, org_id, role, display_name)
    values (new.id, new_org_id, 'ORG_ADMIN', new.raw_user_meta_data ->> 'display_name');
  end if;

  return new;
end;
$$;
