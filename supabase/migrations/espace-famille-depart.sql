-- ============================================================================
-- Espace famille, lot 5b : invitations et depart d'une ecole (03/11)
--
-- `invitations_famille` porte `etablissement_id` : `fn_depart_tables()` la
-- classe d'office « exportee ET effacee ». Ce sont des donnees TECHNIQUES
-- (empreintes de jetons, dates) : effacees au depart, jamais remises dans
-- l'export ZIP, comme `push_subscriptions`.
--
-- Rapiecage sur la definition en base (ancre verifiee), pas de recopie.
-- Controle : supabase/controles/08-depart-ecole.sql (rejoue).
-- ============================================================================

DO $patch$
DECLARE
  src    text := pg_get_functiondef('public.fn_depart_tables()'::regprocedure);
  ancre  text := '''audit_logs'', ''etablissement_smtp'', ''push_subscriptions'', ''year_audits''),';
  nouveau text := '''audit_logs'', ''etablissement_smtp'', ''push_subscriptions'', ''year_audits'', ''invitations_famille''),';
BEGIN
  IF (length(src) - length(replace(src, ancre, ''))) / length(ancre) <> 1 THEN
    RAISE EXCEPTION 'fn_depart_tables : ancre introuvable ou multiple, relire avant de rapiecer';
  END IF;
  EXECUTE replace(src, ancre, nouveau);
END
$patch$;

DO $verif$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fn_depart_tables() WHERE nom = 'invitations_famille' AND efface AND NOT exporte) THEN
    RAISE EXCEPTION 'invitations_famille : effacee et non exportee attendu';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM fn_depart_tables() WHERE nom = 'push_subscriptions' AND efface AND NOT exporte) THEN
    RAISE EXCEPTION 'push_subscriptions : classement perdu';
  END IF;
END
$verif$;
SELECT enregistrer_migration('espace-famille-depart.sql', '02d84eb2206c4ba078122381012fa83df34bee8acb5ae45e1611b76ead4f9f0a');
