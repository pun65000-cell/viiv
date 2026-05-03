BEGIN;

-- ============================================
-- Pre-flight: confirm ของเก่าเป็น placeholder
-- (อ่าน count + base length ก่อน drop เพื่อ log)
-- ============================================
DO $$
DECLARE
  v_prompts_count int;
  v_versions_count int;
  v_patches_count int;
  v_test_log_count int;
BEGIN
  SELECT count(*) INTO v_prompts_count FROM ai_prompts;
  SELECT count(*) INTO v_versions_count FROM ai_prompt_versions;
  SELECT count(*) INTO v_patches_count FROM ai_prompt_patches;
  SELECT count(*) INTO v_test_log_count FROM ai_prompt_test_log;
  RAISE NOTICE '[pre-drop] prompts=% versions=% patches=% test_log=%',
    v_prompts_count, v_versions_count, v_patches_count, v_test_log_count;
END $$;

-- ============================================
-- DROP เก่าทั้งหมด (CASCADE กัน orphan FK)
-- ============================================
DROP TABLE IF EXISTS ai_prompt_test_log CASCADE;
DROP TABLE IF EXISTS ai_prompt_versions CASCADE;
DROP TABLE IF EXISTS ai_prompt_patches CASCADE;
DROP TABLE IF EXISTS ai_prompts CASCADE;

-- ============================================
-- ai_prompts: 1 row ต่อ role (7 rows ตลอด)
-- ============================================
CREATE TABLE ai_prompts (
  slot              text PRIMARY KEY,
  base_text         text NOT NULL DEFAULT '',
  custom_text       text NOT NULL DEFAULT '',
  current_version   int NOT NULL DEFAULT 1,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        text,
  CONSTRAINT ai_prompts_slot_check CHECK (slot IN (
    'chat_bot',
    'complex_post',
    'pos_help',
    'autopost',
    'analytics',
    'internal_ops',
    'fallback'
  ))
);

-- ============================================
-- ai_prompt_patches: patches ต่อ role (เพิ่มได้ไม่จำกัด)
-- ============================================
CREATE TABLE ai_prompt_patches (
  id            text PRIMARY KEY DEFAULT ('pat_' || replace(gen_random_uuid()::text, '-', '')),
  slot          text NOT NULL,
  title         text NOT NULL,
  patch_text    text NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  priority      int NOT NULL DEFAULT 100,
  note          text DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    text,
  paused_at     timestamptz,
  CONSTRAINT ai_prompt_patches_slot_check CHECK (slot IN (
    'chat_bot','complex_post','pos_help','autopost',
    'analytics','internal_ops','fallback'
  ))
);

CREATE INDEX idx_patches_slot_active
  ON ai_prompt_patches(slot, is_active, priority);

-- ============================================
-- ai_prompt_versions: history (เรียกคืนได้)
-- ============================================
CREATE TABLE ai_prompt_versions (
  id                  bigserial PRIMARY KEY,
  slot                text NOT NULL,
  version             int NOT NULL,
  base_text           text,
  custom_text         text,
  patches_snapshot    jsonb DEFAULT '[]'::jsonb,
  saved_at            timestamptz NOT NULL DEFAULT now(),
  saved_by            text,
  notes               text DEFAULT '',
  CONSTRAINT ai_prompt_versions_unique UNIQUE(slot, version),
  CONSTRAINT ai_prompt_versions_slot_check CHECK (slot IN (
    'chat_bot','complex_post','pos_help','autopost',
    'analytics','internal_ops','fallback'
  ))
);

CREATE INDEX idx_versions_slot_version
  ON ai_prompt_versions(slot, version DESC);

-- ============================================
-- ai_prompt_test_log: sandbox test log
-- ============================================
CREATE TABLE ai_prompt_test_log (
  id            bigserial PRIMARY KEY,
  slot          text NOT NULL,
  test_input    text NOT NULL,
  ai_reply      text,
  shop_id       text,
  prompt_used   text,
  tokens_in     int DEFAULT 0,
  tokens_out    int DEFAULT 0,
  cost_usd      numeric(10,6) DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  tested_by     text
);

CREATE INDEX idx_test_log_slot_created
  ON ai_prompt_test_log(slot, created_at DESC);

-- ============================================
-- SEED 7 rows
-- ============================================
INSERT INTO ai_prompts (slot, base_text, custom_text, updated_by) VALUES
  ('chat_bot',     '[TODO: prompt สำหรับ chat_bot — ตอบลูกค้า]',         '', 'system_seed'),
  ('complex_post', '[TODO: prompt สำหรับ complex_post — งานยาว/ซับซ้อน]', '', 'system_seed'),
  ('pos_help',     '[TODO: prompt สำหรับ pos_help — ช่วยใช้ POS]',        '', 'system_seed'),
  ('autopost',     '[TODO: prompt สำหรับ autopost — สร้างโพสต์ขาย]',     '', 'system_seed'),
  ('analytics',    '[TODO: prompt สำหรับ analytics — วิเคราะห์ data]',    '', 'system_seed'),
  ('internal_ops', '[TODO: prompt สำหรับ internal_ops — VIIV office]',   '', 'system_seed'),
  ('fallback',     '[TODO: prompt สำหรับ fallback — เมื่อ primary fail]', '', 'system_seed');

-- snapshot version 1 ของ 7 slot
INSERT INTO ai_prompt_versions (slot, version, base_text, custom_text, saved_by, notes)
SELECT slot, 1, base_text, custom_text, 'system_seed', 'Initial seed v2 (7 roles)'
FROM ai_prompts;

COMMIT;
