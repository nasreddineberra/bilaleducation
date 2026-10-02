-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  DERNIER ECART : le ciblage `all_registered`, et les conditions reelles   ║
-- ║  Tout est ANNULE : exception volontaire en sortie unique du bloc.        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Le controle 03 a prouve que `all_active` (« toutes les familles inscrites »)
-- est lisible par tout enseignant, meme sans classe. Son CHECK a revele une
-- SECONDE variante du meme ciblage : `all_registered` — « tous les contacts »,
-- non-inscrits compris. Supposer qu'elle est couverte parce que sa voisine l'est
-- serait exactement l'erreur que ce chantier combat.
--
-- Le script fait deux choses :
--   1. il EPROUVE `all_registered` comme le 03 a eprouve `all_active` ;
--   2. il AFFICHE les conditions reelles des policies d'annonces — le depot n'en
--      garde aucune trace depuis la suppression de `policies.sql` le 5 aout, et
--      le journal de ce jour-la en tire la regle : « seule `pg_policies` fait
--      foi ». Les avoir sous les yeux evite d'avoir a les redeviner.

DO $ctl$
DECLARE
  r          text := E'\n';
  etab       uuid;
  u_belaid   uuid;
  u_berra    uuid;
  u_zerrouki uuid;
  ann_id     uuid;
  vu_bel     boolean;
  vu_ber     boolean;
  vu_zer     boolean;
  ligne      record;
BEGIN
  SELECT id INTO etab FROM etablissements ORDER BY created_at LIMIT 1;
  SELECT user_id INTO u_belaid   FROM teachers WHERE last_name ILIKE 'BELA%'    LIMIT 1;
  SELECT user_id INTO u_berra    FROM teachers WHERE last_name ILIKE 'BERRA'    LIMIT 1;
  SELECT user_id INTO u_zerrouki FROM teachers WHERE last_name ILIKE 'ZERROUKI' LIMIT 1;

  r := r || format('  role courant : %s%s', current_user, E'\n');

  -- ══ 1. `all_registered` ════════════════════════════════════════════════
  r := r || E'\n═══ 1. CIBLAGE « tous les contacts » (cree puis annule) ═════════\n';

  INSERT INTO announcements (etablissement_id, title, content, announcement_type)
  VALUES (etab, 'Controle all_registered', 'Message de controle, annule.', 'all_registered')
  RETURNING id INTO ann_id;

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
    r := r || E'  -> CONFORME : traite comme `all_active`, les deux ciblages\n';
    r := r || E'     « toutes les familles » sont lisibles par tout enseignant.\n';
  ELSIF NOT (vu_bel OR vu_ber OR vu_zer) THEN
    r := r || E'  -> ECART : la policy couvre `all_active` mais a OUBLIE\n';
    r := r || E'     `all_registered`. Un enseignant ne verrait pas un message\n';
    r := r || E'     adresse a tous les contacts de l ecole.\n';
  ELSE
    r := r || E'  -> ECART PARTIEL : la visibilite depend du perimetre, alors que\n';
    r := r || E'     ce ciblage ne vise aucune classe en particulier.\n';
  END IF;

  -- ══ 2. LES CONDITIONS REELLES ══════════════════════════════════════════
  -- Pour que la prochaine lecture n'ait pas a les redecouvrir.
  r := r || E'\n═══ 2. CONDITIONS DES POLICIES D ANNONCES ═══════════════════════\n';
  FOR ligne IN
    SELECT tablename, policyname, cmd, coalesce(qual, with_check) AS cond
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('announcements', 'announcement_recipients',
                         'announcement_staff_recipients')
     ORDER BY tablename, policyname
  LOOP
    r := r || format('%s  ── %s · %s (%s)%s    %s%s',
                     E'\n', ligne.tablename, ligne.policyname, ligne.cmd,
                     E'\n', ligne.cond, E'\n');
  END LOOP;

  r := r || E'\n  Rien n a ete conserve.\n';
  RAISE EXCEPTION '%', r;
END
$ctl$;
