-- ============================================================================
-- REGLE DE COTISATION POUR DEPART : « DUE EN TOTALITE » PAR DEFAUT (26 octobre 2026)
--
-- Decision de l'utilisateur : la regle par defaut d'un etablissement devient
-- « Due en totalite » (elle etait « Sans ajustement »).
--   1. valeur par defaut de `etablissements.regle_ajustement` = 'due' ;
--   2. les etablissements qui n'ont JAMAIS choisi leur regle
--      (`regle_ajustement_par` vide) passent a 'due' ; un choix deja fait est
--      conserve ;
--   3. le repli de `fn_mouvement_inscrire` (regle introuvable) suit.
--
-- Aucun montant existant ne change : la regle est FIGEE sur chaque depart deja
-- trace (`mouvements_inscription.regle`).
--
-- Changement ADDITIF (valeur par defaut, donnee) : migration d'abord.
-- Controle : supabase/controles/21-mouvements-inscription.sql.
-- ============================================================================

ALTER TABLE public.etablissements ALTER COLUMN regle_ajustement SET DEFAULT 'due';

UPDATE public.etablissements
   SET regle_ajustement = 'due'
 WHERE regle_ajustement_par IS NULL AND regle_ajustement = 'sans_ajustement';

CREATE OR REPLACE FUNCTION public.fn_mouvement_inscrire(
  p_student_id   uuid,
  p_parent_id    uuid,
  p_tutor_number smallint,
  p_class_id     uuid,
  p_sens         text,
  p_motif        text,
  p_date_effet   date,
  p_date_arrivee date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_classe record;
  v_annee  record;
  v_parent uuid := p_parent_id;
  v_regle  text;
  v_auteur text;
BEGIN
  IF public.fn_effacement_en_cours() THEN RETURN; END IF;

  -- Cascade de suppression : la fiche qui portait l'inscription n'existe plus.
  SELECT c.id, c.etablissement_id, c.name, c.academic_year,
         ct.id AS ct_id, ct.label AS ct_label, ct.amount, ct.registration_fee
    INTO v_classe
    FROM classes c
    LEFT JOIN cotisation_types ct ON ct.id = c.cotisation_type_id
   WHERE c.id = p_class_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF p_student_id IS NOT NULL THEN
    SELECT parent_id INTO v_parent FROM students WHERE id = p_student_id;
    IF NOT FOUND THEN RETURN; END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM parents WHERE id = p_parent_id) THEN
    RETURN;
  END IF;

  SELECT id, closed_at INTO v_annee
    FROM school_years
   WHERE etablissement_id = v_classe.etablissement_id AND label = v_classe.academic_year;
  IF FOUND AND v_annee.closed_at IS NOT NULL THEN RETURN; END IF;

  SELECT regle_ajustement INTO v_regle FROM etablissements WHERE id = v_classe.etablissement_id;

  SELECT nullif(btrim(concat_ws(' ', upper(last_name), first_name)), '') INTO v_auteur
    FROM profiles WHERE id = auth.uid();

  INSERT INTO mouvements_inscription (
    etablissement_id, school_year_id, parent_id, student_id, tutor_number, class_id,
    sens, motif, date_effet, date_arrivee, auteur_id, auteur_nom,
    classe_nom, cotisation_type_id, cotisation_libelle, cotisation_montant, frais_inscription, regle)
  VALUES (
    v_classe.etablissement_id, v_annee.id, v_parent, p_student_id, p_tutor_number, p_class_id,
    p_sens, p_motif, coalesce(p_date_effet, current_date), p_date_arrivee,
    -- `auth.uid()` est NULL depuis l'editeur SQL : l'auteur reste vide, rien n'est invente.
    (SELECT id FROM profiles WHERE id = auth.uid()), v_auteur,
    v_classe.name, v_classe.ct_id, v_classe.ct_label, v_classe.amount, v_classe.registration_fee,
    coalesce(v_regle, 'due'));
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.fn_mouvement_inscrire(uuid, uuid, smallint, uuid, text, text, date, date)
  FROM public, anon, authenticated;

SELECT enregistrer_migration('regle-ajustement-due-par-defaut.sql', '2049a66ddae32b6b36f0b0d9343b3936c94e1b8d94490b877e6644c6d2dba034');
