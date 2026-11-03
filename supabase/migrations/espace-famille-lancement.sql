-- ============================================================================
-- Espace famille, lot 7 : deux interrupteurs, colonnes de l'editeur protegees (03/11)
--
-- Decisions 17 a 20 (docs/ESPACE-FAMILLE.md).
--
-- 1. FAILLE PREEXISTANTE FERMEE. `authenticated` peut ecrire toutes les colonnes
--    de `etablissements`, et `etablissements_update` ouvre la fiche de SON ecole a
--    la direction : par un appel direct (sans ecran), une direction pouvait
--    prolonger son abonnement, changer sa limite d'inscrits, rouvrir une ecole
--    coupee ou s'activer l'option payante. Seul `est_demo` etait garde. Les
--    colonnes de l'EDITEUR ne changent plus par une requete de l'application :
--    seulement par le serveur (service role : console, effacement) ou en base.
-- 2. `espace_famille_ouvert` : l'interrupteur de l'ETABLISSEMENT (direction).
--    Jamais ouvert sans l'option : l'option ne se desactive donc pas tant que
--    l'ecole l'a ouvert (contrainte, decision 17).
-- 3. `foyer_du_compte()` et `preparer_invitation_tuteur()` exigent les DEUX.
--    La facturation suit l'option seule (decision 19) : `fn_releve_facturation`
--    inchangee.
--
-- Restrictif sur des ecritures qu'aucun ecran ne fait (verifie : seules la
-- console et l'effacement, en service role, ecrivent ces colonnes). Aucune ecole
-- reelle n'a l'option ; la demonstration est ouverte.
-- Controle : supabase/controles/43-espace-famille-lancement.sql.
-- ============================================================================

-- ── 1. Colonnes de l'editeur ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_guard_etablissement_editeur()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  -- Bloque les requetes de l'APPLICATION (jeton `authenticated` / `anon`) ; le
  -- serveur (service role) et la maintenance directe en base passent.
  IF coalesce(auth.jwt() ->> 'role', '') IN ('authenticated', 'anon')
     AND (NEW.is_active IS DISTINCT FROM OLD.is_active
          OR NEW.subscription_expires_at IS DISTINCT FROM OLD.subscription_expires_at
          OR NEW.max_students IS DISTINCT FROM OLD.max_students
          OR NEW.slug IS DISTINCT FROM OLD.slug
          OR NEW.donnees_effacees_le IS DISTINCT FROM OLD.donnees_effacees_le
          OR NEW.option_espace_famille IS DISTINCT FROM OLD.option_espace_famille) THEN
    RAISE EXCEPTION 'Ce reglage de l''etablissement se modifie depuis la console de l''editeur.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_guard_etablissement_editeur() FROM PUBLIC, anon;

CREATE TRIGGER trg_guard_etablissement_editeur
  BEFORE UPDATE ON public.etablissements
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_etablissement_editeur();

-- ── 2. Interrupteur de l'etablissement ──────────────────────────────────────
ALTER TABLE public.etablissements
  ADD COLUMN espace_famille_ouvert boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT etablissements_espace_famille_coherent
    CHECK (NOT espace_famille_ouvert OR option_espace_famille);

UPDATE public.etablissements SET espace_famille_ouvert = true WHERE est_demo AND option_espace_famille;

-- ── 3. Les deux interrupteurs exiges ────────────────────────────────────────
DO $patch$
DECLARE
  src text;
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.foyer_du_compte()'::regprocedure)
     <> '82737da963c07a55772bdc61b42f9374' THEN
    RAISE EXCEPTION 'foyer_du_compte a change : relire avant de rapiecer';
  END IF;
  src := pg_get_functiondef('public.foyer_du_compte()'::regprocedure);
  IF (length(src) - length(replace(src, 'AND e.option_espace_famille', ''))) / length('AND e.option_espace_famille') <> 1 THEN
    RAISE EXCEPTION 'foyer_du_compte : ancre introuvable ou multiple';
  END IF;
  EXECUTE replace(src, 'AND e.option_espace_famille', 'AND e.option_espace_famille AND e.espace_famille_ouvert');

  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.preparer_invitation_tuteur(uuid, smallint, uuid, text)'::regprocedure)
     <> '1d59bbec1938e706191712d5478227e0' THEN
    RAISE EXCEPTION 'preparer_invitation_tuteur a change : relire avant de rapiecer';
  END IF;
  src := pg_get_functiondef('public.preparer_invitation_tuteur(uuid, smallint, uuid, text)'::regprocedure);
  IF position('IF NOT (SELECT option_espace_famille FROM etablissements WHERE id = v_etab) THEN' IN src) = 0 THEN
    RAISE EXCEPTION 'preparer_invitation_tuteur : ancre introuvable';
  END IF;
  EXECUTE replace(src,
    'IF NOT (SELECT option_espace_famille FROM etablissements WHERE id = v_etab) THEN',
    'IF NOT (SELECT option_espace_famille AND espace_famille_ouvert FROM etablissements WHERE id = v_etab) THEN');
END
$patch$;

-- ── Verification ────────────────────────────────────────────────────────────
DO $verif$
BEGIN
  IF position('espace_famille_ouvert' IN (SELECT prosrc FROM pg_proc WHERE oid = 'public.foyer_du_compte()'::regprocedure)) = 0
     OR position('espace_famille_ouvert' IN (SELECT prosrc FROM pg_proc WHERE oid = 'public.preparer_invitation_tuteur(uuid, smallint, uuid, text)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'interrupteur de l''etablissement non exige';
  END IF;
  IF EXISTS (SELECT 1 FROM etablissements WHERE espace_famille_ouvert AND NOT option_espace_famille) THEN
    RAISE EXCEPTION 'etablissement ouvert sans l''option';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.routine_privileges
              WHERE routine_schema = 'public' AND grantee IN ('anon', 'PUBLIC')
                AND routine_name IN ('foyer_du_compte', 'preparer_invitation_tuteur', 'fn_guard_etablissement_editeur')) THEN
    RAISE EXCEPTION 'fonctions executables par anon ou PUBLIC';
  END IF;
END
$verif$;
SELECT enregistrer_migration('espace-famille-lancement.sql', '3b0fbb80feb2fe1ca3919bb9c90de0f1cf07dda2b223fc7f5eaba3cbc5da45ac');
