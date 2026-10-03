-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  L import ecrit les NOTES MEDICALES de l apprenant                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- POURQUOI. L export de l ancien logiciel de Bilal-Neuville portait, dans une
-- colonne « Commentaire », onze informations de sante reelles — dont « allergique
-- aux fruits de mer » et « allergique au rachis + diabetique de type 1 ». Le
-- gabarit d import n avait aucune colonne pour les accueillir : elles seraient
-- restees sur le quai, a ressaisir a la main, ou perdues.
--
-- RIEN A CREER COTE APPRENANT : `students.medical_notes` existe deja et la fiche
-- l affiche deja (FloatTextarea « Notes médicales »). Cette migration n ouvre
-- donc pas un champ de plus, elle ouvre un CHEMIN vers celui qui existe.
--
-- POURQUOI UNE MIGRATION ET PAS SEULEMENT DU TYPESCRIPT : `import_foyer`
-- ENUMERE ses colonnes une par une, a dessein — « jamais de SQL dynamique, une
-- cle inattendue dans le JSON ne peut pas atteindre une colonne qu on n a pas
-- voulue ». C est precisement ce qui se passerait ici : sans cette migration, la
-- valeur arriverait dans `p_enfants` et serait ignoree EN SILENCE.
--
-- ── POURQUOI ON RAPIECE AU LIEU DE REECRIRE LA FONCTION ────────────────────
--
-- La forme habituelle serait de recopier les 200 lignes de `import_foyer` avec
-- deux lignes en plus. Elle a un defaut : si la fonction EN BASE a devie du
-- fichier du depot, la recopie ecraserait cette derive SANS RIEN DIRE. Or la
-- regle du projet, payee le 5 aout, est que seule la base fait foi.
--
-- On travaille donc sur la definition REELLE (`pg_get_functiondef`) et on n y
-- remplace que deux passages. Si les ancrages ont bouge, la migration LEVE au
-- lieu de produire une fonction a moitie juste.
--
-- CE QUI NE CHANGE PAS : un apprenant DEJA enregistre n est jamais modifie par
-- l import. Les notes medicales ne s ecrivent donc qu a la CREATION et se
-- corrigent ensuite sur la fiche — un fichier perime ne peut pas ecraser une
-- allergie mise a jour entre-temps.
--
-- DONNEE DE SANTE (RGPD, article 9) : la colonne et son affichage preexistent,
-- l import n ouvre aucune exposition nouvelle. La valeur voyage en revanche
-- desormais dans un fichier `.xlsx`, qui ne doit pas trainer.

DO $maj$
DECLARE
  src    text;
  avant  text;
  n      int;
BEGIN
  -- ── Garde ────────────────────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'students'
       AND column_name = 'medical_notes'
  ) THEN
    RAISE EXCEPTION 'students.medical_notes est introuvable : ne pas appliquer a l aveugle.';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'import_foyer';

  IF src IS NULL THEN
    RAISE EXCEPTION 'import_foyer() est introuvable.';
  END IF;

  -- Deja fait ? La migration est alors sans objet, et se rejouer ne doit pas
  -- ajouter la colonne une seconde fois.
  IF position('medical_notes' in src) > 0 THEN
    RAISE NOTICE 'Rien a faire : import_foyer() ecrit deja medical_notes.';
    RETURN;
  END IF;

  avant := src;

  -- 1. La liste des COLONNES de l INSERT. Ancrage tolerant aux espaces et aux
  --    retours a la ligne : on ne parie pas sur l indentation.
  src := regexp_replace(
    src,
    '(emergency_contact_name,\s*emergency_contact_phone)(\s*\))',
    '\1,' || E'\n        medical_notes' || '\2');

  -- 2. La liste des VALEURS du SELECT, juste apres le contact d urgence.
  src := regexp_replace(
    src,
    '(p\.tutor1_last_name \|\| '' '' \|\| p\.tutor1_first_name,\s*p\.tutor1_phone)',
    '\1,' || E'\n        nullif(btrim(coalesce(v_enfant->>''medical_notes'', '''')), '''')');

  n := (length(src) - length(replace(src, 'medical_notes', ''))) / length('medical_notes');
  IF n <> 2 THEN
    RAISE EXCEPTION
      'Les ancrages ont bouge : medical_notes insere % fois au lieu de 2. Rien applique.', n;
  END IF;
  IF src = avant THEN
    RAISE EXCEPTION 'Le remplacement n a rien change. Rien applique.';
  END IF;

  EXECUTE src;
END
$maj$;

-- Verification independante : on relit la fonction depuis le catalogue.
DO $verif$
DECLARE
  src text;
  n   int;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'import_foyer';

  n := (length(src) - length(replace(src, 'medical_notes', ''))) / length('medical_notes');
  IF n < 2 THEN
    RAISE EXCEPTION 'medical_notes apparait % fois dans import_foyer(), attendu 2.', n;
  END IF;

  RAISE NOTICE 'OK : import_foyer() ecrit desormais medical_notes.';
END
$verif$;
