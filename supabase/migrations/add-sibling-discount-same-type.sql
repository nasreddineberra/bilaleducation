-- Migration : ajout colonne sibling_discount_same_type sur cotisation_types
-- Si true : la réduction fratrie ne s'applique qu'entre enfants du même type de scolarité
-- Si false : la réduction s'applique dès le 2e enfant, tous types confondus (comportement par défaut)

ALTER TABLE cotisation_types
  ADD COLUMN IF NOT EXISTS sibling_discount_same_type boolean NOT NULL DEFAULT false;
