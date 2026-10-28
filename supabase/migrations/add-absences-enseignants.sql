-- ============================================================================
-- ABSENCES ENSEIGNANTS : LA BASE (chantier Planning / absences, lot 3a)
-- (28 octobre 2026)
--
-- Conception : docs/CONCEPTION-PLANNING-ABSENCES.md (§ 2 et 3). Decisions de
-- l'utilisateur (28/10) :
--   - une absence va d'une date + heure a une date + heure, bornes comprises
--     (plus de demi-journees) ; une seance est TOUCHEE des qu'elle chevauche
--     l'absence, ne serait-ce qu'une minute ;
--   - trois decisions par seance : Remplacee par..., Annulee, A decider (defaut :
--     AUCUNE ligne, un oubli n'annule jamais un cours) ;
--   - declarent : admin, direction, responsable pedagogique, secretaire ;
--   - remplacant : TOUT membre actif de l'equipe de l'ecole, jamais l'absent,
--     jamais quelqu'un d'occupe sur le meme horaire ;
--   - deux absences du meme enseignant ne se chevauchent pas ;
--   - motif : conge, maladie, personnel, formation, autre ;
--   - une seance VALIDEE ne change pas de decision (retirer la validation d'abord).
--
-- CE LOT N'A AUCUN EFFET VISIBLE : aucun ecran n'ecrit ni ne lit encore ces
-- tables (lot 3b). Les heures du remplacant viendront de la VALIDATION de la
-- seance (3b), les emails aux familles de 3c (`familles_prevenues_le`).
--
-- Ecriture : trois fonctions SECURITY DEFINER, aucune policy d'ecriture (droits
-- retires) : chaque refus est EXPLICITE (code + HINT), jamais une ecriture qui
-- touche zero ligne. Lecture : l'encadrement, et l'enseignant pour SES absences ;
-- les decisions (sans motif) par les memes roles que `schedule_exceptions`
-- (l'EDT doit dire qui assure). Le comptable ne lit pas les absences.
--
-- Une seance « a lieu » a une date (`fn_seance_a_lieu`) et le titulaire en poste
-- (`fn_titulaire_de`) sont les MEMES regles que lib/edt/seance.ts
-- (indexTitulaires) et lib/edt/absences.ts : la base est le juge, le code les
-- affiche. Le controle 29 eprouve les cas limites des deux cotes.
--
-- Depart d'une ecole et remise a zero de la demonstration : les deux tables ont
-- `etablissement_id`, `fn_depart_tables()` les classe d'office.
--
-- Changement ADDITIF : migration d'abord.
-- Controle : supabase/controles/29-absences-enseignants.sql.
-- ============================================================================

-- ── 1. Les absences ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.absences_enseignants (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id uuid NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  -- RESTRICT : une fiche enseignant qui a des absences ne se supprime pas
  -- (historique ; l'ecran le dira au lot 3b).
  teacher_id       uuid NOT NULL REFERENCES public.teachers(id) ON DELETE RESTRICT,
  -- Heure LOCALE de l'ecole, sans fuseau : comparee a `seance_date + start_time`.
  debut            timestamp NOT NULL,
  fin              timestamp NOT NULL,
  motif            text NOT NULL CHECK (motif IN ('conge', 'maladie', 'personnel', 'formation', 'autre')),
  created_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT absences_enseignants_periode CHECK (fin > debut)
);

CREATE INDEX IF NOT EXISTS idx_absences_enseignants_enseignant
  ON public.absences_enseignants (etablissement_id, teacher_id, debut);

-- ── 2. Les decisions, une ligne par seance decidee ────────────────────────────
-- « A decider » = AUCUNE ligne.
CREATE TABLE IF NOT EXISTS public.absences_enseignants_seances (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id      uuid NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  absence_id            uuid NOT NULL REFERENCES public.absences_enseignants(id) ON DELETE CASCADE,
  schedule_slot_id      uuid NOT NULL REFERENCES public.schedule_slots(id) ON DELETE CASCADE,
  seance_date           date NOT NULL,
  decision              text NOT NULL CHECK (decision IN ('remplacee', 'annulee')),
  -- RESTRICT : un compte qui a remplace ne se supprime pas en silence (lot 3b).
  remplacant_profile_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  -- Dernier email aux familles pour cette seance (lot 3c).
  familles_prevenues_le timestamptz,
  decide_par            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decide_le             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT absences_enseignants_seances_unique UNIQUE (schedule_slot_id, seance_date),
  CONSTRAINT absences_enseignants_seances_remplacant
    CHECK ((decision = 'remplacee') = (remplacant_profile_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_absences_enseignants_seances_absence
  ON public.absences_enseignants_seances (absence_id);
CREATE INDEX IF NOT EXISTS idx_absences_enseignants_seances_remplacant
  ON public.absences_enseignants_seances (remplacant_profile_id, seance_date);

-- ── 3. Declencheurs : ecole, date de modification, journal ────────────────────
DROP TRIGGER IF EXISTS absences_enseignants_auto_etablissement ON public.absences_enseignants;
CREATE TRIGGER absences_enseignants_auto_etablissement
  BEFORE INSERT ON public.absences_enseignants
  FOR EACH ROW EXECUTE FUNCTION public.set_etablissement_id();
DROP TRIGGER IF EXISTS absences_enseignants_seances_auto_etablissement ON public.absences_enseignants_seances;
CREATE TRIGGER absences_enseignants_seances_auto_etablissement
  BEFORE INSERT ON public.absences_enseignants_seances
  FOR EACH ROW EXECUTE FUNCTION public.set_etablissement_id();

DROP TRIGGER IF EXISTS update_absences_enseignants_updated_at ON public.absences_enseignants;
CREATE TRIGGER update_absences_enseignants_updated_at
  BEFORE UPDATE ON public.absences_enseignants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS audit_absences_enseignants ON public.absences_enseignants;
CREATE TRIGGER audit_absences_enseignants
  AFTER INSERT OR DELETE OR UPDATE ON public.absences_enseignants
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
DROP TRIGGER IF EXISTS audit_absences_enseignants_seances ON public.absences_enseignants_seances;
CREATE TRIGGER audit_absences_enseignants_seances
  AFTER INSERT OR DELETE OR UPDATE ON public.absences_enseignants_seances
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- ── 4. Lecture ────────────────────────────────────────────────────────────────
ALTER TABLE public.absences_enseignants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absences_enseignants_seances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS absences_enseignants_select ON public.absences_enseignants;
CREATE POLICY absences_enseignants_select ON public.absences_enseignants FOR SELECT
  USING (etablissement_id = current_etablissement_id()
         AND (coalesce(get_user_role(), '') IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire')
              OR (coalesce(get_user_role(), '') = 'enseignant'
                  AND teacher_id IN (SELECT t.id FROM teachers t WHERE t.user_id = auth.uid()))));

DROP POLICY IF EXISTS absences_enseignants_seances_select ON public.absences_enseignants_seances;
CREATE POLICY absences_enseignants_seances_select ON public.absences_enseignants_seances FOR SELECT
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'comptable', 'responsable_pedagogique',
                                               'secretaire', 'enseignant'));

REVOKE ALL ON public.absences_enseignants, public.absences_enseignants_seances FROM public, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.absences_enseignants, public.absences_enseignants_seances
  FROM authenticated;
GRANT SELECT ON public.absences_enseignants, public.absences_enseignants_seances TO authenticated;

-- ── 5. Regles partagees ───────────────────────────────────────────────────────
-- La seance d'un creneau a-t-elle lieu a cette date ? (EDT : 0 = dimanche.)
-- Annulation et jours fermes NON compris : ce sont des etats de la seance.
CREATE OR REPLACE FUNCTION public.fn_seance_a_lieu(p_slot_id uuid, p_date date)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM schedule_slots s
     WHERE s.id = p_slot_id
       AND s.is_active
       AND CASE WHEN s.is_recurring
                THEN s.day_of_week = extract(dow FROM p_date)
                     AND (s.effective_from  IS NULL OR s.effective_from  <= p_date)
                     AND (s.effective_until IS NULL OR s.effective_until >= p_date)
                ELSE s.slot_date = p_date END
  )
$fn$;

-- Titulaire en poste d'une classe a une date (`teachers.id`), comme
-- `indexTitulaires` : affectation principale couvrant la date, la plus recente
-- en cas de passation le meme jour.
CREATE OR REPLACE FUNCTION public.fn_titulaire_de(p_class_id uuid, p_date date)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT ct.teacher_id FROM class_teachers ct
   WHERE ct.class_id = p_class_id
     AND ct.is_main_teacher
     AND (ct.effective_from  IS NULL OR ct.effective_from  <= p_date)
     AND (ct.effective_until IS NULL OR ct.effective_until >= p_date)
   ORDER BY ct.effective_from DESC NULLS LAST
   LIMIT 1
$fn$;

-- Ou un membre de l'equipe est-il deja pris sur cet horaire ? Rend un libelle
-- (« CE1 · 15:00-16:00 », « absent »), NULL s'il est libre. Pris = titulaire
-- d'une seance qui a lieu, ni annulee ni confiee a un autre ; remplacant d'une
-- autre seance ; ou lui-meme absent.
CREATE OR REPLACE FUNCTION public.fn_membre_occupe(
  p_profile_id uuid, p_date date, p_debut time, p_fin time, p_exclure_slot uuid
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT coalesce(
    (SELECT 'absent' FROM absences_enseignants a JOIN teachers t ON t.id = a.teacher_id
      WHERE t.user_id = p_profile_id
        AND a.debut < p_date + p_fin AND a.fin > p_date + p_debut
      LIMIT 1),
    (SELECT c.name || ' · ' || to_char(s.start_time, 'HH24:MI') || '-' || to_char(s.end_time, 'HH24:MI')
       FROM schedule_slots s JOIN classes c ON c.id = s.class_id
       JOIN teachers t ON t.id = fn_titulaire_de(s.class_id, p_date)
      WHERE t.user_id = p_profile_id
        AND s.etablissement_id = (SELECT p.etablissement_id FROM profiles p WHERE p.id = p_profile_id)
        AND s.id <> p_exclure_slot
        AND s.start_time < p_fin AND s.end_time > p_debut
        AND fn_seance_a_lieu(s.id, p_date)
        AND NOT EXISTS (SELECT 1 FROM schedule_exceptions x
                         WHERE x.schedule_slot_id = s.id AND x.exception_date = p_date
                           AND x.exception_type = 'cancelled')
        AND NOT EXISTS (SELECT 1 FROM absences_enseignants_seances d
                         WHERE d.schedule_slot_id = s.id AND d.seance_date = p_date)
      LIMIT 1),
    (SELECT c.name || ' · ' || to_char(s.start_time, 'HH24:MI') || '-' || to_char(s.end_time, 'HH24:MI')
       FROM absences_enseignants_seances d
       JOIN schedule_slots s ON s.id = d.schedule_slot_id JOIN classes c ON c.id = s.class_id
      WHERE d.remplacant_profile_id = p_profile_id
        AND d.seance_date = p_date
        AND d.schedule_slot_id <> p_exclure_slot
        AND s.start_time < p_fin AND s.end_time > p_debut
      LIMIT 1)
  )
$fn$;

-- Garde commune : role autorise a declarer, ecole active. Rend l'ecole.
CREATE OR REPLACE FUNCTION public.fn_absences_garde()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_etab uuid := current_etablissement_id();
BEGIN
  IF v_etab IS NULL
     OR coalesce(get_user_role(), '') NOT IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire') THEN
    RAISE EXCEPTION 'ABSENCE_REFUSEE' USING HINT = 'Votre role ne permet pas de gerer les absences des enseignants.';
  END IF;
  RETURN v_etab;
END
$fn$;

-- Une seance validee dans une liste de decisions sur le point de disparaitre ?
-- Leve ABSENCE_SEANCE_VALIDEE avec la seance en DETAIL.
CREATE OR REPLACE FUNCTION public.fn_absences_verifier_non_validees(p_ids uuid[])
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v record;
BEGIN
  SELECT c.name, d.seance_date, s.start_time, s.end_time INTO v
    FROM absences_enseignants_seances d
    JOIN schedule_slots s ON s.id = d.schedule_slot_id JOIN classes c ON c.id = s.class_id
   WHERE d.id = ANY (p_ids)
     AND EXISTS (SELECT 1 FROM schedule_validations sv
                  WHERE sv.schedule_slot_id = d.schedule_slot_id AND sv.validation_date = d.seance_date)
   ORDER BY d.seance_date, s.start_time
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'ABSENCE_SEANCE_VALIDEE'
      USING HINT = 'Une seance validee ne change pas : retirez d''abord la validation de presence.',
            DETAIL = v.name || ' · ' || to_char(v.seance_date, 'DD/MM/YYYY') || ' · '
                     || to_char(v.start_time, 'HH24:MI') || '-' || to_char(v.end_time, 'HH24:MI');
  END IF;
END
$fn$;

-- ── 6. Declarer ou modifier une absence ───────────────────────────────────────
-- p_id NULL = nouvelle absence. Rend son id.
CREATE OR REPLACE FUNCTION public.enregistrer_absence_enseignant(
  p_id uuid, p_teacher_id uuid, p_debut timestamp, p_fin timestamp, p_motif text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_etab    uuid := fn_absences_garde();
  v_absence absences_enseignants%ROWTYPE;
  v_autre   record;
  v_valid   record;
  v_sortent uuid[];
  v_id      uuid;
BEGIN
  IF p_debut IS NULL OR p_fin IS NULL OR p_fin <= p_debut THEN
    RAISE EXCEPTION 'ABSENCE_PERIODE' USING HINT = 'La fin de l''absence doit suivre son debut.';
  END IF;
  IF coalesce(p_motif, '') NOT IN ('conge', 'maladie', 'personnel', 'formation', 'autre') THEN
    RAISE EXCEPTION 'ABSENCE_MOTIF' USING HINT = 'Motif inconnu.';
  END IF;

  -- Verrou sur la fiche : deux declarations simultanees ne se chevauchent pas.
  PERFORM 1 FROM teachers WHERE id = p_teacher_id AND etablissement_id = v_etab FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ABSENCE_ENSEIGNANT' USING HINT = 'Enseignant introuvable dans cet etablissement.';
  END IF;

  IF p_id IS NOT NULL THEN
    SELECT * INTO v_absence FROM absences_enseignants WHERE id = p_id AND etablissement_id = v_etab FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ABSENCE_INTROUVABLE' USING HINT = 'Cette absence n''existe plus.';
    END IF;
    IF v_absence.teacher_id <> p_teacher_id THEN
      RAISE EXCEPTION 'ABSENCE_ENSEIGNANT_FIGE'
        USING HINT = 'L''enseignant d''une absence ne change pas : supprimez-la et declarez-en une autre.';
    END IF;
  END IF;

  SELECT debut, fin INTO v_autre FROM absences_enseignants
   WHERE teacher_id = p_teacher_id AND id IS DISTINCT FROM p_id
     AND debut < p_fin AND fin > p_debut
   ORDER BY debut LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'ABSENCE_CHEVAUCHEMENT'
      USING HINT = 'Cet enseignant a deja une absence sur cette periode : modifiez-la plutot.',
            DETAIL = to_char(v_autre.debut, 'DD/MM/YYYY HH24:MI') || '-' || to_char(v_autre.fin, 'DD/MM/YYYY HH24:MI');
  END IF;

  -- Une seance que l'absent a lui-meme VALIDEE dans la periode contredit l'absence.
  SELECT c.name, sv.validation_date, s.start_time, s.end_time INTO v_valid
    FROM schedule_validations sv
    JOIN schedule_slots s ON s.id = sv.schedule_slot_id JOIN classes c ON c.id = s.class_id
    JOIN teachers t ON t.id = p_teacher_id AND t.user_id = sv.profile_id
   WHERE sv.etablissement_id = v_etab
     AND sv.validation_date + s.start_time < p_fin AND sv.validation_date + s.end_time > p_debut
   ORDER BY sv.validation_date, s.start_time LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'ABSENCE_SEANCE_VALIDEE'
      USING HINT = 'L''enseignant a valide une seance de cette periode : retirez d''abord la validation de presence.',
            DETAIL = v_valid.name || ' · ' || to_char(v_valid.validation_date, 'DD/MM/YYYY') || ' · '
                     || to_char(v_valid.start_time, 'HH24:MI') || '-' || to_char(v_valid.end_time, 'HH24:MI');
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO absences_enseignants (etablissement_id, teacher_id, debut, fin, motif, created_by)
    VALUES (v_etab, p_teacher_id, p_debut, p_fin, p_motif, auth.uid())
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  -- Modification : les decisions des seances qui SORTENT de la periode
  -- disparaissent (elles redeviennent des seances ordinaires).
  SELECT array_agg(d.id) INTO v_sortent
    FROM absences_enseignants_seances d JOIN schedule_slots s ON s.id = d.schedule_slot_id
   WHERE d.absence_id = p_id
     AND NOT (d.seance_date + s.start_time < p_fin AND d.seance_date + s.end_time > p_debut);
  IF v_sortent IS NOT NULL THEN
    PERFORM fn_absences_verifier_non_validees(v_sortent);
    DELETE FROM absences_enseignants_seances WHERE id = ANY (v_sortent);
  END IF;

  UPDATE absences_enseignants SET debut = p_debut, fin = p_fin, motif = p_motif WHERE id = p_id;
  RETURN p_id;
END
$fn$;

-- ── 7. Supprimer une absence ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.supprimer_absence_enseignant(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_etab uuid := fn_absences_garde();
  v_ids  uuid[];
BEGIN
  PERFORM 1 FROM absences_enseignants WHERE id = p_id AND etablissement_id = v_etab FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ABSENCE_INTROUVABLE' USING HINT = 'Cette absence n''existe plus.';
  END IF;
  SELECT array_agg(id) INTO v_ids FROM absences_enseignants_seances WHERE absence_id = p_id;
  IF v_ids IS NOT NULL THEN
    PERFORM fn_absences_verifier_non_validees(v_ids);
  END IF;
  DELETE FROM absences_enseignants WHERE id = p_id;   -- decisions en cascade
END
$fn$;

-- ── 8. Decider des seances ────────────────────────────────────────────────────
-- p_decisions : [{ "slot_id", "date" (AAAA-MM-JJ), "decision" ('remplacee' |
-- 'annulee' | 'a_decider'), "remplacant" (profiles.id, pour 'remplacee') }].
-- Tout ou rien. Rend { "retablies": [{ slot_id, date }] } : seances dont les
-- familles avaient ete prevenues d'une annulation et qui ne sont plus annulees
-- (lot 3c : proposer de les prevenir).
CREATE OR REPLACE FUNCTION public.decider_seances_absence(p_absence_id uuid, p_decisions jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_etab      uuid := fn_absences_garde();
  v_absence   absences_enseignants%ROWTYPE;
  v_absent    uuid;
  d           jsonb;
  v_slot      schedule_slots%ROWTYPE;
  v_date      date;
  v_decision  text;
  v_remplacant uuid;
  v_avant     absences_enseignants_seances%ROWTYPE;
  v_occupe    text;
  v_seance    text;
  v_retablies jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_absence FROM absences_enseignants WHERE id = p_absence_id AND etablissement_id = v_etab FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ABSENCE_INTROUVABLE' USING HINT = 'Cette absence n''existe plus.';
  END IF;
  SELECT user_id INTO v_absent FROM teachers WHERE id = v_absence.teacher_id;

  IF jsonb_typeof(p_decisions) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'ABSENCE_DECISION' USING HINT = 'Liste de decisions attendue.';
  END IF;

  FOR d IN SELECT * FROM jsonb_array_elements(p_decisions) LOOP
    v_decision := d->>'decision';
    IF coalesce(v_decision, '') NOT IN ('remplacee', 'annulee', 'a_decider') THEN
      RAISE EXCEPTION 'ABSENCE_DECISION' USING HINT = 'Decision inconnue.';
    END IF;
    BEGIN
      v_date := (d->>'date')::date;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'ABSENCE_DECISION' USING HINT = 'Date de seance invalide.';
    END;

    SELECT * INTO v_slot FROM schedule_slots
     WHERE id = (d->>'slot_id')::uuid AND etablissement_id = v_etab;
    IF NOT FOUND OR v_date IS NULL OR NOT fn_seance_a_lieu(v_slot.id, v_date) THEN
      RAISE EXCEPTION 'ABSENCE_SEANCE_HORS' USING HINT = 'Cette seance n''existe pas a cette date.';
    END IF;
    SELECT c.name || ' · ' || to_char(v_date, 'DD/MM/YYYY') || ' · '
           || to_char(v_slot.start_time, 'HH24:MI') || '-' || to_char(v_slot.end_time, 'HH24:MI')
      INTO v_seance FROM classes c WHERE c.id = v_slot.class_id;

    IF NOT (v_date + v_slot.start_time < v_absence.fin AND v_date + v_slot.end_time > v_absence.debut)
       OR fn_titulaire_de(v_slot.class_id, v_date) IS DISTINCT FROM v_absence.teacher_id THEN
      RAISE EXCEPTION 'ABSENCE_SEANCE_HORS'
        USING HINT = 'Cette seance n''est pas touchee par l''absence.', DETAIL = v_seance;
    END IF;
    IF EXISTS (SELECT 1 FROM schedule_exceptions x
                WHERE x.schedule_slot_id = v_slot.id AND x.exception_date = v_date
                  AND x.exception_type = 'cancelled') THEN
      RAISE EXCEPTION 'ABSENCE_SEANCE_ANNULEE'
        USING HINT = 'Cette seance est deja annulee dans l''emploi du temps.', DETAIL = v_seance;
    END IF;
    IF EXISTS (SELECT 1 FROM schedule_validations sv
                WHERE sv.schedule_slot_id = v_slot.id AND sv.validation_date = v_date) THEN
      RAISE EXCEPTION 'ABSENCE_SEANCE_VALIDEE'
        USING HINT = 'Une seance validee ne change pas : retirez d''abord la validation de presence.',
              DETAIL = v_seance;
    END IF;

    SELECT * INTO v_avant FROM absences_enseignants_seances
     WHERE schedule_slot_id = v_slot.id AND seance_date = v_date;
    IF FOUND AND v_avant.absence_id <> p_absence_id THEN
      RAISE EXCEPTION 'ABSENCE_SEANCE_HORS'
        USING HINT = 'Cette seance releve d''une autre absence.', DETAIL = v_seance;
    END IF;

    v_remplacant := NULL;
    IF v_decision = 'remplacee' THEN
      BEGIN
        v_remplacant := (d->>'remplacant')::uuid;
      EXCEPTION WHEN others THEN v_remplacant := NULL;
      END;
      IF v_remplacant IS NULL OR NOT EXISTS (
           SELECT 1 FROM profiles p
            WHERE p.id = v_remplacant AND p.etablissement_id = v_etab AND coalesce(p.is_active, false)
              AND p.role IN ('admin', 'direction', 'comptable', 'secretaire', 'responsable_pedagogique', 'enseignant')) THEN
        RAISE EXCEPTION 'ABSENCE_REMPLACANT'
          USING HINT = 'Le remplacant doit etre un membre actif de l''equipe.', DETAIL = v_seance;
      END IF;
      IF v_remplacant = v_absent THEN
        RAISE EXCEPTION 'ABSENCE_REMPLACANT'
          USING HINT = 'L''enseignant absent ne peut pas se remplacer.', DETAIL = v_seance;
      END IF;
      v_occupe := fn_membre_occupe(v_remplacant, v_date, v_slot.start_time, v_slot.end_time, v_slot.id);
      IF v_occupe IS NOT NULL THEN
        RAISE EXCEPTION 'ABSENCE_REMPLACANT_OCCUPE'
          USING HINT = 'Ce remplacant est deja pris sur cet horaire.', DETAIL = v_seance || ' · ' || v_occupe;
      END IF;
    END IF;

    IF v_avant.id IS NOT NULL AND v_avant.decision = 'annulee' AND v_decision <> 'annulee'
       AND v_avant.familles_prevenues_le IS NOT NULL THEN
      v_retablies := v_retablies || jsonb_build_object('slot_id', v_slot.id, 'date', v_date);
    END IF;

    IF v_decision = 'a_decider' THEN
      DELETE FROM absences_enseignants_seances WHERE schedule_slot_id = v_slot.id AND seance_date = v_date;
    ELSE
      INSERT INTO absences_enseignants_seances
        (etablissement_id, absence_id, schedule_slot_id, seance_date, decision, remplacant_profile_id,
         decide_par, decide_le)
      VALUES (v_etab, p_absence_id, v_slot.id, v_date, v_decision, v_remplacant, auth.uid(), now())
      ON CONFLICT (schedule_slot_id, seance_date) DO UPDATE
        SET decision = EXCLUDED.decision,
            remplacant_profile_id = EXCLUDED.remplacant_profile_id,
            decide_par = EXCLUDED.decide_par,
            decide_le = EXCLUDED.decide_le;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('retablies', v_retablies);
END
$fn$;

-- ── 9. Droits d'execution ─────────────────────────────────────────────────────
-- Regles partagees : internes (appelees par les fonctions ci-dessus).
REVOKE EXECUTE ON FUNCTION public.fn_seance_a_lieu(uuid, date) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_titulaire_de(uuid, date) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_membre_occupe(uuid, date, time, time, uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_absences_garde() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_absences_verifier_non_validees(uuid[]) FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.enregistrer_absence_enseignant(uuid, uuid, timestamp, timestamp, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.supprimer_absence_enseignant(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.decider_seances_absence(uuid, jsonb) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.enregistrer_absence_enseignant(uuid, uuid, timestamp, timestamp, text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.supprimer_absence_enseignant(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.decider_seances_absence(uuid, jsonb) TO authenticated;

-- ── 10. Verification ──────────────────────────────────────────────────────────
DO $verif$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.absences_enseignants'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.absences_enseignants_seances'::regclass) THEN
    RAISE EXCEPTION 'RLS inactive sur une table des absences.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename IN ('absences_enseignants', 'absences_enseignants_seances')
              AND cmd <> 'SELECT') THEN
    RAISE EXCEPTION 'Policy d''ecriture inattendue sur une table des absences.';
  END IF;
  IF has_table_privilege('authenticated', 'public.absences_enseignants', 'INSERT')
     OR has_table_privilege('authenticated', 'public.absences_enseignants_seances', 'UPDATE')
     OR has_table_privilege('anon', 'public.absences_enseignants', 'SELECT') THEN
    RAISE EXCEPTION 'Droit de table inattendu sur les absences.';
  END IF;
  IF has_function_privilege('anon', 'public.decider_seances_absence(uuid, jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.fn_membre_occupe(uuid, date, time, time, uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.enregistrer_absence_enseignant(uuid, uuid, timestamp, timestamp, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Droit d''execution inattendu sur les fonctions des absences.';
  END IF;
  -- Les deux tables doivent etre classees pour le depart d'une ecole.
  IF (SELECT count(*) FROM fn_depart_tables()
       WHERE nom IN ('absences_enseignants', 'absences_enseignants_seances') AND efface AND exporte) <> 2 THEN
    RAISE EXCEPTION 'Tables des absences absentes de fn_depart_tables().';
  END IF;
END
$verif$;

SELECT enregistrer_migration('add-absences-enseignants.sql', '16dddb98d3464096866134241cfc21490b3cd043b12127cb82d9ce6e28a7d55a');
