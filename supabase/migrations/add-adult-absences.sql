-- ============================================================================
-- BILAL EDUCATION — Assiduite des cours ADULTES
-- ----------------------------------------------------------------------------
-- MANQUE CORRIGE (constate le 9 aout 2026). `absences.student_id` est NOT NULL
-- avec cle etrangere vers `students` : un adulte inscrit ne peut pas y figurer.
-- Or la feuille d'appel proposait TOUTES les classes de l'annee, classes
-- adultes comprises, et n'y affichait qu'un trombinoscope VIDE — un ecran qui
-- offre ce qu'il ne sait pas faire.
--
-- Decision utilisateur : on prend bien l'assiduite des cours adultes. D'ou cette
-- CINQUIEME table miroir, apres `adult_grades`, `adult_bulletin_appreciations`,
-- `adult_bulletin_archives` et `adult_homework_status`. Meme regle que partout :
-- un adulte n'est pas un `student`, il ne s'ecrit JAMAIS dans les tables eleves.
--
-- Cle du participant : `parent_id + tutor_number` (le foyer peut compter deux
-- tuteurs, chacun inscrit de son cote).
--
-- Idempotent. A RELIRE puis executer dans Supabase SQL Editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS adult_absences (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,

  parent_id        UUID     NOT NULL REFERENCES parents(id)  ON DELETE CASCADE,
  tutor_number     SMALLINT NOT NULL CHECK (tutor_number IN (1, 2)),
  class_id         UUID     NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
  period_id        UUID     NOT NULL REFERENCES periods(id)  ON DELETE CASCADE,

  absence_date     DATE NOT NULL,
  -- Memes valeurs que `absences` : la table ne connait que ces deux-la, et tout
  -- l'ecran (compteurs, audits, palmares) s'appuie dessus.
  absence_type     TEXT NOT NULL CHECK (absence_type IN ('absence', 'retard')),
  comment          TEXT,

  is_justified               BOOLEAN NOT NULL DEFAULT false,
  justification_date         DATE,
  justification_comment      TEXT,
  -- CHEMIN et non URL : le bucket `absence-justificatifs` est PRIVE, on genere
  -- une URL signee a la consultation. Piege deja paye le 10 juillet, ou
  -- `getPublicUrl` produisait un lien mort (403) sur un bucket prive.
  justification_document_url TEXT,

  recorded_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),

  -- Un participant ne peut avoir qu'une saisie par jour et par classe.
  UNIQUE (parent_id, tutor_number, class_id, absence_date)
);

COMMENT ON TABLE adult_absences IS
  'Assiduite des participants de classes adultes (tuteurs). Table miroir de `absences`, dont la cle etrangere vise `students`. Cle participant : parent_id + tutor_number.';

CREATE INDEX IF NOT EXISTS idx_adult_absences_class_period ON adult_absences (class_id, period_id);
CREATE INDEX IF NOT EXISTS idx_adult_absences_etab         ON adult_absences (etablissement_id);
CREATE INDEX IF NOT EXISTS idx_adult_absences_parent       ON adult_absences (parent_id, tutor_number);
CREATE INDEX IF NOT EXISTS idx_adult_absences_date         ON adult_absences (absence_date);

-- ─── RLS : RECOPIEE de `absences` (passe du 5 aout) ─────────────────────────
-- Encadrement partout, plus l'enseignant sur SES classes via `teaches_class`,
-- qui respecte la fenetre effective_from/until. Le role `parent` est absent,
-- comme partout ailleurs (comptes suspendus en V1).
ALTER TABLE adult_absences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS adult_absences_select ON adult_absences;
CREATE POLICY adult_absences_select ON adult_absences FOR SELECT
  USING (
    etablissement_id = current_etablissement_id()
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
      OR (get_user_role() = 'enseignant' AND teaches_class(class_id))
    )
  );

DROP POLICY IF EXISTS adult_absences_write ON adult_absences;
CREATE POLICY adult_absences_write ON adult_absences FOR ALL
  USING (
    etablissement_id = current_etablissement_id()
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
      OR (get_user_role() = 'enseignant' AND teaches_class(class_id))
    )
  )
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
      OR (get_user_role() = 'enseignant' AND teaches_class(class_id))
    )
  );

-- Trigger d'audit, comme `absences` en porte un.
DROP TRIGGER IF EXISTS audit_adult_absences ON adult_absences;
CREATE TRIGGER audit_adult_absences
  AFTER INSERT OR UPDATE OR DELETE ON adult_absences
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

SELECT 'Table adult_absences creee (RLS calquee sur absences, audit pose).' AS status;
