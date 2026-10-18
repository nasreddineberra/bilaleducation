-- ============================================================================
-- CONTROLE 14 — Storage, salles et ressources : aucune policy sans l'ecole
--
-- Les policies s'ADDITIONNENT : une seule policy large suffit a ouvrir un
-- bucket, quelles que soient les policies strictes posees a cote. Le controle
-- lit `pg_policies` (aucune ecriture dans `storage.objects`) et sort KO pour :
--   - toute policy de `storage.objects` qui ne porte pas l'ecole (dossier
--     racine = `current_etablissement_id()` ou l'ecole du profil), a
--     l'exception unique de la lecture publique des logos ;
--   - toute policy du bucket `bulletins` sans controle de role ;
--   - toute policy de `rooms` / `materials` qui lit `profiles.role` au lieu de
--     `get_user_role()` (l'editeur en intervention n'y serait pas admin).
-- Il rappelle enfin, pour information, les buckets publics.
--
-- Migration : supabase/migrations/secure-storage-anciennes-policies.sql.
-- LECTURE SEULE : exception volontaire finale.
-- ============================================================================
DO $ctl$
DECLARE
  r record;
  rapport text := '';
  nb_ko integer := 0;
  nb integer := 0;
  expr text;
BEGIN
  FOR r IN
    SELECT policyname, cmd, coalesce(qual, '') || ' ' || coalesce(with_check, '') AS e
      FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects' AND permissive = 'PERMISSIVE'
     ORDER BY policyname
  LOOP
    nb := nb + 1;
    expr := r.e;
    IF expr LIKE '%''bulletins''%' AND expr NOT LIKE '%get_user_role()%' THEN
      nb_ko := nb_ko + 1;
      rapport := rapport || E'\n[KO] storage · ' || r.policyname || ' (' || r.cmd || ') bulletins sans role';
      CONTINUE;
    END IF;
    IF expr LIKE '%current_etablissement_id()%' OR expr LIKE '%profiles.etablissement_id%' THEN
      CONTINUE;
    END IF;
    IF r.cmd = 'SELECT' AND expr ~ '^\s*\(bucket_id = ''etablissement-logos''::text\)\s*$' THEN
      rapport := rapport || E'\n[OK] ' || r.policyname || ' (lecture publique des logos, voulue)';
      CONTINUE;
    END IF;
    nb_ko := nb_ko + 1;
    rapport := rapport || E'\n[KO] storage · ' || r.policyname || ' (' || r.cmd || ') sans ecole : '
      || regexp_replace(expr, '\s+', ' ', 'g');
  END LOOP;

  IF nb = 0 THEN
    RAISE EXCEPTION 'CONTROLE 14 : aucune policy lue sur storage.objects, le controle ne mesure rien';
  END IF;

  FOR r IN
    SELECT tablename, policyname, cmd
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename IN ('rooms', 'materials')
       AND (coalesce(qual, '') || coalesce(with_check, '')) LIKE '%profiles.role%'
     ORDER BY 1, 2
  LOOP
    nb_ko := nb_ko + 1;
    rapport := rapport || E'\n[KO] ' || r.tablename || ' · ' || r.policyname || ' (' || r.cmd
      || ') lit profiles.role au lieu de get_user_role()';
  END LOOP;

  FOR r IN SELECT id FROM storage.buckets WHERE public ORDER BY id LOOP
    rapport := rapport || E'\n[info] bucket public : ' || r.id;
  END LOOP;

  RAISE EXCEPTION 'CONTROLE 14 : % KO sur % policies storage lues%', nb_ko, nb, rapport;
END
$ctl$;
