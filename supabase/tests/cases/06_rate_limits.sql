-- Covers migration 0013 (check_rate_limit): allows up to max_hits within
-- the window, rejects beyond that, isolates buckets by key, and that
-- anon/authenticated can't bypass the function to read or write the
-- table directly.

set client_min_messages to warning;
begin;

set role anon;
set request.jwt.claim.role = 'anon';

-- First 3 calls within a max-3 bucket succeed; the 4th is rejected.
select test_assert(check_rate_limit('bucket-a', 3, 60) = true, 'hit 1 of 3 should be allowed');
select test_assert(check_rate_limit('bucket-a', 3, 60) = true, 'hit 2 of 3 should be allowed');
select test_assert(check_rate_limit('bucket-a', 3, 60) = true, 'hit 3 of 3 should be allowed');
select test_assert(check_rate_limit('bucket-a', 3, 60) = false, 'hit 4 of 3 should be rejected');
select test_assert(check_rate_limit('bucket-a', 3, 60) = false, 'still rejected on a later call too');

-- A different key is an independent bucket, unaffected by bucket-a being maxed out.
select test_assert(check_rate_limit('bucket-b', 3, 60) = true, 'a different key should have its own fresh bucket');

-- A window that has already fully elapsed (0-second window) never blocks --
-- simulates an old hit that should be treated as expired.
select test_assert(check_rate_limit('bucket-c', 1, 0) = true, 'first hit in a 0s window is allowed');
select test_assert(check_rate_limit('bucket-c', 1, 0) = true, 'a 0s window never accumulates -- always allowed');

-- anon/authenticated cannot read or write the underlying table directly,
-- only through the function.
do $$
begin
  insert into rate_limit_hits (key) values ('direct-insert-attempt');
  perform test_assert(false, 'anon should not be able to insert into rate_limit_hits directly');
exception
  when insufficient_privilege then null;
end $$;

do $$
begin
  perform count(*) from rate_limit_hits;
  perform test_assert(false, 'anon should not be able to select from rate_limit_hits directly');
exception
  when insufficient_privilege then null;
end $$;

reset role;
rollback;
