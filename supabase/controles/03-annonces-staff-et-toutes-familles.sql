-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  LES DEUX POINTS QUE LE CONTROLE 02 A LAISSES OUVERTS                    ║
-- ║  Tout est ANNULE : exception volontaire en sortie unique du bloc.        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Le controle 02 a PROUVE les trois bornages (bulletins, documents/discipline,
-- annonces de classe). Il a laisse deux questions sans reponse.
--
-- 1. ZERROUKI NE VOIT AUCUNE DES TROIS ANNONCES `staff`. Deux lectures
--    possibles, et elles sont opposees :
--      · elle n'en est pas destinataire  -> NORMAL, la lecture suit le
--        destinataire et non le role (regle du 01/10) ;
--      · elle en est destinataire        -> DEFAUT GRAVE : sa cloche serait
--        vide, et c'est precisement le piege signale le 01/10 (« fermer cette
--        table a l'enseignant n'aurait pas retire un ecran, sa cloche se serait
--        videe »).
--    On ne peut pas trancher par un compte : il faut regarder QUI est
--    destinataire de QUOI.
--
-- 2. AUCUNE ANNONCE « TOUTES LES FAMILLES » N'EXISTE EN BASE. Les 7 annonces
--    sont 3 `class`, 1 `selected`, 3 `staff`. La branche « l'enseignant lit les
--    messages adresses a toutes les familles » n'est donc pas observable — elle
--    est creee ici, puis annulee.

DO $ctl$
DECLARE
  r          text := E'\n';
  etab       uuid;
  u_belaid   uuid;
  u_berra    uuid;
  u_zerrouki uuid;
  ann_id     uuid;
  ligne      record;
  vu_bel     boolean;
  vu_ber     boolean;
  vu_zer     boolean;
  vu_ligne   boolean;   -- le destinataire voit-il SA ligne (ce que lit la cloche) ?
  vu_message boolean;   -- et le message lui-meme ?
  col_type   text;      -- nom reel de la colonne de type sur `announcements`
  def_check  text;
  n          int;
BEGIN
  SELECT id INTO etab FROM etablissements ORDER BY created_at LIMIT 1;
  SELECT user_id INTO u_belaid   FROM teachers WHERE last_name ILIKE 'BELA%'    LIMIT 1;
  SELECT user_id INTO u_berra    FROM teachers WHERE last_name ILIKE 'BERRA'    LIMIT 1;
  SELECT user_id INTO u_zerrouki FROM teachers WHERE last_name ILIKE 'ZERROUKI' LIMIT 1;

  r := r || format('  role courant : %s%s', current_user, E'\n');

  -- ══ 1. QUI EST DESTINATAIRE DE QUOI ════════════════════════════════════
  -- Si ZERROUKI n'apparait dans aucune ligne, son zero du controle 02 est
  -- normal. Si elle y apparait sans voir l'annonce, sa cloche est cassee.
  r := r || E'\n═══ 1. DESTINATAIRES DES ANNONCES « equipe » ════════════════════\n';
  SELECT count(*) INTO n FROM announcement_staff_recipients;
  r := r || format('  %s ligne(s) dans announcement_staff_recipients%s', n, E'\n');

  FOR ligne IN
    SELECT asr.id, asr.announcement_id,
           a.title,
           p.last_name || ' ' || p.first_name AS destinataire,
           p.role,
           asr.profile_id
      FROM announcement_staff_recipients asr
      JOIN announcements a ON a.id = asr.announcement_id
      LEFT JOIN profiles p ON p.id = asr.profile_id
     ORDER BY a.created_at, p.last_name
  LOOP
    -- Voit-il SA PROPRE ligne de destinataire ? C'est ce que la cloche lit.
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims',
                       json_build_object('sub', ligne.profile_id, 'role', 'authenticated')::text, true);
    SELECT EXISTS (SELECT 1 FROM announcement_staff_recipients WHERE id = ligne.id) INTO vu_ligne;
    SELECT EXISTS (SELECT 1 FROM announcements WHERE id = ligne.announcement_id) INTO vu_message;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', NULL, true);

    r := r || format('  %-26s %-22s ligne:%-4s message:%-4s %s%s',
                     coalesce(ligne.destinataire, '(profil introuvable)'),
                     left(coalesce(ligne.title, ''), 22),
                     CASE WHEN vu_ligne   THEN 'vue' ELSE 'NON' END,
                     CASE WHEN vu_message THEN 'vu'  ELSE 'NON' END,
                     CASE WHEN vu_ligne AND vu_message THEN '' ELSE '  <<< CLOCHE CASSEE' END,
                     E'\n');
  END LOOP;

  -- ZERROUKI est-elle destinataire de quoi que ce soit ?
  SELECT count(*) INTO n
    FROM announcement_staff_recipients WHERE profile_id = u_zerrouki;
  r := r || format('%s  ZERROUKI est destinataire de %s message(s) interne(s).%s',
                   E'\n', n, E'\n');
  IF n = 0 THEN
    r := r || E'  -> son zero du controle 02 est NORMAL : la lecture suit le\n';
    r := r || E'     destinataire, pas le role. Rien a corriger.\n';
  ELSE
    r := r || E'  -> a comparer avec la colonne « ligne/message » ci-dessus : si\n';
    r := r || E'     elle ne les voit pas, sa cloche est vide a tort.\n';
  END IF;

  -- ══ 2. UNE ANNONCE A TOUTES LES FAMILLES ═══════════════════════════════
  -- Elle doit etre lisible par TOUT enseignant, y compris celui qui n'a aucune
  -- classe : il est concerne comme toute l'ecole (decision du 01/10). En
  -- revanche la LISTE de ses destinataires lui reste fermee — c'est elle qui
  -- transforme « l'ecole a ecrit » en « ces familles-la ont un probleme ».
  r := r || E'\n═══ 2. ANNONCE « toutes les familles » (creee puis annulee) ═════\n';

  SELECT column_name INTO col_type
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'announcements'
     AND column_name IN ('type', 'announcement_type', 'target_type', 'audience')
   ORDER BY column_name LIMIT 1;

  SELECT pg_get_constraintdef(c.oid) INTO def_check
    FROM pg_constraint c
   WHERE c.conrelid = 'announcements'::regclass AND c.contype = 'c'
     AND pg_get_constraintdef(c.oid) LIKE '%' || col_type || '%'
   LIMIT 1;

  r := r || format('  colonne de type    : %s%s', coalesce(col_type, 'INTROUVABLE'), E'
');
  r := r || format('  valeurs acceptees  : %s%s', coalesce(def_check, '(aucun CHECK)'), E'
');

  IF col_type IS NULL THEN
    RAISE EXCEPTION '%', r || E'
  ABANDON : colonne de type introuvable.
';
  END IF;
  IF def_check IS NOT NULL AND def_check NOT LIKE '%all_active%' THEN
    RAISE EXCEPTION '%', r ||
      E'
  ABANDON : « all_active » n est pas une valeur acceptee. Le libelle
'
      'du ciblage « toutes les familles » differe en base — le lire ci-dessus.
';
  END IF;

  EXECUTE format(
    'INSERT INTO announcements (etablissement_id, title, content, %I)'
    ' VALUES ($1, $2, $3, $4) RETURNING id', col_type)
    INTO ann_id
    USING etab, 'Controle de bornage', 'Message de controle, annule.', 'all_active';

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', u_belaid, 'role', 'authenticated')::text, true);
  SELECT EXISTS (SELECT 1 FROM announcements WHERE id = ann_id) INTO vu_bel;
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', u_berra, 'role', 'authenticated')::text, true);
  SELECT EXISTS (SELECT 1 FROM announcements WHERE id = ann_id) INTO vu_ber;
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', u_zerrouki, 'role', 'authenticated')::text, true);
  SELECT EXISTS (SELECT 1 FROM announcements WHERE id = ann_id) INTO vu_zer;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);

  r := r || format('  BELAID:%-4s BERRA:%-4s ZERROUKI:%-4s%s',
                   CASE WHEN vu_bel THEN 'vu' ELSE 'NON' END,
                   CASE WHEN vu_ber THEN 'vu' ELSE 'NON' END,
                   CASE WHEN vu_zer THEN 'vu' ELSE 'NON' END, E'\n');
  IF vu_bel AND vu_ber AND vu_zer THEN
    r := r || E'  -> CONFORME : un message a toutes les familles est lisible par\n';
    r := r || E'     tout enseignant, meme sans classe.\n';
  ELSE
    r := r || E'  -> ECART : un enseignant ne lit pas un message adresse a toute\n';
    r := r || E'     l ecole. La policy est plus stricte que la decision du 01/10.\n';
  END IF;

  r := r || E'\n  Rien n a ete conserve.\n';
  RAISE EXCEPTION '%', r;
END
$ctl$;
