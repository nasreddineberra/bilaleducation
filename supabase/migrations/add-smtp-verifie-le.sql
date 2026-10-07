-- ============================================================================
-- MESSAGERIE « EPROUVEE » : la trace d'un envoi reussi
--
-- Pour la liste de mise en service de la console (7 octobre). « Configuree » et
-- « eprouvee » sont deux choses differentes : le 15 juillet, aucun email
-- n'etait jamais parti alors que tout paraissait en place.
--
-- DEFINITION : un email est REELLEMENT PARTI avec la configuration enregistree.
-- Pose par le bouton « Tester la connexion » quand il teste la configuration
-- enregistree, et par le premier envoi reel reussi (devoir, relance, message).
-- REMIS A VIDE des que la configuration change.
--
-- Pourquoi pas seulement le bouton de test : il teste la configuration SAISIE,
-- le plus souvent AVANT de l'enregistrer. Dans l'ordre naturel (tester, puis
-- enregistrer), il ne laisserait jamais de trace.
--
-- La table reste en regime « serveur uniquement » (RLS sans policy, privileges
-- revoques) : rien a changer de ce cote.
--
-- Idempotent.
-- ============================================================================

ALTER TABLE public.etablissement_smtp
  ADD COLUMN IF NOT EXISTS verifie_le timestamptz;

COMMENT ON COLUMN public.etablissement_smtp.verifie_le IS
  'Premier envoi reussi avec la configuration enregistree (test ou envoi reel). NULL = jamais eprouvee depuis la derniere modification.';

-- Registre des migrations (voir supabase/migrations/README.md).
SELECT enregistrer_migration('add-smtp-verifie-le.sql', '45da9479f22b77b501427e550f552ba21fc5c142791187a27e72dde9120402d4');
