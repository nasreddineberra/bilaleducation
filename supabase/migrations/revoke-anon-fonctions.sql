-- ============================================================================
-- FONCTIONS : PLUS D'EXECUTION ANONYME (26 octobre 2026)
--
-- Une requete SANS connexion (role `anon`, cle publique visible dans le site)
-- peut appeler toute fonction de `public` sur laquelle `anon` a EXECUTE, par
-- `/rpc/<nom>`. Neuf fonctions d'ACTION ou de DONNEES l'avaient : creees avant
-- la convention « apres REVOKE ... FROM public, revoquer aussi anon », elles
-- tenaient leur droit des privileges par defaut du projet (toute fonction creee
-- dans `public` est executable par PUBLIC et par `anon`).
--
-- Aucune n'etait une faille : chacune garde son role (DEFINER) ou s'execute sous
-- la RLS de l'appelant (INVOKER). C'est la seconde barriere : une garde qui
-- sauterait un jour ne laisserait plus passer Internet.
--
--   1. EXECUTE retire a PUBLIC et a `anon` sur les neuf ; `authenticated` et
--      `service_role` gardent leur octroi explicite (l'application ne change pas,
--      aucune page publique n'appelle de fonction : inventaire du 26/10).
--   2. Privileges par defaut : une fonction creee par `postgres` (les migrations)
--      n'est plus executable par PUBLIC ni par `anon` sans octroi explicite.
--      Le retrait de PUBLIC est GLOBAL (un defaut par schema ne peut qu'ajouter
--      a la regle globale) ; `authenticated` et `service_role` restent octroyes
--      par le defaut de `public`.
--
-- GARDEES pour `anon` : les fonctions des regles d'acces (elles rendent « rien »
-- a un anonyme ; les retirer changerait un resultat vide en erreur) :
-- current_etablissement_id, get_user_role, teaches_class, teaches_parent,
-- teaches_student, est_destinataire_annonce, et les utilitaires
-- fn_effacement_en_cours, norm_name. Les fonctions d'extension ne sont pas
-- touchees.
--
-- Restrictif mais sans code a changer (aucun appel anonyme).
-- Controle : supabase/controles/25-anon-fonctions.sql.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.import_foyer(jsonb, jsonb, uuid)                  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_profile_and_parent(uuid, text, text, text, text, text, boolean, uuid, text, text, text, text, text, text, text, text, text, boolean, text, text, text, text, text, text, text, text, text, boolean, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_profile_only(uuid)                        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_user_and_parent(uuid)                     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_user_and_teacher(uuid)                    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_teacher_profile_active(uuid, boolean)         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_verified_totp_user_ids()                      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_ensure_reserved_presence_types(uuid, uuid)     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin()                                        FROM PUBLIC, anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

SELECT enregistrer_migration('revoke-anon-fonctions.sql', 'e02f65382e88f3c94116560e1ce859df58e23782324bff0e318c7e982bbfff01');
