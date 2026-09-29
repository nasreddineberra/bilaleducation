-- ============================================================================
-- BILAL EDUCATION — Suppression des quatre tables MORTES du referentiel
-- ----------------------------------------------------------------------------
-- `modules`, `teaching_units`, `subjects`, `staff_hourly_rates` : ZERO usage
-- dans `src` (verifie par recherche le 29 septembre), ZERO ligne en base. Ce
-- sont les ancetres du referentiel actuel (`unites_enseignement`,
-- `cours_modules`, `cours`) et des taux horaires (`presence_type_rates`).
--
-- Meme demarche que les deux tables supprimees le 5 aout.
--
-- ── CE QUE LE RELEVE A REVELE : ELLES NE SONT PAS ISOLEES ──────────────────
--
--   evaluations.module_id  ->  modules  ->  teaching_units  ->  subjects
--
-- La premiere fleche part d'une table VIVANTE et centrale. Un `DROP TABLE
-- modules` echouerait donc, et un `DROP ... CASCADE` emporterait la colonne
-- sans qu'on l'ait decide — c'est precisement pour cela qu'on n'utilise jamais
-- CASCADE ici.
--
-- `evaluations.module_id` est une colonne MORTE vers une table morte : elle
-- n'apparait nulle part dans le code. A ne pas confondre avec
-- `evaluations.display_module_id`, qui pointe vers `cours_modules` (le
-- referentiel vivant), est renseignee sur les 8 evaluations existantes et sert
-- aux gabarits, aux bulletins et a la saisie des notes. Les deux colonnes se
-- ressemblent ; une seule est morte. La confusion aurait coute cher.
--
-- ── GARDES ─────────────────────────────────────────────────────────────────
--
-- La migration s'interrompt, en NOMMANT le probleme, si l'une des tables
-- contient des lignes ou si `evaluations.module_id` porte une valeur. Les
-- quatre sont vides aujourd'hui, mais un autre environnement pourrait ne pas
-- l'etre — et un DROP ne se defait pas.
--
-- Idempotent : chaque etape est conditionnee a l'existence de son objet.
-- ============================================================================

DO $$
DECLARE
  n bigint;
  t text;
  pleines text := '';
BEGIN
  -- 1. Aucune des quatre ne doit contenir de ligne.
  FOREACH t IN ARRAY ARRAY['modules','teaching_units','subjects','staff_hourly_rates'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      IF n > 0 THEN
        pleines := pleines || format(' %s(%s lignes)', t, n);
      END IF;
    END IF;
  END LOOP;
  IF pleines <> '' THEN
    RAISE EXCEPTION 'Tables NON VIDES :%. Rien n''a ete supprime.', pleines;
  END IF;

  -- 2. `evaluations.module_id` ne doit porter aucune valeur.
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='evaluations'
                AND column_name='module_id') THEN
    SELECT count(module_id) INTO n FROM public.evaluations;
    IF n > 0 THEN
      RAISE EXCEPTION '% evaluation(s) portent un module_id non nul : colonne conservee, rien supprime.', n;
    END IF;
    ALTER TABLE public.evaluations DROP COLUMN module_id;
    RAISE NOTICE 'evaluations.module_id supprimee (colonne morte).';
  END IF;
END $$;

-- 3. Suppression dans l'ordre des dependances, du plus dependant au moins.
--    SANS CASCADE, volontairement : si une dependance inattendue subsiste, on
--    veut un echec, pas un effet de bord silencieux.
DROP TABLE IF EXISTS public.modules;
DROP TABLE IF EXISTS public.teaching_units;
DROP TABLE IF EXISTS public.subjects;
DROP TABLE IF EXISTS public.staff_hourly_rates;

SELECT 'Quatre tables mortes supprimees, ainsi que la colonne morte evaluations.module_id.' AS status;
