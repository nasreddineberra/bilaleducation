-- ============================================================================
-- BILAL EDUCATION — `file_url` quitte les deux tables d'archives de bulletins
-- ----------------------------------------------------------------------------
-- Le 25 juillet, le bucket des bulletins est passe en PRIVE : tout passe par
-- `file_path` et une URL signee a la consultation. `file_url` (l'ancienne URL
-- publique persistee) a ete rendue nullable, on a cesse de l'ecrire, et le
-- journal notait « DROP COLUMN une fois le nouveau flux confirme ».
--
-- Le flux est confirme depuis (archivage et onglet Scolarite eprouves a l'ecran
-- le 10 aout). Verifie avant d'ecrire : AUCUNE occurrence de `file_url` sur ces
-- deux tables dans le code — les `file_url` restants concernent d'autres tables
-- (documents, pieces d'avertissement).
--
-- Une colonne morte trompe celui qui lit le schema dans six mois : c'est le
-- motif de `policies.sql`, qui a induit en erreur l'audit RLS du 5 aout.
--
-- IRREVERSIBLE : les anciennes valeurs partent avec la colonne. Elles ne
-- designaient plus rien (bucket prive, URL publique inoperante).
--
-- Idempotent.
-- ============================================================================

ALTER TABLE public.bulletin_archives       DROP COLUMN IF EXISTS file_url;
ALTER TABLE public.adult_bulletin_archives DROP COLUMN IF EXISTS file_url;

SELECT 'file_url supprimee de bulletin_archives et adult_bulletin_archives.' AS status;
