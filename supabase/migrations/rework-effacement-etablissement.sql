-- ============================================================================
-- DEPART D'UNE ECOLE, REVU (13/10) : on efface les DONNEES, on garde la FICHE
--
-- Decision utilisateur : l'ecole ne disparait pas de la console. Sa fiche reste,
-- grisee et en lecture seule, et peut etre ROUVERTE des mois plus tard (elle
-- repart alors vide). Remplace le modele de `add-effacement-etablissement.sql`,
-- qui supprimait la ligne `etablissements`.
--
-- CONSERVE (« editeur » + identite) : la ligne `etablissements` (nom, adresse,
-- telephone, contact, slug, logo), `etablissement_notes`,
-- `etablissement_facturation`, `releves_facturation`, `actions_editeur`,
-- `support_interventions`, et le nouveau `etablissement_departs`. Le fichier du
-- LOGO aussi (bucket `etablissement-logos`).
-- EFFACE : tout le reste de l'ecole, ses comptes de connexion, ses fichiers.
--
-- L'ETAT vit sur l'etablissement (`donnees_effacees_le`, lisible pour griser la
-- fiche) ; l'HISTORIQUE des departs et reouvertures dans `etablissement_departs`
-- (serveur uniquement). `etablissements_effaces`, creee le meme jour pour l'ancien
-- modele et vide, est supprimee.
--
-- Idempotent.
-- ============================================================================

-- ── 1. Etat et historique ────────────────────────────────────────────────────
ALTER TABLE public.etablissements ADD COLUMN IF NOT EXISTS donnees_effacees_le timestamptz;

CREATE TABLE IF NOT EXISTS public.etablissement_departs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id  uuid NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  efface_le         timestamptz NOT NULL DEFAULT now(),
  efface_par        uuid,
  efface_par_email  text,
  lignes            jsonb NOT NULL,          -- { table: lignes effacees }
  comptes           integer NOT NULL DEFAULT 0,
  fichiers          integer NOT NULL DEFAULT 0,
  fichiers_effaces  integer,                 -- renseigne par la console apres le Storage
  rouvert_le        timestamptz,
  rouvert_par_email text
);
CREATE INDEX IF NOT EXISTS idx_etablissement_departs_etab ON public.etablissement_departs (etablissement_id, efface_le DESC);
ALTER TABLE public.etablissement_departs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.etablissement_departs FROM anon, authenticated;

DO $drop$
BEGIN
  IF to_regclass('public.etablissements_effaces') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.etablissements_effaces) THEN
      RAISE EXCEPTION 'etablissements_effaces contient des lignes : a examiner avant suppression.';
    END IF;
    DROP TABLE public.etablissements_effaces;
  END IF;
END
$drop$;

-- ── 2. Gardes : contourner AUSSI les mises a jour pendant un effacement ──────
-- Supprimer un cours met `evaluations.cours_id` a NULL : c'est un UPDATE, que la
-- garde de periode archivee refuserait si une archive (adulte, par exemple)
-- n'est pas encore partie. Le premier modele s'en tirait par l'ordre de la
-- cascade ; on ne s'appuie plus sur un ordre.
DO $do$
DECLARE
  f     text;
  v_def text;
  v_new text;
BEGIN
  FOREACH f IN ARRAY ARRAY['fn_guard_periode_archivee', 'fn_protect_reserved_presence_types'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_def
      FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = f;
    CONTINUE WHEN position('IF public.fn_effacement_en_cours() THEN RETURN CASE' IN v_def) > 0;
    v_new := replace(v_def,
      'IF TG_OP = ''DELETE'' AND public.fn_effacement_en_cours() THEN RETURN OLD; END IF;',
      'IF public.fn_effacement_en_cours() THEN RETURN CASE WHEN TG_OP = ''DELETE'' THEN OLD ELSE NEW END; END IF;');
    IF v_new = v_def THEN
      RAISE EXCEPTION 'Fonction % : garde d''effacement introuvable (jouer add-effacement-etablissement.sql d''abord).', f;
    END IF;
    EXECUTE v_new;
  END LOOP;
END
$do$;

-- ── 3. Classement des tables : exportee ? effacee ? ──────────────────────────
-- Le type de retour change : DROP puis CREATE.
DROP FUNCTION IF EXISTS public.fn_depart_tables();
CREATE FUNCTION public.fn_depart_tables()
RETURNS TABLE (nom text, filtre text, exporte boolean, efface boolean)
LANGUAGE plpgsql   -- VOLATILE : elle cree une table temporaire
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_inconnues text;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _depart_classement (nom text, filtre text, exporte boolean, efface boolean) ON COMMIT DROP;
  TRUNCATE _depart_classement;

  -- Toute table a `etablissement_id` est rattachee a l'ecole.
  --   conservees (editeur)  : ni exportees ni effacees ;
  --   techniques            : effacees, pas exportees ;
  --   les autres            : exportees ET effacees.
  INSERT INTO _depart_classement
  SELECT c.table_name::text,
         CASE WHEN c.table_name = 'profiles'
              THEN 'etablissement_id = $1 AND role <> ''super_admin'''
              ELSE 'etablissement_id = $1' END,
         c.table_name NOT IN ('etablissement_notes', 'etablissement_facturation', 'releves_facturation',
                              'actions_editeur', 'support_interventions', 'etablissement_departs',
                              'audit_logs', 'etablissement_smtp', 'push_subscriptions', 'year_audits'),
         c.table_name NOT IN ('etablissement_notes', 'etablissement_facturation', 'releves_facturation',
                              'actions_editeur', 'support_interventions', 'etablissement_departs')
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
   WHERE c.table_schema = 'public' AND c.column_name = 'etablissement_id';

  INSERT INTO _depart_classement VALUES
    ('etablissements',                'id = $1', true, false),   -- la fiche reste
    ('periods',                       'school_year_id IN (SELECT id FROM school_years WHERE etablissement_id = $1)', true, true),
    ('eval_type_configs',             'school_year_id IN (SELECT id FROM school_years WHERE etablissement_id = $1)', true, true),
    ('class_teachers',                'class_id IN (SELECT id FROM classes WHERE etablissement_id = $1)', true, true),
    ('enrollments',                   'class_id IN (SELECT id FROM classes WHERE etablissement_id = $1)', true, true),
    ('evaluation_order_config',       'class_id IN (SELECT id FROM classes WHERE etablissement_id = $1)', true, true),
    ('grades',                        'evaluation_id IN (SELECT id FROM evaluations WHERE etablissement_id = $1)', true, true),
    ('homework_status',               'homework_id IN (SELECT id FROM homework WHERE etablissement_id = $1)', true, true),
    ('adult_homework_status',         'homework_id IN (SELECT id FROM homework WHERE etablissement_id = $1)', true, true),
    ('announcement_recipients',       'announcement_id IN (SELECT id FROM announcements WHERE etablissement_id = $1)', true, true),
    ('announcement_staff_recipients', 'announcement_id IN (SELECT id FROM announcements WHERE etablissement_id = $1)', true, true),
    ('announcement_attachments',      'announcement_id IN (SELECT id FROM announcements WHERE etablissement_id = $1)', true, true),
    ('student_warning_attachments',   'warning_id IN (SELECT id FROM student_warnings WHERE etablissement_id = $1)', true, true),
    ('cours_modules',                 'unite_enseignement_id IN (SELECT id FROM unites_enseignement WHERE etablissement_id = $1)', true, true),
    ('cours',                         'unite_enseignement_id IN (SELECT id FROM unites_enseignement WHERE etablissement_id = $1)', true, true),
    -- Tables globales, sans donnee d'ecole.
    ('migrations_appliquees',         NULL, false, false);

  -- Une table classee nulle part fait echouer l'export comme l'effacement,
  -- plutot que d'etre oubliee en silence.
  SELECT string_agg(t.table_name, ', ' ORDER BY t.table_name) INTO v_inconnues
    FROM information_schema.tables t
   WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
     AND t.table_name NOT IN (SELECT d.nom FROM _depart_classement d);
  IF v_inconnues IS NOT NULL THEN
    RAISE EXCEPTION 'Table(s) non classee(s) pour le depart d''une ecole : %. Completez fn_depart_tables().', v_inconnues;
  END IF;

  RETURN QUERY SELECT d.nom, d.filtre, d.exporte, d.efface FROM _depart_classement d ORDER BY d.nom;
END
$fn$;
REVOKE ALL ON FUNCTION public.fn_depart_tables() FROM public, anon, authenticated;

-- ── 4. Effacement ────────────────────────────────────────────────────────────
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
  v_email     text;
  v_simule    boolean := false;
  v_passe     integer;
  v_reste     boolean;
BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Reserve a la console de l''editeur.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_etab FROM etablissements WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Etablissement introuvable.'; END IF;
  IF v_etab.slug IS DISTINCT FROM p_slug THEN
    RAISE EXCEPTION 'L''adresse saisie ne correspond pas a celle de l''ecole.';
  END IF;
  IF v_etab.donnees_effacees_le IS NOT NULL THEN
    RAISE EXCEPTION 'Les donnees de cette ecole sont deja effacees.';
  END IF;
  IF v_etab.is_active THEN
    RAISE EXCEPTION 'Coupez d''abord l''acces de l''ecole.';
  END IF;
  -- Un super-admin rattache verrait son PROPRE compte efface avec ceux de l'ecole.
  IF EXISTS (SELECT 1 FROM profiles WHERE etablissement_id = p_id AND role = 'super_admin')
     OR EXISTS (SELECT 1 FROM support_interventions WHERE etablissement_id = p_id AND closed_at IS NULL) THEN
    RAISE EXCEPTION 'Une intervention de support est en cours dans cette ecole : quittez-la d''abord.';
  END IF;

  PERFORM count(*) FROM fn_depart_tables();   -- leve si une table n'est pas classee

  -- ── Comptage AVANT : chaque table, en entier et pour cette ecole ──
  FOR r IN SELECT * FROM fn_depart_tables() WHERE filtre IS NOT NULL LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', r.nom) INTO n;
    v_tot_avant := v_tot_avant || jsonb_build_object(r.nom, n);
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %s', r.nom, r.filtre) INTO n USING p_id;
    v_eco_avant := v_eco_avant || jsonb_build_object(r.nom, n);
  END LOOP;

  SELECT array_agg(id) INTO v_comptes FROM profiles WHERE etablissement_id = p_id AND role <> 'super_admin';
  -- Tous les fichiers, SAUF le logo (identite conservee).
  SELECT coalesce(jsonb_agg(jsonb_build_object('bucket', bucket_id, 'nom', name)), '[]'::jsonb) INTO v_fichiers
    FROM storage.objects
   WHERE name LIKE p_id::text || '/%' AND bucket_id <> 'etablissement-logos';

  BEGIN
    PERFORM set_config('app.effacement_etablissement', p_id::text, true);

    -- Ce que les cles imposent : NO ACTION, RESTRICT, et la table sans cle.
    DELETE FROM expenses       WHERE etablissement_id = p_id;
    DELETE FROM other_revenues WHERE etablissement_id = p_id;
    DELETE FROM evaluation_order_config WHERE class_id IN (SELECT id FROM classes WHERE etablissement_id = p_id);
    DELETE FROM students       WHERE etablissement_id = p_id;
    DELETE FROM cours          WHERE unite_enseignement_id IN (SELECT id FROM unites_enseignement WHERE etablissement_id = p_id);
    DELETE FROM cours_modules  WHERE unite_enseignement_id IN (SELECT id FROM unites_enseignement WHERE etablissement_id = p_id);

    -- Le reste, table par table. L'ordre des cles entre tables n'est pas
    -- suppose : une suppression refusee par une cle est retentee a la passe
    -- suivante, une fois ses dependances parties. Les comptes viennent en
    -- dernier (beaucoup de cles NO ACTION pointent vers `profiles`).
    FOR v_passe IN 1..10 LOOP
      v_reste := false;
      FOR r IN SELECT * FROM fn_depart_tables() WHERE efface AND filtre IS NOT NULL AND nom <> 'profiles' LOOP
        BEGIN
          EXECUTE format('DELETE FROM public.%I WHERE %s', r.nom, r.filtre) USING p_id;
        EXCEPTION WHEN foreign_key_violation OR restrict_violation THEN
          v_reste := true;
        END;
      END LOOP;
      EXIT WHEN NOT v_reste;
    END LOOP;
    DELETE FROM auth.users WHERE id = ANY (coalesce(v_comptes, '{}'));   -- profils en cascade

    -- ── Comptage APRES ──
    FOR r IN SELECT * FROM fn_depart_tables() WHERE filtre IS NOT NULL LOOP
      EXECUTE format('SELECT count(*) FROM public.%I', r.nom) INTO n;
      IF r.efface THEN
        -- Plus rien de cette ecole, et rien d'une autre.
        IF (v_tot_avant ->> r.nom)::bigint - n <> (v_eco_avant ->> r.nom)::bigint THEN
          RAISE EXCEPTION 'Controle d''integrite : la table % a perdu % ligne(s) au lieu de %. Rien n''a ete efface.',
            r.nom, (v_tot_avant ->> r.nom)::bigint - n, v_eco_avant ->> r.nom;
        END IF;
        IF (v_eco_avant ->> r.nom)::bigint > 0 THEN
          v_lignes := v_lignes || jsonb_build_object(r.nom, (v_eco_avant ->> r.nom)::bigint);
        END IF;
      ELSIF (v_tot_avant ->> r.nom)::bigint <> n THEN
        RAISE EXCEPTION 'Controle d''integrite : la table conservee % a change (% -> %). Rien n''a ete efface.',
          r.nom, v_tot_avant ->> r.nom, n;
      END IF;
    END LOOP;

    -- Etat et historique, ENCORE sous le marqueur : sans lui, le declencheur
    -- d'audit rouvrirait un journal pour l'ecole qu'on vient de vider.
    SELECT email INTO v_email FROM profiles WHERE id = p_auteur;
    UPDATE etablissements SET donnees_effacees_le = now() WHERE id = p_id;
    INSERT INTO etablissement_departs (etablissement_id, efface_par, efface_par_email, lignes, comptes, fichiers)
    VALUES (p_id, p_auteur, v_email, v_lignes, coalesce(array_length(v_comptes, 1), 0), jsonb_array_length(v_fichiers));

    IF NOT p_reel THEN
      RAISE EXCEPTION USING ERRCODE = 'ZZ001', MESSAGE = 'simulation';
    END IF;
  EXCEPTION
    WHEN SQLSTATE 'ZZ001' THEN v_simule := true;   -- tout est annule, les comptes restent
  END;

  PERFORM set_config('app.effacement_etablissement', '', true);

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

-- ── 5. Le releve mensuel ne compte plus une ecole effacee ────────────────────
DO $do$
DECLARE
  v_def text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'fn_releve_facturation';
  IF v_def IS NULL THEN RAISE EXCEPTION 'fn_releve_facturation introuvable.'; END IF;
  IF position('donnees_effacees_le' IN v_def) = 0 THEN
    v_new := regexp_replace(v_def, '(\s)ON\s+CONFLICT', E'\\1  WHERE e.donnees_effacees_le IS NULL\\1ON CONFLICT');
    IF v_new = v_def THEN RAISE EXCEPTION 'fn_releve_facturation : ancrage ON CONFLICT introuvable.'; END IF;
    EXECUTE v_new;
  END IF;
END
$do$;

-- ── 6. Verification ──────────────────────────────────────────────────────────
DO $verif$
BEGIN
  PERFORM count(*) FROM fn_depart_tables();   -- leve si une table n'est pas classee
  IF (SELECT count(*) FROM fn_depart_tables() WHERE NOT efface AND filtre IS NOT NULL) <> 7 THEN
    RAISE EXCEPTION 'Verification : 7 tables conservees attendues (fiche + 6 tables de l''editeur).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_releve_facturation' AND prosrc LIKE '%donnees_effacees_le IS NULL%') THEN
    RAISE EXCEPTION 'Verification : le releve compte encore les ecoles effacees.';
  END IF;
  IF (SELECT count(*) FROM pg_proc WHERE proname IN ('fn_guard_periode_archivee', 'fn_protect_reserved_presence_types')
        AND prosrc LIKE '%THEN RETURN CASE WHEN TG_OP%') <> 2 THEN
    RAISE EXCEPTION 'Verification : gardes non elargies aux mises a jour.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.routine_privileges
              WHERE routine_name = 'effacer_etablissement' AND grantee IN ('anon', 'authenticated', 'PUBLIC')) THEN
    RAISE EXCEPTION 'Verification : effacer_etablissement executable hors service-role.';
  END IF;
END
$verif$;

-- Registre des migrations (voir supabase/migrations/README.md).
SELECT enregistrer_migration('rework-effacement-etablissement.sql', '3a4c91031b113a1bd0f5c134c4d6b82cd0f0b5a04c1c1de2356bffc7dfced7b7');
