-- ============================================================================
-- Refonte Communications — sous-menu STAFF : securite de l'envoi interne.
--
-- Decisions utilisateur (16/07/2026) :
--   - La communication interne au staff est reservee a l'ENCADREMENT au sens large :
--     admin / direction / responsable_pedagogique / secretaire / COMPTABLE
--     (le comptable ecrit pour la paie / sujets comptables).
--     → l'ENSEIGNANT est le seul role qui ne peut PAS ecrire au staff (il reste
--       destinataire). Il ne communique que les devoirs (cahier de texte).
--
-- Comme pour la refonte parents (lot 1), on resserre la RLS en plus de la garde
-- serveur : un enseignant ne doit pas pouvoir inserer une annonce 'staff' ni des
-- destinataires staff par un appel API direct.
--
-- Idempotent.
-- ============================================================================

-- ─── 1. Insertion d'une annonce 'staff' : encadrement (tout staff sauf enseignant) ─
-- On redefinit la policy du lot 1 en retirant 'enseignant' de la branche 'staff'.
DROP POLICY IF EXISTS "announcements_insert_scoped" ON announcements;

CREATE POLICY "announcements_insert_scoped" ON announcements
  FOR INSERT
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND (
      -- Communication aux parents
      (announcement_type IN ('all_active', 'class', 'selected')
        AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire', 'responsable_pedagogique'))
      OR
      -- Toute la base (non-inscrits compris) : plus restreint
      (announcement_type = 'all_registered'
        AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire'))
      OR
      -- Messagerie interne au staff : encadrement (tout staff SAUF enseignant)
      (announcement_type = 'staff'
        AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire',
                                              'responsable_pedagogique', 'comptable'))
    )
  );

-- ─── 2. Destinataires staff : ecriture reservee a l'encadrement ─────────────
-- L'ancienne policy FOR ALL autorisait TOUT le staff (enseignant compris) a gerer
-- les destinataires. La SELECT reste large (les fiches message affichent la liste) :
-- on ne restreint QUE l'ecriture. Les policies SELECT/UPDATE(read) existantes
-- couvrent la lecture et le « marquer comme lu », on ne les touche pas.
DROP POLICY IF EXISTS "Staff can manage staff announcement recipients" ON announcement_staff_recipients;

CREATE POLICY "staff_recipients_write_scoped" ON announcement_staff_recipients
  FOR ALL
  USING (coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire',
                                           'responsable_pedagogique', 'comptable'))
  WITH CHECK (coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire',
                                                'responsable_pedagogique', 'comptable'));

SELECT 'Communications staff : insertion annonce + destinataires reservee a l''encadrement (tout staff sauf enseignant).' AS status;
