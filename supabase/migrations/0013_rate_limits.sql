-- §7.14: rate limiting on public, unauthenticated write endpoints
-- (course password guessing, live-session/Bridge response spam) --
-- flagged as a gap in PLANNING.md given the anonymous-participation
-- requirement means there's no auth boundary to lean on for these.
--
-- A single SECURITY DEFINER function does the check-and-record
-- atomically per call, keyed by an arbitrary caller-supplied string (an
-- IP+resource combination for pre-auth actions like a password guess, a
-- participant/learner token for already-anonymous-but-identified
-- actions) -- this is app-level abuse mitigation, not a tenant-isolation
-- boundary, so it deliberately doesn't need RLS or per-org scoping the
-- way the rest of this schema does.

create table rate_limit_hits (
  id bigint generated always as identity primary key,
  key text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_hits_key_created_idx on rate_limit_hits (key, created_at);

-- Returns true (and records this hit) if the caller is still under
-- p_max_hits within the trailing p_window_seconds for this key;
-- otherwise returns false without recording anything. Also opportunistically
-- prunes this key's own expired hits so the table doesn't grow unbounded
-- without needing a separate cleanup job.
create function check_rate_limit(p_key text, p_max_hits integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from rate_limit_hits
  where key = p_key and created_at < now() - (p_window_seconds || ' seconds')::interval;

  select count(*) into v_count from rate_limit_hits
  where key = p_key and created_at > now() - (p_window_seconds || ' seconds')::interval;

  if v_count >= p_max_hits then
    return false;
  end if;

  insert into rate_limit_hits (key) values (p_key);
  return true;
end;
$$;

grant execute on function check_rate_limit(text, integer, integer) to anon, authenticated;

-- No direct table grants: only the function above ever touches
-- rate_limit_hits, so there's no need for anon/authenticated to read or
-- write the table themselves (unlike migration 0004's blanket grant,
-- this table is deliberately NOT covered by it).
revoke all on rate_limit_hits from anon, authenticated;
revoke usage on sequence rate_limit_hits_id_seq from anon, authenticated;
