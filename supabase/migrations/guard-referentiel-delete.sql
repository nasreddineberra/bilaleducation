-- ============================================================================
-- Referentiel des cours : la suppression cesse d'emporter ce qu'on ne voit pas
--
-- CONSTAT (10 aout 2026). L'ecran ne faisait qu'une modale de confirmation, la
-- suppression partait DIRECTEMENT DU NAVIGATEUR, et toute la protection reposait
-- sur les cles etrangeres. Or aucune n'etait en RESTRICT :
--
--   supprimer une UE      -> CASCADE sur `cours` ET sur `cours_modules`
--                            = tout le sous-arbre disparaissait en un clic
--   supprimer un module   -> `cours.module_id` SET NULL
--                            = les cours SURVIVAIENT, orphelins : invisibles
--                              dans l'arbre (qui groupe par module), toujours
--                              en base, toujours references
--   supprimer un cours    -> `evaluations.cours_id` et `schedule_slots.cours_id`
--                            passaient a NULL
--
-- Deux consequences que l'ecran presentait a l'envers :
--   . le message « Impossible de supprimer : des cours sont rattaches » etait
--     INATTEIGNABLE — aucune contrainte ne pouvait lever 23503 ;
--   . l'avertissement « tous les elements rattaches seront egalement supprimes »
--     etait FAUX pour un module : ses cours ne sont pas supprimes, ils sont
--     detaches.
--
-- CE QUE CETTE MIGRATION POSE (modele decide par l'utilisateur) : on ne supprime
-- que ce qui est VIDE, en partant du bas.
--
--   un cours   se supprime, sauf s'il sert un GABARIT de l'annee EN COURS
--   un module  ne se supprime que s'il n'a plus aucun cours
--   une UE     ne se supprime que si elle n'a plus ni module NI cours
--              (un cours peut pendre directement a l'UE : `module_id` est
--               nullable, `unite_enseignement_id` ne l'est pas)
--
-- La regle vit dans les CLES ETRANGERES et non dans du code : elle est alors
-- vraie pour tout chemin d'ecriture, y compris un appel direct a l'API.
--
-- Idempotent.
-- ============================================================================

-- ── 1. Les trois cles passent en RESTRICT ────────────────────────────────────
--
-- RESTRICT et non NO ACTION : NO ACTION est differable et ne se verifie qu'en
-- fin de transaction, ce qui laisserait passer un enchainement « je vide puis je
-- supprime » dans une meme transaction. RESTRICT refuse immediatement.
--
-- CONSEQUENCE A CONNAITRE. Contrairement a un declencheur, une cle en RESTRICT
-- n'a PAS de sortie de secours : elle refusera aussi une CASCADE venue d'en
-- haut. `unites_enseignement.etablissement_id` etant en CASCADE, supprimer un
-- etablissement qui possede un referentiel echouera desormais.
--   VERIFIE : les trois seules suppressions d'`etablissements` du code sont des
--   ROLLBACKS de `createTenant` (mot de passe refuse, email deja pris, echec du
--   profil directeur) — l'etablissement a quelques secondes et aucun cours. La
--   console ne propose pas de supprimer une ecole, seulement de lui couper
--   l'acces. Le jour ou une vraie suppression existera, elle devra vider le
--   referentiel d'abord — ce qui est le comportement voulu, pas un defaut.

ALTER TABLE cours DROP CONSTRAINT IF EXISTS cours_unite_enseignement_id_fkey;
ALTER TABLE cours ADD  CONSTRAINT cours_unite_enseignement_id_fkey
  FOREIGN KEY (unite_enseignement_id) REFERENCES unites_enseignement(id) ON DELETE RESTRICT;

ALTER TABLE cours_modules DROP CONSTRAINT IF EXISTS cours_modules_unite_enseignement_id_fkey;
ALTER TABLE cours_modules ADD  CONSTRAINT cours_modules_unite_enseignement_id_fkey
  FOREIGN KEY (unite_enseignement_id) REFERENCES unites_enseignement(id) ON DELETE RESTRICT;

ALTER TABLE cours DROP CONSTRAINT IF EXISTS cours_module_id_fkey;
ALTER TABLE cours ADD  CONSTRAINT cours_module_id_fkey
  FOREIGN KEY (module_id) REFERENCES cours_modules(id) ON DELETE RESTRICT;


-- ── 2. Un cours qui sert un gabarit de l'annee EN COURS ne se supprime pas ───
--
-- La chaine est : referentiel -> GABARIT (`evaluations`) -> notes (`grades`).
-- Le gabarit est donc le bon point de blocage : effacer le cours sous un gabarit
-- vivant laisserait une evaluation notee sans savoir de quoi elle traite.
--
-- BORNE A L'ANNEE EN COURS, decision de l'utilisateur : une annee close a ses
-- bulletins ARCHIVES (l'audit Bulletins est bloquant, il le garantit), et depuis
-- le 9 aout la fiche Scolarite ne lit QUE les archives. Les gabarits d'annees
-- passees ne sont donc plus lus par aucun ecran : leur rattachement peut tomber.
-- L'ecran l'ANNONCE au lieu de le taire.
--
-- Le declencheur vit en base parce que la suppression part du navigateur.

CREATE OR REPLACE FUNCTION public.fn_guard_cours_delete()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_gabarits int;
BEGIN
  -- SORTIE DE SECOURS : si l'UE porteuse n'existe plus, on est dans une CASCADE
  -- legitime (suppression d'un etablissement). Sans elle, la garde bloquerait un
  -- menage regulier. Meme motif que les gardes de classe et de type de presence.
  IF NOT EXISTS (SELECT 1 FROM unites_enseignement WHERE id = OLD.unite_enseignement_id) THEN
    RETURN OLD;
  END IF;

  SELECT count(*) INTO v_gabarits
  FROM evaluations e
  JOIN classes c      ON c.id = e.class_id
  JOIN school_years y ON y.etablissement_id = c.etablissement_id
                     AND y.label            = c.academic_year
  WHERE e.cours_id = OLD.id
    AND y.is_current;

  IF v_gabarits > 0 THEN
    RAISE EXCEPTION
      'Le cours « % » sert encore % gabarit(s) d''evaluation de l''annee en cours. Supprimez-les d''abord.',
      OLD.nom_fr, v_gabarits
      USING ERRCODE = '23503';
  END IF;

  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS guard_cours_delete ON cours;
CREATE TRIGGER guard_cours_delete
  BEFORE DELETE ON cours
  FOR EACH ROW EXECUTE FUNCTION fn_guard_cours_delete();


-- ── 3. La purge gagne un filet par CLASSE ────────────────────────────────────
--
-- Elle effacait les evaluations `WHERE period_id = ANY(v_periods)`. Or
-- `evaluations.period_id` est NULLABLE : une evaluation sans periode echappait
-- donc DEFINITIVEMENT a la purge, et resterait a compter — ou a orpheliner —
-- pour toujours. L'ecran ne peut pas en creer (`handleAdd` sort si aucune
-- periode n'est choisie), mais l'API le pourrait.
--
-- `class_id` est NOT NULL : c'est le critere robuste. Les deux sont conserves,
-- la periode restant le lien le plus direct.

CREATE OR REPLACE FUNCTION public.purge_school_year(p_year_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role     text := coalesce(get_user_role(), '');
  v_etab     uuid;
  v_label    text;
  v_start    date;
  v_end      date;
  v_archived timestamptz;
  v_purged   timestamptz;
  v_periods  uuid[];
  v_classes  uuid[];
  v_paidfees uuid[];
  n_notes    int := 0;
  n_absences int := 0;
  n_fees     int := 0;
  c          int;
BEGIN
  -- Garde de role
  IF v_role NOT IN ('admin', 'direction') THEN
    RAISE EXCEPTION 'Acces refuse : purge reservee a admin/direction.' USING ERRCODE = '42501';
  END IF;

  -- Etat de l'annee et jalons de cloture : tout se lit desormais sur la meme ligne.
  SELECT etablissement_id, label, start_date, end_date, archived_at, purged_at
    INTO v_etab, v_label, v_start, v_end, v_archived, v_purged
  FROM school_years WHERE id = p_year_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Annee introuvable.';
  END IF;

  -- Cloisonnement multi-etablissement (la RPC est SECURITY DEFINER → pas de RLS) :
  -- interdit de purger l'annee d'un autre etablissement, meme via appel RPC direct.
  -- IS DISTINCT FROM couvre le cas NULL (ex. super_admin sans etablissement → refuse).
  IF v_etab IS DISTINCT FROM current_etablissement_id() THEN
    RAISE EXCEPTION 'Acces refuse : annee d''un autre etablissement.' USING ERRCODE = '42501';
  END IF;

  -- Prerequis ABSOLU : annee archivee
  IF v_archived IS NULL THEN
    RAISE EXCEPTION 'Annee % non archivee : purge interdite.', v_label;
  END IF;

  SELECT coalesce(array_agg(id), '{}') INTO v_periods FROM periods WHERE school_year_id = p_year_id;
  SELECT coalesce(array_agg(id), '{}') INTO v_classes FROM classes WHERE academic_year = v_label AND etablissement_id = v_etab;

  -- Desactivation des triggers d'audit des tables purgees (rollback si erreur : DDL transactionnel).
  ALTER TABLE family_fees          DISABLE TRIGGER audit_family_fees;
  ALTER TABLE fee_installments     DISABLE TRIGGER audit_fee_installments;
  ALTER TABLE fee_adjustments      DISABLE TRIGGER audit_fee_adjustments;
  ALTER TABLE staff_time_entries   DISABLE TRIGGER audit_staff_time_entries;
  ALTER TABLE schedule_validations DISABLE TRIGGER audit_schedule_validations;

  -- ── Notes ──
  DELETE FROM grades WHERE evaluation_id IN (SELECT id FROM evaluations WHERE period_id = ANY(v_periods) OR class_id = ANY(v_classes));
  GET DIAGNOSTICS c = ROW_COUNT; n_notes := n_notes + c;
  DELETE FROM adult_grades WHERE evaluation_id IN (SELECT id FROM evaluations WHERE period_id = ANY(v_periods) OR class_id = ANY(v_classes));
  GET DIAGNOSTICS c = ROW_COUNT; n_notes := n_notes + c;

  -- ── Appreciations de bulletin ──
  DELETE FROM bulletin_appreciations       WHERE period_id = ANY(v_periods);
  DELETE FROM adult_bulletin_appreciations WHERE period_id = ANY(v_periods);

  -- ── Absences ──
  DELETE FROM absences WHERE period_id = ANY(v_periods);
  GET DIAGNOSTICS n_absences = ROW_COUNT;

  -- ── Evaluations ──
  DELETE FROM evaluations WHERE period_id = ANY(v_periods) OR class_id = ANY(v_classes);

  -- ── EDT : validations + exceptions + creneaux (scope aux creneaux de l'annee) ──
  DELETE FROM schedule_validations WHERE schedule_slot_id IN (SELECT id FROM schedule_slots WHERE school_year_id = p_year_id);
  DELETE FROM schedule_exceptions  WHERE schedule_slot_id IN (SELECT id FROM schedule_slots WHERE school_year_id = p_year_id);
  DELETE FROM schedule_slots       WHERE school_year_id = p_year_id;

  -- ── Temps de presence (etablissement + plage de dates de l'annee) ──
  IF v_start IS NOT NULL AND v_end IS NOT NULL THEN
    DELETE FROM staff_time_entries WHERE etablissement_id = v_etab AND entry_date BETWEEN v_start AND v_end;
  END IF;

  -- ── Cahier de texte (homework cascade homework_status + adult_homework_status) ──
  DELETE FROM homework      WHERE class_id = ANY(v_classes);
  DELETE FROM class_journal WHERE class_id = ANY(v_classes);

  -- ── Finance : foyers SOLDES uniquement (impayes conserves, vifs) ──
  -- Critere = RESTE RECALCULE (du - percu) <= 0, et NON le libelle `status`
  -- (denormalise, risque de desync → une dette marquee 'paid' a tort serait
  -- effacee). Tolerance centimes (0.005) : dans le doute, on NE supprime pas.
  SELECT coalesce(array_agg(ff.id), '{}')
    INTO v_paidfees
  FROM family_fees ff
  WHERE ff.school_year_id = p_year_id
    AND ff.total_due - coalesce(
          (SELECT sum(fi.amount_paid) FROM fee_installments fi WHERE fi.family_fee_id = ff.id), 0
        ) <= 0.005;

  DELETE FROM fee_installments WHERE family_fee_id = ANY(v_paidfees);
  DELETE FROM fee_adjustments  WHERE family_fee_id = ANY(v_paidfees);
  DELETE FROM family_fees      WHERE id = ANY(v_paidfees);
  GET DIAGNOSTICS n_fees = ROW_COUNT;

  -- Reactivation des triggers d'audit
  ALTER TABLE family_fees          ENABLE TRIGGER audit_family_fees;
  ALTER TABLE fee_installments     ENABLE TRIGGER audit_fee_installments;
  ALTER TABLE fee_adjustments      ENABLE TRIGGER audit_fee_adjustments;
  ALTER TABLE staff_time_entries   ENABLE TRIGGER audit_staff_time_entries;
  ALTER TABLE schedule_validations ENABLE TRIGGER audit_schedule_validations;

  UPDATE school_years SET purged_at = now() WHERE id = p_year_id;

  RETURN jsonb_build_object(
    'label', v_label,
    'notes', n_notes,
    'absences', n_absences,
    'fees_paid', n_fees,
    'already_purged', (v_purged IS NOT NULL)
  );
END;
$function$
;
