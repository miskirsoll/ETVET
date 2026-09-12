-- Shared assertion helper for the test cases in cases/*.sql. Raising an
-- exception (rather than just printing) is what makes a failure actually
-- fail the run.sh script's `psql -v ON_ERROR_STOP=1` invocation instead of
-- requiring a human to eyeball the output.
create or replace function test_assert(condition boolean, message text)
returns void
language plpgsql
as $$
begin
  if not condition then
    raise exception 'ASSERTION FAILED: %', message;
  end if;
end;
$$;
