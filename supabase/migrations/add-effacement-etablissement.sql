-- ============================================================================
-- DEPART D'UNE ECOLE (RGPD) : export des donnees, puis effacement complet
--
-- Deux fonctions appelees par la console de l'editeur (service-role seul) :
--   * `exporter_etablissement(id)` rend toutes les donnees de l'ecole, table par
--     table, plus la liste de ses fichiers. La console en fait un ZIP remis a
--     l'ecole. Le journal d'activite N'EN FAIT PAS PARTIE (decision du 13/10) :
--     c'est une trace technique sur le personnel, pas une donnee de l'ecole.
--   * `effacer_etablissement(id, slug, reel, auteur)` efface tout, en UNE
--     transaction. `reel = false` fait le meme travail puis l'annule : le compte
--     rendu de la simulation est donc EXACT, cascades comprises.
--
-- POURQUOI PAS UN SIMPLE `DELETE FROM etablissements` :
--   * `expenses` / `other_revenues` sont en NO ACTION vers l'etablissement ;
--   * `students.parent_id` est en RESTRICT, et l'ordre de la cascade n'est pas
--     garanti : si les foyers partent avant les apprenants, tout echoue ;
--   * `cours` / `cours_modules` n'ont pas d'etablissement et sont en RESTRICT
--     vers leur unite : la cascade ne les atteint jamais ;
--   * `evaluation_order_config` porte un `class_id` SANS cle etrangere : la
--     cascade l'ignorerait et laisserait des orphelins ;
--   * une dizaine de gardes refusent une suppression qui detruit des donnees
--     (notes, bulletins archives, types reserves...). Elles sont FAITES pour ca.
--
-- LE MARQUEUR `app.effacement_etablissement` : pose par `effacer_etablissement`
-- pour la seule duree de sa transaction (`set_config(..., true)`). Les gardes de
-- SUPPRESSION le consultent et laissent passer. Un client ne peut pas le poser :
-- PostgREST n'execute aucun SQL arbitraire, et aucune fonction exposee n'ecrit
-- ce reglage.
--
-- CE QUE L'EDITEUR GARDE : `etablissements_effaces` (regime serveur uniquement)
-- avec le nom, l'adresse, la date, l'auteur, les volumes effaces, et une COPIE
-- des releves de facturation, de la facturation, des actions et des
-- interventions de l'editeur — que la cascade emporterait.
--
-- FILET DE SECURITE : avant et apres, chaque table est comptee en entier ET pour
-- cette ecole. Si une seule ligne d'une AUTRE ecole a disparu, ou s'il reste une
-- ligne de celle-ci, tout est annule.
--
-- Idempotent.
-- ============================================================================

-- ── 1. Bucket des exports (prive, sans policy : service-role seul) ───────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('exports-ecoles', 'exports-ecoles', false)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Trace des effacements, cote editeur ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.etablissements_effaces (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id uuid NOT NULL,            -- volontairement SANS cle : la ligne n'existe plus
  slug             text NOT NULL,
  nom              text NOT NULL,
  adresse          text,
  efface_le        timestamptz NOT NULL DEFAULT now(),
  efface_par       uuid,
  efface_par_email text,
  lignes           jsonb NOT NULL,           -- { table: nombre de lignes effacees }
  comptes          integer NOT NULL DEFAULT 0,
  fichiers         integer NOT NULL DEFAULT 0,
  fichiers_effaces integer,                  -- renseigne par la console apres le Storage
  releves          jsonb,
  facturation      jsonb,
  actions          jsonb,
  interventions    jsonb
);
ALTER TABLE public.etablissements_effaces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.etablissements_effaces FROM anon, authenticated;

-- ── 3. Marqueur d'effacement ─────────────────────────────────────────────────
-- Execution laissee a tous : les gardes s'executent avec les droits de
-- l'appelant, et un enseignant qui supprime une note doit pouvoir la lire.
CREATE OR REPLACE FUNCTION public.fn_effacement_en_cours()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = ''
AS $fn$
  SELECT coalesce(current_setting('app.effacement_etablissement', true), '') <> ''
$fn$;

-- ── 4. Les gardes de suppression laissent passer pendant un effacement ───────
-- On RAPIECE la definition reelle (pg_get_functiondef) au lieu de la recopier :
-- une recopie ecraserait sans rien dire une derive entre la base et le depot.
DO $do$
DECLARE
  f       text;
  v_n     integer;
  v_def   text;
  v_new   text;
  v_garde text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'fn_block_adult_unenroll', 'fn_block_student_unenroll', 'fn_guard_class_delete',
    'fn_guard_cotisation_type_delete', 'fn_guard_cours_delete', 'fn_guard_parent_delete',
    'fn_guard_periode_archivee', 'fn_guard_presence_type_delete', 'fn_guard_student_delete',
    'fn_protect_reserved_presence_types', 'fn_audit_log'
  ] LOOP
    SELECT count(*), min(pg_get_functiondef(p.oid)) INTO v_n, v_def
      FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = f;
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'Fonction % : % definition(s) trouvee(s), 1 attendue.', f, v_n;
    END IF;
    CONTINUE WHEN position('fn_effacement_en_cours' IN v_def) > 0;   -- deja rapiecee

    IF f = 'fn_audit_log' THEN
      -- Le journal de l'ecole est efface avec elle : tracer ce qui part serait
      -- ecrire des lignes vouees a disparaitre (et vers un etablissement deja
      -- supprime, donc en violation de cle).
      v_garde := E'\nBEGIN\n  IF public.fn_effacement_en_cours() THEN\n    IF TG_OP = ''DELETE'' THEN RETURN OLD; ELSE RETURN NEW; END IF;\n  END IF;\n';
    ELSE
      v_garde := E'\nBEGIN\n  -- Effacement d''une ecole (effacer_etablissement) : tout part, rien a proteger.\n  IF TG_OP = ''DELETE'' AND public.fn_effacement_en_cours() THEN RETURN OLD; END IF;\n';
    END IF;

    v_new := regexp_replace(v_def, E'\\nBEGIN\\r?\\n', v_garde);
    IF v_new = v_def THEN
      RAISE EXCEPTION 'Fonction % : ancrage BEGIN introuvable, rien n''a ete modifie.', f;
    END IF;
    EXECUTE v_new;
  END LOOP;
END
$do$;

-- ── 5. Classement des tables : ce qui appartient a une ecole ─────────────────
-- Toute table a colonne `etablissement_id` est rattachee automatiquement. Les
-- AUTRES doivent etre classees ici, a la main : une table non classee fait
-- echouer l'export comme l'effacement, plutot que d'etre oubliee en silence.
--
-- `exporte = false` : donnees de l'EDITEUR ou techniques, jamais remises a
-- l'ecole (secret SMTP, notes et facturation de l'editeur, journal d'activite).
CREATE OR REPLACE FUNCTION public.fn_depart_tables()
RETURNS TABLE (nom text, filtre text, exporte boolean)
LANGUAGE plpgsql   -- VOLATILE : elle cree une table temporaire
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_inconnues text;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _depart_tables (nom text, filtre text, exporte boolean) ON COMMIT DROP;
  TRUNCATE _depart_tables;

  INSERT INTO _depart_tables
  SELECT c.table_name::text,
         CASE WHEN c.table_name = 'profiles'
              THEN 'etablissement_id = $1 AND role <> ''super_admin'''
              ELSE 'etablissement_id = $1' END,
         c.table_name NOT IN ('audit_logs', 'etablissement_smtp', 'etablissement_notes',
                              'etablissement_facturation', 'releves_facturation',
                              'actions_editeur', 'support_interventions',
                              'push_subscriptions', 'year_audits')
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
   WHERE c.table_schema = 'public' AND c.column_name = 'etablissement_id';

  INSERT INTO _depart_tables VALUES
    ('etablissements',                'id = $1', true),
    ('periods',                       'school_year_id IN (SELECT id FROM school_years WHERE etablissement_id = $1)', true),
    ('eval_type_configs',             'school_year_id IN (SELECT id FROM school_years WHERE etablissement_id = $1)', true),
    ('class_teachers',                'class_id IN (SELECT id FROM classes WHERE etablissement_id = $1)', true),
    ('enrollments',                   'class_id IN (SELECT id FROM classes WHERE etablissement_id = $1)', true),
    ('evaluation_order_config',       'class_id IN (SELECT id FROM classes WHERE etablissement_id = $1)', true),
    ('grades',                        'evaluation_id IN (SELECT id FROM evaluations WHERE etablissement_id = $1)', true),
    ('homework_status',               'homework_id IN (SELECT id FROM homework WHERE etablissement_id = $1)', true),
    ('adult_homework_status',         'homework_id IN (SELECT id FROM homework WHERE etablissement_id = $1)', true),
    ('announcement_recipients',       'announcement_id IN (SELECT id FROM announcements WHERE etablissement_id = $1)', true),
    ('announcement_staff_recipients', 'announcement_id IN (SELECT id FROM announcements WHERE etablissement_id = $1)', true),
    ('announcement_attachments',      'announcement_id IN (SELECT id FROM announcements WHERE etablissement_id = $1)', true),
    ('student_warning_attachments',   'warning_id IN (SELECT id FROM student_warnings WHERE etablissement_id = $1)', true),
    ('cours_modules',                 'unite_enseignement_id IN (SELECT id FROM unites_enseignement WHERE etablissement_id = $1)', true),
    ('cours',                         'unite_enseignement_id IN (SELECT id FROM unites_enseignement WHERE etablissement_id = $1)', true),
    -- Tables globales, sans donnee d'ecole.
    ('migrations_appliquees',         NULL, false),
    ('etablissements_effaces',        NULL, false);

  SELECT string_agg(t.table_name, ', ' ORDER BY t.table_name) INTO v_inconnues
    FROM information_schema.tables t
   WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
     AND t.table_name NOT IN (SELECT d.nom FROM _depart_tables d);
  IF v_inconnues IS NOT NULL THEN
    RAISE EXCEPTION 'Table(s) non classee(s) pour le depart d''une ecole : %. Completez fn_depart_tables().', v_inconnues;
  END IF;

  RETURN QUERY SELECT d.nom, d.filtre, d.exporte FROM _depart_tables d ORDER BY d.nom;
END
$fn$;
REVOKE ALL ON FUNCTION public.fn_depart_tables() FROM public, anon, authenticated;

-- ── 6. Export ────────────────────────────────────────────────────────────────
-- `json` et non `jsonb` : il conserve l'ORDRE des colonnes, donc celui des CSV.
CREATE OR REPLACE FUNCTION public.exporter_etablissement(p_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  r        record;
  v_noms   text[] := '{}';
  v_vals   json[] := '{}';
  v_val    json;
  v_tables json;
  v_fich   json;
BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Reserve a la console de l''editeur.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM etablissements WHERE id = p_id) THEN
    RAISE EXCEPTION 'Etablissement introuvable.';
  END IF;

  FOR r IN SELECT * FROM fn_depart_tables() WHERE exporte AND filtre IS NOT NULL LOOP
    EXECUTE format('SELECT coalesce(json_agg(t), ''[]''::json) FROM public.%I t WHERE %s', r.nom, r.filtre)
      INTO v_val USING p_id;
    v_noms := v_noms || r.nom;
    v_vals := v_vals || v_val;
  END LOOP;

  SELECT json_object_agg(n, v ORDER BY n) INTO v_tables FROM unnest(v_noms, v_vals) AS u(n, v);

  -- Les fichiers, sauf les exports precedents.
  SELECT coalesce(json_agg(json_build_object('bucket', o.bucket_id, 'nom', o.name) ORDER BY o.bucket_id, o.name), '[]'::json)
    INTO v_fich
    FROM storage.objects o
   WHERE o.name LIKE p_id::text || '/%' AND o.bucket_id <> 'exports-ecoles';

  RETURN json_build_object('tables', v_tables, 'fichiers', v_fich);
END
$fn$;
REVOKE ALL ON FUNCTION public.exporter_etablissement(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exporter_etablissement(uuid) TO service_role;

-- ── 7. Effacement ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.effacer_etablissement(
  p_id     uuid,
  p_slug   text,
  p_reel   boolean,
  p_auteur uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_etab      etablissements%ROWTYPE;
  r           record;
  n           bigint;
  v_tot_avant jsonb := '{}';
  v_eco_avant jsonb := '{}';
  v_lignes    jsonb := '{}';
  v_comptes   uuid[];
  v_fichiers  jsonb;
  v_releves   jsonb;
  v_fact      jsonb;
  v_actions   jsonb;
  v_interv    jsonb;
  v_email     text;
  v_simule    boolean := false;
BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Reserve a la console de l''editeur.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_etab FROM etablissements WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Etablissement introuvable.'; END IF;
  IF v_etab.slug IS DISTINCT FROM p_slug THEN
    RAISE EXCEPTION 'L''adresse saisie ne correspond pas a celle de l''ecole.';
  END IF;
  IF v_etab.is_active THEN
    RAISE EXCEPTION 'Coupez d''abord l''acces de l''ecole.';
  END IF;
  -- Un super-admin rattache verrait son PROPRE profil emporte par la cascade.
  IF EXISTS (SELECT 1 FROM profiles WHERE etablissement_id = p_id AND role = 'super_admin')
     OR EXISTS (SELECT 1 FROM support_interventions WHERE etablissement_id = p_id AND closed_at IS NULL) THEN
    RAISE EXCEPTION 'Une intervention de support est en cours dans cette ecole : quittez-la d''abord.';
  END IF;

  -- ── Comptage AVANT : chaque table, en entier et pour cette ecole ──
  FOR r IN SELECT * FROM fn_depart_tables() WHERE filtre IS NOT NULL LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', r.nom) INTO n;
    v_tot_avant := v_tot_avant || jsonb_build_object(r.nom, n);
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %s', r.nom, r.filtre) INTO n USING p_id;
    v_eco_avant := v_eco_avant || jsonb_build_object(r.nom, n);
  END LOOP;

  SELECT array_agg(id) INTO v_comptes FROM profiles WHERE etablissement_id = p_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('bucket', bucket_id, 'nom', name)), '[]'::jsonb) INTO v_fichiers
    FROM storage.objects WHERE name LIKE p_id::text || '/%';

  -- Copies conservees par l'editeur (la cascade les emporterait).
  SELECT jsonb_agg(to_jsonb(x) ORDER BY x.mois) INTO v_releves FROM releves_facturation x WHERE x.etablissement_id = p_id;
  SELECT to_jsonb(x) INTO v_fact FROM etablissement_facturation x WHERE x.etablissement_id = p_id;
  SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at) INTO v_actions FROM actions_editeur x WHERE x.etablissement_id = p_id;
  SELECT jsonb_agg(to_jsonb(x) ORDER BY x.opened_at) INTO v_interv FROM support_interventions x WHERE x.etablissement_id = p_id;

  BEGIN
    PERFORM set_config('app.effacement_etablissement', p_id::text, true);

    -- Dans l'ordre que les cles imposent (voir l'en-tete).
    DELETE FROM expenses       WHERE etablissement_id = p_id;
    DELETE FROM other_revenues WHERE etablissement_id = p_id;
    DELETE FROM evaluation_order_config WHERE class_id IN (SELECT id FROM classes WHERE etablissement_id = p_id);
    DELETE FROM students       WHERE etablissement_id = p_id;
    DELETE FROM cours          WHERE unite_enseignement_id IN (SELECT id FROM unites_enseignement WHERE etablissement_id = p_id);
    DELETE FROM cours_modules  WHERE unite_enseignement_id IN (SELECT id FROM unites_enseignement WHERE etablissement_id = p_id);
    DELETE FROM etablissements WHERE id = p_id;   -- tout le reste, en cascade
    -- Les comptes APRES : leurs profils sont deja partis avec l'ecole, et une
    -- suppression plus tot heurterait les cles NO ACTION vers `profiles`.
    DELETE FROM auth.users WHERE id = ANY (coalesce(v_comptes, '{}'));

    -- ── Comptage APRES : rien d'une autre ecole, plus rien de celle-ci ──
    FOR r IN SELECT * FROM fn_depart_tables() WHERE filtre IS NOT NULL LOOP
      EXECUTE format('SELECT count(*) FROM public.%I', r.nom) INTO n;
      IF (v_tot_avant ->> r.nom)::bigint - n <> (v_eco_avant ->> r.nom)::bigint THEN
        RAISE EXCEPTION 'Controle d''integrite : la table % a perdu % ligne(s) au lieu de %. Rien n''a ete efface.',
          r.nom, (v_tot_avant ->> r.nom)::bigint - n, v_eco_avant ->> r.nom;
      END IF;
      IF (v_eco_avant ->> r.nom)::bigint > 0 THEN
        v_lignes := v_lignes || jsonb_build_object(r.nom, (v_eco_avant ->> r.nom)::bigint);
      END IF;
    END LOOP;

    IF NOT p_reel THEN
      RAISE EXCEPTION USING ERRCODE = 'ZZ001', MESSAGE = 'simulation';
    END IF;
  EXCEPTION
    WHEN SQLSTATE 'ZZ001' THEN v_simule := true;   -- tout est annule, les comptes restent
  END;

  PERFORM set_config('app.effacement_etablissement', '', true);

  IF p_reel THEN
    SELECT email INTO v_email FROM profiles WHERE id = p_auteur;
    INSERT INTO etablissements_effaces (etablissement_id, slug, nom, adresse, efface_par, efface_par_email,
                                        lignes, comptes, fichiers, releves, facturation, actions, interventions)
    VALUES (p_id, v_etab.slug, v_etab.nom, v_etab.adresse, p_auteur, v_email,
            v_lignes, coalesce(array_length(v_comptes, 1), 0), jsonb_array_length(v_fichiers),
            v_releves, v_fact, v_actions, v_interv);
  END IF;

  RETURN jsonb_build_object(
    'reel',     p_reel AND NOT v_simule,
    'lignes',   v_lignes,
    'comptes',  coalesce(array_length(v_comptes, 1), 0),
    'fichiers', CASE WHEN p_reel THEN v_fichiers ELSE to_jsonb(jsonb_array_length(v_fichiers)) END
  );
END
$fn$;
REVOKE ALL ON FUNCTION public.effacer_etablissement(uuid, text, boolean, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.effacer_etablissement(uuid, text, boolean, uuid) TO service_role;

-- ── 8. Verification ──────────────────────────────────────────────────────────
DO $verif$
DECLARE
  v_n integer;
BEGIN
  SELECT count(*) INTO v_n FROM pg_proc
   WHERE pronamespace = 'public'::regnamespace
     AND proname IN ('fn_block_adult_unenroll', 'fn_block_student_unenroll', 'fn_guard_class_delete',
                     'fn_guard_cotisation_type_delete', 'fn_guard_cours_delete', 'fn_guard_parent_delete',
                     'fn_guard_periode_archivee', 'fn_guard_presence_type_delete', 'fn_guard_student_delete',
                     'fn_protect_reserved_presence_types', 'fn_audit_log')
     AND prosrc LIKE '%fn_effacement_en_cours%';
  IF v_n <> 11 THEN
    RAISE EXCEPTION 'Verification : % garde(s) rapiecee(s) sur 11.', v_n;
  END IF;
  PERFORM count(*) FROM fn_depart_tables();   -- leve si une table n'est pas classee
  IF EXISTS (SELECT 1 FROM information_schema.routine_privileges
              WHERE routine_name IN ('effacer_etablissement', 'exporter_etablissement')
                AND grantee IN ('anon', 'authenticated', 'PUBLIC')) THEN
    RAISE EXCEPTION 'Verification : les fonctions de depart sont executables hors service-role.';
  END IF;
END
$verif$;

-- Registre des migrations (voir supabase/migrations/README.md).
SELECT enregistrer_migration('add-effacement-etablissement.sql', 'bc2f4ca52cfd7da8002d514249ee767c16331501ecd951fa4ed259c69160458c');
