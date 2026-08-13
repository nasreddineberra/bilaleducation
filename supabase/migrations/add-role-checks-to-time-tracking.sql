-- ============================================================================
-- TEMPS DE PRESENCE : le controle de ROLE manquait sur la LECTURE et sur les
-- TAUX HORAIRES.
--
-- ┌─ CE QUI ETAIT OUVERT ────────────────────────────────────────────────────┐
-- │ 1. `staff_time_entries` SELECT n'avait que le cloisonnement d'etablisse-  │
-- │    ment. TOUT compte authentifie de l'ecole lisait les heures de tout le  │
-- │    monde — presences, absences, et le champ `absence_reason`, du texte    │
-- │    libre qui peut porter un motif medical.                                │
-- │                                                                           │
-- │ 2. `presence_types` et `presence_type_rates` n'avaient AUCUN controle de  │
-- │    role, en FOR ALL. Un enseignant pouvait lire la grille des taux        │
-- │    horaires ET la modifier. C'est la paie.                                │
-- └───────────────────────────────────────────────────────────────────────────┘
--
-- Meme defaut que celui corrige le 5 aout sur les tables centrales : le
-- cloisonnement pose A LA PLACE du controle de role, et non EN PLUS. Les gardes
-- de l'ecran (`canManageAll`, `canSeeCosts`) sont applicatives — le navigateur
-- detient un jeton valide et peut appeler l'API REST sans passer par elles.
--
-- ── L'ENSEIGNANT NE SAISIT PAS, IL CONFIRME ────────────────────────────────
--
-- Decision de l'utilisateur : les cours naissent avec la classe, poses par la
-- direction, et se propagent seuls. L'enseignant ne cree rien — il VALIDE une
-- presence sur un cours passe, date d'aujourd'hui au plus.
--
-- Son ecriture ne peut donc pas etre supprimee (le bouton ✓ de l'emploi du
-- temps insere bien une ligne ici, depuis SON navigateur), mais elle se borne
-- a ce que cet acte exige. TROIS bornes, et la RLS les porte toutes les trois
-- parce qu'aucune ne tient si elle ne vit que dans l'ecran :
--
--   · sa propre ligne              — pas celle d'un collegue
--   · un type COURS ou ACTIVITE    — ni absence, ni menage, ni administratif
--   · une date <= aujourd'hui      — on ne valide pas un cours a venir
--
-- La 3e reprend en base ce que l'ecran impose deja (`canValidate = dateStr <=
-- todayStr`) : une regle qui ne vit que dans le navigateur n'est pas une regle.
--
-- ── QUI SAISIT DEPUIS L'ECRAN ──────────────────────────────────────────────
--
--   admin · direction · secretaire   tout le personnel
--   responsable pedagogique          les enseignants + soi (decision du 14/07)
--   COMPTABLE                        RIEN — il lit tout, il ne saisit pas
--   enseignant                       sa validation seule (ci-dessus)
--
-- ── TAUX ET TYPES ──────────────────────────────────────────────────────────
--
-- L'ecriture suit l'ECRAN qui l'exerce, pas un role plus large : « Parametres →
-- Financiers » et « Types de presence » sont l'un et l'autre reserves a
-- admin/direction (sidebar + `requireRoleServer` de `types-presence/actions`).
-- Accorder le droit a un role qui n'a pas l'ecran, c'est ouvrir une porte que
-- personne n'emprunte — sauf par l'API.
--
-- La LECTURE des taux suit `canSeeCosts` : admin, direction, comptable, et
-- l'enseignant (qui voit son propre cout a l'ecran). Secretaire et responsable
-- pedagogique ne voient pas les couts — ils liront un recapitulatif sans
-- montants, ce qui est exactement leur perimetre d'ecran.
--
-- Idempotent. Aucune donnee touchee.
-- ============================================================================

-- ── 1. staff_time_entries ───────────────────────────────────────────────────

DROP POLICY IF EXISTS staff_time_entries_select            ON staff_time_entries;
DROP POLICY IF EXISTS staff_time_entries_manage            ON staff_time_entries;
DROP POLICY IF EXISTS staff_time_entries_teacher_own_insert ON staff_time_entries;
DROP POLICY IF EXISTS staff_time_entries_teacher_own_update ON staff_time_entries;
DROP POLICY IF EXISTS staff_time_entries_teacher_own_delete ON staff_time_entries;

-- LECTURE : l'encadrement voit tout, l'enseignant ses seules lignes.
-- `coalesce` : sans lui, un role NULL (anonyme) rend la comparaison NULL, et
-- `NULL = ANY(...)` ne vaut pas FALSE mais NULL — regle du 7 juillet.
CREATE POLICY staff_time_entries_select ON staff_time_entries
  FOR SELECT USING (
    etablissement_id = current_etablissement_id()
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY[
        'admin', 'direction', 'comptable', 'secretaire', 'responsable_pedagogique'
      ])
      OR (coalesce(get_user_role(), '') = 'enseignant' AND profile_id = auth.uid())
    )
  );

-- ECRITURE, gestionnaires : le COMPTABLE n'y est plus.
CREATE POLICY staff_time_entries_manage ON staff_time_entries
  FOR ALL USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'secretaire'])
  ) WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin', 'direction', 'secretaire'])
  );

-- ECRITURE, enseignant : une VALIDATION, pas une saisie.
CREATE POLICY staff_time_entries_teacher_validation ON staff_time_entries
  FOR INSERT WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = 'enseignant'
    AND profile_id = auth.uid()
    AND entry_date <= CURRENT_DATE
    AND entry_type IN (
      SELECT code FROM presence_types
      WHERE etablissement_id = current_etablissement_id()
        AND reserved_kind IN ('cours', 'activite')
    )
  );

-- Annuler sa validation reste possible : c'est le pendant du bouton, et
-- l'entree lui appartient. Pas de borne de date — corriger une validation
-- ancienne est legitime.
CREATE POLICY staff_time_entries_teacher_own_delete ON staff_time_entries
  FOR DELETE USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = 'enseignant'
    AND profile_id = auth.uid()
  );

-- Pas d'UPDATE pour l'enseignant : une validation se pose ou se retire, elle
-- ne se modifie pas. Un horaire faux se corrige en annulant puis revalidant.

-- ── 2. schedule_validations ─────────────────────────────────────────────────

DROP POLICY IF EXISTS schedule_validations_select             ON schedule_validations;
DROP POLICY IF EXISTS schedule_validations_teacher_own_insert ON schedule_validations;

CREATE POLICY schedule_validations_select ON schedule_validations
  FOR SELECT USING (
    etablissement_id = current_etablissement_id()
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY[
        'admin', 'direction', 'comptable', 'secretaire', 'responsable_pedagogique'
      ])
      OR (coalesce(get_user_role(), '') = 'enseignant' AND profile_id = auth.uid())
    )
  );

CREATE POLICY schedule_validations_teacher_own_insert ON schedule_validations
  FOR INSERT WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = 'enseignant'
    AND profile_id = auth.uid()
    AND validation_date <= CURRENT_DATE
  );

-- ── 3. presence_types ───────────────────────────────────────────────────────
--
-- Lecture pour tout le personnel : l'emploi du temps en a besoin pour resoudre
-- le type reserve d'un creneau, et le temps de presence pour nommer et colorer
-- chaque saisie. Ecriture admin/direction, comme l'ecran.

DROP POLICY IF EXISTS presence_types_tenant ON presence_types;
DROP POLICY IF EXISTS presence_types_insert ON presence_types;
DROP POLICY IF EXISTS presence_types_update ON presence_types;
DROP POLICY IF EXISTS presence_types_delete ON presence_types;

CREATE POLICY presence_types_select ON presence_types
  FOR SELECT USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY[
      'admin', 'direction', 'comptable', 'secretaire', 'responsable_pedagogique', 'enseignant'
    ])
  );

CREATE POLICY presence_types_write ON presence_types
  FOR ALL USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin', 'direction'])
  ) WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin', 'direction'])
  );

-- ── 4. presence_type_rates ──────────────────────────────────────────────────
--
-- C'est la PAIE. Lecture calquee sur `canSeeCosts`, ecriture sur l'ecran
-- « Parametres → Financiers », reserve a admin/direction.

DROP POLICY IF EXISTS presence_type_rates_tenant ON presence_type_rates;
DROP POLICY IF EXISTS presence_type_rates_insert ON presence_type_rates;
DROP POLICY IF EXISTS presence_type_rates_update ON presence_type_rates;
DROP POLICY IF EXISTS presence_type_rates_delete ON presence_type_rates;

CREATE POLICY presence_type_rates_select ON presence_type_rates
  FOR SELECT USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY[
      'admin', 'direction', 'comptable', 'enseignant'
    ])
  );

CREATE POLICY presence_type_rates_write ON presence_type_rates
  FOR ALL USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin', 'direction'])
  ) WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin', 'direction'])
  );
