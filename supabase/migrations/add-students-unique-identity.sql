-- ============================================================================
-- UNICITE DE L'IDENTITE D'UN APPRENANT, PAR ETABLISSEMENT
--
-- Cle : etablissement + NOM + PRENOM + DATE DE NAISSANCE (noms normalises).
--
-- ┌─ POURQUOI LA DATE DE NAISSANCE ENTRE DANS LA CLE ────────────────────────┐
-- │ Les enseignants sont contraints sur NOM + PRENOM seuls, avec la          │
-- │ consequence assumee que deux homonymes reels doivent etre distingues     │
-- │ artificiellement. A 200-300 eleves issus d'une meme communaute, ce n'est │
-- │ plus tenable : deux cousins « ABBASSI Adam » sont un cas ordinaire.      │
-- │                                                                          │
-- │ Un eleve a ce qu'un enseignant n'a pas : une date de naissance, et elle  │
-- │ est `NOT NULL` en base — verifie avant d'ecrire cette migration. Il n'y  │
-- │ a donc AUCUNE echappatoire par le vide : PostgreSQL considere deux NULL  │
-- │ comme distincts, et une colonne nullable aurait laisse passer deux       │
-- │ eleves sans date.                                                        │
-- │                                                                          │
-- │ Resultat : deux homonymes nes a des dates differentes sont acceptes,     │
-- │ deux fiches de la MEME personne sont refusees.                          │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- ── POURQUOI UN INDEX ET PAS SEULEMENT UN CONTROLE APPLICATIF ──────────────
--
-- Le controle vivait UNIQUEMENT dans le formulaire, et il etait a moitie faux :
-- `.ilike('last_name', …)` ignore la casse mais PAS les accents, alors que le
-- prenom, lui, etait normalise — « BÉRRA Leila » et « BERRA Leila » n'etaient
-- meme pas rapproches. Et cet ecran ECRIT DIRECTEMENT depuis le navigateur :
-- la contrainte du formulaire se contourne par un appel a l'API REST.
--
-- Un index, non. La base refuse, quelle que soit la voie d'entree.
--
-- Verifie avant ecriture : 45 apprenants, 0 doublon.
--
-- Idempotent.
-- ============================================================================

-- ── 1. Refus AVANT toute creation d'index ──────────────────────────────────
--
-- `CREATE UNIQUE INDEX` echouerait de lui-meme sur des doublons existants,
-- mais avec un message qui ne nomme personne. On les liste d'abord : une
-- migration qui s'arrete doit dire QUOI corriger, pas seulement QUE ca coince.

DO $$
DECLARE
  v_liste text;
BEGIN
  -- Le regroupement porte sur la cle NORMALISEE seule. Y ajouter les colonnes
  -- brutes pour l'affichage placerait « BÉRRA » et « BERRA » dans deux groupes
  -- distincts — le controle laisserait alors passer exactement les doublons
  -- qu'il est cense trouver. D'ou `max()` pour l'affichage.
  SELECT string_agg(txt, ' · ') INTO v_liste
  FROM (
    SELECT format('%s %s (%s) x%s',
                  max(last_name), max(first_name), date_of_birth, count(*)) AS txt
    FROM public.students
    GROUP BY etablissement_id,
             public.norm_name(last_name),
             public.norm_name(first_name),
             date_of_birth
    HAVING count(*) > 1
  ) d;

  IF v_liste IS NOT NULL THEN
    RAISE EXCEPTION
      'Des apprenants en double existent deja, l''index ne peut pas etre pose. A corriger avant : %',
      v_liste;
  END IF;
END $$;

-- ── 2. L'index ─────────────────────────────────────────────────────────────
--
-- `norm_name()` est IMMUTABLE (creee pour les enseignants le 3 aout) : une
-- fonction seulement STABLE — comme `unaccent` — serait refusee dans un index.

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_unique_identite
  ON public.students (
    etablissement_id,
    public.norm_name(last_name),
    public.norm_name(first_name),
    date_of_birth
  );

COMMENT ON INDEX public.idx_students_unique_identite IS
  'Un apprenant est unique par etablissement sur NOM + PRENOM (normalises) + date de naissance. '
  'La date de naissance distingue les homonymes reels, frequents dans une meme communaute.';

SELECT 'Index unique d''identite pose sur students (etablissement + nom + prenom + naissance).' AS status;
