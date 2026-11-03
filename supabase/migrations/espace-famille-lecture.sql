-- ============================================================================
-- Espace famille, lot 2 : lecture « mon foyer » (03/11)
--
-- Plan et decisions : docs/ESPACE-FAMILLE.md. Tout passe par
-- `foyer_du_compte()` (lot 1) : option coupee, ecole inactive ou expiree, role
-- autre que `parent` = rien a lire.
--
-- DEUX VOIES. La RLS ouvre une ligne ENTIERE : une table qui porte une donnee
-- interne (note de fiche, motif d'absence, telephone d'enseignant, note d'un
-- paiement) ne s'ouvre pas au parent, il la lit par une fonction `famille_*`
-- qui ne rend que des colonnes choisies.
--
-- DECISION 5 (`foyer_actif()`) : sans enfant actif ni cours adulte suivi cette
-- annee, le foyer ne lit plus que sa fiche, le nom de ses enfants et leurs
-- bulletins de l'annee en cours, jusqu'a la date de fin d'annee. Un enfant parti
-- (frere ou soeur restant) : ses absences ne se lisent plus, ses bulletins de
-- l'annee si. Bulletins : annee en cours seulement.
--
-- ADDITIF : droits de lecture NOUVEAUX pour le parent ; seule
-- `notifications_select_parent` est resserree (foyer actif), aucun compte
-- parent n'existe. Rien n'est retire au personnel.
-- Controle : supabase/controles/38-espace-famille-lecture.sql.
-- ============================================================================

-- ── 1. Fonctions d'appartenance ─────────────────────────────────────────────

-- Decision 5 : le foyer a-t-il encore une classe cette annee (enfant actif
-- affecte, ou cours adulte suivi par CE tuteur) ?
CREATE OR REPLACE FUNCTION public.foyer_actif()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT EXISTS (SELECT 1 FROM classes_du_compte())
$fn$;

-- La classe est-elle une classe de l'annee en cours de son ecole ?
CREATE OR REPLACE FUNCTION public.classe_annee_en_cours(p_class_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM classes c
      JOIN school_years y ON y.etablissement_id = c.etablissement_id AND y.is_current AND y.label = c.academic_year
     WHERE c.id = p_class_id
  )
$fn$;

-- Enfant du foyer, actif, affecte cette annee.
CREATE OR REPLACE FUNCTION public.enfant_actif_du_foyer(p_student_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM students s
      JOIN enrollments en ON en.student_id = s.id AND en.status = 'active'
     WHERE s.id = p_student_id
       AND s.parent_id = foyer_du_compte()
       AND s.is_active
       AND classe_annee_en_cours(en.class_id)
  )
$fn$;

-- Bulletin d'un enfant : son foyer, une periode de l'annee en cours ; enfant
-- actif, ou parti mais annee non terminee (decision 5).
CREATE OR REPLACE FUNCTION public.bulletin_enfant_lisible(p_student_id uuid, p_period_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM students s
      JOIN periods pe ON pe.id = p_period_id
      JOIN school_years y ON y.id = pe.school_year_id AND y.is_current AND y.etablissement_id = s.etablissement_id
     WHERE s.id = p_student_id
       AND s.parent_id = foyer_du_compte()
       AND (enfant_actif_du_foyer(s.id)
            OR (now() AT TIME ZONE 'Europe/Paris')::date <= coalesce(y.end_date, 'infinity'::date))
  )
$fn$;

-- Bulletin d'un adulte : SA place dans son foyer, annee en cours ; cours suivi,
-- ou quitte mais annee non terminee.
CREATE OR REPLACE FUNCTION public.bulletin_adulte_lisible(p_parent_id uuid, p_tutor_number smallint, p_period_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT coalesce(p_parent_id = foyer_du_compte() AND p_tutor_number = tuteur_du_compte(), false)
     AND EXISTS (
       SELECT 1 FROM periods pe
         JOIN school_years y ON y.id = pe.school_year_id AND y.is_current AND y.etablissement_id = current_etablissement_id()
        WHERE pe.id = p_period_id
          AND (EXISTS (SELECT 1 FROM parent_class_enrollments pce
                         JOIN classes c ON c.id = pce.class_id AND c.academic_year = y.label
                        WHERE pce.parent_id = p_parent_id AND pce.tutor_number = p_tutor_number AND pce.status = 'active')
               OR (now() AT TIME ZONE 'Europe/Paris')::date <= coalesce(y.end_date, 'infinity'::date))
     )
$fn$;

-- Classes lisibles : celles de l'annee (`classes_du_compte`) et celles de ses
-- bulletins lisibles (enfant parti).
CREATE OR REPLACE FUNCTION public.classes_famille()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT classes_du_compte()
  UNION
  SELECT b.class_id FROM bulletin_archives b
   WHERE b.student_id IN (SELECT s.id FROM students s WHERE s.parent_id = foyer_du_compte())
     AND bulletin_enfant_lisible(b.student_id, b.period_id)
  UNION
  SELECT b.class_id FROM adult_bulletin_archives b
   WHERE b.parent_id = foyer_du_compte()
     AND bulletin_adulte_lisible(b.parent_id, b.tutor_number, b.period_id)
$fn$;

-- Fichier du bucket `bulletins` : celui d'un bulletin lisible, et lui seul.
CREATE OR REPLACE FUNCTION public.fichier_bulletin_lisible(p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT EXISTS (SELECT 1 FROM bulletin_archives b
                  WHERE b.file_path = p_name AND b.etablissement_id = current_etablissement_id()
                    AND bulletin_enfant_lisible(b.student_id, b.period_id))
      OR EXISTS (SELECT 1 FROM adult_bulletin_archives b
                  WHERE b.file_path = p_name AND b.parent_id = foyer_du_compte()
                    AND bulletin_adulte_lisible(b.parent_id, b.tutor_number, b.period_id))
$fn$;

-- Message adresse au foyer (foyer actif). Fonction et non sous-requete : la
-- regle de `announcement_recipients` lit `announcements`, la reciproque bouclerait.
CREATE OR REPLACE FUNCTION public.annonce_du_foyer(p_announcement_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT foyer_actif() AND EXISTS (
    SELECT 1 FROM announcement_recipients r
     WHERE r.announcement_id = p_announcement_id AND r.parent_id = foyer_du_compte()
  )
$fn$;

-- Piece jointe (bucket `communication-attachments`) d'un message du foyer.
CREATE OR REPLACE FUNCTION public.fichier_annonce_lisible(p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT EXISTS (SELECT 1 FROM announcement_attachments a
                  WHERE a.file_path = p_name AND annonce_du_foyer(a.announcement_id))
$fn$;

-- ── 2. Fonctions de lecture (colonnes choisies) ─────────────────────────────

-- Tuteurs du foyer, sans la note interne de la fiche.
CREATE OR REPLACE FUNCTION public.famille_foyer()
 RETURNS TABLE (tutor_number smallint, last_name text, first_name text, relationship text,
                email text, phone text, address text, city text, postal_code text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT 1::smallint, p.tutor1_last_name, p.tutor1_first_name, p.tutor1_relationship,
         p.tutor1_email, p.tutor1_phone, p.tutor1_address, p.tutor1_city, p.tutor1_postal_code
    FROM parents p WHERE p.id = foyer_du_compte()
  UNION ALL
  SELECT 2::smallint, p.tutor2_last_name, p.tutor2_first_name, p.tutor2_relationship,
         p.tutor2_email, p.tutor2_phone, p.tutor2_address, p.tutor2_city, p.tutor2_postal_code
    FROM parents p WHERE p.id = foyer_du_compte()
     AND (coalesce(p.tutor2_last_name, '') <> '' OR coalesce(p.tutor2_first_name, '') <> '')
  ORDER BY 1
$fn$;

-- Titulaires des classes du compte : identite seule (ni telephone, ni email,
-- ni notes de la fiche enseignant).
CREATE OR REPLACE FUNCTION public.famille_enseignants()
 RETURNS TABLE (class_id uuid, teacher_id uuid, is_main_teacher boolean, subject text,
                effective_from date, effective_until date, civilite text, first_name text, last_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT ct.class_id, ct.teacher_id, ct.is_main_teacher, ct.subject, ct.effective_from, ct.effective_until,
         t.civilite, t.first_name, t.last_name
    FROM class_teachers ct
    JOIN teachers t ON t.id = ct.teacher_id
   WHERE ct.class_id IN (SELECT classes_du_compte())
$fn$;

-- Seances annulees ou remplacees des classes du compte, entre deux dates (100
-- jours au plus). Jamais l'absence de l'enseignant ni son motif.
CREATE OR REPLACE FUNCTION public.famille_seances_modifiees(p_debut date, p_fin date)
 RETURNS TABLE (schedule_slot_id uuid, seance_date date, decision text, remplacant_profile_id uuid,
                remplacant_teacher_id uuid, remplacant_civilite text, remplacant_nom text, remplacant_prenom text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT s.schedule_slot_id, s.seance_date, s.decision, s.remplacant_profile_id,
         t.id, t.civilite, coalesce(t.last_name, pr.last_name), coalesce(t.first_name, pr.first_name)
    FROM absences_enseignants_seances s
    JOIN schedule_slots sl ON sl.id = s.schedule_slot_id
    LEFT JOIN profiles pr ON pr.id = s.remplacant_profile_id
    LEFT JOIN teachers t ON t.user_id = s.remplacant_profile_id AND t.etablissement_id = s.etablissement_id
   WHERE sl.class_id IN (SELECT classes_du_compte())
     AND s.seance_date BETWEEN p_debut AND p_fin
     AND p_fin - p_debut <= 100
$fn$;

-- Donnees du calcul financier du foyer, annee en cours (foyer actif). Le calcul
-- reste `lib/financements/compute.ts` : memes entrees que l'ecran Reglements,
-- sans les notes ni l'auteur des ecritures.
CREATE OR REPLACE FUNCTION public.famille_finances()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
  WITH f AS (SELECT foyer_du_compte() AS id),
  y AS (SELECT sy.id, sy.label, sy.start_date, sy.end_date FROM school_years sy
         WHERE sy.etablissement_id = current_etablissement_id() AND sy.is_current),
  cot AS (SELECT t.id, jsonb_build_object('id', t.id, 'label', t.label, 'amount', t.amount,
                   'registration_fee', t.registration_fee, 'sibling_discount', t.sibling_discount,
                   'sibling_discount_same_type', t.sibling_discount_same_type,
                   'max_installments', t.max_installments, 'is_adult', t.is_adult) AS j
            FROM cotisation_types t WHERE t.etablissement_id = current_etablissement_id())
  SELECT CASE WHEN NOT foyer_actif() THEN NULL ELSE jsonb_build_object(
    'annee', (SELECT jsonb_build_object('id', y.id, 'label', y.label, 'start_date', y.start_date, 'end_date', y.end_date) FROM y),
    'enfants', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                  'id', s.id, 'first_name', s.first_name, 'last_name', s.last_name, 'created_at', s.created_at,
                  'is_active', s.is_active, 'enrollment_id', en.id, 'status', en.status, 'class_id', en.class_id,
                  'date_depart', en.date_depart, 'classe_nom', c.name, 'cotisation', cot.j) ORDER BY s.created_at), '[]'::jsonb)
                  FROM students s
                  JOIN enrollments en ON en.student_id = s.id AND en.status IN ('active', 'withdrawn')
                  JOIN classes c ON c.id = en.class_id
                  JOIN y ON y.label = c.academic_year
                  LEFT JOIN cot ON cot.id = c.cotisation_type_id
                 WHERE s.parent_id = (SELECT id FROM f)),
    'adultes', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                  'tutor_number', pce.tutor_number, 'status', pce.status, 'class_id', pce.class_id,
                  'date_depart', pce.date_depart, 'classe_nom', c.name, 'cotisation', cot.j)), '[]'::jsonb)
                  FROM parent_class_enrollments pce
                  JOIN classes c ON c.id = pce.class_id
                  JOIN y ON y.label = c.academic_year
                  LEFT JOIN cot ON cot.id = c.cotisation_type_id
                 WHERE pce.parent_id = (SELECT id FROM f) AND pce.status IN ('active', 'withdrawn')),
    'mouvements_depart', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                  'id', m.id, 'student_id', m.student_id, 'parent_id', m.parent_id, 'tutor_number', m.tutor_number,
                  'class_id', m.class_id, 'regle', m.regle, 'decision', m.decision, 'survenu_le', m.survenu_le)
                  ORDER BY m.survenu_le DESC), '[]'::jsonb)
                  FROM mouvements_inscription m JOIN y ON y.id = m.school_year_id
                 WHERE m.motif = 'depart'
                   AND (m.parent_id = (SELECT id FROM f)
                        OR m.student_id IN (SELECT s.id FROM students s WHERE s.parent_id = (SELECT id FROM f)))),
    'dossiers', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                  'id', ff.id, 'subtotal', ff.subtotal, 'adjustments_total', ff.adjustments_total,
                  'total_due', ff.total_due, 'num_installments', ff.num_installments, 'status', ff.status,
                  'reductions', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                                   'adjustment_date', a.adjustment_date, 'adjustment_type', a.adjustment_type,
                                   'label', a.label, 'amount', a.amount) ORDER BY a.adjustment_date), '[]'::jsonb)
                                   FROM fee_adjustments a WHERE a.family_fee_id = ff.id),
                  'echeances', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                                   'installment_number', i.installment_number, 'due_date', i.due_date,
                                   'amount_due', i.amount_due, 'amount_paid', i.amount_paid, 'paid_date', i.paid_date,
                                   'payment_method', i.payment_method, 'receipt_number', i.receipt_number,
                                   'status', i.status) ORDER BY i.installment_number), '[]'::jsonb)
                                   FROM fee_installments i WHERE i.family_fee_id = ff.id))), '[]'::jsonb)
                  FROM family_fees ff JOIN y ON y.id = ff.school_year_id
                 WHERE ff.parent_id = (SELECT id FROM f))
  ) END
$fn$;

DO $droits$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.foyer_actif()', 'public.classe_annee_en_cours(uuid)', 'public.enfant_actif_du_foyer(uuid)',
    'public.bulletin_enfant_lisible(uuid, uuid)', 'public.bulletin_adulte_lisible(uuid, smallint, uuid)',
    'public.classes_famille()', 'public.fichier_bulletin_lisible(text)', 'public.annonce_du_foyer(uuid)',
    'public.fichier_annonce_lisible(text)', 'public.famille_foyer()', 'public.famille_enseignants()',
    'public.famille_seances_modifiees(date, date)', 'public.famille_finances()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END
$droits$;

-- ── 3. Regles de lecture du parent ──────────────────────────────────────────

CREATE POLICY students_parent_select ON public.students
  FOR SELECT TO authenticated
  USING (etablissement_id = current_etablissement_id() AND parent_id = (SELECT foyer_du_compte()));

CREATE POLICY classes_parent_select ON public.classes
  FOR SELECT TO authenticated
  USING (etablissement_id = current_etablissement_id() AND (SELECT foyer_du_compte()) IS NOT NULL AND id IN (SELECT classes_famille()));

CREATE POLICY schedule_slots_parent_select ON public.schedule_slots
  FOR SELECT TO authenticated
  USING (etablissement_id = current_etablissement_id() AND class_id IN (SELECT classes_du_compte()));

CREATE POLICY schedule_exceptions_parent_select ON public.schedule_exceptions
  FOR SELECT TO authenticated
  USING (etablissement_id = current_etablissement_id()
         AND schedule_slot_id IN (SELECT sl.id FROM schedule_slots sl WHERE sl.class_id IN (SELECT classes_du_compte())));

CREATE POLICY rooms_parent_select ON public.rooms
  FOR SELECT TO authenticated
  USING (etablissement_id = current_etablissement_id() AND (SELECT foyer_actif()));

CREATE POLICY unites_enseignement_parent_select ON public.unites_enseignement
  FOR SELECT TO authenticated
  USING (etablissement_id = current_etablissement_id() AND (SELECT foyer_actif()));

CREATE POLICY school_years_parent_select ON public.school_years
  FOR SELECT TO authenticated
  USING (etablissement_id = current_etablissement_id() AND (SELECT foyer_du_compte()) IS NOT NULL);

CREATE POLICY periods_parent_select ON public.periods
  FOR SELECT TO authenticated
  USING ((SELECT foyer_du_compte()) IS NOT NULL
         AND school_year_id IN (SELECT y.id FROM school_years y WHERE y.etablissement_id = current_etablissement_id()));

CREATE POLICY absences_parent_select ON public.absences
  FOR SELECT TO authenticated
  USING (etablissement_id = current_etablissement_id()
         AND (SELECT foyer_du_compte()) IS NOT NULL AND enfant_actif_du_foyer(student_id) AND classe_annee_en_cours(class_id));

CREATE POLICY adult_absences_parent_select ON public.adult_absences
  FOR SELECT TO authenticated
  USING (etablissement_id = current_etablissement_id()
         AND parent_id = (SELECT foyer_du_compte()) AND tutor_number = (SELECT tuteur_du_compte())
         AND class_id IN (SELECT classes_du_compte()));

CREATE POLICY parent_class_enrollments_parent_select ON public.parent_class_enrollments
  FOR SELECT TO authenticated
  USING (etablissement_id = current_etablissement_id()
         AND parent_id = (SELECT foyer_du_compte()) AND tutor_number = (SELECT tuteur_du_compte()));

CREATE POLICY bulletin_archives_parent_select ON public.bulletin_archives
  FOR SELECT TO authenticated
  USING (etablissement_id = current_etablissement_id() AND (SELECT foyer_du_compte()) IS NOT NULL AND bulletin_enfant_lisible(student_id, period_id));

CREATE POLICY adult_bulletin_archives_parent_select ON public.adult_bulletin_archives
  FOR SELECT TO authenticated
  USING (etablissement_id = current_etablissement_id()
         AND (SELECT foyer_du_compte()) IS NOT NULL AND bulletin_adulte_lisible(parent_id, tutor_number, period_id));

CREATE POLICY announcements_parent_select ON public.announcements
  FOR SELECT TO authenticated
  USING (etablissement_id = current_etablissement_id() AND (SELECT foyer_du_compte()) IS NOT NULL AND annonce_du_foyer(id));

CREATE POLICY announcement_recipients_parent_select ON public.announcement_recipients
  FOR SELECT TO authenticated
  USING (parent_id = (SELECT foyer_du_compte()) AND (SELECT foyer_actif()));

-- `announcement_attachments` : sa regle existante (`ann_attachments_select`) lit
-- `announcements` sous la RLS du lecteur ; elle suit donc la regle ci-dessus.

CREATE POLICY bulletins_pdf_parent_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'bulletins'
         AND (storage.foldername(name))[1] = (public.current_etablissement_id())::text
         AND coalesce(public.get_user_role(), '') = 'parent'
         AND (SELECT public.foyer_du_compte()) IS NOT NULL AND public.fichier_bulletin_lisible(name));

CREATE POLICY comm_pj_parent_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'communication-attachments'
         AND (storage.foldername(name))[1] = (public.current_etablissement_id())::text
         AND coalesce(public.get_user_role(), '') = 'parent'
         AND (SELECT public.foyer_du_compte()) IS NOT NULL AND public.fichier_annonce_lisible(name));

-- Deux regles ne portaient que l'ecole, sans le role : tout compte de l'ecole,
-- parent compris, lisait salles et ressources. Reservees au personnel (le parent
-- lit les salles par `rooms_parent_select`, foyer actif). Les documents requis
-- (`doc_type_configs_select`) restent lisibles du parent : decision du controle 12.
DROP POLICY rooms_select ON public.rooms;
CREATE POLICY rooms_select ON public.rooms
  FOR SELECT TO authenticated
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'comptable', 'responsable_pedagogique', 'secretaire', 'enseignant']));

DROP POLICY materials_select ON public.materials;
CREATE POLICY materials_select ON public.materials
  FOR SELECT TO authenticated
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'comptable', 'responsable_pedagogique', 'secretaire', 'enseignant']));

-- Decision 5 : les notifications se ferment avec le foyer.
DROP POLICY notifications_select_parent ON public.notifications;
CREATE POLICY notifications_select_parent ON public.notifications
  FOR SELECT TO authenticated
  USING (etablissement_id = current_etablissement_id()
         AND parent_id = (SELECT foyer_du_compte()) AND (SELECT foyer_actif()));

-- ── Verification ────────────────────────────────────────────────────────────
DO $verif$
BEGIN
  IF (SELECT count(*) FROM pg_policies WHERE policyname IN (
        'students_parent_select', 'classes_parent_select', 'schedule_slots_parent_select',
        'schedule_exceptions_parent_select', 'rooms_parent_select', 'unites_enseignement_parent_select',
        'school_years_parent_select', 'periods_parent_select', 'absences_parent_select',
        'adult_absences_parent_select', 'parent_class_enrollments_parent_select',
        'bulletin_archives_parent_select', 'adult_bulletin_archives_parent_select',
        'announcements_parent_select', 'announcement_recipients_parent_select',
        'bulletins_pdf_parent_select', 'comm_pj_parent_select', 'notifications_select_parent')) <> 18 THEN
    RAISE EXCEPTION 'regles de lecture parent : 18 attendues';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.routine_privileges
              WHERE routine_schema = 'public' AND grantee IN ('anon', 'PUBLIC')
                AND routine_name IN ('foyer_actif', 'classe_annee_en_cours', 'enfant_actif_du_foyer',
                                     'bulletin_enfant_lisible', 'bulletin_adulte_lisible', 'classes_famille',
                                     'fichier_bulletin_lisible', 'annonce_du_foyer', 'fichier_annonce_lisible',
                                     'famille_foyer', 'famille_enseignants', 'famille_seances_modifiees',
                                     'famille_finances')) THEN
    RAISE EXCEPTION 'fonctions espace famille executables par anon ou PUBLIC';
  END IF;
END
$verif$;
SELECT enregistrer_migration('espace-famille-lecture.sql', 'b15dda7d375875da1520dd42c2a3c513879b9fb01e7ad737c923e7ce97a32283');
