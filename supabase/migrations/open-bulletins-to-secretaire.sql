-- ============================================================================
-- BILAL EDUCATION — Bulletins ouverts a la SECRETAIRE, en lecture ET ecriture
-- ----------------------------------------------------------------------------
-- Constate le 29 septembre 2026, pendant le parcours du compte secretaire.
--
-- ── L'INCOHERENCE ──────────────────────────────────────────────────────────
--
-- La secretaire avait :
--   . la SAISIE DES NOTES et les GABARITS (ouverts le 5 aout, avec elargissement
--     explicite des selecteurs de perimetre « sans quoi elle serait tombee dans
--     la branche enseignant et aurait vu zero classe ») ;
--   . la LECTURE du bucket `bulletins`, ou elle est NOMMEMENT listee parmi les
--     cinq roles lecteurs depuis le 25 juillet.
--
-- Mais l'ecran Bulletins lui etait ferme, et l'entree de menu aussi. Elle
-- saisissait donc les notes qui PRODUISENT les bulletins sans pouvoir voir le
-- resultat de sa propre saisie — et le droit de lecture sur le bucket etait un
-- droit QU'AUCUN ECRAN N'EXERÇAIT. C'est le meme signe que celui releve le
-- 16 septembre sur les demandes de support : une policy que rien n'utilise
-- signale un ecran manquant, pas un droit en trop.
--
-- ── LA DECISION (utilisateur, 29/09) ───────────────────────────────────────
--
-- « Elle peut etre amenee exceptionnellement a faire les actions d'un
-- enseignant, donc les 4 » — consulter, saisir les appreciations, archiver,
-- desarchiver — « en lecture ecriture ».
--
-- L'archivage DEPOSE un PDF et le desarchivage le SUPPRIME. Sans cette
-- migration, l'ecran lui offrirait les deux boutons et le stockage refuserait :
-- la ligne d'archive serait ecrite en base (la table `bulletin_archives` n'a
-- pas encore de controle de role — chantier RLS en cours) mais le fichier ne
-- suivrait pas. Un archivage a moitie fait, sans message clair. C'est
-- exactement ce que cette migration evite.
--
-- ── FORME ──────────────────────────────────────────────────────────────────
--
-- Recopie EXACTE des policies du 25 juillet, avec `secretaire` ajoutee aux
-- trois policies d'ecriture. Le cloisonnement par etablissement
-- (`storage.foldername(name))[1]`) et le SELECT restent inchanges — elle y
-- figurait deja.
--
-- L'enseignant reste en LECTURE SEULE : il consulte les bulletins de ses
-- classes, il ne les archive pas. Le comptable reste exclu (decision du
-- 25 juillet).
--
-- Idempotent.
-- ============================================================================

-- UPDATE necessaire car l'archivage televerse en `upsert: true` (re-archivage).

DROP POLICY IF EXISTS "bulletins_pdf_insert" ON storage.objects;
CREATE POLICY bulletins_pdf_insert ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'bulletins'
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire')
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
  );

DROP POLICY IF EXISTS "bulletins_pdf_update" ON storage.objects;
CREATE POLICY bulletins_pdf_update ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'bulletins'
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire')
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
  );

DROP POLICY IF EXISTS "bulletins_pdf_delete" ON storage.objects;
CREATE POLICY bulletins_pdf_delete ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'bulletins'
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire')
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
  );

SELECT 'Bucket bulletins : la secretaire ecrit desormais (archivage / desarchivage).' AS status;
