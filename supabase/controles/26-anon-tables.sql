-- ============================================================================
-- CONTROLE 26 — Aucun droit de table pour `anon`, RLS partout
--
--   toute table de `public`                    -> RLS activee
--   toute table / sequence de `public`         -> aucun droit pour `anon`
--   les memes                                  -> lisibles par `authenticated`
--   une table / sequence NOUVELLE (postgres)   -> fermee a `anon`
--   une lecture anonyme reelle                 -> « permission denied »
--
-- Migration : supabase/migrations/revoke-anon-tables.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================
DO $ctl$
DECLARE
  nb_tables integer;
  liste     text;
  ok        boolean;
  msg       text;
  rapport   text := '';
  nb_ko     integer := 0;
BEGIN
  SELECT count(*) INTO nb_tables
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r';
  ok := nb_tables >= 60;
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] tables lues               ' || nb_tables;
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  SELECT string_agg(c.relname, ', ') INTO liste
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity;
  ok := liste IS NULL;
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] tables sans RLS            ' || coalesce(liste, 'aucune');
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  SELECT string_agg(c.relname, ', ') INTO liste
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
    AND has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER');
  ok := liste IS NULL;
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] droits de table anon       ' || coalesce(liste, 'aucun');
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  SELECT string_agg(s.relname, ', ') INTO liste
  FROM (SELECT c.oid, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'S' OFFSET 0) s
  WHERE has_sequence_privilege('anon', s.oid, 'USAGE,SELECT,UPDATE');
  ok := liste IS NULL;
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] droits de sequence anon    ' || coalesce(liste, 'aucun');
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  SELECT string_agg(c.relname, ', ') INTO liste
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT has_table_privilege('authenticated', c.oid, 'SELECT')
    AND c.relname NOT IN ('actions_editeur', 'etablissement_departs', 'etablissement_facturation', 'etablissement_notes',
                          'etablissement_smtp', 'migrations_appliquees', 'releves_facturation', 'support_interventions');
  ok := liste IS NULL;
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] authenticated intact       ' || coalesce('fermees : ' || liste, 'oui');
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  -- Une table et une sequence nouvelles, creees comme le ferait une migration.
  CREATE TABLE public.ctl26_nouvelle(id int);
  CREATE SEQUENCE public.ctl26_nouvelle_seq;
  ok := NOT has_table_privilege('anon', 'public.ctl26_nouvelle', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
        AND NOT has_sequence_privilege('anon', 'public.ctl26_nouvelle_seq', 'USAGE')
        AND has_table_privilege('authenticated', 'public.ctl26_nouvelle', 'SELECT');
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] defaut : nouvelle table    '
    || CASE WHEN has_table_privilege('anon', 'public.ctl26_nouvelle', 'SELECT') THEN 'anon PERMIS' ELSE 'anon refuse' END;
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  -- Lecture reelle sous `anon`.
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM count(*) FROM public.students;
    msg := 'lecture acceptee';
  EXCEPTION WHEN OTHERS THEN msg := SQLERRM; END;
  RESET ROLE;
  ok := msg LIKE 'permission denied%' OR msg LIKE 'droit refus%';
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] lecture anonyme            ' || msg;
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  RAISE EXCEPTION 'CONTROLE 26 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
