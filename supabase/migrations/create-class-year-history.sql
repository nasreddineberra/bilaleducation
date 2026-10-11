-- ============================================================================
-- Historique des CLASSES (composition des annees archivees)
--
-- Une ligne par classe et par annee, figee a l'ARCHIVAGE du passage d'annee, a
-- cote de `student_year_history` (participant x annee) et `family_year_finance`
-- (foyer x annee). Elle repond a « qui etait dans quelle classe, avec quel
-- enseignant, a quel creneau » pour les annees passees.
--
-- PHOTO AUTONOME : identites, noms d'enseignants et creneaux sont recopies, aucun
-- lien vif obligatoire. Elle reste juste si la classe est renommee, supprimee ou
-- purgee. « Annuler la cloture » la supprime avec les deux autres archives.
--
-- CONTENU (decision utilisateur) : la COMPOSITION seulement — ni notes, ni
-- absences, ni montants. Ceux-la restent dans la fiche Scolarite de chaque
-- apprenant.
--
-- LECTURE : tout le personnel, ENSEIGNANT COMPRIS (decision utilisateur), pour
-- toutes les classes. ECRITURE : admin / direction (c'est l'archivage).
--
-- Additif. Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.class_year_history (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  etablissement_id UUID NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  school_year_id   UUID REFERENCES public.school_years(id) ON DELETE SET NULL,
  year_label       TEXT NOT NULL,   -- fige (survit a une suppression d'annee)

  class_id         UUID REFERENCES public.classes(id) ON DELETE SET NULL,  -- lien vif tant que la classe existe
  class_name       TEXT NOT NULL,
  level            TEXT,
  cotisation_label TEXT,
  is_adult         BOOLEAN NOT NULL DEFAULT false,
  max_students     INT,

  -- [{nom, du, au}] ; titulaire courant en fin d'annee + anciens titulaires
  titulaires       JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{nom, du, au}]
  remplacements    JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{jour, debut, fin, salle, du, au}]
  creneaux         JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{type: 'eleve'|'adulte', nom, prenom, numero}]
  participants     JSONB NOT NULL DEFAULT '[]'::jsonb,
  effectif         INT NOT NULL DEFAULT 0,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cyh_etab_year ON public.class_year_history (etablissement_id, school_year_id);

ALTER TABLE public.class_year_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cyh_select ON public.class_year_history;
CREATE POLICY cyh_select ON public.class_year_history FOR SELECT
  USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire', 'responsable_pedagogique', 'comptable', 'enseignant')
  );

DROP POLICY IF EXISTS cyh_write ON public.class_year_history;
CREATE POLICY cyh_write ON public.class_year_history FOR ALL
  USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') IN ('admin', 'direction')
  )
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') IN ('admin', 'direction')
  );

-- Verification : table et 2 policies en place.
DO $verif$
BEGIN
  IF (SELECT count(*) FROM pg_policies WHERE tablename = 'class_year_history') <> 2 THEN
    RAISE EXCEPTION 'policies de class_year_history non posees';
  END IF;
END
$verif$;
SELECT enregistrer_migration('create-class-year-history.sql', '9f9c7714c011a29feef119fa854cdd7507acc5378d8540699f3bd721364da8bd');
