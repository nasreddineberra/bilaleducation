-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  RECONNAISSANCE avant le test des bornages d'enseignant                  ║
-- ║  LECTURE SEULE — ce script n'ecrit rien, il ne fait que decrire.         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- POURQUOI CE SCRIPT EXISTE. Trois bornages n'ont jamais ete prouves :
-- `teaches_class` sur les bulletins, `teaches_student` sur les documents et la
-- discipline, et le perimetre des annonces de classe. Les controles precedents
-- ont tous repondu « il voit TOUT le reel » — ce qui ne distingue pas « borne »
-- de « pas borne », faute d'un objet hors de son perimetre.
--
-- Le test decisif doit donc CREER un tel objet, dans une transaction annulee.
-- Mais un script ecrit a l'aveugle echouerait sur une contrainte sans rapport
-- (piege paye le 16 aout : un CHECK sur `gender` avait fait passer un echec pour
-- un succes). Celui-ci mesure d'abord le terrain.
--
-- A COLLER dans l'editeur SQL de Supabase. Le bandeau rouge est ATTENDU : le
-- rapport s'affiche a la place du message d'erreur, et l'abandon est le chemin de
-- sortie unique du bloc.

DO $ctl$
DECLARE
  r       text := E'\n';
  ligne   record;
  nb      int;
BEGIN
  r := r || E'═══ 1. ENSEIGNANTS ET LEUR PERIMETRE ════════════════════════════\n';
  FOR ligne IN
    SELECT t.id,
           t.last_name || ' ' || t.first_name AS nom,
           t.user_id,
           p.email,
           count(ct.id) FILTER (
             WHERE (ct.effective_from IS NULL OR ct.effective_from <= current_date)
               AND (ct.effective_until IS NULL OR ct.effective_until >= current_date)
           ) AS classes_actives
      FROM teachers t
      LEFT JOIN profiles p        ON p.id = t.user_id
      LEFT JOIN class_teachers ct ON ct.teacher_id = t.id
     GROUP BY t.id, t.last_name, t.first_name, t.user_id, p.email
     ORDER BY classes_actives DESC, nom
  LOOP
    r := r || format('  %-28s %-34s classes actives : %s%s',
                     ligne.nom, coalesce(ligne.email, '(sans compte)'),
                     ligne.classes_actives, E'\n');
  END LOOP;

  r := r || E'\n═══ 2. CLASSES, ET QUI LES ENSEIGNE AUJOURD HUI ═════════════════\n';
  FOR ligne IN
    SELECT c.id, c.name, c.academic_year,
           coalesce(string_agg(DISTINCT t.last_name, ', '), '(personne)') AS enseignants
      FROM classes c
      LEFT JOIN class_teachers ct
             ON ct.class_id = c.id
            AND (ct.effective_from  IS NULL OR ct.effective_from  <= current_date)
            AND (ct.effective_until IS NULL OR ct.effective_until >= current_date)
      LEFT JOIN teachers t ON t.id = ct.teacher_id
     GROUP BY c.id, c.name, c.academic_year
     ORDER BY c.academic_year DESC, c.name
  LOOP
    r := r || format('  %-22s %-12s %s%s', ligne.name, ligne.academic_year,
                     ligne.enseignants, E'\n');
  END LOOP;

  r := r || E'\n═══ 3. VOLUME DES TABLES A EPROUVER ═════════════════════════════\n';
  FOR ligne IN
    SELECT 'bulletin_archives'        AS t, count(*) AS n FROM bulletin_archives
    UNION ALL SELECT 'adult_bulletin_archives', count(*) FROM adult_bulletin_archives
    UNION ALL SELECT 'bulletin_appreciations', count(*) FROM bulletin_appreciations
    UNION ALL SELECT 'student_documents',      count(*) FROM student_documents
    UNION ALL SELECT 'student_warnings',       count(*) FROM student_warnings
    UNION ALL SELECT 'announcements',          count(*) FROM announcements
    UNION ALL SELECT 'announcement_recipients', count(*) FROM announcement_recipients
    UNION ALL SELECT 'students',               count(*) FROM students
    UNION ALL SELECT 'enrollments',            count(*) FROM enrollments
    ORDER BY t
  LOOP
    r := r || format('  %-26s %s ligne(s)%s', ligne.t, ligne.n, E'\n');
  END LOOP;

  -- Les colonnes OBLIGATOIRES sans valeur par defaut : c'est ce qu'un script de
  -- test doit fournir, et c'est ce qui le fait echouer quand on l'ignore.
  -- NB (piege du 13/09) : un DECLENCHEUR n'est pas un defaut — une colonne peut
  -- apparaitre ici tout en etant remplie par un BEFORE INSERT.
  r := r || E'\n═══ 4. COLONNES OBLIGATOIRES (NOT NULL, sans defaut) ════════════\n';
  FOR ligne IN
    SELECT table_name AS t,
           string_agg(column_name || ' ' || data_type, ', ' ORDER BY ordinal_position) AS cols
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND is_nullable  = 'NO'
       AND column_default IS NULL
       AND table_name IN ('bulletin_archives', 'bulletin_appreciations',
                          'student_documents', 'student_warnings',
                          'announcements', 'announcement_recipients',
                          'students', 'enrollments', 'classes', 'class_teachers')
     GROUP BY table_name
     ORDER BY table_name
  LOOP
    r := r || format('  %s%s    %s%s', ligne.t, E'\n', ligne.cols, E'\n');
  END LOOP;

  -- Un declencheur peut remplir une colonne obligatoire : sans cette liste, on
  -- conclurait a tort qu'une colonne est a fournir (ou l'inverse).
  r := r || E'\n═══ 5. DECLENCHEURS SUR CES TABLES ══════════════════════════════\n';
  FOR ligne IN
    SELECT c.relname AS t,
           string_agg(tg.tgname, ', ' ORDER BY tg.tgname) AS triggers
      FROM pg_trigger tg
      JOIN pg_class c ON c.oid = tg.tgrelid
     WHERE NOT tg.tgisinternal
       AND c.relname IN ('bulletin_archives', 'bulletin_appreciations',
                         'student_documents', 'student_warnings',
                         'announcements', 'announcement_recipients',
                         'students', 'enrollments', 'classes', 'class_teachers')
     GROUP BY c.relname
     ORDER BY c.relname
  LOOP
    r := r || format('  %-26s %s%s', ligne.t, ligne.triggers, E'\n');
  END LOOP;

  -- Les trois fonctions de perimetre : leur presence, et leur definition exacte.
  r := r || E'\n═══ 6. FONCTIONS DE PERIMETRE ═══════════════════════════════════\n';
  SELECT count(*) INTO nb FROM pg_proc
   WHERE proname IN ('teaches_class', 'teaches_student', 'teaches_parent');
  r := r || format('  %s fonction(s) trouvee(s) sur 3 attendues%s', nb, E'\n');
  FOR ligne IN
    SELECT proname, pg_get_functiondef(oid) AS def
      FROM pg_proc
     WHERE proname IN ('teaches_class', 'teaches_student', 'teaches_parent')
     ORDER BY proname
  LOOP
    r := r || format('%s  ── %s ──%s%s%s', E'\n', ligne.proname, E'\n', ligne.def, E'\n');
  END LOOP;

  -- Les policies qui PORTENT les bornages a eprouver.
  r := r || E'\n═══ 7. POLICIES CITANT UN BORNAGE D ENSEIGNANT ══════════════════\n';
  FOR ligne IN
    SELECT tablename, policyname, cmd,
           coalesce(qual, with_check) AS condition
      FROM pg_policies
     WHERE schemaname = 'public'
       AND (coalesce(qual, '') || coalesce(with_check, '')) ~ 'teaches_'
     ORDER BY tablename, policyname
  LOOP
    r := r || format('  %-26s %-34s %s%s', ligne.tablename, ligne.policyname,
                     ligne.cmd, E'\n');
  END LOOP;

  RAISE EXCEPTION '%', r;
END
$ctl$;
