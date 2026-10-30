-- ============================================================================
-- Colonnes a valeur par defaut : NOT NULL (30/10)
--
-- 72 colonnes portaient un DEFAUT mais acceptaient NULL. Aucune n'en contenait
-- (mesure du 30/10, lecture seule), le code n'en ecrit aucun (types simules
-- NOT NULL : 0 erreur au type-check) et les fonctions de la base ont toutes une
-- valeur ou un repli (creation de comptes, import_foyer, fn_demo_peupler,
-- declarer_depart_eleve). Decision du 27/10 : NOT NULL apres la sortie des
-- `any`, terminee le 30/10.
--
-- Effet : les types generes disent « booleen » et non « booleen ou vide » ;
-- les `?? false` / `?? 25` de lecture deviennent inutiles. Un NULL ecrit par
-- erreur leve au lieu de s'installer en silence (une capacite vide affichait
-- une classe pleine dans Affectation).
--
-- EXCLUE : `evaluations.max_score` (defaut 20) : NULL y a un SENS (evaluation
-- diagnostique, sans bareme ; 4 lignes sur 12 au 30/10).
--
-- RESTRICTIF, mais le code en service est deja conforme : jouable des
-- maintenant. Echec franc si une ligne NULL est apparue entre-temps (rien
-- n'est applique). Controle : supabase/controles/35-colonnes-defaut-not-null.sql.
-- Apres : npm run types-db puis npm run type-check.
-- ============================================================================

ALTER TABLE public.absences
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.adult_absences
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.announcement_attachments
  ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE public.announcement_recipients
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN email_status SET NOT NULL,
  ALTER COLUMN is_read SET NOT NULL;

ALTER TABLE public.announcement_staff_recipients
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN email_status SET NOT NULL,
  ALTER COLUMN is_read SET NOT NULL;

ALTER TABLE public.announcements
  ALTER COLUMN channel SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN is_published SET NOT NULL,
  ALTER COLUMN priority SET NOT NULL,
  ALTER COLUMN recipient_count SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.class_teachers
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN is_main_teacher SET NOT NULL;

ALTER TABLE public.classes
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN is_active SET NOT NULL,
  ALTER COLUMN max_students SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.cours
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN order_index SET NOT NULL;

ALTER TABLE public.cours_modules
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN order_index SET NOT NULL;

ALTER TABLE public.enrollments
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN enrollment_date SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.etablissements
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN week_start_day SET NOT NULL;

ALTER TABLE public.evaluation_order_config
  ALTER COLUMN module_order SET NOT NULL,
  ALTER COLUMN ue_order SET NOT NULL;

ALTER TABLE public.evaluations
  ALTER COLUMN coefficient SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN sort_order SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.expenses
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.grades
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN is_absent SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.notifications
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN email_status SET NOT NULL,
  ALTER COLUMN is_read SET NOT NULL,
  ALTER COLUMN metadata SET NOT NULL,
  ALTER COLUMN push_status SET NOT NULL;

ALTER TABLE public.other_revenues
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.parents
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN tutor1_relationship SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.presence_types
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.profiles
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN is_active SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.push_subscriptions
  ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE public.school_years
  ALTER COLUMN vacations SET NOT NULL;

ALTER TABLE public.students
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN enrollment_date SET NOT NULL,
  ALTER COLUMN is_active SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.teachers
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN hire_date SET NOT NULL,
  ALTER COLUMN is_active SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.unites_enseignement
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN order_index SET NOT NULL;

SELECT enregistrer_migration('colonnes-defaut-not-null.sql', 'cd038aa62efe700249f34dd99c3ea736f34836b66e58891c5356d75e19fb0b56');
