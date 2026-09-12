-- Bug fix: every prior migration created tables without granting the
-- Data API roles (anon, authenticated) any privileges on them. Supabase's
-- current default is to NOT auto-expose newly created tables (see the
-- auto_expose_new_tables note in supabase/config.toml) -- RLS policies
-- only restrict access that a GRANT already allows, they don't imply one.
-- Without this, every table added in 0001-0003 would return "permission
-- denied" through the API even though RLS looked correct, because the
-- manual `grant ... to authenticated` run during local testing was never
-- captured in a migration.
--
-- Fix: grant broad table privileges to anon/authenticated now (RLS
-- remains the real access-control boundary, same model as the Supabase
-- dashboard's own default for a new table), and set default privileges so
-- every table created by a *future* migration is covered automatically --
-- this should never need repeating again.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;
alter default privileges in schema public
  grant execute on functions to anon, authenticated;
