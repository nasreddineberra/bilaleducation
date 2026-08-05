-- ============================================================================
-- Durcissement des deux fonctions qui pilotent toute la RLS
--
-- `current_etablissement_id()` est appelée par 81 policies, `get_user_role()`
-- par des dizaines d'autres. Leur définition n'existait NULLE PART dans le
-- dépôt : la base les connaissait, le code non. Une reconstruction
-- d'environnement depuis les sources aurait échoué sur la première policy.
-- Ce fichier les verse dans le dépôt ET corrige deux défauts.
--
-- Idempotent : `CREATE OR REPLACE`, rejouable sans effet.
--
-- AUCUN changement de comportement : mêmes valeurs retournées, mêmes droits.
-- ============================================================================

-- ── 1. get_user_role() ──────────────────────────────────────────────────────
--
-- Deux corrections :
--
-- VOLATILE → STABLE. Une fonction volatile placée dans une policy est
-- réévaluée À CHAQUE LIGNE, et le planificateur ne peut ni la mettre en cache
-- ni l'inliner dans la clause. Sur une table qui grossit, c'est une requête
-- supplémentaire par ligne lue. `current_etablissement_id()` était déjà STABLE,
-- ce qui est le bon modèle : on l'aligne dessus.
--
-- plpgsql → sql. Une fonction SQL d'une seule instruction, marquée STABLE, peut
-- être INLINÉE par le planificateur directement dans la condition de la policy.
-- Un bloc plpgsql ne l'est jamais.
--
-- SET search_path. Sur une fonction SECURITY DEFINER, un search_path laissé
-- libre est le vecteur classique d'élévation de privilège : l'appelant peut
-- faire pointer un nom de table non qualifié vers un objet qu'il contrôle.
-- `pg_temp` est placé EN DERNIER pour qu'un objet temporaire ne puisse pas
-- masquer une table du schéma public.
CREATE OR REPLACE FUNCTION public.get_user_role()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $function$
  SELECT role FROM profiles WHERE id = auth.uid()
$function$;

-- ── 2. current_etablissement_id() ───────────────────────────────────────────
--
-- Déjà STABLE et correcte : on ne lui ajoute que le search_path fixe.
--
-- SECURITY DEFINER est ici INDISPENSABLE et non un confort : la fonction lit
-- `profiles`, table elle-même soumise à la RLS. Sans l'élévation, l'appel
-- depuis une policy retournerait NULL et cloisonnerait donc TOUT (aucune ligne
-- ne satisfaisant `etablissement_id = NULL`). À ne jamais retirer.
CREATE OR REPLACE FUNCTION public.current_etablissement_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $function$
  SELECT etablissement_id FROM profiles WHERE id = auth.uid()
$function$;

-- ── Vérification ────────────────────────────────────────────────────────────
-- Attendu : les deux en provolatile = 's' (stable), prosecdef = true,
-- et un proconfig contenant search_path.
--
--   select proname, provolatile, prosecdef, proconfig
--   from pg_proc
--   where proname in ('get_user_role', 'current_etablissement_id');
