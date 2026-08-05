-- ============================================================================
-- Deux corrections faisant suite à la passe RLS du 5 août
--
-- 1. La secrétaire ne doit PAS pouvoir supprimer un enseignant (décision
--    utilisateur). `teachers_write` étant en `FOR ALL`, elle couvrait aussi le
--    DELETE : il faut séparer les commandes.
--
-- 2. Le référentiel pédagogique (UE → modules → cours) est ouvert au
--    responsable pédagogique. Ses policies l'autorisaient DÉJÀ — seule la
--    sidebar le fermait. En revanche elles ont le défaut INVERSE des tables
--    centrales : le rôle sans le tenant. Et elles ferment le référentiel à
--    l'enseignant alors que les écrans Gabarits et Saisie des notes en
--    chargent l'arbre pour lui : son arbre est VIDE aujourd'hui.
--
-- Idempotent.
-- ============================================================================

-- ── 1. teachers : la suppression sort du périmètre de la secrétaire ─────────
--
-- Trois policies au lieu d'une : INSERT et UPDATE pour admin / direction /
-- secrétaire, DELETE pour admin et direction seuls. Supprimer un enseignant
-- entraîne son compte de connexion et ses fichiers : ce n'est pas une écriture
-- comme une autre.
DROP POLICY IF EXISTS teachers_write  ON teachers;
DROP POLICY IF EXISTS teachers_insert ON teachers;
DROP POLICY IF EXISTS teachers_update ON teachers;
DROP POLICY IF EXISTS teachers_delete ON teachers;

CREATE POLICY teachers_insert ON teachers FOR INSERT
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','secretaire'])
  );

CREATE POLICY teachers_update ON teachers FOR UPDATE
  USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','secretaire'])
  )
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','secretaire'])
  );

CREATE POLICY teachers_delete ON teachers FOR DELETE
  USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction'])
  );

-- ── 2. Référentiel pédagogique ──────────────────────────────────────────────
--
-- `unites_enseignement` porte `etablissement_id` ; `cours_modules` et `cours`
-- s'y rattachent par `unite_enseignement_id`, d'où le cloisonnement en cascade.
--
-- LECTURE ouverte à tout le personnel : l'arbre du référentiel s'affiche sur
-- les Gabarits, la Saisie des notes et les Bulletins. Le fermer y produit un
-- arbre vide — sans message, la RLS ne refusant pas mais ne renvoyant rien.
--
-- ÉCRITURE : admin, direction, responsable pédagogique — ce que les policies
-- d'origine prévoyaient déjà.

DROP POLICY IF EXISTS "Gestion UE"           ON unites_enseignement;
DROP POLICY IF EXISTS ue_select              ON unites_enseignement;
DROP POLICY IF EXISTS ue_write               ON unites_enseignement;

CREATE POLICY ue_select ON unites_enseignement FOR SELECT
  USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable','responsable_pedagogique','enseignant','secretaire'])
  );

CREATE POLICY ue_write ON unites_enseignement FOR ALL
  USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique'])
  )
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique'])
  );

DROP POLICY IF EXISTS "Gestion modules cours" ON cours_modules;
DROP POLICY IF EXISTS cours_modules_select    ON cours_modules;
DROP POLICY IF EXISTS cours_modules_write     ON cours_modules;

CREATE POLICY cours_modules_select ON cours_modules FOR SELECT
  USING (
    unite_enseignement_id IN (SELECT id FROM unites_enseignement WHERE etablissement_id = current_etablissement_id())
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable','responsable_pedagogique','enseignant','secretaire'])
  );

CREATE POLICY cours_modules_write ON cours_modules FOR ALL
  USING (
    unite_enseignement_id IN (SELECT id FROM unites_enseignement WHERE etablissement_id = current_etablissement_id())
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique'])
  )
  WITH CHECK (
    unite_enseignement_id IN (SELECT id FROM unites_enseignement WHERE etablissement_id = current_etablissement_id())
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique'])
  );

DROP POLICY IF EXISTS "Gestion cours" ON cours;
DROP POLICY IF EXISTS cours_select    ON cours;
DROP POLICY IF EXISTS cours_write     ON cours;

CREATE POLICY cours_select ON cours FOR SELECT
  USING (
    unite_enseignement_id IN (SELECT id FROM unites_enseignement WHERE etablissement_id = current_etablissement_id())
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable','responsable_pedagogique','enseignant','secretaire'])
  );

CREATE POLICY cours_write ON cours FOR ALL
  USING (
    unite_enseignement_id IN (SELECT id FROM unites_enseignement WHERE etablissement_id = current_etablissement_id())
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique'])
  )
  WITH CHECK (
    unite_enseignement_id IN (SELECT id FROM unites_enseignement WHERE etablissement_id = current_etablissement_id())
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique'])
  );

-- ── Vérification ────────────────────────────────────────────────────────────
--   select tablename, policyname, cmd
--   from pg_policies
--   where schemaname = 'public'
--     and tablename in ('teachers','unites_enseignement','cours_modules','cours')
--   order by tablename, cmd, policyname;
--
-- Attendu : teachers → 4 policies (SELECT, INSERT, UPDATE, DELETE) ;
--           les trois tables du référentiel → 2 chacune (_select, _write).
