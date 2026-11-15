-- ============================================================================
-- Secretaire : Reglements, Cahier de texte, Referentiel des cours (15/11)
--
-- Decision utilisateur du 15/11. La secretaire recoit :
--   - REGLEMENTS COMPLET, comme le comptable sur cet ecran : dossiers, paiements,
--     reductions (lecture et ecriture), impayes anterieurs et mouvements
--     d'inscription (lecture), relances et attestations (lecture, envoi,
--     suppression), garde des fonctions d'argent (`fin_garde_dossier`) et
--     decision « au cas par cas » d'un depart (`decider_mouvement`).
--     RESTENT FERMES : la regle de depart (`definir_regle_ajustement`), les
--     cotisations, les depenses et recettes, l'ecriture des impayes anterieurs.
--   - CAHIER DE TEXTE comme l'encadrement : seances, devoirs, suivi des familles.
--   - REFERENTIEL DES COURS en ecriture (unites, modules, cours).
-- L'emploi du temps lui etait deja ouvert en base (creneaux, exceptions,
-- validations) : seul le menu manquait.
--
-- Chaque policy garde son ecole (`current_etablissement_id()`) : seule la liste
-- des roles change. Additif : migration d'abord, code ensuite.
-- Controle : supabase/controles/44-secretaire-ecrans.sql (21 et 22 ajustes).
-- ============================================================================

-- ── Reglements ───────────────────────────────────────────────────────────────
ALTER POLICY family_fees_select ON public.family_fees
  USING ((etablissement_id = current_etablissement_id()) AND (COALESCE(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'comptable', 'secretaire'])));
ALTER POLICY family_fees_write ON public.family_fees
  USING ((etablissement_id = current_etablissement_id()) AND (COALESCE(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'comptable', 'secretaire'])))
  WITH CHECK ((etablissement_id = current_etablissement_id()) AND (COALESCE(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'comptable', 'secretaire'])));

ALTER POLICY fee_installments_select ON public.fee_installments
  USING ((etablissement_id = current_etablissement_id()) AND (COALESCE(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'comptable', 'secretaire'])));
ALTER POLICY fee_installments_write ON public.fee_installments
  USING ((etablissement_id = current_etablissement_id()) AND (COALESCE(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'comptable', 'secretaire'])))
  WITH CHECK ((etablissement_id = current_etablissement_id()) AND (COALESCE(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'comptable', 'secretaire'])));

ALTER POLICY fee_adjustments_select ON public.fee_adjustments
  USING ((etablissement_id = current_etablissement_id()) AND (COALESCE(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'comptable', 'secretaire'])));
ALTER POLICY fee_adjustments_write ON public.fee_adjustments
  USING ((etablissement_id = current_etablissement_id()) AND (COALESCE(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'comptable', 'secretaire'])))
  WITH CHECK ((etablissement_id = current_etablissement_id()) AND (COALESCE(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'comptable', 'secretaire'])));

-- Impayes anterieurs : LECTURE seule (l'ecriture reste a admin / direction).
ALTER POLICY fyf_select ON public.family_year_finance
  USING ((etablissement_id = current_etablissement_id()) AND (COALESCE(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'comptable', 'secretaire'])));

ALTER POLICY fin_comm_select ON public.financement_communications
  USING ((etablissement_id = current_etablissement_id()) AND (COALESCE(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'comptable', 'secretaire'])));
ALTER POLICY fin_comm_insert ON public.financement_communications
  WITH CHECK ((etablissement_id = current_etablissement_id()) AND (COALESCE(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'comptable', 'secretaire'])));
ALTER POLICY fin_comm_delete ON public.financement_communications
  USING ((etablissement_id = current_etablissement_id()) AND (COALESCE(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'comptable', 'secretaire'])));

ALTER POLICY mouvements_inscription_select ON public.mouvements_inscription
  USING ((etablissement_id = current_etablissement_id()) AND (COALESCE(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'comptable', 'secretaire'])));

-- Gardes des fonctions : par ancrage sur la definition en base.
DO $patch$
DECLARE
  f text;
  v_def text;
  v_ancre text := $a$NOT IN ('admin', 'direction', 'comptable')$a$;
  v_remplacement text := $a$NOT IN ('admin', 'direction', 'comptable', 'secretaire')$a$;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.fin_garde_dossier', 'public.decider_mouvement'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_def FROM pg_proc p WHERE p.oid = f::regproc;
    v_def := replace(v_def, E'\r\n', E'\n');
    CONTINUE WHEN position(v_remplacement IN v_def) > 0;   -- deja rapiecee (rejeu)
    IF (length(v_def) - length(replace(v_def, v_ancre, ''))) / length(v_ancre) <> 1 THEN
      RAISE EXCEPTION '% : ancrage attendu une fois, la fonction a change.', f;
    END IF;
    EXECUTE replace(v_def, v_ancre, v_remplacement);
  END LOOP;
END
$patch$;

-- ── Cahier de texte ──────────────────────────────────────────────────────────
ALTER POLICY journal_staff_crud ON public.class_journal
  USING ((etablissement_id = current_etablissement_id()) AND (COALESCE(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'responsable_pedagogique', 'secretaire'])))
  WITH CHECK ((etablissement_id = current_etablissement_id()) AND (COALESCE(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'responsable_pedagogique', 'secretaire'])));
ALTER POLICY homework_staff_crud ON public.homework
  USING ((etablissement_id = current_etablissement_id()) AND (COALESCE(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'responsable_pedagogique', 'secretaire'])))
  WITH CHECK ((etablissement_id = current_etablissement_id()) AND (COALESCE(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'responsable_pedagogique', 'secretaire'])));
ALTER POLICY hwstatus_staff_select ON public.homework_status
  USING ((COALESCE(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'responsable_pedagogique', 'secretaire']))
         AND (homework_id IN (SELECT h.id FROM homework h WHERE h.etablissement_id = current_etablissement_id())));
ALTER POLICY adult_hwstatus_staff_select ON public.adult_homework_status
  USING ((COALESCE(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'responsable_pedagogique', 'secretaire']))
         AND (homework_id IN (SELECT h.id FROM homework h WHERE h.etablissement_id = current_etablissement_id())));

-- ── Referentiel des cours ────────────────────────────────────────────────────
ALTER POLICY ue_write ON public.unites_enseignement
  USING ((etablissement_id = current_etablissement_id()) AND (COALESCE(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'responsable_pedagogique', 'secretaire'])))
  WITH CHECK ((etablissement_id = current_etablissement_id()) AND (COALESCE(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'responsable_pedagogique', 'secretaire'])));
ALTER POLICY cours_modules_write ON public.cours_modules
  USING ((unite_enseignement_id IN (SELECT unites_enseignement.id FROM unites_enseignement WHERE unites_enseignement.etablissement_id = current_etablissement_id()))
         AND (COALESCE(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'responsable_pedagogique', 'secretaire'])))
  WITH CHECK ((unite_enseignement_id IN (SELECT unites_enseignement.id FROM unites_enseignement WHERE unites_enseignement.etablissement_id = current_etablissement_id()))
         AND (COALESCE(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'responsable_pedagogique', 'secretaire'])));
ALTER POLICY cours_write ON public.cours
  USING ((unite_enseignement_id IN (SELECT unites_enseignement.id FROM unites_enseignement WHERE unites_enseignement.etablissement_id = current_etablissement_id()))
         AND (COALESCE(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'responsable_pedagogique', 'secretaire'])))
  WITH CHECK ((unite_enseignement_id IN (SELECT unites_enseignement.id FROM unites_enseignement WHERE unites_enseignement.etablissement_id = current_etablissement_id()))
         AND (COALESCE(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'responsable_pedagogique', 'secretaire'])));
SELECT enregistrer_migration('secretaire-ecrans.sql', '33fc0360f578b49222d08e895a77780c8514d1d6b821c4bc45af3c87301d5248');
