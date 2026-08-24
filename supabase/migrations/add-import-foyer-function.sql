-- ============================================================================
-- IMPORT D'UN FOYER ET DE SES ENFANTS, D'UN SEUL TENANT
--
-- ┌─ POURQUOI UNE FONCTION EN BASE ──────────────────────────────────────────┐
-- │ Un foyer, c'est une ligne `parents` PLUS N lignes `students`. PostgREST   │
-- │ n'offre pas de transaction multi-requetes : creer le dossier parents puis │
-- │ echouer sur le troisieme enfant laisserait une famille incomplete, et le  │
-- │ rejeu buterait sur la garde d'unicite des tuteurs — donc sur une erreur   │
-- │ incomprehensible pour l'utilisateur, qui n'a rien fait de mal.            │
-- │                                                                           │
-- │ Une fonction est UNE transaction : tout passe, ou rien n'est ecrit.       │
-- └───────────────────────────────────────────────────────────────────────────┘
--
-- ── SECURITY INVOKER, ET C'EST DELIBERE ────────────────────────────────────
--
-- Pas de `SECURITY DEFINER` ici : la RLS doit s'appliquer, et surtout le
-- declencheur d'audit doit capter `auth.uid()`. Une fonction elevee ecrirait
-- 200 apprenants sans qu'aucun journal ne dise QUI. C'est la regle du projet
-- (« les tables s'ecrivent avec le client SESSION »), et elle vaut aussi pour
-- ce qui s'execute en base.
--
-- ── CE QUE LA FONCTION NE FAIT PAS ─────────────────────────────────────────
--
-- Elle ne DECIDE rien : le rapprochement (quel foyer existe, quel enfant est
-- deja la, quoi mettre a jour) est fait en amont et relu par l'utilisateur.
-- Ici on execute ce qui a ete coche, rien de plus.
--
-- Idempotent.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.import_foyer(
  p_foyer    jsonb,
  p_enfants  jsonb,
  p_foyer_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_etab      uuid := public.current_etablissement_id();
  v_role      text := coalesce(public.get_user_role(), '');
  v_foyer_id  uuid := p_foyer_id;
  v_cree      boolean := false;
  v_enfant    jsonb;
  v_numero    text;
  v_prefixe   text;
  v_annee     text;
  v_seq       int;
  v_numeros   text[] := '{}';
  v_max       int;
  v_actifs    int;
  v_nouveaux  int := jsonb_array_length(coalesce(p_enfants, '[]'::jsonb));
BEGIN
  IF v_etab IS NULL THEN
    RAISE EXCEPTION 'Etablissement non identifie.';
  END IF;

  -- L'ecran d'import est reserve a la direction. Le controle est REPETE ici :
  -- une garde d'ecran ne protege rien, cette fonction etant appelable par RPC.
  IF v_role NOT IN ('admin', 'direction') THEN
    RAISE EXCEPTION 'Seules la direction et l''administration peuvent importer des familles.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- ── La limite de licence s'applique a l'import comme a la saisie ─────────
  --
  -- La creation manuelle la verifie ; un import qui l'ignorerait permettrait de
  -- depasser l'abonnement par un simple fichier.
  SELECT max_students INTO v_max FROM public.etablissements WHERE id = v_etab;
  IF v_max IS NOT NULL AND v_nouveaux > 0 THEN
    SELECT count(*) INTO v_actifs
    FROM public.students WHERE etablissement_id = v_etab AND is_active;

    IF v_actifs + v_nouveaux > v_max THEN
      RAISE EXCEPTION
        'Limite de l''abonnement atteinte : % apprenants actifs, % a importer, maximum %.',
        v_actifs, v_nouveaux, v_max
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- ── 1. Le foyer ──────────────────────────────────────────────────────────
  IF v_foyer_id IS NULL THEN
    -- Colonnes ENUMEREES une par une, jamais de SQL dynamique : une cle
    -- inattendue dans le JSON ne peut pas atteindre une colonne qu'on n'a pas
    -- voulue. Verbeux, et c'est le prix de la surete.
    INSERT INTO public.parents (
      etablissement_id,
      tutor1_last_name, tutor1_first_name, tutor1_email, tutor1_phone,
      tutor1_relationship, tutor1_address, tutor1_city, tutor1_postal_code, tutor1_profession,
      tutor2_last_name, tutor2_first_name, tutor2_email, tutor2_phone,
      tutor2_relationship, tutor2_address, tutor2_city, tutor2_postal_code, tutor2_profession,
      situation_familiale
    ) VALUES (
      v_etab,
      p_foyer->>'tutor1_last_name', p_foyer->>'tutor1_first_name',
      p_foyer->>'tutor1_email', p_foyer->>'tutor1_phone',
      coalesce(p_foyer->>'tutor1_relationship', 'père'),
      p_foyer->>'tutor1_address', p_foyer->>'tutor1_city',
      p_foyer->>'tutor1_postal_code', p_foyer->>'tutor1_profession',
      p_foyer->>'tutor2_last_name', p_foyer->>'tutor2_first_name',
      p_foyer->>'tutor2_email', p_foyer->>'tutor2_phone',
      p_foyer->>'tutor2_relationship',
      p_foyer->>'tutor2_address', p_foyer->>'tutor2_city',
      p_foyer->>'tutor2_postal_code', p_foyer->>'tutor2_profession',
      p_foyer->>'situation_familiale'
    )
    RETURNING id INTO v_foyer_id;

    v_cree := true;

  ELSE
    -- ── Mise a jour ────────────────────────────────────────────────────────
    --
    -- `coalesce(nouveau, ancien)` : une cle ABSENTE du JSON, ou nulle, laisse
    -- la valeur en place. C'est la regle « une cellule vide n'efface jamais »,
    -- exprimee ici plutot que confiee au seul appelant — la fonction est
    -- appelable directement, elle doit tenir la regle elle-meme.
    --
    -- Les champs d'IDENTITE (noms des tuteurs) n'apparaissent pas : ils servent
    -- de cle de rapprochement, un import ne les renomme jamais.
    UPDATE public.parents SET
      tutor1_email        = coalesce(p_foyer->>'tutor1_email',        tutor1_email),
      tutor1_phone        = coalesce(p_foyer->>'tutor1_phone',        tutor1_phone),
      tutor1_relationship = coalesce(p_foyer->>'tutor1_relationship', tutor1_relationship),
      tutor1_address      = coalesce(p_foyer->>'tutor1_address',      tutor1_address),
      tutor1_city         = coalesce(p_foyer->>'tutor1_city',         tutor1_city),
      tutor1_postal_code  = coalesce(p_foyer->>'tutor1_postal_code',  tutor1_postal_code),
      tutor1_profession   = coalesce(p_foyer->>'tutor1_profession',   tutor1_profession),
      tutor2_email        = coalesce(p_foyer->>'tutor2_email',        tutor2_email),
      tutor2_phone        = coalesce(p_foyer->>'tutor2_phone',        tutor2_phone),
      tutor2_relationship = coalesce(p_foyer->>'tutor2_relationship', tutor2_relationship),
      tutor2_address      = coalesce(p_foyer->>'tutor2_address',      tutor2_address),
      tutor2_city         = coalesce(p_foyer->>'tutor2_city',         tutor2_city),
      tutor2_postal_code  = coalesce(p_foyer->>'tutor2_postal_code',  tutor2_postal_code),
      tutor2_profession   = coalesce(p_foyer->>'tutor2_profession',   tutor2_profession),
      situation_familiale = coalesce(p_foyer->>'situation_familiale', situation_familiale)
    WHERE id = v_foyer_id
      AND etablissement_id = v_etab;

    -- Zero ligne = foyer inexistant, ou appartenant a un autre etablissement.
    -- Sans ce controle, l'import annoncerait un succes sur une mise a jour qui
    -- n'a rien touche — le defaut deja paye sur la console super-admin.
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Foyer introuvable dans cet etablissement.';
    END IF;
  END IF;

  -- ── 2. Les enfants ───────────────────────────────────────────────────────
  IF v_nouveaux > 0 THEN
    -- Numerotation serialisee : deux imports simultanes calculeraient le meme
    -- « prochain numero ». Le verrou est pose par ETABLISSEMENT et tombe a la
    -- fin de la transaction — il ne gene aucun autre etablissement.
    PERFORM pg_advisory_xact_lock(hashtext('import_foyer:' || v_etab::text));

    v_annee   := to_char(CURRENT_DATE, 'YYYY');
    v_prefixe := 'ELV-' || to_char(CURRENT_DATE, 'YYYYMM') || '-';

    -- Le plus grand sequentiel de l'ANNEE, lu comme un NOMBRE.
    -- L'ecran de creation manuelle, lui, trie les numeros comme des CHAINES :
    -- au 1000e apprenant d'une meme annee, « …-1000 » se classerait avant
    -- « …-999 » et la numerotation repartirait en arriere. Ici on compte.
    SELECT coalesce(max(split_part(student_number, '-', 3)::int), 0)
      INTO v_seq
    FROM public.students
    WHERE etablissement_id = v_etab
      AND student_number LIKE 'ELV-' || v_annee || '%'
      AND split_part(student_number, '-', 3) ~ '^[0-9]+$';

    FOR v_enfant IN SELECT * FROM jsonb_array_elements(p_enfants)
    LOOP
      v_seq := v_seq + 1;
      v_numero := v_prefixe || lpad(v_seq::text, 3, '0');

      INSERT INTO public.students (
        etablissement_id, parent_id, student_number,
        last_name, first_name, date_of_birth, gender,
        enrollment_date, is_active,
        -- Adresse et contact d'urgence DERIVES DU TUTEUR 1, exactement comme le
        -- fait la fiche eleve, qui les recopie du tuteur choisi (tuteur 1 par
        -- defaut). L'import ne cree donc pas des fiches d'une autre forme.
        address, city, postal_code,
        emergency_contact_name, emergency_contact_phone
      )
      SELECT
        v_etab, v_foyer_id, v_numero,
        v_enfant->>'last_name', v_enfant->>'first_name',
        (v_enfant->>'date_of_birth')::date, v_enfant->>'gender',
        CURRENT_DATE, true,
        p.tutor1_address, p.tutor1_city, p.tutor1_postal_code,
        p.tutor1_last_name || ' ' || p.tutor1_first_name, p.tutor1_phone
      FROM public.parents p
      WHERE p.id = v_foyer_id;

      v_numeros := v_numeros || v_numero;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'foyer_id',      v_foyer_id,
    'foyer_cree',    v_cree,
    'enfants_crees', v_nouveaux,
    'numeros',       to_jsonb(v_numeros)
  );
END;
$$;

COMMENT ON FUNCTION public.import_foyer(jsonb, jsonb, uuid) IS
  'Ecrit un foyer et ses enfants d''un seul tenant. SECURITY INVOKER : la RLS '
  's''applique et le declencheur d''audit capte l''acteur. Les numeros d''eleve '
  'sont attribues en sequence sous verrou consultatif.';

-- Seuls les comptes authentifies peuvent l'appeler ; le controle de role est
-- dans le corps, avec un message en francais.
REVOKE ALL ON FUNCTION public.import_foyer(jsonb, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_foyer(jsonb, jsonb, uuid) TO authenticated;

SELECT 'Fonction import_foyer() posee.' AS status;
