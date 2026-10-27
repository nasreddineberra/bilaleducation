-- ============================================================================
-- TABLES : PLUS AUCUN DROIT POUR `anon` (27 octobre 2026)
--
-- `anon` (requete SANS connexion, cle publique visible dans le site) gardait les
-- sept droits (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER) sur
-- 61 tables de `public`, defaut du projet Supabase. Seule la RLS l'arretait :
-- mesure du 27/10, 70 tables, 1 051 lignes, un anonyme en voit 0.
--
-- Le risque n'etait pas le present mais l'AVENIR : les privileges par defaut
-- ouvraient a `anon` toute table et toute sequence NOUVELLE. Une table creee un
-- jour sans RLS aurait ete lisible et modifiable depuis Internet, sans un mot.
--
--   1. Tous les droits de table et de sequence de `public` retires a `anon`.
--   2. Privileges par defaut de `postgres` (les migrations) : une table ou une
--      sequence nouvelle n'est plus ouverte a `anon`. `authenticated` et
--      `service_role` gardent les leurs (l'application ne change pas).
--
-- NON MODIFIABLE : les privileges par defaut de `supabase_admin` (« permission
-- denied to change default privileges », essai du 27/10) ; il ne cree pas les
-- tables du projet (toutes appartiennent a `postgres`). Le controle 26 repere
-- toute table qui rouvrirait un droit a `anon`.
--
-- Inventaire du code (27/10) : aucune page publique ne lit une table en anonyme
-- (middleware et logo de connexion par la cle serveur, autres parcours connectes).
-- Une requete anonyme rend desormais « permission denied » au lieu d'un resultat
-- vide. Les fonctions des regles d'acces gardent leur EXECUTE (migration du 26/10).
--
-- Restrictif mais sans code a changer. Storage (schema `storage`) non touche.
-- Controle : supabase/controles/26-anon-tables.sql.
-- ============================================================================

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES    FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

SELECT enregistrer_migration('revoke-anon-tables.sql', '0eeff7581ba3ee449a2058996e3245d05b8e554c4961c87c0f31be7141369acd');
