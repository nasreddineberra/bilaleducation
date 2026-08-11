-- ============================================================================
-- Jours feries de l'annee scolaire
--
-- L'annee ne connaissait que des SEMAINES de vacances (`school_years.vacations`,
-- jsonb). Un ferie est une JOURNEE isolee : le modele des vacances ne convient
-- pas, mais son RANGEMENT si — d'ou une colonne jumelle plutot qu'une table.
--
-- POURQUOI PAS UNE TABLE. Un ferie n'a ni identite propre, ni relation, ni
-- historique : c'est une date et un libelle, qui n'existent que par leur annee
-- et disparaissent avec elle. Une table apporterait une cle etrangere, des
-- policies RLS a ecrire et un ON DELETE a choisir, pour ne rien resoudre de
-- plus. La colonne herite du cloisonnement de `school_years`, deja en place.
--
-- SAISIE MANUELLE, decision de l'utilisateur — et c'est ce qui evite le vrai
-- piege : les feries civils francais se calculent (fixes, ou derives de Paques),
-- mais les fetes musulmanes suivent le calendrier LUNAIRE et ne se calculent pas
-- de facon fiable a l'avance. Un ecran qui ne proposerait que du calcule serait
-- inutilisable dans cette application.
--
-- FORME DE CHAQUE ENTREE : { "date": "2026-11-11", "label": "Armistice" }
-- Un tableau, trie a l'affichage — l'ordre stocke n'a pas de sens.
--
-- Idempotent.
-- ============================================================================

ALTER TABLE school_years
  ADD COLUMN IF NOT EXISTS jours_feries jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN school_years.jours_feries IS
  'Jours feries de l''annee, saisis a la main : [{ "date": "AAAA-MM-JJ", "label": "..." }]. '
  'Journees isolees, a distinguer des semaines de `vacations`.';
