-- ============================================================================
-- BILAL EDUCATION — Passage d'annee : l'etat vit sur l'ANNEE
-- ----------------------------------------------------------------------------
-- Refonte du socle de donnees de la cloture d'annee, apres la conception
-- arretee le 9 aout 2026.
--
-- CE QUI CHANGE, ET POURQUOI
-- --------------------------
-- L'ancien modele decrivait un PROCESSUS : une ligne `year_closure` marquee
-- `in_progress`, creee au premier clic sur « Preparer l'annee suivante », et six
-- lignes `year_closure_steps` verrouillees en sequence. C'est ce modele qui a
-- produit le defaut signale : un clic creait un objet irreversible, aucune
-- action ne permettait d'abandonner, et rouvrir l'ecran replacait l'utilisateur
-- dans une cloture ouverte des semaines plus tot.
--
-- Le nouveau modele ne decrit plus un processus mais un ETAT, et cet etat
-- appartient a l'ANNEE elle-meme :
--   · les audits sont LIBRES — relancables a tout moment, meme en septembre,
--     pour connaitre l'etat des donnees saisies. Ils ne ferment rien. Relancer
--     un audit remplace son resultat : c'est ca, « annuler un audit ».
--   · la cloture devient un ACTE TERMINAL unique, pose sur `school_years`.
--
-- Il n'y a donc plus rien a « demarrer », donc plus rien a annuler.
--
-- 1. `school_years` porte l'etat : closed_at / closed_by, et les jalons
--    d'archivage et de purge qui vivaient dans l'en-tete.
-- 2. `year_audits` remplace `year_closure_steps` : le DERNIER resultat de chaque
--    audit, rattache a l'annee et non a une cloture. Ni `status`, ni verrouillage
--    sequentiel, ni `order_index` (l'ordre et le caractere bloquant vivent dans
--    le code, `src/lib/closure/steps.ts` : ce sont des regles, pas des donnees).
-- 3. `year_closure` et `year_closure_steps` disparaissent — videes de leur
--    substance, elles n'auraient plus porte qu'une redondance.
--
-- LES RESULTATS D'AUDIT NE SONT PAS LA GARDE. Ils servent l'ecran (afficher sans
-- tout recalculer) et prouvent que les six ont ete passes. Au moment de clore, on
-- RE-AUDITE cote serveur : un resultat vieux d'un mois ne doit jamais autoriser
-- une cloture.
--
-- Idempotent. A RELIRE puis executer dans Supabase SQL Editor.
-- ============================================================================

-- ─── A. L'etat de cloture rejoint l'annee ───────────────────────────────────
--
-- Sur `school_years` et non dans une table annexe : « cette annee est close » est
-- une propriete de l'annee. C'est ce qui permet de l'afficher dans sa fiche et en
-- derniere colonne de la liste sans jointure, et de fonder dessus le passage en
-- lecture seule.

ALTER TABLE school_years
  ADD COLUMN IF NOT EXISTS closed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS purged_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS purge_intent TEXT;

-- CHECK pose a part : `ADD COLUMN IF NOT EXISTS` ne rejoue pas la contrainte si
-- la colonne existe deja, et une contrainte nommee se teste, elle.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_years_purge_intent_check'
  ) THEN
    ALTER TABLE school_years
      ADD CONSTRAINT school_years_purge_intent_check
      CHECK (purge_intent IN ('purge', 'keep'));
  END IF;
END $$;

COMMENT ON COLUMN school_years.closed_at IS
  'Acte terminal de cloture. Une annee close peut rester l''annee EN COURS jusqu''a l''activation de N+1.';
COMMENT ON COLUMN school_years.archived_at IS
  'Snapshots student_year_history / family_year_finance generes. Prerequis absolu a la purge.';
COMMENT ON COLUMN school_years.purged_at IS
  'Purge effectuee : SEUL point de non-retour du cycle. Tant qu''elle n''a pas eu lieu, tout se defait.';

-- ─── B. year_audits : le dernier resultat de chaque audit ───────────────────
--
-- Une ligne par annee x audit, remplacee a chaque relance (upsert sur la cle
-- d'unicite). Aucun `closed_at` par etape : un audit ne se cloture pas, il se
-- relance.

CREATE TABLE IF NOT EXISTS year_audits (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  school_year_id   UUID NOT NULL REFERENCES school_years(id)   ON DELETE CASCADE,

  step_key         TEXT NOT NULL,   -- affectations | absences | notes | bulletins | temps_presence | financements
  anomalies_count  INT  NOT NULL DEFAULT 0,
  recap_json       JSONB NOT NULL DEFAULT '{}'::jsonb,

  audited_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  audited_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,

  UNIQUE (school_year_id, step_key)
);

COMMENT ON TABLE year_audits IS
  'Dernier resultat de chaque audit de passage d''annee. Relancable a volonte ; ne verrouille rien. La garde de cloture re-audite cote serveur, elle ne se fie pas a ces lignes.';

CREATE INDEX IF NOT EXISTS idx_year_audits_etab_year ON year_audits (etablissement_id, school_year_id);

-- PAS de trigger d'audit : ces lignes sont reecrites a chaque relance, le journal
-- se remplirait de bruit. Les evenements qui comptent (cloture, archivage, purge)
-- sont traces une fois, cote server action.

ALTER TABLE year_audits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS year_audits_all ON year_audits;
CREATE POLICY year_audits_all ON year_audits
  FOR ALL
  USING      (etablissement_id = current_etablissement_id() AND coalesce(get_user_role(), '') IN ('admin', 'direction'))
  WITH CHECK (etablissement_id = current_etablissement_id() AND coalesce(get_user_role(), '') IN ('admin', 'direction'));

-- ─── C. La purge lit et ecrit desormais sur l'annee ─────────────────────────
--
-- Seuls trois passages changent (lecture du prerequis d'archivage, ecriture de
-- `purged_at`) ; le corps destructif est repris a l'identique.

CREATE OR REPLACE FUNCTION purge_school_year(p_year_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role     text := coalesce(get_user_role(), '');
  v_etab     uuid;
  v_label    text;
  v_start    date;
  v_end      date;
  v_archived timestamptz;
  v_purged   timestamptz;
  v_periods  uuid[];
  v_classes  uuid[];
  v_paidfees uuid[];
  n_notes    int := 0;
  n_absences int := 0;
  n_fees     int := 0;
  c          int;
BEGIN
  -- Garde de role
  IF v_role NOT IN ('admin', 'direction') THEN
    RAISE EXCEPTION 'Acces refuse : purge reservee a admin/direction.' USING ERRCODE = '42501';
  END IF;

  -- Etat de l'annee et jalons de cloture : tout se lit desormais sur la meme ligne.
  SELECT etablissement_id, label, start_date, end_date, archived_at, purged_at
    INTO v_etab, v_label, v_start, v_end, v_archived, v_purged
  FROM school_years WHERE id = p_year_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Annee introuvable.';
  END IF;

  -- Cloisonnement multi-etablissement (la RPC est SECURITY DEFINER → pas de RLS) :
  -- interdit de purger l'annee d'un autre etablissement, meme via appel RPC direct.
  -- IS DISTINCT FROM couvre le cas NULL (ex. super_admin sans etablissement → refuse).
  IF v_etab IS DISTINCT FROM current_etablissement_id() THEN
    RAISE EXCEPTION 'Acces refuse : annee d''un autre etablissement.' USING ERRCODE = '42501';
  END IF;

  -- Prerequis ABSOLU : annee archivee
  IF v_archived IS NULL THEN
    RAISE EXCEPTION 'Annee % non archivee : purge interdite.', v_label;
  END IF;

  SELECT coalesce(array_agg(id), '{}') INTO v_periods FROM periods WHERE school_year_id = p_year_id;
  SELECT coalesce(array_agg(id), '{}') INTO v_classes FROM classes WHERE academic_year = v_label AND etablissement_id = v_etab;

  -- Desactivation des triggers d'audit des tables purgees (rollback si erreur : DDL transactionnel).
  ALTER TABLE family_fees          DISABLE TRIGGER audit_family_fees;
  ALTER TABLE fee_installments     DISABLE TRIGGER audit_fee_installments;
  ALTER TABLE fee_adjustments      DISABLE TRIGGER audit_fee_adjustments;
  ALTER TABLE staff_time_entries   DISABLE TRIGGER audit_staff_time_entries;
  ALTER TABLE schedule_validations DISABLE TRIGGER audit_schedule_validations;

  -- ── Notes ──
  DELETE FROM grades WHERE evaluation_id IN (SELECT id FROM evaluations WHERE period_id = ANY(v_periods));
  GET DIAGNOSTICS c = ROW_COUNT; n_notes := n_notes + c;
  DELETE FROM adult_grades WHERE evaluation_id IN (SELECT id FROM evaluations WHERE period_id = ANY(v_periods));
  GET DIAGNOSTICS c = ROW_COUNT; n_notes := n_notes + c;

  -- ── Appreciations de bulletin ──
  DELETE FROM bulletin_appreciations       WHERE period_id = ANY(v_periods);
  DELETE FROM adult_bulletin_appreciations WHERE period_id = ANY(v_periods);

  -- ── Absences ──
  DELETE FROM absences WHERE period_id = ANY(v_periods);
  GET DIAGNOSTICS n_absences = ROW_COUNT;

  -- ── Evaluations ──
  DELETE FROM evaluations WHERE period_id = ANY(v_periods);

  -- ── EDT : validations + exceptions + creneaux (scope aux creneaux de l'annee) ──
  DELETE FROM schedule_validations WHERE schedule_slot_id IN (SELECT id FROM schedule_slots WHERE school_year_id = p_year_id);
  DELETE FROM schedule_exceptions  WHERE schedule_slot_id IN (SELECT id FROM schedule_slots WHERE school_year_id = p_year_id);
  DELETE FROM schedule_slots       WHERE school_year_id = p_year_id;

  -- ── Temps de presence (etablissement + plage de dates de l'annee) ──
  IF v_start IS NOT NULL AND v_end IS NOT NULL THEN
    DELETE FROM staff_time_entries WHERE etablissement_id = v_etab AND entry_date BETWEEN v_start AND v_end;
  END IF;

  -- ── Cahier de texte (homework cascade homework_status + adult_homework_status) ──
  DELETE FROM homework      WHERE class_id = ANY(v_classes);
  DELETE FROM class_journal WHERE class_id = ANY(v_classes);

  -- ── Finance : foyers SOLDES uniquement (impayes conserves, vifs) ──
  -- Critere = RESTE RECALCULE (du - percu) <= 0, et NON le libelle `status`
  -- (denormalise, risque de desync → une dette marquee 'paid' a tort serait
  -- effacee). Tolerance centimes (0.005) : dans le doute, on NE supprime pas.
  SELECT coalesce(array_agg(ff.id), '{}')
    INTO v_paidfees
  FROM family_fees ff
  WHERE ff.school_year_id = p_year_id
    AND ff.total_due - coalesce(
          (SELECT sum(fi.amount_paid) FROM fee_installments fi WHERE fi.family_fee_id = ff.id), 0
        ) <= 0.005;

  DELETE FROM fee_installments WHERE family_fee_id = ANY(v_paidfees);
  DELETE FROM fee_adjustments  WHERE family_fee_id = ANY(v_paidfees);
  DELETE FROM family_fees      WHERE id = ANY(v_paidfees);
  GET DIAGNOSTICS n_fees = ROW_COUNT;

  -- Reactivation des triggers d'audit
  ALTER TABLE family_fees          ENABLE TRIGGER audit_family_fees;
  ALTER TABLE fee_installments     ENABLE TRIGGER audit_fee_installments;
  ALTER TABLE fee_adjustments      ENABLE TRIGGER audit_fee_adjustments;
  ALTER TABLE staff_time_entries   ENABLE TRIGGER audit_staff_time_entries;
  ALTER TABLE schedule_validations ENABLE TRIGGER audit_schedule_validations;

  UPDATE school_years SET purged_at = now() WHERE id = p_year_id;

  RETURN jsonb_build_object(
    'label', v_label,
    'notes', n_notes,
    'absences', n_absences,
    'fees_paid', n_fees,
    'already_purged', (v_purged IS NOT NULL)
  );
END;
$$;

REVOKE ALL ON FUNCTION purge_school_year(uuid) FROM public;
GRANT EXECUTE ON FUNCTION purge_school_year(uuid) TO authenticated;

-- ─── D. Retrait des tables du modele « processus » ──────────────────────────
--
-- GARDE : on refuse de supprimer une table qui contient encore des lignes. Ici
-- les quatre tables ont ete verifiees vides avant ecriture de cette migration,
-- mais un autre environnement pourrait porter une cloture reelle — la migration
-- doit alors s'arreter et non effacer.
--
-- DROP sans CASCADE, volontairement : s'il reste une dependance inconnue, il vaut
-- mieux echouer que l'emporter en silence. L'ordre (etapes puis en-tete) suit la
-- cle etrangere.

DO $$
DECLARE
  n bigint;
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['year_closure_steps', 'year_closure'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM %I', t) INTO n;
      IF n > 0 THEN
        RAISE EXCEPTION 'Table % non vide (% ligne(s)) : migration interrompue. Traitez ces clotures avant de rejouer.', t, n;
      END IF;
      EXECUTE format('DROP TABLE %I', t);
      RAISE NOTICE 'Table % supprimee.', t;
    END IF;
  END LOOP;
END $$;

SELECT 'Passage d''annee : etat porte par school_years, audits libres dans year_audits, year_closure(_steps) supprimees.' AS status;
