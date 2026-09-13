-- ============================================================================
-- L'EMAIL DU TUTEUR 1 DEVIENT OBLIGATOIRE EN BASE
--
-- ┌─ POURQUOI LA BASE, ALORS QUE TROIS NIVEAUX L'EXIGENT DEJA ───────────────┐
-- │ Le formulaire le marque obligatoire, `CreateParentSchema` le valide et   │
-- │ la server action d'import le reverifie. Et pourtant un foyer a ete cree  │
-- │ SANS email le 24 aout.                                                   │
-- │                                                                          │
-- │ Le mecanisme : sur l'ecran d'import, cocher un foyer est un INSTANT. On  │
-- │ coche pendant qu'il est valide, on vide la cellule ensuite, la case      │
-- │ reste cochee. Le schema Zod, lui, declarait l'email `.optional()`.       │
-- │                                                                          │
-- │ Les trois garde-fous applicatifs ont ete corriges. Celui-ci est le seul  │
-- │ INCONTOURNABLE : la fiche parent ecrit directement depuis le navigateur, │
-- │ toute regle qui ne vit pas en base se contourne par un appel a l'API.    │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- ── LA CONSEQUENCE EST ASSUMEE ─────────────────────────────────────────────
--
-- Une famille sans adresse email ne peut plus etre enregistree. C'est un
-- choix : l'email est le SEUL canal de l'etablissement vers les familles
-- (devoirs, relances, annonces, bulletins). Un foyer sans adresse est un
-- foyer qu'on ne peut pas joindre, et qui disparait silencieusement de tous
-- les comptes rendus d'envoi sous le statut « skipped ».
--
-- Le tuteur 2 reste facultatif : un foyer peut n'avoir qu'un responsable.
--
-- ── LE VIDE N'EST PAS QUE `NULL` ───────────────────────────────────────────
--
-- `NOT NULL` seul laisserait passer la chaine vide, qu'un appel a l'API peut
-- tres bien ecrire. D'ou le CHECK sur `btrim()` : c'est la meme valeur pour
-- l'utilisateur, elle doit etre refusee de la meme facon.
--
-- Aucun controle de FORME ici (pas de motif d'adresse) : une expression trop
-- stricte refuserait des adresses legitimes, et la validation de forme a deja
-- sa place dans le schema Zod.
--
-- Idempotent.
-- ============================================================================

-- ── 1. Refus AVANT toute contrainte ────────────────────────────────────────
--
-- `ALTER TABLE ... SET NOT NULL` echouerait de lui-meme, mais sans nommer
-- personne. Une migration qui s'arrete doit dire QUI corriger.

DO $$
DECLARE
  v_liste text;
BEGIN
  SELECT string_agg(format('%s %s', tutor1_last_name, tutor1_first_name), ' · ')
    INTO v_liste
  FROM public.parents
  WHERE tutor1_email IS NULL OR btrim(tutor1_email) = '';

  IF v_liste IS NOT NULL THEN
    RAISE EXCEPTION
      'Des foyers n''ont pas d''email de tuteur 1, la contrainte ne peut pas etre posee. A completer avant : %',
      v_liste;
  END IF;
END $$;

-- ── 2. Les deux contraintes ────────────────────────────────────────────────

ALTER TABLE public.parents
  ALTER COLUMN tutor1_email SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'parents_tutor1_email_non_vide'
      AND conrelid = 'public.parents'::regclass
  ) THEN
    ALTER TABLE public.parents
      ADD CONSTRAINT parents_tutor1_email_non_vide
      CHECK (btrim(tutor1_email) <> '');
  END IF;
END $$;

COMMENT ON COLUMN public.parents.tutor1_email IS
  'Obligatoire : seul canal de l''etablissement vers la famille. Le tuteur 2 reste facultatif.';

SELECT 'Email du tuteur 1 desormais obligatoire en base (NOT NULL + non vide).' AS status;
