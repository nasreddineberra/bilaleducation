-- ============================================================================
-- DOCUMENTS REQUIS : ECRITURE RESERVEE A ADMIN / DIRECTION (18 octobre 2026)
--
-- Les quatre policies de `document_type_configs` ne portaient que l'ECOLE :
-- tout compte de l'ecole (enseignant, secretaire, comptable... et parent quand
-- les comptes seront ouverts) pouvait creer, modifier ou supprimer les
-- documents requis par l'API REST. Le seul ecran qui les ecrit
-- (Parametres > Etablissement) est reserve a admin / direction.
--
-- - SELECT : inchange sur le fond (l'ecole), la fiche apprenant et les tableaux
--   de bord Direction / Secretaire lisent la liste.
-- - INSERT, UPDATE, DELETE : l'ecole ET le role admin / direction
--   (`get_user_role()` repond `admin` pour l'editeur en intervention).
-- - `current_etablissement_id()` remplace la sous-requete sur `profiles`.
--
-- Changement RESTRICTIF : le code (garde serveur de la page) part d'abord.
-- Controle : supabase/controles/12-documents-requis-roles.sql.
-- ============================================================================

DROP POLICY IF EXISTS doc_type_configs_select ON public.document_type_configs;
DROP POLICY IF EXISTS doc_type_configs_insert ON public.document_type_configs;
DROP POLICY IF EXISTS doc_type_configs_update ON public.document_type_configs;
DROP POLICY IF EXISTS doc_type_configs_delete ON public.document_type_configs;

CREATE POLICY doc_type_configs_select ON public.document_type_configs
  FOR SELECT TO authenticated
  USING (etablissement_id = current_etablissement_id());

CREATE POLICY doc_type_configs_insert ON public.document_type_configs
  FOR INSERT TO authenticated
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') IN ('admin', 'direction')
  );

CREATE POLICY doc_type_configs_update ON public.document_type_configs
  FOR UPDATE TO authenticated
  USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') IN ('admin', 'direction')
  )
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') IN ('admin', 'direction')
  );

CREATE POLICY doc_type_configs_delete ON public.document_type_configs
  FOR DELETE TO authenticated
  USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') IN ('admin', 'direction')
  );

-- Registre des migrations (voir supabase/migrations/README.md).
SELECT enregistrer_migration('restrict-document-type-configs.sql', 'd2ac7a4dca350468bfbe3f9d5ee7b9be1f32931333f863b9d44f3d0d18109413');
