-- ============================================================================
-- Synchronisation de l'identite entre `profiles` et `teachers`.
--
-- Probleme : civilite / first_name / last_name sont DUPLIQUES dans les deux tables,
-- et TROIS chemins peuvent les modifier sans jamais synchroniser l'autre :
--   - Mon compte            (updateOwnProfile)   → profiles seul
--   - Fiche utilisateur     (updateProfile)      → profiles seul
--   - Fiche enseignant      (updateTeacher)      → teachers seul
-- → un enseignant pouvait s'appeler « X » cote compte et « Y » cote fiche.
--
-- Correctif : synchronisation bidirectionnelle en base → couvre TOUS les chemins
-- (UI, server actions, scripts), presents et futurs.
--
-- SECURITY DEFINER : indispensable. La RLS de `teachers` n'autorise l'ecriture qu'a
-- admin/direction ; sans cela, un enseignant renommant son nom depuis Mon compte
-- verrait la synchro echouer SILENCIEUSEMENT (0 ligne, aucune erreur).
-- La fonction ne fait que recopier 3 champs entre deux lignes deja liees par user_id.
-- `auth.uid()` reste celui de l'appelant → le journal d'audit capte toujours l'acteur.
--
-- Anti-recursion : la mise a jour retour est filtree par IS DISTINCT FROM → elle
-- ne touche 0 ligne (les valeurs sont deja egales) et n'entraine pas de 3e passage.
--
-- NB parents : `parents.tutor1/2_*` porte la meme duplication, mais les comptes
-- parents sont SUSPENDUS en V1 (tutor1/2_user_id vides) → aucune desynchronisation
-- possible aujourd'hui. A traiter le jour ou on activera les comptes parents.
--
-- Idempotent.
-- ============================================================================

-- ─── profiles → teachers ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_sync_identity_profile_to_teacher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE teachers t
  SET civilite   = NEW.civilite,
      first_name = NEW.first_name,
      last_name  = NEW.last_name
  WHERE t.user_id = NEW.id
    AND (t.civilite   IS DISTINCT FROM NEW.civilite
      OR t.first_name IS DISTINCT FROM NEW.first_name
      OR t.last_name  IS DISTINCT FROM NEW.last_name);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_identity_profile_to_teacher ON profiles;
CREATE TRIGGER trg_sync_identity_profile_to_teacher
  AFTER UPDATE OF civilite, first_name, last_name ON profiles
  FOR EACH ROW EXECUTE FUNCTION fn_sync_identity_profile_to_teacher();

-- ─── teachers → profiles ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_sync_identity_teacher_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;   -- fiche enseignant sans compte lie : rien a synchroniser
  END IF;

  UPDATE profiles p
  SET civilite   = NEW.civilite,
      first_name = NEW.first_name,
      last_name  = NEW.last_name
  WHERE p.id = NEW.user_id
    AND (p.civilite   IS DISTINCT FROM NEW.civilite
      OR p.first_name IS DISTINCT FROM NEW.first_name
      OR p.last_name  IS DISTINCT FROM NEW.last_name);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_identity_teacher_to_profile ON teachers;
CREATE TRIGGER trg_sync_identity_teacher_to_profile
  AFTER UPDATE OF civilite, first_name, last_name ON teachers
  FOR EACH ROW EXECUTE FUNCTION fn_sync_identity_teacher_to_profile();

-- ─── Rattrapage : aligner l'existant (profiles fait foi si divergence) ──────
-- Aucune divergence constatee au 15/07/2026, mais rend la migration sure si rejouee.
UPDATE teachers t
SET civilite   = p.civilite,
    first_name = p.first_name,
    last_name  = p.last_name
FROM profiles p
WHERE t.user_id = p.id
  AND (t.civilite   IS DISTINCT FROM p.civilite
    OR t.first_name IS DISTINCT FROM p.first_name
    OR t.last_name  IS DISTINCT FROM p.last_name);

SELECT 'Identite synchronisee profiles <-> teachers (civilite / first_name / last_name).' AS status;
