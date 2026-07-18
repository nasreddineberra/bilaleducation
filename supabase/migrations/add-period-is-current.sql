-- ============================================================================
-- Periode « en cours » : la direction marque UNE periode de l'annee comme
-- courante (les periodes n'ont pas de dates → choix manuel). Sert de valeur
-- par defaut au selecteur de periode sur tous les ecrans (bulletins, notes,
-- evaluations…).
--
-- Miroir de `school_years.is_current` (une seule courante), applique aux
-- periodes, cloisonne par annee scolaire.
--
-- Idempotent.
-- ============================================================================

ALTER TABLE public.periods
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT false;

-- Une seule periode courante par annee scolaire.
CREATE UNIQUE INDEX IF NOT EXISTS idx_periods_one_current_per_year
  ON public.periods (school_year_id)
  WHERE is_current;

COMMENT ON COLUMN public.periods.is_current IS
  'Periode en cours de l''annee (choisie par la direction). Defaut du selecteur de periode sur les ecrans. Une seule par annee scolaire.';

-- Pas de backfill : sans periode marquee, les ecrans retombent sur la 1re
-- periode (comportement actuel) — aucune regression. La direction choisit.

SELECT 'periods.is_current ajoute (une seule periode courante par annee).' AS status;
