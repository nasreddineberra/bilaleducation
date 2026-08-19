-- ============================================================================
-- UN TUTEUR N'APPARAIT QU'UNE FOIS PAR ETABLISSEMENT
--
-- Regle decidee : une personne ne figure qu'une seule fois, **tous foyers et
-- tous rangs confondus**. Ni deux fois dans le meme foyer, ni dans deux foyers
-- differents, ni en tuteur 1 ici et en tuteur 2 la.
--
-- ┌─ POURQUOI UN DECLENCHEUR ET PAS UN INDEX UNIQUE ─────────────────────────┐
-- │ Aucun index ne sait exprimer cette regle. Un index unique compare une    │
-- │ colonne A ELLE-MEME d'une ligne a l'autre : il attraperait « tuteur 1 de │
-- │ A = tuteur 1 de B », jamais « tuteur 1 de A = tuteur 2 de B », et encore │
-- │ moins « tuteur 1 = tuteur 2 de la MEME ligne ».                          │
-- │                                                                          │
-- │ C'est exactement le trou du controle applicatif actuel, qui compare le   │
-- │ tuteur 1 aux seuls tuteurs 1 et le tuteur 2 aux seuls tuteurs 2 : la     │
-- │ meme personne peut aujourd'hui etre tuteur 1 du foyer A et tuteur 2 du   │
-- │ foyer B sans que rien ne le signale.                                     │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- ── CONSEQUENCES ASSUMEES (arbitrage utilisateur du 16 aout) ───────────────
--
-- Deux familles homonymes sans lien — deux « BENALI Karim » — ne pourront pas
-- coexister ; il faudra distinguer la saisie. Un parent remarie present dans
-- deux foyers sera refuse de la meme facon. Ces deux cas ont ete poses et
-- retenus : le risque de double saisie a ete juge superieur.
--
-- ── PORTEE ─────────────────────────────────────────────────────────────────
--
-- SECURITY DEFINER : sans elevation, les requetes du declencheur subissent la
-- RLS de l'appelant. Un foyer que la politique masquerait serait invisible, et
-- la garde laisserait passer le doublon — une garde qui ne voit pas tout ne
-- garde rien. Le cloisonnement est assure explicitement par le filtre sur
-- `etablissement_id`, jamais par la RLS.
--
-- Verifie avant ecriture : 31 foyers, 53 tuteurs, 0 doublon.
--
-- Idempotent.
-- ============================================================================

-- ── 1. Refus AVANT de poser la garde ───────────────────────────────────────
--
-- Un declencheur ne vaut que pour les ecritures FUTURES : des doublons deja
-- presents resteraient, invisibles et hors la regle. On les liste d'abord.

DO $$
DECLARE
  v_liste text;
BEGIN
  WITH personnes AS (
    SELECT id, etablissement_id,
           public.norm_name(tutor1_last_name) AS nom,
           public.norm_name(tutor1_first_name) AS prenom,
           tutor1_last_name || ' ' || tutor1_first_name AS affichage
    FROM public.parents
    UNION ALL
    SELECT id, etablissement_id,
           public.norm_name(tutor2_last_name),
           public.norm_name(tutor2_first_name),
           tutor2_last_name || ' ' || tutor2_first_name
    FROM public.parents
    WHERE coalesce(tutor2_last_name, '') <> '' OR coalesce(tutor2_first_name, '') <> ''
  )
  -- Sous-requete obligatoire : `string_agg` doit agreger les GROUPES, pas les
  -- lignes de chaque groupe. Ecrit d'un bloc, il rendrait une chaine PAR
  -- groupe — et `INTO` sur plusieurs lignes leverait.
  SELECT string_agg(txt, ' · ') INTO v_liste
  FROM (
    SELECT format('%s (x%s)', max(affichage), count(*)) AS txt
    FROM personnes
    GROUP BY etablissement_id, nom, prenom
    HAVING count(*) > 1
  ) d;

  IF v_liste IS NOT NULL THEN
    RAISE EXCEPTION
      'Des tuteurs en double existent deja, la garde ne peut pas etre posee. A corriger avant : %',
      v_liste;
  END IF;
END $$;

-- ── 2. La garde ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_guard_parents_unique_tutor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nom1    text := public.norm_name(NEW.tutor1_last_name);
  v_prenom1 text := public.norm_name(NEW.tutor1_first_name);
  v_nom2    text;
  v_prenom2 text;
  v_a_t2    boolean := coalesce(NEW.tutor2_last_name, '') <> ''
                    OR coalesce(NEW.tutor2_first_name, '') <> '';
  v_conflit record;
BEGIN
  IF v_a_t2 THEN
    v_nom2    := public.norm_name(NEW.tutor2_last_name);
    v_prenom2 := public.norm_name(NEW.tutor2_first_name);
  END IF;

  -- ── Cas 1 : la meme personne deux fois dans le MEME foyer ────────────────
  --
  -- Toujours une erreur de saisie, jamais une situation reelle. Se traite ici
  -- et non par une contrainte CHECK, pour porter le meme message que le reste.
  IF v_a_t2 AND v_nom2 = v_nom1 AND v_prenom2 = v_prenom1 THEN
    RAISE EXCEPTION
      'Le tuteur 2 est la meme personne que le tuteur 1 (% %). Un foyer ne peut pas porter deux fois la meme personne.',
      NEW.tutor1_last_name, NEW.tutor1_first_name
      USING ERRCODE = 'unique_violation';
  END IF;

  -- ── Cas 2 : la personne figure deja dans un autre foyer ──────────────────
  --
  -- Les quatre rapprochements sont ecrits EN CLAIR (t1 vs t1, t1 vs t2,
  -- t2 vs t1, t2 vs t2) plutot que par une valeur sentinelle : une sentinelle
  -- qui se trouverait egale a une vraie donnee produirait un faux refus, et
  -- personne ne comprendrait pourquoi.
  SELECT p.id,
         p.tutor1_last_name, p.tutor1_first_name,
         p.tutor2_last_name, p.tutor2_first_name,
         CASE
           WHEN public.norm_name(p.tutor1_last_name) = v_nom1
            AND public.norm_name(p.tutor1_first_name) = v_prenom1 THEN 1
           WHEN v_a_t2
            AND public.norm_name(p.tutor1_last_name) = v_nom2
            AND public.norm_name(p.tutor1_first_name) = v_prenom2 THEN 1
           ELSE 2
         END AS rang_existant
    INTO v_conflit
  FROM public.parents p
  WHERE p.etablissement_id = NEW.etablissement_id
    AND p.id IS DISTINCT FROM NEW.id
    AND (
         -- tuteur 1 du foyer saisi, retrouve en tuteur 1 ou en tuteur 2
         (public.norm_name(p.tutor1_last_name) = v_nom1
          AND public.norm_name(p.tutor1_first_name) = v_prenom1)
      OR (coalesce(p.tutor2_last_name, '') <> ''
          AND public.norm_name(p.tutor2_last_name) = v_nom1
          AND public.norm_name(p.tutor2_first_name) = v_prenom1)
         -- tuteur 2 du foyer saisi, retrouve en tuteur 1 ou en tuteur 2
      OR (v_a_t2
          AND public.norm_name(p.tutor1_last_name) = v_nom2
          AND public.norm_name(p.tutor1_first_name) = v_prenom2)
      OR (v_a_t2
          AND coalesce(p.tutor2_last_name, '') <> ''
          AND public.norm_name(p.tutor2_last_name) = v_nom2
          AND public.norm_name(p.tutor2_first_name) = v_prenom2)
    )
  LIMIT 1;

  IF FOUND THEN
    -- Le foyer se nomme par son tuteur 1 ; `rang_existant` dit a quelle place
    -- la personne y figure deja. Sans ce rang, un utilisateur cherchant un
    -- « BENALI Karim » en tete de fiche ne le trouverait pas et croirait le
    -- message faux.
    RAISE EXCEPTION
      'Cette personne figure deja comme tuteur % du foyer « % % ». Un tuteur ne peut appartenir qu''a un seul foyer.',
      v_conflit.rang_existant,
      v_conflit.tutor1_last_name, v_conflit.tutor1_first_name
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_guard_parents_unique_tutor() IS
  'Un tuteur ne figure qu''une fois par etablissement, tous foyers et tous rangs confondus. '
  'Un index unique ne sait pas exprimer cette regle : il ne compare qu''une colonne a elle-meme.';

DROP TRIGGER IF EXISTS trg_guard_parents_unique_tutor ON public.parents;
CREATE TRIGGER trg_guard_parents_unique_tutor
  BEFORE INSERT OR UPDATE OF
    etablissement_id,
    tutor1_last_name, tutor1_first_name,
    tutor2_last_name, tutor2_first_name
  ON public.parents
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guard_parents_unique_tutor();

SELECT 'Garde posee : un tuteur n''apparait qu''une fois par etablissement.' AS status;
