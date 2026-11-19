-- Phase 10 (additive, no data change): lock the public schema against Supabase's auto-generated APIs (ADR-029).
--
-- Supabase exposes tables in `public` through its REST/GraphQL APIs to the `anon` and `authenticated` roles,
-- whose keys are public by design. This app never uses those APIs — only the backend (table owner) reads
-- and writes data — so:
--   1. Row Level Security on every table, with no policies → those roles can read/write no rows.
--      The table owner (our backend's role) is not affected (RLS is not FORCEd).
--   2. On Supabase, all privileges are revoked from anon/authenticated (RLS does not cover TRUNCATE),
--      now and for tables created later. Locally these roles do not exist, so this part is skipped.
-- `test/schema-safety.e2e-spec.ts` fails if a future migration adds a table without RLS.

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
  END IF;
END $$;
