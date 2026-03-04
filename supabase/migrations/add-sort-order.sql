-- Sauvegarde de l'ordre des évaluations dans le panneau d'élaboration
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0;
