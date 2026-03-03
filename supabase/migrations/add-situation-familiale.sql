-- Migration : ajout situation familiale, type de garde et notes sur la table parents
-- À exécuter dans Supabase SQL Editor sur une base existante

ALTER TABLE parents
  ADD COLUMN IF NOT EXISTS situation_familiale TEXT
    CHECK (situation_familiale IN ('mariés', 'pacsés', 'union_libre', 'séparés', 'divorcés', 'veuf_veuve', 'monoparental')),
  ADD COLUMN IF NOT EXISTS type_garde TEXT
    CHECK (type_garde IN ('alternée', 'exclusive_t1', 'exclusive_t2')),
  ADD COLUMN IF NOT EXISTS notes TEXT;
