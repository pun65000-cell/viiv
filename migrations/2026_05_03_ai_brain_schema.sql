BEGIN;

-- ============================================
-- ai_prompts: prompt หลัก 1 row ต่อ slot (3 rows ตลอด)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_prompts (
  slot              text PRIMARY KEY,
  base_text         text NOT NULL DEFAULT '',
  custom_text       text NOT NULL DEFAULT '',
  current_version   int NOT NULL DEFAULT 1,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        text,
  CONSTRAINT ai_prompts_slot_check CHECK (slot IN ('greet', 'funnel', 'rescue'))
);

-- ============================================
-- ai_prompt_patches: patches ย่อย N ต่อ slot
-- ============================================
CREATE TABLE IF NOT EXISTS ai_prompt_patches (
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
  CONSTRAINT ai_prompt_patches_slot_check CHECK (slot IN ('greet', 'funnel', 'rescue'))
);

CREATE INDEX IF NOT EXISTS idx_patches_slot_active
  ON ai_prompt_patches(slot, is_active, priority);

-- ============================================
-- ai_prompt_versions: history ของ ai_prompts (เรียกคืนได้)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_prompt_versions (
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
  CONSTRAINT ai_prompt_versions_slot_check CHECK (slot IN ('greet', 'funnel', 'rescue'))
);

CREATE INDEX IF NOT EXISTS idx_versions_slot_version
  ON ai_prompt_versions(slot, version DESC);

-- ============================================
-- ai_prompt_test_log: บันทึก sandbox test
-- ============================================
CREATE TABLE IF NOT EXISTS ai_prompt_test_log (
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

CREATE INDEX IF NOT EXISTS idx_test_log_slot_created
  ON ai_prompt_test_log(slot, created_at DESC);

-- ============================================
-- SEED: 3 rows ใน ai_prompts ด้วย placeholder "[TODO]"
-- ใช้ ON CONFLICT DO NOTHING — รัน migration ซ้ำได้
-- ============================================
INSERT INTO ai_prompts (slot, base_text, custom_text, updated_by) VALUES
  ('greet',  '[TODO: เขียน base prompt สำหรับทักทายลูกค้า]', '', 'system_seed'),
  ('funnel', '[TODO: เขียน base prompt สำหรับ funnel flow]',  '', 'system_seed'),
  ('rescue', '[TODO: เขียน base prompt สำหรับ AI rescue]',    '', 'system_seed')
ON CONFLICT (slot) DO NOTHING;

-- ============================================
-- SEED: snapshot version 1 ของ 3 slot (เพื่อ history มี baseline)
-- ============================================
INSERT INTO ai_prompt_versions (slot, version, base_text, custom_text, saved_by, notes)
SELECT slot, 1, base_text, custom_text, 'system_seed', 'Initial seed (placeholder)'
FROM ai_prompts
ON CONFLICT (slot, version) DO NOTHING;

COMMIT;
