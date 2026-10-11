-- ============================================================================
-- Nom de classe UNIQUE par etablissement ET par annee scolaire
--
-- AVANT : seul le formulaire controlait, cote navigateur, et sur TOUTES les annees
-- confondues — recreer `MAT-SM-BD1` a la rentree suivante aurait ete refuse, et un
-- appel direct a l'API (ou deux enregistrements simultanes) passait outre.
--
-- REGLE (decision utilisateur) : un nom est unique dans une annee, sans tenir
-- compte de la casse ni des accents ; le meme nom redevient possible l'annee
-- suivante. `norm_name()` est celle des doublons d'enseignants et d'apprenants
-- (IMMUTABLE, donc utilisable en index), alignee sur `normalizeNom` cote client.
--
-- Refuse de s'appliquer si des doublons existent deja, en les nommant.
-- Idempotent.
-- ============================================================================

DO $garde$
DECLARE v_doublons text;
BEGIN
  SELECT string_agg(format('%s (%s)', d.name, coalesce(d.academic_year, 'sans annee')), ', ')
    INTO v_doublons
    FROM (
      SELECT max(name) AS name, academic_year
        FROM classes
       GROUP BY etablissement_id, academic_year, norm_name(name)
      HAVING count(*) > 1
    ) d;
  IF v_doublons IS NOT NULL THEN
    RAISE EXCEPTION 'Classes en double dans une meme annee : %. A corriger avant la migration.', v_doublons;
  END IF;
END
$garde$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_unique_name_per_year
  ON public.classes (etablissement_id, academic_year, norm_name(name));

DO $verif$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_classes_unique_name_per_year') THEN
    RAISE EXCEPTION 'index idx_classes_unique_name_per_year non pose';
  END IF;
END
$verif$;
SELECT enregistrer_migration('add-classes-unique-name-per-year.sql', '76a2401eca3e93d12ea387af9c1b2ce24014ac9c13ec3f20d9f8a3ecab00e013');
