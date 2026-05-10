-- Phase 3.A.5 — Add columns to fb_sessions for ownership verification
-- Run via Supabase Dashboard SQL Editor (Rule 198/308 — ห้ามรัน DDL จาก Claude Code)
-- Generated: 2026-05-10

-- Columns added for connection.py endpoints:
--   /save   → profile_url, page_url, api_token_encrypted
--   /verify → reads profile_url, page_url; writes fb_user_id, fb_user_name, fb_account_type (already exist)
--   /status → reads all of the above

ALTER TABLE fb_sessions ADD COLUMN IF NOT EXISTS profile_url text;
ALTER TABLE fb_sessions ADD COLUMN IF NOT EXISTS page_url text;
ALTER TABLE fb_sessions ADD COLUMN IF NOT EXISTS api_token_encrypted text;

-- Verify after running:
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'fb_sessions'
--   ORDER BY ordinal_position;
