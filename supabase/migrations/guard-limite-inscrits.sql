-- ============================================================================
-- LIMITE D'INSCRITS : controlee en base, sur la BASE FACTURABLE
--
-- Arbitrage du 7 octobre : `etablissements.max_students` sert a la fois de
-- limite d'ESSAI et de PLAFOND d'abonnement payant. Elle doit donc compter la
-- meme chose que la facturation :
--
--     base facturable = eleves actifs + adultes inscrits
--
-- ou un adulte inscrit est un tuteur coche « cours adultes ». Tuteur 1 et
-- tuteur 2 comptent SEPAREMENT : un foyer peut en compter deux.
--
-- POURQUOI EN BASE. La limite n'etait controlee que par l'ecran de creation et
-- par l'import. Reactiver un eleve (fiche, ou « Tout actif » dans la mise a
-- jour des statuts en lot) et cocher « cours adultes » la contournaient — et la
-- creation manuelle ecrit directement depuis le navigateur.
--
-- CE QUI EST CONTROLE : tout geste qui AUGMENTE la base facturable.
--   * creer un eleve actif, reactiver un eleve inactif ;
--   * cocher « cours adultes » sur un tuteur (creation ou modification).
-- Diminuer n'est JAMAIS bloque. Une ecole deja au-dessus de sa limite (limite
-- abaissee) continue de travailler ; elle ne peut simplement plus rien ajouter.
--
-- POURQUOI AFTER ET NON BEFORE. Une mise a jour en lot touche plusieurs lignes
-- en une instruction. Un declencheur AFTER ROW s'execute quand TOUTE
-- l'instruction a ete appliquee : chaque controle voit donc le total final, et
-- un refus annule l'instruction entiere — jamais un lot applique a moitie.
--
-- LE MESSAGE porte un repere stable (`HINT = 'limite_inscrits'`) et les chiffres
-- dans `DETAIL` : l'application les reformule en francais accentue
-- (`src/lib/tenant/limite-inscrits.ts`). Le texte du message reste lisible seul.
--
-- Idempotent.
-- ============================================================================

-- ── La mesure ────────────────────────────────────────────────────────────────
-- SECURITY DEFINER : le comptage doit voir TOUS les inscrits de l'ecole, quel
-- que soit le perimetre RLS de celui qui ecrit (un enseignant ne voit que ses
-- eleves ; le compte serait faux, donc la limite contournable).
CREATE OR REPLACE FUNCTION public.fn_base_facturable(p_etab uuid)
  RETURNS TABLE (eleves_actifs int, adultes_inscrits int)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
  SELECT
    (SELECT count(*)::int FROM students s
      WHERE s.etablissement_id = p_etab AND s.is_active),
    (SELECT (count(*) FILTER (WHERE p.tutor1_adult_courses)
           + count(*) FILTER (WHERE p.tutor2_adult_courses))::int
       FROM parents p
      WHERE p.etablissement_id = p_etab);
$fn$;

REVOKE ALL ON FUNCTION public.fn_base_facturable(uuid) FROM public, anon, authenticated;

-- ── Le controle ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_guard_limite_inscrits()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_hausse  boolean;
  v_max     integer;
  v_eleves  integer;
  v_adultes integer;
BEGIN
  IF NEW.etablissement_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Le geste augmente-t-il la base facturable ?
  -- OLD est lu par `to_jsonb` : sur un INSERT il n'existe pas, et une valeur
  -- absente vaut « faux » (donc toute creation cochee est une hausse).
  IF TG_TABLE_NAME = 'students' THEN
    v_hausse := NEW.is_active
                AND NOT coalesce((to_jsonb(OLD)->>'is_active')::boolean, false);
  ELSE
    v_hausse :=
         (NEW.tutor1_adult_courses AND NOT coalesce((to_jsonb(OLD)->>'tutor1_adult_courses')::boolean, false))
      OR (NEW.tutor2_adult_courses AND NOT coalesce((to_jsonb(OLD)->>'tutor2_adult_courses')::boolean, false));
  END IF;

  IF NOT v_hausse THEN
    RETURN NULL;
  END IF;

  SELECT max_students INTO v_max FROM etablissements WHERE id = NEW.etablissement_id;
  IF v_max IS NULL THEN
    RETURN NULL;  -- sans limite
  END IF;

  SELECT b.eleves_actifs, b.adultes_inscrits INTO v_eleves, v_adultes
    FROM fn_base_facturable(NEW.etablissement_id) b;

  IF v_eleves + v_adultes > v_max THEN
    RAISE EXCEPTION
      'Limite de l''abonnement atteinte : % inscrits maximum (% eleves actifs + % adultes inscrits).',
      v_max, v_eleves, v_adultes
      USING ERRCODE = 'check_violation',
            DETAIL  = format('max=%s;eleves=%s;adultes=%s', v_max, v_eleves, v_adultes),
            HINT    = 'limite_inscrits';
  END IF;

  RETURN NULL;
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_guard_limite_inscrits() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_limite_inscrits_students ON public.students;
CREATE TRIGGER trg_guard_limite_inscrits_students
  AFTER INSERT OR UPDATE OF is_active ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_limite_inscrits();

DROP TRIGGER IF EXISTS trg_guard_limite_inscrits_parents ON public.parents;
CREATE TRIGGER trg_guard_limite_inscrits_parents
  AFTER INSERT OR UPDATE OF tutor1_adult_courses, tutor2_adult_courses ON public.parents
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_limite_inscrits();

-- ── Console : la sante mesure la base facturable ─────────────────────────────
-- Elle comparait la limite a TOUS les eleves, inactifs compris. Le type de
-- retour change : il faut supprimer la fonction avant de la recreer.
DROP FUNCTION IF EXISTS public.get_etablissements_sante();

CREATE FUNCTION public.get_etablissements_sante()
  RETURNS TABLE (
    etablissement_id UUID,
    users_count      INTEGER,
    students_count   INTEGER,
    base_facturable  INTEGER,
    classes_count    INTEGER,
    last_sign_in     TIMESTAMPTZ,
    smtp_configured  BOOLEAN
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, auth, pg_temp
AS $function$
  SELECT
    e.id,
    (SELECT count(*)::int FROM profiles p
       WHERE p.etablissement_id = e.id AND p.role <> 'super_admin'),
    (SELECT count(*)::int FROM students s  WHERE s.etablissement_id = e.id),
    (SELECT b.eleves_actifs + b.adultes_inscrits FROM fn_base_facturable(e.id) b),
    (SELECT count(*)::int FROM classes  c  WHERE c.etablissement_id = e.id),
    (SELECT max(u.last_sign_in_at)
       FROM auth.users u
       JOIN profiles p2 ON p2.id = u.id
      WHERE p2.etablissement_id = e.id AND p2.role <> 'super_admin'),
    EXISTS (SELECT 1 FROM etablissement_smtp sm WHERE sm.etablissement_id = e.id)
  FROM etablissements e
$function$;

COMMENT ON FUNCTION public.get_etablissements_sante() IS
  'Sante des etablissements clients pour la console de l''editeur : effectifs, base facturable, derniere connexion et messagerie configuree. RESERVEE AU SERVICE-ROLE (droit d''execution retire aux roles de l''API) : elle lit auth.users et les donnees de tous les etablissements. Le super-admin est exclu des comptages.';

REVOKE ALL ON FUNCTION public.get_etablissements_sante() FROM public, anon, authenticated;

-- ── Verification ─────────────────────────────────────────────────────────────
DO $verif$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n FROM pg_trigger
   WHERE tgname IN ('trg_guard_limite_inscrits_students', 'trg_guard_limite_inscrits_parents')
     AND NOT tgisinternal;
  IF n <> 2 THEN RAISE EXCEPTION 'declencheurs : % sur 2', n; END IF;

  IF has_function_privilege('anon', 'public.get_etablissements_sante()', 'EXECUTE')
  OR has_function_privilege('anon', 'public.fn_base_facturable(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon peut encore executer une fonction reservee';
  END IF;

  RAISE NOTICE 'OK — 2 declencheurs poses, fonctions reservees au serveur.';
END;
$verif$;

-- Registre des migrations (voir supabase/migrations/README.md).
SELECT enregistrer_migration('guard-limite-inscrits.sql', '18ce2942bc462549dbef082c219c2f2f2e617e264803ff73062c635811633038');
