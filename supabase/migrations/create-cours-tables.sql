-- ============================================================
-- Référentiel pédagogique : UE → Modules → Cours
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- Unités d'Enseignement (matières)
CREATE TABLE IF NOT EXISTS unites_enseignement (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  etablissement_id uuid REFERENCES etablissements(id) ON DELETE CASCADE NOT NULL,
  nom_fr           text NOT NULL,
  nom_ar           text,          -- Nom en arabe ou autre langue secondaire
  code             text,          -- ex. "MATH", "AR", "EI"
  order_index      int  DEFAULT 0,
  created_at       timestamptz DEFAULT now()
);

-- Modules (regroupement optionnel de cours dans une UE)
CREATE TABLE IF NOT EXISTS cours_modules (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  unite_enseignement_id uuid REFERENCES unites_enseignement(id) ON DELETE CASCADE NOT NULL,
  nom_fr                text NOT NULL,
  nom_ar                text,          -- Nom en arabe ou autre langue secondaire
  order_index           int  DEFAULT 0,
  created_at            timestamptz DEFAULT now()
);

-- Cours
CREATE TABLE IF NOT EXISTS cours (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  unite_enseignement_id uuid REFERENCES unites_enseignement(id) ON DELETE CASCADE NOT NULL,
  module_id             uuid REFERENCES cours_modules(id) ON DELETE SET NULL,  -- NULL = cours direct de la UE
  nom_fr                text NOT NULL,
  nom_ar                text,          -- Nom en arabe ou autre langue secondaire
  duree_minutes         int,           -- optionnel
  order_index           int  DEFAULT 0,
  created_at            timestamptz DEFAULT now()
);

-- Activer RLS
ALTER TABLE unites_enseignement ENABLE ROW LEVEL SECURITY;
ALTER TABLE cours_modules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE cours                ENABLE ROW LEVEL SECURITY;

-- Politiques RLS (accès limité aux rôles pédagogiques)
CREATE POLICY "Gestion UE" ON unites_enseignement FOR ALL
  USING (get_user_role() IN ('admin', 'direction', 'responsable_pedagogique'));

CREATE POLICY "Gestion modules cours" ON cours_modules FOR ALL
  USING (get_user_role() IN ('admin', 'direction', 'responsable_pedagogique'));

CREATE POLICY "Gestion cours" ON cours FOR ALL
  USING (get_user_role() IN ('admin', 'direction', 'responsable_pedagogique'));
