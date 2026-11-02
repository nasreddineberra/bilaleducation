-- ============================================================================
-- Historisation avant purge et bilan financier annuel (02/11)
--
-- La purge de fin d'annee ne gardait qu'une condition : annee archivee. Ni
-- archive COMPLETE, ni archive A JOUR : un paiement saisi apres l'archivage
-- etait efface sans trace, et le Temps de presence (heures ET cout du personnel)
-- disparaissait sans qu'aucun bilan de l'annee n'ait ete etabli.
--
-- CETTE MIGRATION :
--   1. `bilans_financiers` : une ligne ecole x annee, chiffres FIGES a
--      l'archivage (calcul de l'application, `lib/financements/bilan.ts`), plus
--      le RELEVE des donnees de l'annee pris au meme instant (`comptages`).
--   2. `class_year_history.cahier_texte` : resume fige du cahier de texte de la
--      classe (seances et devoirs), affiche dans l'Historique des classes.
--   3. `releve_historisation(annee)` : comptage des donnees que la purge efface
--      ou que le bilan resume. Pris a l'archivage, compare avant la purge : une
--      SUPPRESSION posterieure a l'archivage se voit aussi (une date ne la
--      montrerait pas).
--   4. `verifier_historisation(annee)` : liste des manques, vide si la purge peut
--      passer.
--   5. `purge_school_year` REFUSE tant que la liste n'est pas vide (meme
--      transaction). Rapiecage sur la definition en base, ancre verifiee.
--
-- Additif : aucune annee n'est archivee au 02/11 (aucune ecole), la garde ne
-- bloque donc rien d'existant. Une annee archivee AVANT le deploiement du code
-- n'aurait pas de bilan : la purge la refuserait (sens sur), il suffirait de
-- relancer l'archivage.
-- ============================================================================

-- ── 1. Bilan financier fige ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bilans_financiers (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  etablissement_id UUID NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  school_year_id   UUID REFERENCES public.school_years(id) ON DELETE SET NULL,
  year_label       TEXT NOT NULL,                  -- fige (survit a une suppression d'annee)
  chiffres         JSONB NOT NULL,                 -- forme : `BilanChiffres` (src/types/json.ts)
  comptages        JSONB NOT NULL,                 -- `releve_historisation` a l'archivage
  etabli_le        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  etabli_par       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  etabli_par_nom   TEXT,                           -- fige (survit au compte)
  UNIQUE (etablissement_id, school_year_id)
);

ALTER TABLE public.bilans_financiers ENABLE ROW LEVEL SECURITY;

-- Lecture : le trio Financements (menu « Bilans annuels »).
DROP POLICY IF EXISTS bilans_select ON public.bilans_financiers;
CREATE POLICY bilans_select ON public.bilans_financiers FOR SELECT
  USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'comptable')
  );

-- Ecriture : admin / direction (c'est l'archivage).
DROP POLICY IF EXISTS bilans_write ON public.bilans_financiers;
CREATE POLICY bilans_write ON public.bilans_financiers FOR ALL
  USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') IN ('admin', 'direction')
  )
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') IN ('admin', 'direction')
  );

-- ── 2. Cahier de texte dans l'historique des classes ────────────────────────
-- [{date, titre, contenu, devoirs: [{titre, rendu, consigne}]}] + devoirs sans seance.
ALTER TABLE public.class_year_history
  ADD COLUMN IF NOT EXISTS cahier_texte JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ── 3. Releve des donnees de l'annee ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.releve_historisation(p_year_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_role    text := coalesce(get_user_role(), '');
  v_etab    uuid;
  v_label   text;
  v_start   date;
  v_end     date;
  v_periods uuid[];
  v_classes uuid[];
BEGIN
  IF v_role NOT IN ('admin', 'direction') THEN
    RAISE EXCEPTION 'Acces refuse.' USING ERRCODE = '42501';
  END IF;
  SELECT etablissement_id, label, start_date, end_date INTO v_etab, v_label, v_start, v_end
    FROM school_years WHERE id = p_year_id;
  IF NOT FOUND OR v_etab IS DISTINCT FROM current_etablissement_id() THEN
    RAISE EXCEPTION 'Annee introuvable.' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(array_agg(id), '{}') INTO v_periods FROM periods WHERE school_year_id = p_year_id;
  SELECT coalesce(array_agg(id), '{}') INTO v_classes FROM classes WHERE academic_year = v_label AND etablissement_id = v_etab;

  RETURN jsonb_build_object(
    'dossiers',    (SELECT count(*) FROM family_fees WHERE school_year_id = p_year_id),
    'paiements',   (SELECT count(*) FROM fee_installments fi JOIN family_fees ff ON ff.id = fi.family_fee_id WHERE ff.school_year_id = p_year_id),
    'ajustements', (SELECT count(*) FROM fee_adjustments fa JOIN family_fees ff ON ff.id = fa.family_fee_id WHERE ff.school_year_id = p_year_id),
    'depenses',    (SELECT count(*) FROM expenses WHERE school_year_id = p_year_id),
    'revenus',     (SELECT count(*) FROM other_revenues WHERE school_year_id = p_year_id),
    'presences',   (SELECT count(*) FROM staff_time_entries WHERE etablissement_id = v_etab AND entry_date BETWEEN v_start AND v_end),
    'seances',     (SELECT count(*) FROM class_journal WHERE class_id = ANY(v_classes)),
    'devoirs',     (SELECT count(*) FROM homework WHERE class_id = ANY(v_classes)),
    'decisions',   (SELECT count(*) FROM absences_enseignants_seances aes JOIN schedule_slots ss ON ss.id = aes.schedule_slot_id WHERE ss.school_year_id = p_year_id),
    'notes',       (SELECT count(*) FROM grades g JOIN evaluations e ON e.id = g.evaluation_id WHERE e.period_id = ANY(v_periods) OR e.class_id = ANY(v_classes)),
    'notes_adultes', (SELECT count(*) FROM adult_grades g JOIN evaluations e ON e.id = g.evaluation_id WHERE e.period_id = ANY(v_periods) OR e.class_id = ANY(v_classes))
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.releve_historisation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.releve_historisation(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.releve_historisation(uuid) TO authenticated;

-- ── 4. Verification avant purge ─────────────────────────────────────────────
-- Rend [{code, libelle, nombre}] ; vide = tout ce que la purge efface est historise.
CREATE OR REPLACE FUNCTION public.verifier_historisation(p_year_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_role     text := coalesce(get_user_role(), '');
  v_etab     uuid;
  v_label    text;
  v_start    date;
  v_end      date;
  v_archived timestamptz;
  v_periods  uuid[];
  v_classes  uuid[];
  v_releve   jsonb;
  v_avant    jsonb;
  v_cle      text;
  v_manques  jsonb := '[]'::jsonb;
  n          bigint;

  -- Libelle d'un ecart de releve, par cle de `releve_historisation`.
  v_libelles jsonb := jsonb_build_object(
    'dossiers', 'dossiers de reglement', 'paiements', 'paiements', 'ajustements', 'ajustements',
    'depenses', 'depenses', 'revenus', 'autres revenus', 'presences', 'saisies de Temps de presence',
    'seances', 'seances du cahier de texte', 'devoirs', 'devoirs', 'decisions', 'decisions d absence',
    'notes', 'notes', 'notes_adultes', 'notes des adultes');
BEGIN
  IF v_role NOT IN ('admin', 'direction') THEN
    RAISE EXCEPTION 'Acces refuse.' USING ERRCODE = '42501';
  END IF;
  SELECT etablissement_id, label, start_date, end_date, archived_at
    INTO v_etab, v_label, v_start, v_end, v_archived
    FROM school_years WHERE id = p_year_id;
  IF NOT FOUND OR v_etab IS DISTINCT FROM current_etablissement_id() THEN
    RAISE EXCEPTION 'Annee introuvable.' USING ERRCODE = '42501';
  END IF;

  IF v_archived IS NULL THEN
    RETURN jsonb_build_array(jsonb_build_object('code', 'archive', 'libelle', 'Annee non archivee', 'nombre', 1));
  END IF;

  SELECT coalesce(array_agg(id), '{}') INTO v_periods FROM periods WHERE school_year_id = p_year_id;
  SELECT coalesce(array_agg(id), '{}') INTO v_classes FROM classes WHERE academic_year = v_label AND etablissement_id = v_etab;

  -- Participants sans ligne d'historique (meme filtre que l'archivage : actifs, ou partis).
  SELECT count(*) INTO n
    FROM enrollments en JOIN students s ON s.id = en.student_id
   WHERE en.class_id = ANY(v_classes)
     AND (en.status = 'withdrawn' OR (en.status = 'active' AND s.is_active))
     AND NOT EXISTS (SELECT 1 FROM student_year_history h
                      WHERE h.school_year_id = p_year_id AND h.student_id = en.student_id);
  IF n > 0 THEN
    v_manques := v_manques || jsonb_build_object('code', 'eleves', 'libelle', 'Eleves sans historique', 'nombre', n);
  END IF;

  SELECT count(*) INTO n
    FROM parent_class_enrollments pce
    JOIN classes c ON c.id = pce.class_id
    JOIN cotisation_types ct ON ct.id = c.cotisation_type_id AND ct.is_adult
   WHERE pce.class_id = ANY(v_classes) AND pce.status IN ('active', 'withdrawn')
     AND NOT EXISTS (SELECT 1 FROM student_year_history h
                      WHERE h.school_year_id = p_year_id AND h.parent_id = pce.parent_id
                        AND h.tutor_number = pce.tutor_number);
  IF n > 0 THEN
    v_manques := v_manques || jsonb_build_object('code', 'adultes', 'libelle', 'Adultes sans historique', 'nombre', n);
  END IF;

  -- Participant note sur une periode, sans bulletin archive de cette periode.
  SELECT count(*) INTO n FROM (
    SELECT DISTINCT g.student_id, e.period_id
      FROM grades g JOIN evaluations e ON e.id = g.evaluation_id
     WHERE e.period_id = ANY(v_periods) AND (g.score IS NOT NULL OR g.is_absent)
       AND NOT EXISTS (SELECT 1 FROM bulletin_archives b
                        WHERE b.student_id = g.student_id AND b.period_id = e.period_id)
  ) x;
  IF n > 0 THEN
    v_manques := v_manques || jsonb_build_object('code', 'bulletins', 'libelle', 'Bulletins d eleves non archives', 'nombre', n);
  END IF;

  SELECT count(*) INTO n FROM (
    SELECT DISTINCT g.parent_id, g.tutor_number, e.period_id
      FROM adult_grades g JOIN evaluations e ON e.id = g.evaluation_id
     WHERE e.period_id = ANY(v_periods) AND (g.score IS NOT NULL OR g.is_absent)
       AND NOT EXISTS (SELECT 1 FROM adult_bulletin_archives b
                        WHERE b.parent_id = g.parent_id AND b.tutor_number = g.tutor_number
                          AND b.period_id = e.period_id)
  ) x;
  IF n > 0 THEN
    v_manques := v_manques || jsonb_build_object('code', 'bulletins_adultes', 'libelle', 'Bulletins d adultes non archives', 'nombre', n);
  END IF;

  -- Foyer SOLDE (que la purge efface, meme critere qu'elle) absent de l'historique financier.
  SELECT count(*) INTO n
    FROM family_fees ff
   WHERE ff.school_year_id = p_year_id
     AND ff.total_due - coalesce((SELECT sum(fi.amount_paid) FROM fee_installments fi WHERE fi.family_fee_id = ff.id), 0) <= 0.005
     AND NOT EXISTS (SELECT 1 FROM family_year_finance f
                      WHERE f.school_year_id = p_year_id AND f.parent_id = ff.parent_id);
  IF n > 0 THEN
    v_manques := v_manques || jsonb_build_object('code', 'foyers', 'libelle', 'Foyers soldes sans historique financier', 'nombre', n);
  END IF;

  -- Classe sans ligne d'historique.
  SELECT count(*) INTO n
    FROM unnest(v_classes) AS c(id)
   WHERE NOT EXISTS (SELECT 1 FROM class_year_history h
                      WHERE h.school_year_id = p_year_id AND h.class_id = c.id);
  IF n > 0 THEN
    v_manques := v_manques || jsonb_build_object('code', 'classes', 'libelle', 'Classes sans historique', 'nombre', n);
  END IF;

  -- Bilan financier.
  SELECT comptages INTO v_avant FROM bilans_financiers
   WHERE etablissement_id = v_etab AND school_year_id = p_year_id;
  IF NOT FOUND THEN
    v_manques := v_manques || jsonb_build_object('code', 'bilan', 'libelle', 'Bilan financier non etabli', 'nombre', 1);
  ELSE
    -- Ajout ou SUPPRESSION depuis l'archivage : le releve a change.
    v_releve := releve_historisation(p_year_id);
    FOR v_cle IN SELECT jsonb_object_keys(v_releve) LOOP
      IF (v_avant->>v_cle) IS DISTINCT FROM (v_releve->>v_cle) THEN
        v_manques := v_manques || jsonb_build_object(
          'code', 'releve_' || v_cle,
          'libelle', 'Nombre de ' || coalesce(v_libelles->>v_cle, v_cle) || ' change depuis l archivage',
          'nombre', abs(coalesce((v_releve->>v_cle)::bigint, 0) - coalesce((v_avant->>v_cle)::bigint, 0)));
      END IF;
    END LOOP;
  END IF;

  -- Modification posterieure a l'archivage (le releve ne voit pas une modification).
  SELECT
      (SELECT count(*) FROM family_fees ff WHERE ff.school_year_id = p_year_id AND ff.updated_at > v_archived)
    + (SELECT count(*) FROM fee_installments fi JOIN family_fees ff ON ff.id = fi.family_fee_id
        WHERE ff.school_year_id = p_year_id AND fi.updated_at > v_archived)
    + (SELECT count(*) FROM fee_adjustments fa JOIN family_fees ff ON ff.id = fa.family_fee_id
        WHERE ff.school_year_id = p_year_id AND fa.created_at > v_archived)
    + (SELECT count(*) FROM expenses WHERE school_year_id = p_year_id AND updated_at > v_archived)
    + (SELECT count(*) FROM other_revenues WHERE school_year_id = p_year_id AND updated_at > v_archived)
    INTO n;
  IF n > 0 THEN
    v_manques := v_manques || jsonb_build_object('code', 'finance_modifiee', 'libelle', 'Donnees financieres modifiees depuis l archivage', 'nombre', n);
  END IF;

  SELECT count(*) INTO n FROM staff_time_entries
   WHERE etablissement_id = v_etab AND entry_date BETWEEN v_start AND v_end AND updated_at > v_archived;
  IF n > 0 THEN
    v_manques := v_manques || jsonb_build_object('code', 'presences_modifiees', 'libelle', 'Temps de presence modifie depuis l archivage', 'nombre', n);
  END IF;

  SELECT (SELECT count(*) FROM class_journal WHERE class_id = ANY(v_classes) AND updated_at > v_archived)
       + (SELECT count(*) FROM homework WHERE class_id = ANY(v_classes) AND updated_at > v_archived)
    INTO n;
  IF n > 0 THEN
    v_manques := v_manques || jsonb_build_object('code', 'cahier_modifie', 'libelle', 'Cahier de texte modifie depuis l archivage', 'nombre', n);
  END IF;

  SELECT count(*) INTO n
    FROM absences_enseignants_seances aes JOIN schedule_slots ss ON ss.id = aes.schedule_slot_id
   WHERE ss.school_year_id = p_year_id AND aes.decide_le > v_archived;
  IF n > 0 THEN
    v_manques := v_manques || jsonb_build_object('code', 'decisions_modifiees', 'libelle', 'Decisions d absence modifiees depuis l archivage', 'nombre', n);
  END IF;

  RETURN v_manques;
END;
$fn$;

REVOKE ALL ON FUNCTION public.verifier_historisation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verifier_historisation(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.verifier_historisation(uuid) TO authenticated;

-- ── 5. La purge refuse une historisation incomplete ─────────────────────────
-- Rapiecage de la definition EN BASE (README, § 5) : la garde s'insere juste
-- avant la lecture des periodes, apres toutes les gardes existantes.
DO $maj$
DECLARE
  src    text;
  ancre  text := E'  SELECT coalesce(array_agg(id), ''{}'') INTO v_periods FROM periods WHERE school_year_id = p_year_id;';
  garde  text := E'  -- HISTORISATION COMPLETE ET A JOUR (verifier_historisation, 02/11) : la purge\n'
              || E'  -- est le seul point de non-retour, rien ne part qui ne soit historise.\n'
              || E'  IF jsonb_array_length(verifier_historisation(p_year_id)) > 0 THEN\n'
              || E'    RAISE EXCEPTION ''Annee % : historisation incomplete (%). Relancez l archivage. Purge refusee.'',\n'
              || E'      v_label, (SELECT string_agg(m->>''libelle'', '' ; '') FROM jsonb_array_elements(verifier_historisation(p_year_id)) m);\n'
              || E'  END IF;\n\n';
BEGIN
  src := pg_get_functiondef('public.purge_school_year(uuid)'::regprocedure);
  IF position('verifier_historisation' IN src) > 0 THEN
    RAISE NOTICE 'purge_school_year appelle deja verifier_historisation.';
    RETURN;
  END IF;
  IF (length(src) - length(replace(src, ancre, ''))) / length(ancre) <> 1 THEN
    RAISE EXCEPTION 'purge_school_year : ancre absente ou multiple, rapiecage refuse.';
  END IF;
  EXECUTE replace(src, ancre, garde || ancre);
END
$maj$;

-- ── Verification ────────────────────────────────────────────────────────────
DO $verif$
DECLARE
  src text := pg_get_functiondef('public.purge_school_year(uuid)'::regprocedure);
BEGIN
  IF (SELECT count(*) FROM pg_policies WHERE tablename = 'bilans_financiers') <> 2 THEN
    RAISE EXCEPTION 'policies de bilans_financiers non posees';
  END IF;
  IF position('verifier_historisation' IN src) = 0 THEN
    RAISE EXCEPTION 'purge_school_year sans verifier_historisation';
  END IF;
  -- Gardes preexistantes conservees.
  IF position('non archivee' IN src) = 0 OR position('deja purgee' IN src) = 0
     OR position('is_current' IN src) = 0 OR position('current_etablissement_id()' IN src) = 0 THEN
    RAISE EXCEPTION 'purge_school_year a perdu une garde';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.routine_privileges
              WHERE routine_schema = 'public' AND grantee IN ('anon', 'PUBLIC')
                AND routine_name IN ('releve_historisation', 'verifier_historisation')) THEN
    RAISE EXCEPTION 'releve / verifier_historisation executables par anon ou PUBLIC';
  END IF;
END
$verif$;

SELECT enregistrer_migration('historisation-avant-purge.sql', '16f25a516cfb6521a1875116de38eeb0657148f92d583ad8018be9dda836661f');
