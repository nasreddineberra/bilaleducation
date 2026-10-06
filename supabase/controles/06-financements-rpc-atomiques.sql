-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  LES RPC D'ECRITURE D'ARGENT : existent-elles, et FONCTIONNENT-ELLES ?   ║
-- ║  Tout est ANNULE : exception volontaire en sortie unique du bloc.        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- A rejouer apres `add-financement-rpc-atomiques.sql`.
--
-- POURQUOI CE CONTROLE EXISTE. La migration verifie que les fonctions sont la
-- et que `fin_statut_dossier` rend les bons verdicts. Elle ne prouve PAS que
-- les ecritures aboutissent sur les VRAIES tables — et c'etait mon risque
-- technique principal : le depot n'a plus de `schema.sql` depuis le 5 aout, je
-- n'ai donc jamais vu le type reel de `payment_method`, `payment_reference` ni
-- `status`. Les RPC s'en remettent a `jsonb_populate_record`, qui coerce
-- d'apres la table elle-meme. Ce controle est ce qui le demontre.
--
-- IDENTITE ASSUMEE, comme les controles 02 a 05 : `SET LOCAL ROLE authenticated`
-- + le claim `sub`, c'est ainsi que PostgREST presente un porteur de jeton, donc
-- ce que la RLS et `get_user_role()` verront pour de vrai. Depuis l'editeur SQL
-- il n'y a PAS de session : sans cela, `fin_garde_dossier` refuserait tout.
--
-- CHAQUE CAS DANS SON PROPRE BLOC D'EXCEPTION (regle du 16/09) : sinon la
-- premiere erreur avorte la transaction et les cas suivants ne prouvent RIEN.
-- Et chaque echec DIT SA CAUSE (`GET STACKED DIAGNOSTICS`, regle du 01/10) —
-- un controle qui transforme une panne franche en mystere ne sert personne.

DO $ctl$
DECLARE
  r          text := E'\n';
  etab       uuid;
  u_finance  uuid;
  role_fin   text;
  u_ens      uuid;
  annee      uuid;
  fee        uuid;
  fee_cree   boolean := false;
  v_subtotal numeric;   -- `subtotal` seul serait AMBIGU : c est aussi une colonne
  res        jsonb;
  adj_id     uuid;
  pay_id     uuid;
  msg        text;
  code       text;
  type_adj   text;   -- lu dans le CHECK de fee_adjustments.adjustment_type
  moyen      text;   -- lu dans le CHECK (ou l enum) de fee_installments.payment_method
  n          int;
  ligne      record;
BEGIN
  -- ── 0. Les fonctions sont-elles en place, et bien INVOKER ? ──────────────
  r := r || E'=== 0. LES FONCTIONS ===\n';
  FOR ligne IN
    SELECT p.proname,
           p.prosecdef AS definer,
           pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public' AND p.proname LIKE 'fin\_%'
     ORDER BY p.proname
  LOOP
    r := r || format('  %-26s %-34s %s%s', ligne.proname, ligne.args,
                     CASE WHEN ligne.definer THEN '*** DEFINER (anormal) ***' ELSE 'invoker' END,
                     E'\n');
  END LOOP;

  SELECT count(*) INTO n
    FROM information_schema.routine_privileges
   WHERE routine_schema = 'public' AND grantee = 'anon' AND routine_name LIKE 'fin\_%';
  r := r || format('  anon peut en executer : %s  (0 attendu)%s', n, E'\n\n');

  -- ── 1. Reperes ───────────────────────────────────────────────────────────
  SELECT id INTO etab FROM etablissements ORDER BY created_at LIMIT 1;
  SELECT id INTO annee FROM school_years WHERE is_current AND etablissement_id = etab LIMIT 1;

  -- Un compte a role FINANCE (celui qui doit pouvoir), et un enseignant (celui
  -- qui ne doit pas). On prend le comptable en priorite : c'est le profil reel
  -- de ce module.
  SELECT id, role INTO u_finance, role_fin FROM profiles
   WHERE etablissement_id = etab AND role IN ('comptable', 'direction', 'admin')
   ORDER BY CASE role WHEN 'comptable' THEN 1 WHEN 'direction' THEN 2 ELSE 3 END
   LIMIT 1;
  SELECT id INTO u_ens FROM profiles
   WHERE etablissement_id = etab AND role = 'enseignant' LIMIT 1;

  r := r || E'=== 1. CONDITIONS DU TEST (il doit les prouver, regle du 16/09) ===\n';
  r := r || format('  etablissement : %s%s', coalesce(etab::text, 'AUCUN'), E'\n');
  r := r || format('  annee en cours: %s%s', coalesce(annee::text, 'AUCUNE'), E'\n');
  r := r || format('  compte finance: %s (role %s)%s', coalesce(u_finance::text, 'AUCUN'), coalesce(role_fin, '-'), E'\n');
  r := r || format('  enseignant    : %s%s', coalesce(u_ens::text, 'AUCUN'), E'\n');

  IF u_finance IS NULL OR annee IS NULL THEN
    r := r || E'\n  *** NON CONCLUANT : pas de compte finance ou pas d annee en cours.\n';
    RAISE EXCEPTION '%', r;
  END IF;

  -- Un dossier reel de l'annee ; a defaut on en cree un (annule avec le reste).
  SELECT id, subtotal INTO fee, v_subtotal
    FROM family_fees WHERE school_year_id = annee ORDER BY created_at LIMIT 1;

  IF fee IS NULL THEN
    INSERT INTO family_fees (etablissement_id, parent_id, school_year_id,
                             subtotal, adjustments_total, total_due, num_installments, status)
    SELECT etab, p.id, annee, 300, 0, 300, 1, 'pending'
      FROM parents p WHERE p.etablissement_id = etab LIMIT 1
    RETURNING id, subtotal INTO fee, v_subtotal;
    fee_cree := true;
  END IF;

  IF fee IS NULL THEN
    r := r || E'\n  *** NON CONCLUANT : aucun dossier et aucun foyer pour en creer un.\n';
    RAISE EXCEPTION '%', r;
  END IF;

  v_subtotal := coalesce(v_subtotal, 0);
  r := r || format('  dossier       : %s%s  (subtotal %s)%s',
                   fee, CASE WHEN fee_cree THEN ' [cree pour le test]' ELSE ' [reel]' END,
                   v_subtotal, E'\n\n');

  -- LES VALEURS ACCEPTEES SE LISENT, ELLES NE S INVENTENT PAS. Un CHECK sans
  -- rapport avec ce qu on teste fait echouer le script — ou pire, fait passer un
  -- echec pour un succes (piege paye le 16/08 sur `gender`, puis le 02/10 sur
  -- `category` et `severity`). On prend la 1re valeur litterale du CHECK, et a
  -- defaut de CHECK (colonne de type enumere) la 1re etiquette de l enum.
  SELECT m[1] INTO type_adj
    FROM pg_constraint c,
         LATERAL regexp_matches(pg_get_constraintdef(c.oid), '''([^'']+)''', 'g') AS m
   WHERE c.conrelid = 'fee_adjustments'::regclass AND c.contype = 'c'
     AND pg_get_constraintdef(c.oid) LIKE '%adjustment_type%'
   LIMIT 1;

  SELECT m[1] INTO moyen
    FROM pg_constraint c,
         LATERAL regexp_matches(pg_get_constraintdef(c.oid), '''([^'']+)''', 'g') AS m
   WHERE c.conrelid = 'fee_installments'::regclass AND c.contype = 'c'
     AND pg_get_constraintdef(c.oid) LIKE '%payment_method%'
   LIMIT 1;

  IF moyen IS NULL THEN
    SELECT e.enumlabel INTO moyen
      FROM pg_type ty
      JOIN pg_enum e ON e.enumtypid = ty.oid
      JOIN pg_attribute a ON a.atttypid = ty.oid
     WHERE a.attrelid = 'fee_installments'::regclass AND a.attname = 'payment_method'
     ORDER BY e.enumsortorder LIMIT 1;
  END IF;

  r := r || format('  valeurs lues  : adjustment_type=%s  payment_method=%s%s',
                   coalesce(type_adj, '(aucun CHECK)'), coalesce(moyen, '(aucun CHECK ni enum)'), E'

');

  -- ── 2. Sous identite FINANCE : les quatre ecritures ──────────────────────
  r := r || E'=== 2. LES QUATRE ECRITURES, sous identite reelle ===\n';

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', u_finance, 'role', 'authenticated')::text, true);

  -- (a) ajouter une reduction
  BEGIN
    res := fin_ajouter_reduction(fee, v_subtotal,
             jsonb_build_object('adjustment_date', current_date,
                                'adjustment_type', type_adj,
                                'label',           'Controle 06 (annule)',
                                'amount',          -30));
    adj_id := (res -> 'reduction' ->> 'id')::uuid;
    r := r || format('  OK    ajouter_reduction     du=%s  ajust=%s  statut=%s%s',
                     res->'recap'->>'total_due', res->'recap'->>'adjustments_total',
                     res->'recap'->>'status', E'\n');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT, code = RETURNED_SQLSTATE;
    r := r || format('  ECHEC ajouter_reduction     [%s] %s%s', code, msg, E'\n');
  END;

  -- (b) enregistrer un paiement — LE CAS QUI EPROUVE LA COERCION DE TYPES
  --     (`payment_method`, `payment_reference` en jsonb, `status`).
  BEGIN
    res := fin_enregistrer_paiement(fee, v_subtotal,
             jsonb_build_object('installment_number', 99,
                                'due_date',          current_date,
                                'amount_due',        50,
                                'amount_paid',       50,
                                'paid_date',         current_date,
                                'payment_method',    moyen,
                                'payment_reference', jsonb_build_object('check_number', 'CTRL-06', 'bank', 'LCL'),
                                'receipt_number',    NULL,
                                'status',            'paid',
                                'notes',             'Controle 06 (annule)'),
             NULL);
    pay_id := (res -> 'paiement' ->> 'id')::uuid;
    r := r || format('  OK    enregistrer_paiement  du=%s  percu=%s  statut=%s%s',
                     res->'recap'->>'total_due', res->'recap'->>'total_paid',
                     res->'recap'->>'status', E'\n');
    r := r || format('        moyen relu=%s  reference relue=%s%s',
                     res->'paiement'->>'payment_method', res->'paiement'->>'payment_reference', E'\n');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT, code = RETURNED_SQLSTATE;
    r := r || format('  ECHEC enregistrer_paiement  [%s] %s%s', code, msg, E'\n');
  END;

  -- (c) modifier ce paiement
  IF pay_id IS NOT NULL THEN
    BEGIN
      res := fin_enregistrer_paiement(fee, v_subtotal,
               jsonb_build_object('installment_number', 99,
                                  'due_date',          current_date,
                                  'amount_due',        80,
                                  'amount_paid',       80,
                                  'paid_date',         current_date,
                                  'payment_method',    moyen,
                                  'payment_reference', NULL,
                                  'receipt_number',    NULL,
                                  'status',            'paid',
                                  'notes',             'Controle 06 (modifie, annule)'),
               pay_id);
      r := r || format('  OK    modifier_paiement     percu=%s  statut=%s%s',
                       res->'recap'->>'total_paid', res->'recap'->>'status', E'\n');
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT, code = RETURNED_SQLSTATE;
      r := r || format('  ECHEC modifier_paiement     [%s] %s%s', code, msg, E'\n');
    END;
  END IF;

  -- (d) supprimer le paiement, puis la reduction
  IF pay_id IS NOT NULL THEN
    BEGIN
      res := fin_supprimer_paiement(pay_id, v_subtotal);
      r := r || format('  OK    supprimer_paiement    percu=%s  statut=%s%s',
                       res->'recap'->>'total_paid', res->'recap'->>'status', E'\n');
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT, code = RETURNED_SQLSTATE;
      r := r || format('  ECHEC supprimer_paiement    [%s] %s%s', code, msg, E'\n');
    END;
  END IF;

  IF adj_id IS NOT NULL THEN
    BEGIN
      res := fin_supprimer_reduction(adj_id, v_subtotal);
      r := r || format('  OK    supprimer_reduction   du=%s  statut=%s%s',
                       res->'recap'->>'total_due', res->'recap'->>'status', E'\n');
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT, code = RETURNED_SQLSTATE;
      r := r || format('  ECHEC supprimer_reduction   [%s] %s%s', code, msg, E'\n');
    END;
  END IF;

  -- ── 3. LE CAS QUI DOIT ECHOUER ───────────────────────────────────────────
  --
  -- Sans lui, on n'aurait prouve que la moitie : un controle qui ne verifie
  -- que les succes ne distingue pas « garde en place » de « garde absente ».
  r := r || E'\n=== 3. UN ENSEIGNANT DOIT ETRE REFUSE ===\n';
  IF u_ens IS NULL THEN
    r := r || E'  non concluant : aucun enseignant dans cet etablissement.\n';
  ELSE
    PERFORM set_config('request.jwt.claims',
                       json_build_object('sub', u_ens, 'role', 'authenticated')::text, true);
    BEGIN
      res := fin_ajouter_reduction(fee, v_subtotal,
               jsonb_build_object('adjustment_date', current_date,
                                  'adjustment_type', type_adj,
                                  'label', 'NE DOIT PAS PASSER', 'amount', -10));
      r := r || E'  *** ACCEPTE — LA GARDE NE MORD PAS ***\n';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT, code = RETURNED_SQLSTATE;
      r := r || format('  OK    refuse  [%s] %s%s', code, msg, E'\n');
    END;
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);

  r := r || E'\n  Rien n a ete conserve : reduction, paiement et dossier eventuel\n';
  r := r || E'  disparaissent avec l abandon de cette transaction.\n';

  RAISE EXCEPTION '%', r;
END
$ctl$;
