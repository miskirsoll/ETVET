-- On first sign-up, give the person their own organization (FREE tier) and
-- an ORG_ADMIN users row, so "every user belongs to an organization" holds
-- from the moment auth.users gets a row -- no separate onboarding step.
-- An invited teammate (future work) would instead get an existing org_id
-- passed through auth metadata and skip organization creation here.

create function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  insert into organizations (name, subscription_tier)
  values (coalesce(new.raw_user_meta_data ->> 'org_name', 'My Organization'), 'FREE')
  returning id into new_org_id;

  insert into users (id, org_id, role, display_name)
  values (new.id, new_org_id, 'ORG_ADMIN', new.raw_user_meta_data ->> 'display_name');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();
