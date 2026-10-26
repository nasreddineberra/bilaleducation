-- ============================================================================
-- REGLE DE COTISATION POUR DEPART : APPLICATION AUX DEPARTS DEJA DECLARES (26 octobre 2026)
--
-- Jusqu'ici la regle etait FIGEE sur chaque depart (`mouvements_inscription.regle`) :
-- la modifier en cours d'annee ne valait que pour les departs suivants.
-- Decision de l'utilisateur (option B) : au changement de regle, l'ecole CHOISIT
-- de l'appliquer aussi aux departs deja declares de l'annee en cours.
--
--   1. trace de la modification sur chaque depart : `regle_initiale` (la regle du
--      jour du depart, gardee a la premiere modification), `regle_modifiee_par`,
--      `regle_modifiee_par_nom`, `regle_modifiee_le` ;
--   2. `definir_regle_ajustement(p_regle, p_retroactif)` : avec `p_retroactif`,
--      les departs (motif « depart ») des annees NON closes de l'ecole prennent la
--      nouvelle regle ; rend le nombre de departs mis a jour. Une annee close
--      n'est jamais touchee.
--
-- Une decision « au cas par cas » deja prise est CONSERVEE (colonne `decision`) :
-- elle ne compte que sous « Au cas par cas » (`regleDepart`, compute.ts) et
-- revient si l'ecole y revient. Un depart sans decision passe « a decider ».
--
-- Changement ADDITIF (colonnes, parametre a defaut) : migration d'abord. L'appel
-- actuel `definir_regle_ajustement(p_regle)` garde son comportement.
-- Controle : supabase/controles/23-regle-ajustement-retroactive.sql.
-- ============================================================================

ALTER TABLE public.mouvements_inscription
  ADD COLUMN IF NOT EXISTS regle_initiale         text,
  ADD COLUMN IF NOT EXISTS regle_modifiee_par     uuid,
  ADD COLUMN IF NOT EXISTS regle_modifiee_par_nom text,
  ADD COLUMN IF NOT EXISTS regle_modifiee_le      timestamptz;

-- Nouvelle signature (parametre ajoute, retour entier) : l'ancienne est retiree.
DROP FUNCTION IF EXISTS public.definir_regle_ajustement(text);

CREATE OR REPLACE FUNCTION public.definir_regle_ajustement(p_regle text, p_retroactif boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  n       integer;
  v_etab  uuid := current_etablissement_id();
  v_nom   text;
BEGIN
  IF coalesce(get_user_role(), '') NOT IN ('admin', 'direction', 'comptable') THEN
    RAISE EXCEPTION 'REGLE_REFUSEE' USING HINT = 'Votre role ne permet pas de modifier ce reglage.';
  END IF;
  IF p_regle NOT IN ('sans_ajustement', 'due', 'prorata', 'cas_par_cas') THEN
    RAISE EXCEPTION 'REGLE_INCONNUE';
  END IF;
  UPDATE etablissements
     SET regle_ajustement = p_regle, regle_ajustement_par = auth.uid(), regle_ajustement_le = now()
   WHERE id = v_etab;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'REGLE_REFUSEE' USING HINT = 'Etablissement introuvable.'; END IF;

  IF NOT coalesce(p_retroactif, false) THEN RETURN 0; END IF;

  SELECT nullif(btrim(concat_ws(' ', upper(last_name), first_name)), '') INTO v_nom
    FROM profiles WHERE id = auth.uid();

  UPDATE mouvements_inscription m
     SET regle_initiale         = coalesce(m.regle_initiale, m.regle),
         regle                  = p_regle,
         regle_modifiee_par     = (SELECT id FROM profiles WHERE id = auth.uid()),
         regle_modifiee_par_nom = v_nom,
         regle_modifiee_le      = now()
    FROM school_years sy
   WHERE m.etablissement_id = v_etab
     AND m.sens = 'depart' AND m.motif = 'depart'
     AND m.regle <> p_regle
     AND sy.id = m.school_year_id AND sy.closed_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.definir_regle_ajustement(text, boolean) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.definir_regle_ajustement(text, boolean) TO authenticated;

SELECT enregistrer_migration('regle-ajustement-retroactive.sql', 'e3f0bb41eb1a7ceb65d4b179f09d1a4a3b7aec0cebb9de3bed4c56f5656ae0d1');
