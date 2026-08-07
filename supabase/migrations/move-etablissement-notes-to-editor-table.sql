-- ============================================================================
-- Notes internes de l'éditeur : sorties de `etablissements`
--
-- CONSTAT. La colonne `etablissements.notes` porte des observations
-- COMMERCIALES sur le client — historique, contacts clés, remarques. Elle
-- n'apparaît nulle part dans l'écran Établissement de l'école, mais
-- l'invisibilité à l'écran n'est pas une protection :
--
--   1. `/dashboard/etablissement` fait un `select('*')` et transmet la ligne
--      entière au formulaire : les notes voyagent dans la charge de la page,
--      lisibles dans les outils de développement du navigateur ;
--   2. la politique `etablissements_select` vaut `id = current_etablissement_id()`
--      SANS restriction de colonne : n'importe quel compte authentifié de
--      l'école — direction, secrétariat, comptabilité, enseignant — peut lire la
--      ligne complète par l'API ;
--   3. `etablissements_update` autorise `admin`/`direction` à écrire sur cette
--      même ligne, toujours sans restriction de colonne : une école pouvait
--      RÉÉCRIRE ou effacer les notes de son fournisseur.
--
-- CE QUE FAIT CETTE MIGRATION. Les notes rejoignent une table réservée à
-- l'éditeur, sur le régime déjà éprouvé pour la configuration SMTP : RLS activée,
-- AUCUNE politique, privilèges retirés aux rôles de l'API. Le serveur seul y
-- accède, donc la console seule.
--
-- POURQUOI UNE TABLE ET NON DES PRIVILÈGES PAR COLONNE. Retirer `notes` du
-- `GRANT SELECT` aurait suffi techniquement, mais ferait dépendre la
-- confidentialité d'une requête écrite correctement partout — un `select('*')`
-- ajouté un jour la casserait en silence. Une table dont les rôles API n'ont
-- aucun privilège ne peut pas fuir par inadvertance.
--
-- PAS DE DÉCLENCHEUR D'AUDIT sur cette table, et c'est délibéré : `fn_audit_log`
-- copie `to_jsonb(NEW)` dans `audit_logs`, dont la lecture est ouverte à
-- l'`admin` et à la `direction` de l'établissement. Auditer les notes les
-- publierait dans le journal de l'école — exactement ce que cette migration
-- empêche. Même raisonnement que pour le mot de passe SMTP.
--
-- Idempotent. Reprend les notes existantes avant de supprimer la colonne.
-- ============================================================================

CREATE TABLE IF NOT EXISTS etablissement_notes (
  etablissement_id UUID PRIMARY KEY REFERENCES etablissements(id) ON DELETE CASCADE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE etablissement_notes IS
  'Notes internes de l''editeur sur un etablissement client (observations commerciales, historique, contacts). Table SERVEUR UNIQUEMENT : RLS sans aucune policy, seul le service-role y accede. Ne JAMAIS ajouter de policy de lecture ni de declencheur d''audit — l''ecole lirait les notes prises sur elle.';

-- Reprise des notes déjà saisies, avant la suppression de la colonne.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'etablissements' AND column_name = 'notes'
  ) THEN
    INSERT INTO etablissement_notes (etablissement_id, notes)
    SELECT id, notes FROM etablissements WHERE notes IS NOT NULL AND notes <> ''
    ON CONFLICT (etablissement_id) DO NOTHING;

    ALTER TABLE etablissements DROP COLUMN notes;
  END IF;
END $$;

-- RLS active, AUCUNE policy : verrouillage total côté client.
ALTER TABLE etablissement_notes ENABLE ROW LEVEL SECURITY;

-- Ceinture et bretelles : même si une policy était ajoutée par erreur un jour,
-- les rôles de l'API n'ont aucun privilège sur la table.
REVOKE ALL ON etablissement_notes FROM anon, authenticated;

CREATE OR REPLACE FUNCTION fn_touch_etablissement_notes()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_touch_etablissement_notes ON etablissement_notes;
CREATE TRIGGER trg_touch_etablissement_notes
  BEFORE UPDATE ON etablissement_notes
  FOR EACH ROW EXECUTE FUNCTION fn_touch_etablissement_notes();

-- ── Vérification ────────────────────────────────────────────────────────────
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'etablissements' AND column_name = 'notes';   -- 0 ligne
--   SELECT grantee FROM information_schema.role_table_grants
--     WHERE table_name = 'etablissement_notes';                        -- ni anon ni authenticated
--   SELECT count(*) FROM pg_policy WHERE polrelid = 'etablissement_notes'::regclass;  -- 0
