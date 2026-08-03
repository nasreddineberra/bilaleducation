-- ============================================================================
-- Categorie « CV » pour les documents d'enseignant.
--
-- La colonne `teacher_documents.category` porte un CHECK ferme : ajouter une
-- categorie cote application ne suffit pas, l'insertion serait rejetee (23514).
--
-- Aucune donnee existante n'est touchee : on ne fait qu'ELARGIR la liste, donc
-- toutes les lignes deja en base restent valides.
--
-- Idempotent.
-- ============================================================================

ALTER TABLE teacher_documents
  DROP CONSTRAINT IF EXISTS teacher_documents_category_check;

ALTER TABLE teacher_documents
  ADD CONSTRAINT teacher_documents_category_check
  CHECK (category IN ('contrat', 'cv', 'diplome', 'identite', 'autre'));

SELECT 'Categorie CV ajoutee a teacher_documents.category.' AS status;
