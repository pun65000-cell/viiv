BEGIN;

DO $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM ai_prompts;
  RAISE NOTICE '[pre-drop] ai_prompts rows: %', v_count;
END $$;

DROP TABLE IF EXISTS ai_prompt_test_log CASCADE;
DROP TABLE IF EXISTS ai_prompt_versions CASCADE;
DROP TABLE IF EXISTS ai_prompt_patches CASCADE;
DROP TABLE IF EXISTS ai_prompts CASCADE;

CREATE TABLE ai_prompts (
  slot              text PRIMARY KEY,
  brain_group       text NOT NULL DEFAULT 'customer',
  base_text         text NOT NULL DEFAULT '',
  custom_text       text NOT NULL DEFAULT '',
  current_version   int NOT NULL DEFAULT 1,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        text,
  CONSTRAINT ai_prompts_slot_check CHECK (slot IN (
    'chat_bot','pos_help','autopost','analytics','fallback_customer',
    'billing_renewal','billing_invoice','slip_verify','package_lifecycle','internal_ops',
    'fallback_customer_backup','fallback_internal_backup'
  )),
  CONSTRAINT ai_prompts_group_check CHECK (brain_group IN ('customer','internal','fallback'))
);

CREATE TABLE ai_prompt_patches (
  id          text PRIMARY KEY DEFAULT ('pat_'||replace(gen_random_uuid()::text,'-','')),
  slot        text NOT NULL,
  title       text NOT NULL,
  patch_text  text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  priority    int NOT NULL DEFAULT 100,
  note        text DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  text,
  paused_at   timestamptz
);
CREATE INDEX idx_patches_slot ON ai_prompt_patches(slot, is_active, priority);

CREATE TABLE ai_prompt_versions (
  id               bigserial PRIMARY KEY,
  slot             text NOT NULL,
  version          int NOT NULL,
  base_text        text,
  custom_text      text,
  patches_snapshot jsonb DEFAULT '[]'::jsonb,
  saved_at         timestamptz NOT NULL DEFAULT now(),
  saved_by         text,
  notes            text DEFAULT '',
  UNIQUE(slot, version)
);
CREATE INDEX idx_versions_slot ON ai_prompt_versions(slot, version DESC);

CREATE TABLE ai_prompt_test_log (
  id          bigserial PRIMARY KEY,
  slot        text NOT NULL,
  test_input  text NOT NULL,
  ai_reply    text,
  shop_id     text,
  prompt_used text,
  tokens_in   int DEFAULT 0,
  tokens_out  int DEFAULT 0,
  cost_usd    numeric(10,6) DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  tested_by   text
);

INSERT INTO ai_prompts (slot, brain_group, base_text, updated_by) VALUES
  ('chat_bot',               'customer', '[TODO: chat_bot]',               'system_seed'),
  ('pos_help',               'customer', '[TODO: pos_help]',               'system_seed'),
  ('autopost',               'customer', '[TODO: autopost]',               'system_seed'),
  ('analytics',              'customer', '[TODO: analytics]',              'system_seed'),
  ('fallback_customer',      'customer', '[TODO: fallback_customer]',      'system_seed'),
  ('billing_renewal',        'internal', '[TODO: billing_renewal]',        'system_seed'),
  ('billing_invoice',        'internal', '[TODO: billing_invoice]',        'system_seed'),
  ('slip_verify',            'internal', '[TODO: slip_verify]',            'system_seed'),
  ('package_lifecycle',      'internal', '[TODO: package_lifecycle]',      'system_seed'),
  ('internal_ops',           'internal', '[TODO: internal_ops]',           'system_seed'),
  ('fallback_customer_backup','fallback','[TODO: fallback_customer_backup]','system_seed'),
  ('fallback_internal_backup','fallback','[TODO: fallback_internal_backup]','system_seed');

INSERT INTO ai_prompt_versions (slot, version, base_text, custom_text, saved_by, notes)
SELECT slot, 1, base_text, custom_text, 'system_seed', 'Initial seed v3 (3 groups)'
FROM ai_prompts;

COMMIT;
