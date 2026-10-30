-- ============================================================================
-- CONTROLE 35 — Colonnes a valeur par defaut : NOT NULL (30/10)
--
-- Verifie :
--   - les 72 colonnes de la migration sont NOT NULL ;
--   - `evaluations.max_score` reste facultative (NULL = evaluation diagnostique) ;
--   - AUCUNE autre colonne de `public` ne porte un defaut en acceptant NULL :
--     une colonne nouvelle a defaut se declare NOT NULL, ou s'ajoute ici comme
--     exception justifiee ;
--   - un NULL explicite est refuse (notes : `is_absent`).
-- Migration : supabase/migrations/colonnes-defaut-not-null.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================

DO $ctl$
DECLARE
  res text;
  rapport text := '';
  nb_ko integer := 0;
  essais text[][] := '{}';
  i integer;
BEGIN
  -- ── Les 72 colonnes ───────────────────────────────────────────────────────
  SELECT coalesce(string_agg(c.table_name || '.' || c.column_name, ',' ORDER BY 1), '') INTO res
    FROM information_schema.columns c
   WHERE c.table_schema = 'public'
     AND c.is_nullable = 'YES'
     AND (c.table_name, c.column_name) IN (
      ('absences', 'created_at'),
      ('absences', 'updated_at'),
      ('adult_absences', 'created_at'),
      ('adult_absences', 'updated_at'),
      ('announcement_attachments', 'created_at'),
      ('announcement_recipients', 'created_at'),
      ('announcement_recipients', 'email_status'),
      ('announcement_recipients', 'is_read'),
      ('announcement_staff_recipients', 'created_at'),
      ('announcement_staff_recipients', 'email_status'),
      ('announcement_staff_recipients', 'is_read'),
      ('announcements', 'channel'),
      ('announcements', 'created_at'),
      ('announcements', 'is_published'),
      ('announcements', 'priority'),
      ('announcements', 'recipient_count'),
      ('announcements', 'updated_at'),
      ('class_teachers', 'created_at'),
      ('class_teachers', 'is_main_teacher'),
      ('classes', 'created_at'),
      ('classes', 'is_active'),
      ('classes', 'max_students'),
      ('classes', 'updated_at'),
      ('cours', 'created_at'),
      ('cours', 'order_index'),
      ('cours_modules', 'created_at'),
      ('cours_modules', 'order_index'),
      ('enrollments', 'created_at'),
      ('enrollments', 'enrollment_date'),
      ('enrollments', 'status'),
      ('enrollments', 'updated_at'),
      ('etablissements', 'created_at'),
      ('etablissements', 'updated_at'),
      ('etablissements', 'week_start_day'),
      ('evaluation_order_config', 'module_order'),
      ('evaluation_order_config', 'ue_order'),
      ('evaluations', 'coefficient'),
      ('evaluations', 'created_at'),
      ('evaluations', 'sort_order'),
      ('evaluations', 'updated_at'),
      ('expenses', 'created_at'),
      ('expenses', 'updated_at'),
      ('grades', 'created_at'),
      ('grades', 'is_absent'),
      ('grades', 'updated_at'),
      ('notifications', 'created_at'),
      ('notifications', 'email_status'),
      ('notifications', 'is_read'),
      ('notifications', 'metadata'),
      ('notifications', 'push_status'),
      ('other_revenues', 'created_at'),
      ('other_revenues', 'updated_at'),
      ('parents', 'created_at'),
      ('parents', 'tutor1_relationship'),
      ('parents', 'updated_at'),
      ('presence_types', 'created_at'),
      ('presence_types', 'updated_at'),
      ('profiles', 'created_at'),
      ('profiles', 'is_active'),
      ('profiles', 'updated_at'),
      ('push_subscriptions', 'created_at'),
      ('school_years', 'vacations'),
      ('students', 'created_at'),
      ('students', 'enrollment_date'),
      ('students', 'is_active'),
      ('students', 'updated_at'),
      ('teachers', 'created_at'),
      ('teachers', 'hire_date'),
      ('teachers', 'is_active'),
      ('teachers', 'updated_at'),
      ('unites_enseignement', 'created_at'),
      ('unites_enseignement', 'order_index')
     );
  essais := essais || ARRAY[['72 colonnes NOT NULL (restantes)', '', res]];

  SELECT count(*)::text INTO res
    FROM information_schema.columns c
   WHERE c.table_schema = 'public'
     AND (c.table_name, c.column_name) IN (
      ('absences', 'created_at'),
      ('absences', 'updated_at'),
      ('adult_absences', 'created_at'),
      ('adult_absences', 'updated_at'),
      ('announcement_attachments', 'created_at'),
      ('announcement_recipients', 'created_at'),
      ('announcement_recipients', 'email_status'),
      ('announcement_recipients', 'is_read'),
      ('announcement_staff_recipients', 'created_at'),
      ('announcement_staff_recipients', 'email_status'),
      ('announcement_staff_recipients', 'is_read'),
      ('announcements', 'channel'),
      ('announcements', 'created_at'),
      ('announcements', 'is_published'),
      ('announcements', 'priority'),
      ('announcements', 'recipient_count'),
      ('announcements', 'updated_at'),
      ('class_teachers', 'created_at'),
      ('class_teachers', 'is_main_teacher'),
      ('classes', 'created_at'),
      ('classes', 'is_active'),
      ('classes', 'max_students'),
      ('classes', 'updated_at'),
      ('cours', 'created_at'),
      ('cours', 'order_index'),
      ('cours_modules', 'created_at'),
      ('cours_modules', 'order_index'),
      ('enrollments', 'created_at'),
      ('enrollments', 'enrollment_date'),
      ('enrollments', 'status'),
      ('enrollments', 'updated_at'),
      ('etablissements', 'created_at'),
      ('etablissements', 'updated_at'),
      ('etablissements', 'week_start_day'),
      ('evaluation_order_config', 'module_order'),
      ('evaluation_order_config', 'ue_order'),
      ('evaluations', 'coefficient'),
      ('evaluations', 'created_at'),
      ('evaluations', 'sort_order'),
      ('evaluations', 'updated_at'),
      ('expenses', 'created_at'),
      ('expenses', 'updated_at'),
      ('grades', 'created_at'),
      ('grades', 'is_absent'),
      ('grades', 'updated_at'),
      ('notifications', 'created_at'),
      ('notifications', 'email_status'),
      ('notifications', 'is_read'),
      ('notifications', 'metadata'),
      ('notifications', 'push_status'),
      ('other_revenues', 'created_at'),
      ('other_revenues', 'updated_at'),
      ('parents', 'created_at'),
      ('parents', 'tutor1_relationship'),
      ('parents', 'updated_at'),
      ('presence_types', 'created_at'),
      ('presence_types', 'updated_at'),
      ('profiles', 'created_at'),
      ('profiles', 'is_active'),
      ('profiles', 'updated_at'),
      ('push_subscriptions', 'created_at'),
      ('school_years', 'vacations'),
      ('students', 'created_at'),
      ('students', 'enrollment_date'),
      ('students', 'is_active'),
      ('students', 'updated_at'),
      ('teachers', 'created_at'),
      ('teachers', 'hire_date'),
      ('teachers', 'is_active'),
      ('teachers', 'updated_at'),
      ('unites_enseignement', 'created_at'),
      ('unites_enseignement', 'order_index')
     );
  essais := essais || ARRAY[['72 colonnes lues', '72', res]];

  -- ── Exception ─────────────────────────────────────────────────────────────
  SELECT is_nullable INTO res FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'evaluations' AND column_name = 'max_score';
  essais := essais || ARRAY[['evaluations.max_score facultative', 'YES', res]];

  -- ── Aucune autre colonne a defaut acceptant NULL ──────────────────────────
  SELECT coalesce(string_agg(c.table_name || '.' || c.column_name, ',' ORDER BY 1), '') INTO res
    FROM information_schema.columns c
    JOIN information_schema.tables t USING (table_schema, table_name)
   WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
     AND c.is_nullable = 'YES' AND c.column_default IS NOT NULL
     AND (c.table_name, c.column_name) <> ('evaluations', 'max_score');
  essais := essais || ARRAY[['autres colonnes a defaut acceptant NULL', '', res]];

  -- ── Un NULL explicite est refuse ──────────────────────────────────────────
  BEGIN
    UPDATE public.grades SET is_absent = NULL WHERE id = (SELECT id FROM public.grades LIMIT 1);
    res := CASE WHEN FOUND THEN 'accepte' ELSE 'aucune note a essayer' END;
  EXCEPTION WHEN not_null_violation THEN
    res := 'refuse';
  END;
  essais := essais || ARRAY[['grades.is_absent = NULL', 'refuse', res]];

  -- ── Rapport ───────────────────────────────────────────────────────────────
  FOR i IN 1 .. array_length(essais, 1) LOOP
    IF essais[i][2] <> essais[i][3] THEN nb_ko := nb_ko + 1; END IF;
    rapport := rapport || E'\n[' || CASE WHEN essais[i][2] = essais[i][3] THEN 'OK' ELSE 'KO' END || '] '
      || rpad(essais[i][1], 44) || coalesce(nullif(essais[i][3], ''), '(aucune)')
      || CASE WHEN essais[i][2] <> essais[i][3] THEN E'\n     attendu' || repeat(' ', 40) || coalesce(nullif(essais[i][2], ''), '(aucune)') ELSE '' END;
  END LOOP;

  RAISE EXCEPTION 'CONTROLE 35 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
