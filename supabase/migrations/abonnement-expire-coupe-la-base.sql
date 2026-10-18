-- ============================================================================
-- ABONNEMENT EXPIRE : LA BASE COUPE AUSSI (18 octobre 2026)
--
-- Le middleware redirigeait les PAGES d'une ecole expiree ou inactive vers
-- /abonnement-expire, mais un compte de cette ecole gardait, avec son jeton,
-- la lecture et l'ecriture de toutes ses donnees par l'API REST.
--
-- LEVIER UNIQUE : `current_etablissement_id()` rend NULL quand l'ecole de
-- l'appelant est inactive ou expiree. Les policies (tenant ET role) et les RPC
-- qui la lisent ne trouvent alors plus rien. Regle de `lib/tenant/abonnement.ts`
-- (decision du 7 octobre) : le jour d'echeance est INCLUS, la coupure tombe le
-- lendemain a 0 h, heure de Paris ; on compare des JOURS de Paris.
--
-- Decisions utilisateur (18/10) :
--   - coupure TOTALE, lecture comprise (l'export ZIP de la console reste) ;
--   - l'editeur en intervention (super_admin rattache) garde l'acces.
--
-- Hors levier, corriges ici :
--   - cahier de texte (`homework`, `class_journal`, `homework_status`,
--     `adult_homework_status`) et `notifications` : policies d'origine sur
--     `profiles` (ou sans ecole pour l'enseignant et le parent). Reecrites a
--     droits EGAUX, avec l'ecole via `current_etablissement_id()` et le role via
--     `get_user_role()` (l'editeur en intervention y redevient admin). Les
--     lectures « admin » redondantes avec `*_staff_crud` sont retirees.
--   - `etablissements_update` : `get_user_role()` au lieu de `profiles.role`.
--   - RPC `set_teacher_profile_active` : ne verifiait que le role ; une
--     direction pouvait desactiver le compte d'un enseignant d'une AUTRE ecole.
--   - RPC `get_verified_totp_user_ids` : rendait les comptes 2FA de TOUTES les
--     ecoles ; bornee a l'ecole de l'appelant.
--
-- Controle : supabase/controles/16-abonnement-expire.sql.
-- ============================================================================

-- ── Le levier ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_etablissement_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT p.etablissement_id
    FROM profiles p
    JOIN etablissements e ON e.id = p.etablissement_id
   WHERE p.id = auth.uid()
     AND (
       -- L'editeur en intervention garde l'acces (decision du 18/10).
       p.role = 'super_admin'
       OR (
         e.is_active
         AND (
           e.subscription_expires_at IS NULL
           OR (now() AT TIME ZONE 'Europe/Paris')::date
              <= (e.subscription_expires_at AT TIME ZONE 'Europe/Paris')::date
         )
       )
     )
$fn$;

-- ── Etablissement ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS etablissements_update ON public.etablissements;
CREATE POLICY etablissements_update ON public.etablissements
  FOR UPDATE TO authenticated
  USING (id = current_etablissement_id()
         AND coalesce(get_user_role(), '') IN ('admin', 'direction'))
  WITH CHECK (id = current_etablissement_id()
              AND coalesce(get_user_role(), '') IN ('admin', 'direction'));

-- ── Cahier de texte : seances ──────────────────────────────────────────────
DROP POLICY IF EXISTS journal_admin_select   ON public.class_journal;
DROP POLICY IF EXISTS journal_parent_select  ON public.class_journal;
DROP POLICY IF EXISTS journal_staff_crud     ON public.class_journal;
DROP POLICY IF EXISTS journal_teacher_select ON public.class_journal;
DROP POLICY IF EXISTS journal_teacher_insert ON public.class_journal;
DROP POLICY IF EXISTS journal_teacher_update ON public.class_journal;
DROP POLICY IF EXISTS journal_teacher_delete ON public.class_journal;

CREATE POLICY journal_staff_crud ON public.class_journal
  FOR ALL TO authenticated
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'responsable_pedagogique'))
  WITH CHECK (etablissement_id = current_etablissement_id()
              AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'responsable_pedagogique'));

-- Enseignant : ses classes, 7 jours avant sa prise de poste (remplacant).
CREATE POLICY journal_teacher_select ON public.class_journal
  FOR SELECT TO authenticated
  USING (
    etablissement_id = current_etablissement_id()
    AND class_id IN (
      SELECT ct.class_id FROM class_teachers ct JOIN teachers t ON t.id = ct.teacher_id
       WHERE t.user_id = auth.uid()
         AND (ct.effective_from IS NULL OR ct.effective_from - interval '7 days' <= current_date)
         AND (ct.effective_until IS NULL OR ct.effective_until >= current_date)
    )
  );

CREATE POLICY journal_teacher_insert ON public.class_journal
  FOR INSERT TO authenticated
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND teacher_id IN (SELECT t.id FROM teachers t WHERE t.user_id = auth.uid())
    AND class_id IN (
      SELECT ct.class_id FROM class_teachers ct JOIN teachers t ON t.id = ct.teacher_id
       WHERE t.user_id = auth.uid()
         AND (ct.effective_from IS NULL OR ct.effective_from <= current_date)
         AND (ct.effective_until IS NULL OR ct.effective_until >= current_date)
    )
  );

CREATE POLICY journal_teacher_update ON public.class_journal
  FOR UPDATE TO authenticated
  USING (etablissement_id = current_etablissement_id()
         AND teacher_id IN (SELECT t.id FROM teachers t WHERE t.user_id = auth.uid()));

CREATE POLICY journal_teacher_delete ON public.class_journal
  FOR DELETE TO authenticated
  USING (etablissement_id = current_etablissement_id()
         AND teacher_id IN (SELECT t.id FROM teachers t WHERE t.user_id = auth.uid()));

-- Parent (comptes suspendus en V1) : les classes actives de ses enfants.
CREATE POLICY journal_parent_select ON public.class_journal
  FOR SELECT TO authenticated
  USING (
    etablissement_id = current_etablissement_id()
    AND class_id IN (
      SELECT e.class_id FROM enrollments e
        JOIN students s ON s.id = e.student_id
        JOIN parents p ON p.id = s.parent_id
       WHERE p.user_id = auth.uid() AND e.status = 'active'
    )
  );

-- ── Cahier de texte : devoirs ──────────────────────────────────────────────
DROP POLICY IF EXISTS homework_admin_select   ON public.homework;
DROP POLICY IF EXISTS homework_parent_select  ON public.homework;
DROP POLICY IF EXISTS homework_staff_crud     ON public.homework;
DROP POLICY IF EXISTS homework_teacher_select ON public.homework;
DROP POLICY IF EXISTS homework_teacher_insert ON public.homework;
DROP POLICY IF EXISTS homework_teacher_update ON public.homework;
DROP POLICY IF EXISTS homework_teacher_delete ON public.homework;

CREATE POLICY homework_staff_crud ON public.homework
  FOR ALL TO authenticated
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'responsable_pedagogique'))
  WITH CHECK (etablissement_id = current_etablissement_id()
              AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'responsable_pedagogique'));

CREATE POLICY homework_teacher_select ON public.homework
  FOR SELECT TO authenticated
  USING (
    etablissement_id = current_etablissement_id()
    AND class_id IN (
      SELECT ct.class_id FROM class_teachers ct JOIN teachers t ON t.id = ct.teacher_id
       WHERE t.user_id = auth.uid()
         AND (ct.effective_from IS NULL OR ct.effective_from - interval '7 days' <= current_date)
         AND (ct.effective_until IS NULL OR ct.effective_until >= current_date)
    )
  );

CREATE POLICY homework_teacher_insert ON public.homework
  FOR INSERT TO authenticated
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND teacher_id IN (SELECT t.id FROM teachers t WHERE t.user_id = auth.uid())
    AND class_id IN (
      SELECT ct.class_id FROM class_teachers ct JOIN teachers t ON t.id = ct.teacher_id
       WHERE t.user_id = auth.uid()
         AND (ct.effective_from IS NULL OR ct.effective_from <= current_date)
         AND (ct.effective_until IS NULL OR ct.effective_until >= current_date)
    )
  );

CREATE POLICY homework_teacher_update ON public.homework
  FOR UPDATE TO authenticated
  USING (etablissement_id = current_etablissement_id()
         AND teacher_id IN (SELECT t.id FROM teachers t WHERE t.user_id = auth.uid()));

CREATE POLICY homework_teacher_delete ON public.homework
  FOR DELETE TO authenticated
  USING (etablissement_id = current_etablissement_id()
         AND teacher_id IN (SELECT t.id FROM teachers t WHERE t.user_id = auth.uid()));

CREATE POLICY homework_parent_select ON public.homework
  FOR SELECT TO authenticated
  USING (
    etablissement_id = current_etablissement_id()
    AND class_id IN (
      SELECT e.class_id FROM enrollments e
        JOIN students s ON s.id = e.student_id
        JOIN parents p ON p.id = s.parent_id
       WHERE p.user_id = auth.uid() AND e.status = 'active'
    )
  );

-- ── Suivi des devoirs (eleves) ─────────────────────────────────────────────
-- L'ecole est celle du devoir.
DROP POLICY IF EXISTS hwstatus_staff_select   ON public.homework_status;
DROP POLICY IF EXISTS hwstatus_teacher_select ON public.homework_status;
DROP POLICY IF EXISTS hwstatus_parent_select  ON public.homework_status;
DROP POLICY IF EXISTS hwstatus_parent_insert  ON public.homework_status;
DROP POLICY IF EXISTS hwstatus_parent_update  ON public.homework_status;

CREATE POLICY hwstatus_staff_select ON public.homework_status
  FOR SELECT TO authenticated
  USING (
    coalesce(get_user_role(), '') IN ('admin', 'direction', 'responsable_pedagogique')
    AND homework_id IN (SELECT h.id FROM homework h WHERE h.etablissement_id = current_etablissement_id())
  );

CREATE POLICY hwstatus_teacher_select ON public.homework_status
  FOR SELECT TO authenticated
  USING (
    homework_id IN (
      SELECT h.id FROM homework h
       WHERE h.etablissement_id = current_etablissement_id()
         AND h.class_id IN (
           SELECT ct.class_id FROM class_teachers ct JOIN teachers t ON t.id = ct.teacher_id
            WHERE t.user_id = auth.uid()
              AND (ct.effective_from IS NULL OR ct.effective_from - interval '7 days' <= current_date)
              AND (ct.effective_until IS NULL OR ct.effective_until >= current_date)
         )
    )
  );

CREATE POLICY hwstatus_parent_select ON public.homework_status
  FOR SELECT TO authenticated
  USING (
    parent_id IN (SELECT p.id FROM parents p WHERE p.user_id = auth.uid())
    AND homework_id IN (SELECT h.id FROM homework h WHERE h.etablissement_id = current_etablissement_id())
  );

CREATE POLICY hwstatus_parent_insert ON public.homework_status
  FOR INSERT TO authenticated
  WITH CHECK (
    parent_id IN (SELECT p.id FROM parents p WHERE p.user_id = auth.uid())
    AND homework_id IN (SELECT h.id FROM homework h WHERE h.etablissement_id = current_etablissement_id())
  );

CREATE POLICY hwstatus_parent_update ON public.homework_status
  FOR UPDATE TO authenticated
  USING (
    parent_id IN (SELECT p.id FROM parents p WHERE p.user_id = auth.uid())
    AND homework_id IN (SELECT h.id FROM homework h WHERE h.etablissement_id = current_etablissement_id())
  );

-- ── Suivi des devoirs (adultes) ────────────────────────────────────────────
DROP POLICY IF EXISTS adult_hwstatus_staff_select   ON public.adult_homework_status;
DROP POLICY IF EXISTS adult_hwstatus_teacher_select ON public.adult_homework_status;
DROP POLICY IF EXISTS adult_hwstatus_participant    ON public.adult_homework_status;

CREATE POLICY adult_hwstatus_staff_select ON public.adult_homework_status
  FOR SELECT TO authenticated
  USING (
    coalesce(get_user_role(), '') IN ('admin', 'direction', 'responsable_pedagogique')
    AND homework_id IN (SELECT h.id FROM homework h WHERE h.etablissement_id = current_etablissement_id())
  );

CREATE POLICY adult_hwstatus_teacher_select ON public.adult_homework_status
  FOR SELECT TO authenticated
  USING (
    homework_id IN (
      SELECT h.id FROM homework h
       WHERE h.etablissement_id = current_etablissement_id()
         AND h.class_id IN (
           SELECT ct.class_id FROM class_teachers ct JOIN teachers t ON t.id = ct.teacher_id
            WHERE t.user_id = auth.uid()
              AND (ct.effective_from IS NULL OR ct.effective_from - interval '7 days' <= current_date)
              AND (ct.effective_until IS NULL OR ct.effective_until >= current_date)
         )
    )
  );

-- L'adulte participant (tuteur 1 ou 2 du foyer) gere son propre suivi.
CREATE POLICY adult_hwstatus_participant ON public.adult_homework_status
  FOR ALL TO authenticated
  USING (
    homework_id IN (SELECT h.id FROM homework h WHERE h.etablissement_id = current_etablissement_id())
    AND EXISTS (
      SELECT 1 FROM parents p
       WHERE p.id = adult_homework_status.parent_id
         AND ((adult_homework_status.tutor_number = 1 AND p.tutor1_user_id = auth.uid())
           OR (adult_homework_status.tutor_number = 2 AND p.tutor2_user_id = auth.uid()))
    )
  )
  WITH CHECK (
    homework_id IN (SELECT h.id FROM homework h WHERE h.etablissement_id = current_etablissement_id())
    AND EXISTS (
      SELECT 1 FROM parents p
       WHERE p.id = adult_homework_status.parent_id
         AND ((adult_homework_status.tutor_number = 1 AND p.tutor1_user_id = auth.uid())
           OR (adult_homework_status.tutor_number = 2 AND p.tutor2_user_id = auth.uid()))
    )
  );

-- ── Notifications ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS notifications_select_staff  ON public.notifications;
DROP POLICY IF EXISTS notifications_select_parent ON public.notifications;

CREATE POLICY notifications_select_staff ON public.notifications
  FOR SELECT TO authenticated
  USING (etablissement_id = current_etablissement_id());

CREATE POLICY notifications_select_parent ON public.notifications
  FOR SELECT TO authenticated
  USING (etablissement_id = current_etablissement_id()
         AND parent_id IN (SELECT p.id FROM parents p WHERE p.user_id = auth.uid()));

-- ── RPC : l'ecole de l'appelant ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_teacher_profile_active(p_teacher_id uuid, p_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  -- coalesce : un rôle NULL (appelant anonyme / sans profil) doit être refusé.
  -- Sans cela, `NULL NOT IN (...)` vaut NULL → la garde ne se déclencherait pas.
  IF coalesce(get_user_role(), '') NOT IN ('admin', 'direction') THEN
    RAISE EXCEPTION 'Permission refusée : rôle insuffisant.';
  END IF;

  -- L'enseignant doit etre de l'ecole de l'appelant (NULL si ecole expiree).
  UPDATE public.profiles p
  SET is_active = p_active,
      updated_at = now()
  FROM public.teachers t
  WHERE t.id = p_teacher_id
    AND t.etablissement_id = current_etablissement_id()
    AND p.id = t.user_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.get_verified_totp_user_ids()
RETURNS TABLE(user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF coalesce(get_user_role(), '') NOT IN ('admin', 'direction') THEN
    RAISE EXCEPTION 'Acces refuse';
  END IF;

  -- Les seuls comptes de l'ecole de l'appelant.
  RETURN QUERY
    SELECT f.user_id
    FROM auth.mfa_factors f
    JOIN public.profiles pr ON pr.id = f.user_id
    WHERE f.factor_type = 'totp'
      AND f.status = 'verified'
      AND pr.etablissement_id = current_etablissement_id();
END;
$fn$;

-- Registre des migrations (voir supabase/migrations/README.md).
SELECT enregistrer_migration('abonnement-expire-coupe-la-base.sql', '727a3730b7d50490a7963637724e4614c883b5a5972d53f0d49742d0d40bc520');
