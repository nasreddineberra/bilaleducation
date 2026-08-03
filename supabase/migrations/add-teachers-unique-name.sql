-- ============================================================================
-- Unicite du couple NOM + PRENOM des enseignants, par etablissement.
--
-- Jusqu'ici le controle de doublon etait UNIQUEMENT cote client (formulaire) :
--   - deux creations simultanees passaient toutes les deux ;
--   - tout appel hors formulaire creait le doublon sans obstacle ;
--   - le filtre `ilike` sur le nom ignorait la casse mais PAS les accents,
--     donc « BERRA » et « BÉRRA » n'etaient meme pas rapproches.
-- Cet index est le filet de securite : la base refuse le doublon quelle que
-- soit la voie d'entree.
--
-- CONSEQUENCE ASSUMEE : deux enseignants HOMONYMES reels (memes nom et prenom
-- dans le meme etablissement) deviennent impossibles a enregistrer tels quels.
-- Il faudra les distinguer (second prenom, initiale). Cas juge rare devant le
-- risque de doublon accidentel.
--
-- Idempotent.
-- ============================================================================

-- Normalisation partagee : sans casse, sans accents, espaces reduits.
-- IMMUTABLE (obligatoire pour un index) et sans dependance a `unaccent`, dont
-- la forme a un argument est seulement STABLE et donc inutilisable en index.
CREATE OR REPLACE FUNCTION public.norm_name(txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(
    translate(
      btrim(regexp_replace(coalesce(txt, ''), '\s+', ' ', 'g')),
      'àáâãäåçèéêëìíîïñòóôõöùúûüýÿÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ',
      'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY'
    )
  )
$$;

COMMENT ON FUNCTION public.norm_name(text) IS
  'Normalisation d''un nom pour comparaison : minuscules, sans accents, espaces reduits. IMMUTABLE (utilisable en index).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_teachers_unique_name
  ON public.teachers (
    etablissement_id,
    public.norm_name(last_name),
    public.norm_name(first_name)
  );

SELECT 'Index unique nom+prenom cree sur teachers (par etablissement).' AS status;
