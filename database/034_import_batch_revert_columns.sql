-- 034: Colunas de reversao em import_batches
-- O handler DELETE /api/imports/[id] espera essas colunas, mas nunca foram criadas
-- Cole no Supabase SQL Editor

ALTER TABLE import_batches
  ADD COLUMN IF NOT EXISTS reverted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reverted_by TEXT DEFAULT NULL;
