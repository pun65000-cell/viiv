-- Phase Z.F — DB cleanup queue
-- Generated: 2026-05-14  Author: Phase Z paradigm pivot
-- ⚠️  DO NOT RUN IMMEDIATELY
-- Run via Supabase Dashboard SQL editor once Official Platform API paradigm
-- is stable (~30 days, i.e. after 2026-06-14).
-- These tables are from the 72h browser-sandbox paradigm (Phase F).
-- Verify no code references these tables before executing.
--
-- Tables targeted:
--   fb_sessions   — browser cookie sessions (modulecookie :8005)
--   fb_audit_log  — cookie action audit log (modulecookie :8005)
--
-- Verification query (run first, expect 0 rows for both):
-- SELECT table_name, pg_size_pretty(pg_total_relation_size(quote_ident(table_name)))
--   FROM information_schema.tables
--   WHERE table_name IN ('fb_sessions', 'fb_audit_log')
--   AND table_schema = 'public';

-- Step 1: Confirm tables exist + row counts
SELECT 'fb_sessions' AS tbl, COUNT(*) AS rows FROM fb_sessions
UNION ALL
SELECT 'fb_audit_log', COUNT(*) FROM fb_audit_log;

-- Step 2: Drop (execute only after confirming step 1 output and paradigm stability)
-- Uncomment to execute:
-- DROP TABLE IF EXISTS fb_sessions;
-- DROP TABLE IF EXISTS fb_audit_log;
