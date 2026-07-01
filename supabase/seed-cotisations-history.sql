-- ============================================================================
-- BILAL EDUCATION — Simulation d'historique (Paramètres Financiers)
-- Crée des données pour les années passées 2024-2025 et 2025-2026 :
--   • cotisation_types  -> historique de l'encadré « Types de cotisations »
--   • presence_type_rates -> historique de l'encadré « Taux horaires »
--
-- Idempotent : réexécutable (remplace les données de ces 2 années uniquement).
-- N'affecte PAS l'année en cours.
-- À exécuter dans Supabase SQL Editor.
-- ============================================================================

DO $$
DECLARE
  v_etab  uuid;
  v_2425  uuid;
  v_2526  uuid;
BEGIN
  -- 1. Établissement : celui de l'année en cours, sinon le premier
  SELECT etablissement_id INTO v_etab FROM school_years WHERE is_current LIMIT 1;
  IF v_etab IS NULL THEN
    SELECT id INTO v_etab FROM etablissements LIMIT 1;
  END IF;
  IF v_etab IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement trouvé.';
  END IF;

  -- 2. Années scolaires passées (créées si absentes, is_current = false)
  SELECT id INTO v_2425 FROM school_years
    WHERE etablissement_id = v_etab AND label = '2024-2025' LIMIT 1;
  IF v_2425 IS NULL THEN
    INSERT INTO school_years (etablissement_id, label, is_current, start_date, end_date)
    VALUES (v_etab, '2024-2025', false, '2024-09-01', '2025-08-31')
    RETURNING id INTO v_2425;
  END IF;

  SELECT id INTO v_2526 FROM school_years
    WHERE etablissement_id = v_etab AND label = '2025-2026' LIMIT 1;
  IF v_2526 IS NULL THEN
    INSERT INTO school_years (etablissement_id, label, is_current, start_date, end_date)
    VALUES (v_etab, '2025-2026', false, '2025-09-01', '2026-08-31')
    RETURNING id INTO v_2526;
  END IF;

  -- 3. Cotisations — remplacement pour ces 2 années
  DELETE FROM cotisation_types WHERE school_year_id IN (v_2425, v_2526);

  -- 2024-2025
  INSERT INTO cotisation_types
    (etablissement_id, school_year_id, label, amount, registration_fee, sibling_discount, sibling_discount_same_type, max_installments, is_adult, order_index)
  VALUES
    (v_etab, v_2425, 'MATERNELLE', 180, 30, 20, false, 3, false, 0),
    (v_etab, v_2425, 'PRIMAIRE',   200, 30, 25, false, 3, false, 1),
    (v_etab, v_2425, 'COLLÈGE',    240, 40, 30, false, 5, false, 2),
    (v_etab, v_2425, 'ADULTES',    300, 50,  0, false, 1, true,  3);

  -- 2025-2026 (montants revalorisés + un niveau supplémentaire)
  INSERT INTO cotisation_types
    (etablissement_id, school_year_id, label, amount, registration_fee, sibling_discount, sibling_discount_same_type, max_installments, is_adult, order_index)
  VALUES
    (v_etab, v_2526, 'MATERNELLE', 190, 30, 20, false, 3, false, 0),
    (v_etab, v_2526, 'PRIMAIRE',   210, 35, 25, false, 3, false, 1),
    (v_etab, v_2526, 'COLLÈGE',    250, 40, 30, true,  5, false, 2),
    (v_etab, v_2526, 'LYCÉE',      280, 45, 30, false, 5, false, 3),
    (v_etab, v_2526, 'ADULTES',    320, 50,  0, false, 1, true,  4);

  -- 4. Taux horaires — remplacement pour ces 2 années
  --    Absence forcée à 0, autres types : valeur croissante selon order_index.
  DELETE FROM presence_type_rates WHERE school_year_id IN (v_2425, v_2526);

  INSERT INTO presence_type_rates (etablissement_id, school_year_id, presence_type_id, rate)
  SELECT v_etab, v_2425, pt.id,
         CASE WHEN pt.is_absence THEN 0
              ELSE round((5.0 + pt.order_index * 2.5)::numeric, 2) END
  FROM presence_types pt
  WHERE pt.etablissement_id = v_etab AND pt.is_active;

  INSERT INTO presence_type_rates (etablissement_id, school_year_id, presence_type_id, rate)
  SELECT v_etab, v_2526, pt.id,
         CASE WHEN pt.is_absence THEN 0
              ELSE round((5.5 + pt.order_index * 2.5)::numeric, 2) END
  FROM presence_types pt
  WHERE pt.etablissement_id = v_etab AND pt.is_active;

  RAISE NOTICE 'Historique simulé créé pour 2024-2025 (%) et 2025-2026 (%) — établissement %.', v_2425, v_2526, v_etab;
END $$;
