-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  PREUVE DES BORNAGES D'ENSEIGNANT (point 4 du plan)                      ║
-- ║  Tout est ANNULE : exception volontaire en sortie unique du bloc.        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- CE QUE LES CONTROLES PRECEDENTS NE POUVAIENT PAS PROUVER. Les 29/09 et 01/10
-- ont tous repondu « l'enseignant voit TOUT le reel » — ce qui ne distingue pas
-- « borne » de « pas borne ». La cause n'etait pas la methode : c'etait le CHOIX
-- DE L'ENSEIGNANT. On interrogeait quelqu'un qui enseignait toutes les classes
-- concernees.
--
-- La reconnaissance du 02/10 a montre trois perimetres DISJOINTS :
--     BELAID   -> ADUL-DA-BL1 + MAT-SM-BD1
--     BERRA    -> MAT-SM-BL2 seule
--     ZERROUKI -> AUCUNE classe active
-- ZERROUKI est donc le temoin decisif : si un bornage fonctionne, elle ne voit
-- RIEN ; s'il ne fonctionne pas, elle voit tout. Aucune donnee a creer.
--
-- SEULES EXCEPTIONS : `student_documents` et `student_warnings` sont VIDES. Deux
-- lignes y sont donc creees sur un eleve de BERRA — puis annulees avec le reste.
--
-- LE SCRIPT PROUVE SES PROPRES CONDITIONS avant de conclure (regle du 16/09 : un
-- test qui ne dit pas sous quelle identite il tourne ne prouve rien).

DO $ctl$
DECLARE
  r            text := E'\n';
  etab         uuid;
  u_belaid     uuid;
  u_berra      uuid;
  u_zerrouki   uuid;
  cls_berra    uuid;   -- MAT-SM-BL2
  cls_belaid   uuid;   -- MAT-SM-BD1
  eleve_berra  uuid;   -- un eleve inscrit dans MAT-SM-BL2
  periode      uuid;
  doc_id       uuid;
  warn_id      uuid;
  cat_valide   text;   -- lue dans student_documents_category_check
  sev_valide   text;   -- lue dans student_warnings_*_check
  ligne        record;
  n_reel       int;
  attendu      text;
  verdict      text;

-- Toute lecture se fait sous `authenticated` + le claim `sub` : c'est ainsi que
-- PostgREST presente un porteur de jeton, donc ce que la RLS verra pour de vrai.
BEGIN
  -- ── Reperes ──────────────────────────────────────────────────────────────
  SELECT id INTO etab FROM etablissements ORDER BY created_at LIMIT 1;
  SELECT t.user_id INTO u_belaid   FROM teachers t WHERE t.last_name ILIKE 'BELA%'   LIMIT 1;
  SELECT t.user_id INTO u_berra    FROM teachers t WHERE t.last_name ILIKE 'BERRA'   LIMIT 1;
  SELECT t.user_id INTO u_zerrouki FROM teachers t WHERE t.last_name ILIKE 'ZERROUKI' LIMIT 1;
  SELECT id INTO cls_berra  FROM classes WHERE name = 'MAT-SM-BL2' LIMIT 1;
  SELECT id INTO cls_belaid FROM classes WHERE name = 'MAT-SM-BD1' LIMIT 1;
  SELECT e.student_id INTO eleve_berra
    FROM enrollments e WHERE e.class_id = cls_berra AND e.status = 'active' LIMIT 1;
  SELECT p.id INTO periode
    FROM periods p JOIN school_years y ON y.id = p.school_year_id
   WHERE y.is_current ORDER BY p.order_index LIMIT 1;

  r := r || E'═══ CONDITIONS DU TEST (a verifier avant de lire les verdicts) ══\n';
  r := r || format('  role courant       : %s%s', current_user, E'\n');
  r := r || format('  BELAID   user_id   : %s%s', coalesce(u_belaid::text,  'INTROUVABLE'), E'\n');
  r := r || format('  BERRA    user_id   : %s%s', coalesce(u_berra::text,   'INTROUVABLE'), E'\n');
  r := r || format('  ZERROUKI user_id   : %s%s', coalesce(u_zerrouki::text,'INTROUVABLE'), E'\n');
  r := r || format('  MAT-SM-BL2 (BERRA) : %s%s', coalesce(cls_berra::text, 'INTROUVABLE'), E'\n');
  r := r || format('  eleve de BL2       : %s%s', coalesce(eleve_berra::text,'INTROUVABLE'), E'\n');
  r := r || format('  periode en cours   : %s%s', coalesce(periode::text,   'INTROUVABLE'), E'\n');

  IF u_zerrouki IS NULL OR u_berra IS NULL OR cls_berra IS NULL OR eleve_berra IS NULL THEN
    RAISE EXCEPTION '%', r || E'\n  ABANDON : un repere manque, les verdicts seraient faux.\n';
  END IF;

  -- ── Les deux tables vides recoivent une ligne, sur un eleve de BERRA ─────
  -- Creees en `postgres` : l'enseignant n'a PAS le droit d'ecrire ces tables
  -- (lot 3 du 29/09), c'est sa LECTURE qu'on eprouve.
  --
  -- LES VALEURS SONT LUES DANS LES CONTRAINTES, jamais devinees : `category`
  -- a refuse « Autre » au premier essai, et c'est exactement le piege du
  -- 16 aout — un CHECK sans rapport avec ce qu'on teste fait echouer le script,
  -- ou pire, fait passer un echec pour un succes.
  SELECT m[1] INTO cat_valide
    FROM pg_constraint c,
         LATERAL regexp_matches(pg_get_constraintdef(c.oid), '''([^'']+)''', 'g') AS m
   WHERE c.conrelid = 'student_documents'::regclass
     AND c.contype  = 'c'
     AND pg_get_constraintdef(c.oid) LIKE '%category%'
   LIMIT 1;

  SELECT m[1] INTO sev_valide
    FROM pg_constraint c,
         LATERAL regexp_matches(pg_get_constraintdef(c.oid), '''([^'']+)''', 'g') AS m
   WHERE c.conrelid = 'student_warnings'::regclass
     AND c.contype  = 'c'
     AND pg_get_constraintdef(c.oid) LIKE '%severity%'
   LIMIT 1;

  r := r || format('  categorie acceptee : %s%s', coalesce(cat_valide, '(aucun CHECK)'), E'
');
  r := r || format('  severite acceptee  : %s%s', coalesce(sev_valide, '(aucun CHECK)'), E'
');

  INSERT INTO student_documents
    (etablissement_id, student_id, doc_type_key, category, file_url, file_name)
  VALUES (etab, eleve_berra, 'test_bornage', coalesce(cat_valide, 'Autre'),
          etab || '/controle-bornage.pdf', 'controle-bornage.pdf')
  RETURNING id INTO doc_id;

  INSERT INTO student_warnings
    (etablissement_id, student_id, class_id, period_id, severity)
  VALUES (etab, eleve_berra, cls_berra, periode, coalesce(sev_valide, 'avertissement'))
  RETURNING id INTO warn_id;

  r := r || E'\n  1 document + 1 avertissement crees sur un eleve de MAT-SM-BL2\n';
  r := r || E'  (tables vides avant : sans eux, aucun bornage ne serait observable)\n';

  -- ══ MESURES ════════════════════════════════════════════════════════════
  -- Pour chaque table : le reel, puis ce que voit chaque enseignant, puis le
  -- verdict. L'attendu se LIT dans les perimetres : BERRA voit ce qui touche
  -- MAT-SM-BL2, BELAID ce qui touche ses deux classes, ZERROUKI rien.
  r := r || E'\n═══ VERDICTS ════════════════════════════════════════════════════\n';
  r := r || E'  table                     reel  BELAID  BERRA  ZERROUKI  verdict\n';

  FOR ligne IN
    SELECT * FROM (VALUES
      ('bulletin_archives',       'SELECT count(*) FROM bulletin_archives'),
      ('bulletin_appreciations',  'SELECT count(*) FROM bulletin_appreciations'),
      ('adult_bulletin_archives', 'SELECT count(*) FROM adult_bulletin_archives'),
      ('student_documents',       'SELECT count(*) FROM student_documents'),
      ('student_warnings',        'SELECT count(*) FROM student_warnings'),
      ('students',                'SELECT count(*) FROM students'),
      ('enrollments',             'SELECT count(*) FROM enrollments'),
      ('parents',                 'SELECT count(*) FROM parents'),
      ('announcements',           'SELECT count(*) FROM announcements'),
      ('announcement_recipients', 'SELECT count(*) FROM announcement_recipients')
    ) AS v(nom, req)
  LOOP
    DECLARE
      n_bel int; n_ber int; n_zer int;
    BEGIN
      RESET ROLE;
      EXECUTE ligne.req INTO n_reel;

      SET LOCAL ROLE authenticated;
      PERFORM set_config('request.jwt.claims',
                         json_build_object('sub', u_belaid, 'role', 'authenticated')::text, true);
      EXECUTE ligne.req INTO n_bel;

      PERFORM set_config('request.jwt.claims',
                         json_build_object('sub', u_berra, 'role', 'authenticated')::text, true);
      EXECUTE ligne.req INTO n_ber;

      PERFORM set_config('request.jwt.claims',
                         json_build_object('sub', u_zerrouki, 'role', 'authenticated')::text, true);
      EXECUTE ligne.req INTO n_zer;

      RESET ROLE;
      PERFORM set_config('request.jwt.claims', NULL, true);

      -- LE VERDICT TIENT A ZERROUKI. Elle n'enseigne AUCUNE classe : tout ce
      -- qu'elle voit d'une table bornee par le perimetre est un bornage qui ne
      -- mord pas. Seule exception legitime : `announcements`, ou elle doit lire
      -- les messages adresses a TOUTES les familles et ceux qu'on lui adresse.
      IF n_reel = 0 THEN
        verdict := 'table vide, non concluant';
      ELSIF ligne.nom = 'announcements' THEN
        verdict := 'a LIRE A LA MAIN (voir detail ci-dessous)';
      ELSIF n_zer = 0 AND n_ber < n_reel THEN
        verdict := 'BORNE  (temoin a 0, et BERRA ne voit pas tout)';
      ELSIF n_zer = 0 AND n_ber = n_reel THEN
        verdict := 'borne pour le temoin, mais BERRA voit tout : a regarder';
      ELSE
        verdict := '*** NON BORNE *** le temoin sans classe voit des lignes';
      END IF;

      r := r || format('  %-24s %5s %7s %6s %9s  %s%s',
                       ligne.nom, n_reel, n_bel, n_ber, n_zer, verdict, E'\n');
    END;
  END LOOP;

  -- ── Detail des bulletins : la classe de chaque ligne et le verdict de la
  --    fonction de perimetre. C'est ce qui transforme un compte en PREUVE.
  r := r || E'\n═══ DETAIL — bulletins archives, classe par classe ═══════════════\n';
  FOR ligne IN
    SELECT ba.id, c.name AS classe
      FROM bulletin_archives ba JOIN classes c ON c.id = ba.class_id
     ORDER BY c.name
  LOOP
    DECLARE
      vu_bel boolean; vu_ber boolean; vu_zer boolean;
    BEGIN
      SET LOCAL ROLE authenticated;
      PERFORM set_config('request.jwt.claims',
                         json_build_object('sub', u_belaid, 'role', 'authenticated')::text, true);
      SELECT EXISTS (SELECT 1 FROM bulletin_archives WHERE id = ligne.id) INTO vu_bel;
      PERFORM set_config('request.jwt.claims',
                         json_build_object('sub', u_berra, 'role', 'authenticated')::text, true);
      SELECT EXISTS (SELECT 1 FROM bulletin_archives WHERE id = ligne.id) INTO vu_ber;
      PERFORM set_config('request.jwt.claims',
                         json_build_object('sub', u_zerrouki, 'role', 'authenticated')::text, true);
      SELECT EXISTS (SELECT 1 FROM bulletin_archives WHERE id = ligne.id) INTO vu_zer;
      RESET ROLE;
      PERFORM set_config('request.jwt.claims', NULL, true);

      r := r || format('  %-14s BELAID:%-4s BERRA:%-4s ZERROUKI:%-4s%s',
                       ligne.classe,
                       CASE WHEN vu_bel THEN 'vu' ELSE 'non' END,
                       CASE WHEN vu_ber THEN 'vu' ELSE 'non' END,
                       CASE WHEN vu_zer THEN 'vu' ELSE 'non' END, E'\n');
    END;
  END LOOP;

  -- ── Detail des annonces : le TYPE et la classe visee. `class` doit suivre le
  --    perimetre, `all_active` est lisible par tous, `selected` est FERME a
  --    l'enseignant (decision du 01/10 : la liste nominative des destinataires
  --    est plus sensible que le message).
  r := r || E'\n═══ DETAIL — annonces, type et classe visee ══════════════════════\n';
  FOR ligne IN
    SELECT a.id,
           coalesce(to_jsonb(a) ->> 'target_type',
                    to_jsonb(a) ->> 'type',
                    to_jsonb(a) ->> 'announcement_type', '?') AS target_type,
           coalesce(
             (SELECT c.name FROM classes c
               WHERE c.id::text = coalesce(to_jsonb(a) ->> 'target_class_id',
                                           to_jsonb(a) ->> 'class_id')),
             '(aucune)') AS classe
      FROM announcements a
     ORDER BY 2, 3
  LOOP
    DECLARE
      vu_bel boolean; vu_ber boolean; vu_zer boolean;
    BEGIN
      SET LOCAL ROLE authenticated;
      PERFORM set_config('request.jwt.claims',
                         json_build_object('sub', u_belaid, 'role', 'authenticated')::text, true);
      SELECT EXISTS (SELECT 1 FROM announcements WHERE id = ligne.id) INTO vu_bel;
      PERFORM set_config('request.jwt.claims',
                         json_build_object('sub', u_berra, 'role', 'authenticated')::text, true);
      SELECT EXISTS (SELECT 1 FROM announcements WHERE id = ligne.id) INTO vu_ber;
      PERFORM set_config('request.jwt.claims',
                         json_build_object('sub', u_zerrouki, 'role', 'authenticated')::text, true);
      SELECT EXISTS (SELECT 1 FROM announcements WHERE id = ligne.id) INTO vu_zer;
      RESET ROLE;
      PERFORM set_config('request.jwt.claims', NULL, true);

      r := r || format('  %-14s %-14s BELAID:%-4s BERRA:%-4s ZERROUKI:%-4s%s',
                       ligne.target_type, ligne.classe,
                       CASE WHEN vu_bel THEN 'vu' ELSE 'non' END,
                       CASE WHEN vu_ber THEN 'vu' ELSE 'non' END,
                       CASE WHEN vu_zer THEN 'vu' ELSE 'non' END, E'\n');
    END;
  END LOOP;

  r := r || E'\n  Rien n a ete conserve : le document et l avertissement crees\n';
  r := r || E'  disparaissent avec l abandon de cette transaction.\n';

  RAISE EXCEPTION '%', r;
END
$ctl$;
