-- ⚠️ Rollback กลับไป schema เดิม (greet/funnel/rescue)
-- หมายเหตุ: data หาย เพราะของเก่าเป็น placeholder ทั้งหมด
-- ใช้เฉพาะกรณีต้องการ revert structure

BEGIN;
DROP TABLE IF EXISTS ai_prompt_test_log CASCADE;
DROP TABLE IF EXISTS ai_prompt_versions CASCADE;
DROP TABLE IF EXISTS ai_prompt_patches CASCADE;
DROP TABLE IF EXISTS ai_prompts CASCADE;

CREATE TABLE ai_prompts (
  slot text PRIMARY KEY,
  base_text text NOT NULL DEFAULT '',
  custom_text text NOT NULL DEFAULT '',
  current_version int NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  CONSTRAINT ai_prompts_slot_check CHECK (slot IN ('greet','funnel','rescue'))
);
-- (ตารางอื่น schema เดียวกับ Phase A)
COMMIT;
