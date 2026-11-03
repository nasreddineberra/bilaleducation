-- ============================================================================
-- Espace famille : invitations ouvertes a la secretaire et au responsable
-- pedagogique (03/11)
--
-- Decision utilisateur du 03/11 : ils ont l'onglet « Parents » d'Utilisateurs
-- (option active) et y invitent, renvoient et suivent les comptes. « Desactiver »
-- / « Reactiver » restent a la direction (garde des profils inchangee).
-- `comptes_parents_ecole()` leur est donc ouverte. Rapiecage ancre.
--
-- Additive. Controle : supabase/controles/41-espace-famille-comptes-parents.sql.
-- ============================================================================

DO $patch$
DECLARE
  src    text := pg_get_functiondef('public.comptes_parents_ecole()'::regprocedure);
  ancre  text := 'NOT IN (''admin'', ''direction'') THEN';
  nouveau text := 'NOT IN (''admin'', ''direction'', ''secretaire'', ''responsable_pedagogique'') THEN';
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.comptes_parents_ecole()'::regprocedure)
     <> '14da1f8057687a7c40951c61b9fd5816'
     OR (length(src) - length(replace(src, ancre, ''))) / length(ancre) <> 1 THEN
    RAISE EXCEPTION 'comptes_parents_ecole a change : relire avant de rapiecer';
  END IF;
  EXECUTE replace(src, ancre, nouveau);
END
$patch$;

DO $verif$
BEGIN
  IF position('''secretaire'', ''responsable_pedagogique''' IN
       (SELECT prosrc FROM pg_proc WHERE oid = 'public.comptes_parents_ecole()'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'comptes_parents_ecole : roles non ouverts';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.routine_privileges
              WHERE routine_schema = 'public' AND grantee IN ('anon', 'PUBLIC')
                AND routine_name = 'comptes_parents_ecole') THEN
    RAISE EXCEPTION 'comptes_parents_ecole executable par anon ou PUBLIC';
  END IF;
END
$verif$;
SELECT enregistrer_migration('espace-famille-comptes-parents-roles.sql', '06d61b51d537017f79c5dbd0917130ecf7a60933bdbb46e6f1795939a42681b8');
