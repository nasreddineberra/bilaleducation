-- ============================================================================
-- Suppression de deux tables mortes : `payments` et `schedules`
--
-- Constat du 5 août 2026 :
--   * `payments`  : 0 ligne. Remplacée par `family_fees` + `fee_installments`
--                   (18 lignes), qui portent tout le module Financements.
--   * `schedules` : 0 ligne. Remplacée par `schedule_slots` (4 lignes), qui
--                   porte tout l'emploi du temps.
--
-- Aucune des deux n'a de chemin d'ÉCRITURE dans l'application : elles n'étaient
-- plus interrogées que pour compter des dépendances avant suppression d'un
-- compte ou d'un enseignant — ces comptages ont été retirés du code.
--
-- Dans l'esprit du chantier « garder la BDD la plus légère possible ».
--
-- ATTENTION : irréversible. `DROP TABLE` sans CASCADE, VOLONTAIREMENT : si un
-- objet dépend encore de ces tables, la commande ÉCHOUE au lieu d'emporter
-- silencieusement la dépendance avec elle.
-- ============================================================================

-- ── Contrôle préalable (à lancer AVANT, et à ne poursuivre que si tout est à 0)
--
--   select 'payments' as t, count(*) from payments
--   union all select 'schedules', count(*) from schedules;
--
-- Objets qui référencent encore ces tables :
--
--   select conrelid::regclass as table_dependante, conname
--   from pg_constraint
--   where confrelid in ('payments'::regclass, 'schedules'::regclass);
--
-- Vues éventuelles :
--
--   select viewname from pg_views
--   where definition ilike '%payments%' or definition ilike '%schedules%';

DROP TABLE IF EXISTS public.payments;
DROP TABLE IF EXISTS public.schedules;

-- Les policies, triggers d'audit et index de ces tables disparaissent avec
-- elles : aucun ménage complémentaire n'est nécessaire.
