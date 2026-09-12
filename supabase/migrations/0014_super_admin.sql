-- §7.12: a minimal Super Admin console -- cross-org platform management,
-- the lowest-priority role since it's an internal/operator surface, not
-- customer-facing. No self-service path grants SUPER_ADMIN (unlike
-- ORG_ADMIN on signup or AUTHOR/TRAINER/REVIEWER via team invites,
-- migration 0011) -- an operator promotes themselves directly in the
-- database, the same "manual test tool until the real thing exists"
-- posture as /upgrade's tier switcher before Stripe. See LOCAL_DEV.md.
--
-- organizations' only RLS policy is "read your own org"
-- (current_org_id()), so a plain client query can never return a
-- cross-org list no matter what the app layer checks -- same reason
-- get_learner_progress()/current_org_id() itself are SECURITY DEFINER
-- RPCs rather than relying on a client-side filter.

create function admin_list_organizations()
returns table (
  org_id uuid,
  name text,
  subscription_tier subscription_tier,
  created_at timestamptz,
  member_count bigint,
  course_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from users where id = auth.uid() and role = 'SUPER_ADMIN') then
    raise exception 'admin_list_organizations requires SUPER_ADMIN';
  end if;

  return query
    select
      o.id,
      o.name,
      o.subscription_tier,
      o.created_at,
      (select count(*) from users u where u.org_id = o.id),
      (select count(*) from courses c where c.org_id = o.id)
    from organizations o
    order by o.created_at desc;
end;
$$;

grant execute on function admin_list_organizations() to authenticated;

-- Support-driven tier override, separate from /upgrade's self-service
-- switcher (which only an org's own ORG_ADMIN can use on their own org).
create function admin_set_org_tier(p_org_id uuid, p_tier subscription_tier)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from users where id = auth.uid() and role = 'SUPER_ADMIN') then
    raise exception 'admin_set_org_tier requires SUPER_ADMIN';
  end if;

  update organizations set subscription_tier = p_tier where id = p_org_id;
end;
$$;

grant execute on function admin_set_org_tier(uuid, subscription_tier) to authenticated;
