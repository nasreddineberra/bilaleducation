-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  La purge refuse l annee EN COURS et une annee DEJA PURGEE                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- CE QUE LA REVUE DU 03/10 A MONTRE. `purge_school_year` se defend bien : elle
-- est SECURITY DEFINER, verifie le role avec `coalesce`, cloisonne par
-- etablissement, exige l archivage, et son execution est retiree a `public`.
-- Mais elle ne regarde PAS `is_current` — ce controle ne vit que dans la server
-- action `purgeYear`, et une RPC s appelle directement depuis le navigateur,
-- par-dessus l action.
--
-- Le scenario tient en trois gestes : une annee EN COURS peut legitimement etre
-- cloturee (conception du 09/08 : « une annee peut etre close tout en restant
-- courante »), puis archivee. A partir de la, un appel RPC direct purge l annee
-- VIVANTE — notes, absences, paiements — alors que l ecran le refuse.
--
-- Ce n est pas une elevation de privilege : il faut etre admin ou direction.
-- C est « l ecran interdit, l API autorise », le defaut que les trois lots RLS
-- d aout-septembre ont passe un mois a fermer. Et ici le prix de l erreur est
-- la base de l annee en cours.
--
-- SECOND POINT, mineur : `v_purged` etait lu puis seulement RAPPORTE
-- (`already_purged`). Une seconde purge rejouait donc tout le travail de
-- suppression. Sans degat — les lignes ne sont plus la — mais une operation
-- destructrice ne doit pas pouvoir se relancer en silence.
--
-- ── FORME : ON RAPIECE, ON NE REECRIT PAS ──────────────────────────────────
-- Recopier les 120 lignes de la fonction ecraserait SANS RIEN DIRE une derive
-- eventuelle entre la base et le depot — or la regle du projet, payee le
-- 5 aout, est que seule la base fait foi. On insere donc deux gardes dans la
-- definition REELLE, et on leve si l ancrage a bouge.

DO $maj$
DECLARE
  src   text;
  avant text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'purge_school_year';

  IF src IS NULL THEN
    RAISE EXCEPTION 'purge_school_year() est introuvable.';
  END IF;

  IF position('is_current' in src) > 0 THEN
    RAISE NOTICE 'Rien a faire : purge_school_year() regarde deja is_current.';
    RETURN;
  END IF;

  -- La fonction DOIT porter sa garde d archivage : c est l ancrage, et c est
  -- aussi la preuve qu on a bien la bonne version sous la main.
  IF position('non archivee' in src) = 0 THEN
    RAISE EXCEPTION 'purge_school_year() n a pas la forme attendue (garde d archivage absente).';
  END IF;

  avant := src;

  -- Les deux gardes se posent JUSTE APRES celle de l archivage : a cet endroit
  -- le role et le tenant sont deja verifies, et rien n a encore ete supprime.
  src := regexp_replace(
    src,
    '(RAISE EXCEPTION ''Annee % non archivee : purge interdite\.'', v_label;\s*END IF;)',
    '\1'
    || E'\n\n  -- Une annee DEJA PURGEE ne se repurge pas : une operation destructrice'
    || E'\n  -- ne doit pas pouvoir se relancer en silence.'
    || E'\n  IF v_purged IS NOT NULL THEN'
    || E'\n    RAISE EXCEPTION ''Annee % deja purgee le %.'', v_label, v_purged::date;'
    || E'\n  END IF;'
    || E'\n\n  -- L ANNEE EN COURS NE SE PURGE JAMAIS. Le controle existait dans la server'
    || E'\n  -- action `purgeYear`, mais une RPC s appelle directement depuis le navigateur :'
    || E'\n  -- sans cette ligne, une annee courante cloturee puis archivee etait purgeable'
    || E'\n  -- par-dessus l ecran, qui le refuse.'
    || E'\n  IF (SELECT is_current FROM school_years WHERE id = p_year_id) THEN'
    || E'\n    RAISE EXCEPTION ''Annee % en cours : purge interdite. Basculez d abord sur l annee suivante.'', v_label;'
    || E'\n  END IF;');

  IF src = avant THEN
    RAISE EXCEPTION 'L ancrage a bouge : rien applique.';
  END IF;
  IF position('is_current' in src) = 0 OR position('deja purgee' in src) = 0 THEN
    RAISE EXCEPTION 'Les deux gardes ne sont pas toutes posees : rien applique.';
  END IF;

  EXECUTE src;
END
$maj$;

-- ── `anon` POUVAIT APPELER LA PURGE ────────────────────────────────────────
--
-- Le controle du 03/10 a montre `anon EXECUTE` sur cette fonction, alors que la
-- migration d origine ecrit `REVOKE ALL ... FROM public`. Les deux sont vrais :
-- Supabase pose un `ALTER DEFAULT PRIVILEGES` qui accorde EXECUTE NOMMEMENT a
-- `anon`, et un REVOKE sur le pseudo-role `public` ne retire pas une concession
-- nominative.
--
-- Rien n etait exploitable — un appelant non authentifie n a pas de role, donc
-- `coalesce(get_user_role(), '')` le refuse. Mais la surface d attaque ne doit
-- pas depasser l intention : une fonction qui efface une annee entiere n a pas
-- a etre seulement APPELABLE sans etre connecte.
--
-- REGLE : apres un `REVOKE ... FROM public` sur une fonction sensible, verifier
-- `information_schema.routine_privileges` — Supabase y aura ajoute `anon`.
REVOKE EXECUTE ON FUNCTION purge_school_year(uuid) FROM anon;

-- Verification : on relit la fonction depuis le catalogue, et on s assure que
-- les gardes PREEXISTANTES sont toujours la — rapiecer ne doit rien perdre.
DO $verif$
DECLARE
  src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'purge_school_year';

  IF position('is_current' in src) = 0 THEN
    RAISE EXCEPTION 'La garde « annee en cours » est absente.';
  END IF;
  IF position('deja purgee' in src) = 0 THEN
    RAISE EXCEPTION 'La garde « deja purgee » est absente.';
  END IF;
  IF position('SECURITY DEFINER' in src) = 0
     OR position('coalesce(get_user_role()' in src) = 0
     OR position('current_etablissement_id()' in src) = 0
     OR position('non archivee' in src) = 0 THEN
    RAISE EXCEPTION 'Une garde preexistante a disparu : NE PAS EN RESTER LA.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
     WHERE routine_schema = 'public' AND routine_name = 'purge_school_year'
       AND grantee = 'anon' AND privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anon peut encore executer purge_school_year().';
  END IF;

  RAISE NOTICE 'OK : purge refusee sur l annee en cours, sur une annee deja purgee, et hors de portee d anon.';
END
$verif$;
