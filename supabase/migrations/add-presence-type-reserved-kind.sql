-- ============================================================================
-- Types de presence RESERVES (absence / cours / activite).
--
-- Probleme corrige : l'EDT valide une presence en ecrivant
-- `staff_time_entries.entry_type = schedule_slots.slot_type` ('cours'|'activite'),
-- alors que le recap Temps de presence regroupe par CODE de presence_types
-- (ex. 'CRS'/'ACT'). Aucune correspondance → heures comptees mais invisibles.
-- (Confusion code / libelle a l'origine.)
--
-- Solution : colonne `reserved_kind` qui (1) marque le type comme RESERVE
-- (ni supprimable ni recodable) et (2) sert de correspondance EDT :
-- slot_type 'cours' → le type reserve 'cours' → on ecrit son VRAI code.
-- Aucune valeur en dur cote application.
--
-- Garanties apportees :
--   - les 3 types reserves existent pour CHAQUE annee (trigger idempotent) ;
--   - leurs codes sont donc toujours "pris" → non reutilisables par un autre type
--     (contrainte existante presence_types_etab_year_code_key) ;
--   - suppression / recodage interdits en base (pas seulement dans l'UI).
--
-- Idempotent.
-- ============================================================================

-- ─── 1. Colonne reserved_kind ───────────────────────────────────────────────
ALTER TABLE presence_types
  ADD COLUMN IF NOT EXISTS reserved_kind text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'presence_types_reserved_kind_check') THEN
    ALTER TABLE presence_types
      ADD CONSTRAINT presence_types_reserved_kind_check
      CHECK (reserved_kind IS NULL OR reserved_kind IN ('absence', 'cours', 'activite'));
  END IF;
END $$;

-- ─── 1 bis. Code : exactement 3 caracteres ──────────────────────────────────
-- Regle metier (AB. / CRS / ACT / MEN). Verrouille en base, pas seulement dans l'UI.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'presence_types_code_len_check') THEN
    ALTER TABLE presence_types
      ADD CONSTRAINT presence_types_code_len_check
      CHECK (char_length(code) = 3);
  END IF;
END $$;

-- ─── 2. Backfill des types existants ────────────────────────────────────────
-- Un seul type par (etablissement, annee, kind) : on ne retient que le 1er match.
WITH ranked AS (
  SELECT
    id,
    kind,
    row_number() OVER (PARTITION BY etablissement_id, school_year_id, kind
                       ORDER BY order_index, label) AS rn
  FROM (
    SELECT
      id, etablissement_id, school_year_id, order_index, label,
      CASE
        WHEN is_absence THEN 'absence'
        WHEN upper(code) = 'CRS' OR upper(label) = 'COURS' THEN 'cours'
        WHEN upper(code) = 'ACT' OR upper(label) IN ('ACTIVITÉ', 'ACTIVITE') THEN 'activite'
      END AS kind
    FROM presence_types
    WHERE reserved_kind IS NULL
  ) x
  WHERE kind IS NOT NULL
)
UPDATE presence_types p
SET reserved_kind = r.kind
FROM ranked r
WHERE p.id = r.id AND r.rn = 1 AND p.reserved_kind IS NULL;

-- ─── 3. Unicite : un seul type par role reserve et par annee ────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_presence_types_reserved_kind
  ON presence_types (etablissement_id, school_year_id, reserved_kind)
  WHERE reserved_kind IS NOT NULL;

-- ─── 4. Fonction : garantir les 3 types reserves d'une annee ────────────────
-- Idempotente : ne cree QUE ce qui manque (annees saisies a l'avance, rejeu...).
-- Reprend code / libelle / couleur de l'annee precedente de l'etablissement,
-- sinon valeurs par defaut.
CREATE OR REPLACE FUNCTION fn_ensure_reserved_presence_types(p_etab uuid, p_year uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  k    record;
  prev record;
BEGIN
  FOR k IN
    SELECT * FROM (VALUES
      ('absence',  'ABSENCE',  'AB.', '#ef4444', true,  0),
      ('cours',    'COURS',    'CRS', '#3b82f6', false, 1),
      ('activite', 'ACTIVITÉ', 'ACT', '#f97316', false, 2)
    ) AS t(kind, def_label, def_code, def_color, is_abs, ord)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM presence_types
      WHERE etablissement_id = p_etab AND school_year_id = p_year AND reserved_kind = k.kind
    ) THEN
      -- Dernier type reserve equivalent d'une autre annee du meme etablissement
      SELECT p.label, p.code, p.color, p.order_index
        INTO prev
      FROM presence_types p
      JOIN school_years sy ON sy.id = p.school_year_id
      WHERE p.etablissement_id = p_etab
        AND p.reserved_kind = k.kind
        AND p.school_year_id <> p_year
      ORDER BY sy.start_date DESC NULLS LAST
      LIMIT 1;

      INSERT INTO presence_types
        (etablissement_id, school_year_id, label, code, color, is_active, is_absence, order_index, reserved_kind)
      VALUES (
        p_etab, p_year,
        COALESCE(prev.label, k.def_label),
        COALESCE(prev.code,  k.def_code),
        COALESCE(prev.color, k.def_color),
        true, k.is_abs,
        COALESCE(prev.order_index, k.ord),
        k.kind
      );
    END IF;
  END LOOP;
END $$;

-- ─── 5. Backfill : toutes les annees existantes ─────────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, etablissement_id FROM school_years LOOP
    PERFORM fn_ensure_reserved_presence_types(r.etablissement_id, r.id);
  END LOOP;
END $$;

-- ─── 6. Trigger : toute nouvelle annee recoit les 3 types reserves ──────────
CREATE OR REPLACE FUNCTION fn_school_year_reserved_types()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM fn_ensure_reserved_presence_types(NEW.etablissement_id, NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_school_year_reserved_types ON school_years;
CREATE TRIGGER trg_school_year_reserved_types
  AFTER INSERT ON school_years
  FOR EACH ROW EXECUTE FUNCTION fn_school_year_reserved_types();

-- ─── 7. Protection : pas de suppression / recodage d'un type reserve ────────
-- NB : la garde DELETE ne s'applique que si l'annee existe encore, afin de
-- laisser passer la CASCADE (presence_types.school_year_id → ON DELETE CASCADE)
-- lors de la suppression d'une annee ou d'un etablissement.
CREATE OR REPLACE FUNCTION fn_protect_reserved_presence_types()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.reserved_kind IS NOT NULL
       AND EXISTS (SELECT 1 FROM school_years WHERE id = OLD.school_year_id) THEN
      RAISE EXCEPTION 'Type de presence reserve (%) : suppression interdite.', OLD.reserved_kind
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF OLD.reserved_kind IS NOT NULL THEN
    IF NEW.code IS DISTINCT FROM OLD.code THEN
      RAISE EXCEPTION 'Type de presence reserve (%) : le code ne peut pas etre modifie (l''historique des saisies y est rattache).', OLD.reserved_kind
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.reserved_kind IS DISTINCT FROM OLD.reserved_kind THEN
      RAISE EXCEPTION 'Type de presence reserve (%) : le role reserve ne peut pas etre modifie.', OLD.reserved_kind
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.is_absence IS DISTINCT FROM OLD.is_absence THEN
      RAISE EXCEPTION 'Type de presence reserve (%) : is_absence ne peut pas etre modifie.', OLD.reserved_kind
        USING ERRCODE = 'check_violation';
    END IF;
    -- Desactiver un type reserve le retirerait du recap Temps de presence
    -- (filtre is_active) → les heures validees depuis l'EDT deviendraient orphelines.
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Type de presence reserve (%) : ne peut pas etre desactive.', OLD.reserved_kind
        USING ERRCODE = 'check_violation';
    END IF;
    -- Seuls le libelle et la couleur restent modifiables.
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_protect_reserved_presence_types ON presence_types;
CREATE TRIGGER trg_protect_reserved_presence_types
  BEFORE UPDATE OR DELETE ON presence_types
  FOR EACH ROW EXECUTE FUNCTION fn_protect_reserved_presence_types();

SELECT 'presence_types : reserved_kind (absence/cours/activite) + reconduction annuelle + protection.' AS status;
