-- ============================================================================
-- Notifications de l'equipe : suppression par le destinataire (une fois lue)
--
-- Une notification de la cloche est une ligne de `announcement_staff_recipients`.
-- La SUPPRIMER physiquement effacerait aussi la trace d'envoi cote expediteur
-- (liste des destinataires et statut d'email de « Messages envoyes »). On la
-- MASQUE donc : `deleted_at` renseigne = absente de la cloche du destinataire,
-- toujours presente dans l'historique de l'expediteur.
--
-- Aucune policy a ajouter : `ann_staff_recipients_read_own` (UPDATE) autorise deja
-- le destinataire a modifier SA ligne.
--
-- Additif : a jouer AVANT le deploiement (la page lit la nouvelle colonne).
-- Idempotent.
-- ============================================================================

ALTER TABLE public.announcement_staff_recipients
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

DO $verif$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'announcement_staff_recipients'
      AND column_name = 'deleted_at'
  ) THEN
    RAISE EXCEPTION 'colonne deleted_at non posee';
  END IF;
END
$verif$;
SELECT enregistrer_migration('add-staff-notification-deleted-at.sql', '97d1459184f8de7bbdb033782ce22b1fd8edcc49a8b994f5f43bc254ac77fdc3');
