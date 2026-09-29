-- ============================================================================
-- BILAL EDUCATION — CHANTIER RLS, LOT 1 : finance et bulletins
-- ----------------------------------------------------------------------------
-- Seconde moitie de la passe du 5 aout, restee en plan. Le releve du
-- 29 septembre a montre que ces sept tables n'ont qu'UNE policy, en `FOR ALL`,
-- dont l'unique condition est l'etablissement : le cloisonnement a REMPLACE le
-- controle de role au lieu de s'y ajouter.
--
-- ── CE QUE CELA PERMET AUJOURD'HUI ─────────────────────────────────────────
--
-- Tout compte authentifie de l'ecole — un enseignant, et un parent le jour ou
-- ces comptes seront reactives — peut, par un simple appel a l'API REST :
--   . reecrire ce qu'une famille doit, s'accorder une reduction, saisir ou
--     effacer un paiement (`family_fees`, `fee_adjustments`, `fee_installments`) ;
--   . SUPPRIMER UN BULLETIN ARCHIVE ou reecrire une appreciation.
--
-- Le second point est le plus grave. Un bulletin archive est un document
-- PUBLIE, remis aux familles. Le 9 aout, l'historique de cloture a ete recrit
-- pour AGREGER ces archives au lieu de recalculer, precisement pour qu'il ne
-- puisse jamais contredire ce que les familles detiennent. Cette garantie
-- repose donc aujourd'hui sur des tables que n'importe qui peut reecrire.
--
-- Les gardes applicatives ne protegent rien ici : ces ecrans ecrivent
-- DIRECTEMENT depuis le navigateur, qui detient un jeton valide.
--
-- ── MATRICE (decidee le 29/09) ─────────────────────────────────────────────
--
-- FINANCE — lecture ET ecriture : admin, direction, comptable (`FINANCE_ROLES`,
--   la source unique cote application). Personne d'autre ne lit : la
--   consequence assumee est que la suppression d'une fiche parent, qui COMPTE
--   les cotisations du foyer, se restreint a admin et direction — c'est un acte
--   lourd, et un foyer avec des cotisations est de toute facon bloque.
--
-- BULLETINS — la distinction qui compte est entre ARCHIVER et APPRECIER :
--   . archives   : ecriture admin / direction / secretaire. L'enseignant en est
--                  exclu, exactement comme du bucket `bulletins` (25 juillet),
--                  ou l'ecriture ne lui a jamais ete accordee. Lui ouvrir la
--                  table sans le bucket produirait un archivage a moitie fait.
--   . appreciations : ecriture ouverte a l'ENSEIGNANT sur SES classes —
--                  l'appreciation est un acte pedagogique, c'est lui qui la
--                  redige. Le lui retirer serait une regression.
--   . lecture    : les cinq roles du bucket (comptable exclu, decision du
--                  25 juillet), l'enseignant borne a ses classes via
--                  `teaches_class`, comme `grades` depuis le 5 aout.
--
-- `teaches_class` respecte la fenetre `effective_from` / `effective_until` :
-- un ancien titulaire ne lit donc plus les bulletins de la classe qu'il a
-- quittee. C'est le meme correctif que celui du 24 septembre sur le titulaire.
--
-- ── FORME ──────────────────────────────────────────────────────────────────
--
-- Motif du 5 aout : DEUX policies par table, `_select` et `_write` (FOR ALL),
-- portant tenant ET role. Les policies permissives s'ADDITIONNENT (OR) : c'est
-- pourquoi les anciennes `*_tenant` doivent etre SUPPRIMEES et non completees —
-- en laisser une annulerait tout le reste, comme cela s'est produit sur
-- `announcements` en juillet (lot 2).
--
-- Idempotent.
-- ============================================================================

-- ── Garde : la migration suppose `etablissement_id` sur les sept tables ─────
-- Mieux vaut un echec franc et nomme qu'une policy posee sur une colonne
-- absente. (`periods` passe par `school_years` faute de cette colonne : le cas
-- existe, il faut donc le verifier plutot que le supposer.)
DO $$
DECLARE manquantes text := '';
        t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['family_fees','fee_adjustments','fee_installments',
                           'bulletin_archives','adult_bulletin_archives',
                           'bulletin_appreciations','adult_bulletin_appreciations']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name=t
                      AND column_name='etablissement_id') THEN
      manquantes := manquantes || ' ' || t;
    END IF;
  END LOOP;
  IF manquantes <> '' THEN
    RAISE EXCEPTION 'Colonne etablissement_id absente sur :%. Migration interrompue.', manquantes;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  FINANCE
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS family_fees_tenant      ON public.family_fees;
DROP POLICY IF EXISTS family_fees_select      ON public.family_fees;
DROP POLICY IF EXISTS family_fees_write       ON public.family_fees;

CREATE POLICY family_fees_select ON public.family_fees FOR SELECT
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable']));

CREATE POLICY family_fees_write ON public.family_fees FOR ALL
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable']))
  WITH CHECK (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable']));

DROP POLICY IF EXISTS fee_adjustments_tenant  ON public.fee_adjustments;
DROP POLICY IF EXISTS fee_adjustments_select  ON public.fee_adjustments;
DROP POLICY IF EXISTS fee_adjustments_write   ON public.fee_adjustments;

CREATE POLICY fee_adjustments_select ON public.fee_adjustments FOR SELECT
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable']));

CREATE POLICY fee_adjustments_write ON public.fee_adjustments FOR ALL
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable']))
  WITH CHECK (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable']));

DROP POLICY IF EXISTS fee_installments_tenant ON public.fee_installments;
DROP POLICY IF EXISTS fee_installments_select ON public.fee_installments;
DROP POLICY IF EXISTS fee_installments_write  ON public.fee_installments;

CREATE POLICY fee_installments_select ON public.fee_installments FOR SELECT
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable']));

CREATE POLICY fee_installments_write ON public.fee_installments FOR ALL
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable']))
  WITH CHECK (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable']));

-- ═══════════════════════════════════════════════════════════════════════════
--  BULLETINS — ARCHIVES (l'enseignant LIT ses classes, il n'archive pas)
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS bulletin_archives_select ON public.bulletin_archives;
DROP POLICY IF EXISTS bulletin_archives_insert ON public.bulletin_archives;
DROP POLICY IF EXISTS bulletin_archives_delete ON public.bulletin_archives;
DROP POLICY IF EXISTS bulletin_archives_write  ON public.bulletin_archives;

CREATE POLICY bulletin_archives_select ON public.bulletin_archives FOR SELECT
  USING (
    etablissement_id = current_etablissement_id()
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
      OR (get_user_role() = 'enseignant' AND teaches_class(class_id))
    )
  );

CREATE POLICY bulletin_archives_write ON public.bulletin_archives FOR ALL
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','secretaire']))
  WITH CHECK (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','secretaire']));

DROP POLICY IF EXISTS adult_bull_arch_select ON public.adult_bulletin_archives;
DROP POLICY IF EXISTS adult_bull_arch_insert ON public.adult_bulletin_archives;
DROP POLICY IF EXISTS adult_bull_arch_delete ON public.adult_bulletin_archives;
DROP POLICY IF EXISTS adult_bull_arch_write  ON public.adult_bulletin_archives;

CREATE POLICY adult_bull_arch_select ON public.adult_bulletin_archives FOR SELECT
  USING (
    etablissement_id = current_etablissement_id()
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
      OR (get_user_role() = 'enseignant' AND teaches_class(class_id))
    )
  );

CREATE POLICY adult_bull_arch_write ON public.adult_bulletin_archives FOR ALL
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','secretaire']))
  WITH CHECK (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','secretaire']));

-- ═══════════════════════════════════════════════════════════════════════════
--  BULLETINS — APPRECIATIONS (acte PEDAGOGIQUE : l'enseignant les redige)
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS bulletin_appreciations_select ON public.bulletin_appreciations;
DROP POLICY IF EXISTS bulletin_appreciations_insert ON public.bulletin_appreciations;
DROP POLICY IF EXISTS bulletin_appreciations_update ON public.bulletin_appreciations;
DROP POLICY IF EXISTS bulletin_appreciations_delete ON public.bulletin_appreciations;
DROP POLICY IF EXISTS bulletin_appreciations_write  ON public.bulletin_appreciations;

CREATE POLICY bulletin_appreciations_select ON public.bulletin_appreciations FOR SELECT
  USING (
    etablissement_id = current_etablissement_id()
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
      OR (get_user_role() = 'enseignant' AND teaches_class(class_id))
    )
  );

CREATE POLICY bulletin_appreciations_write ON public.bulletin_appreciations FOR ALL
  USING (
    etablissement_id = current_etablissement_id()
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
      OR (get_user_role() = 'enseignant' AND teaches_class(class_id))
    )
  )
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
      OR (get_user_role() = 'enseignant' AND teaches_class(class_id))
    )
  );

DROP POLICY IF EXISTS adult_bull_appr_select ON public.adult_bulletin_appreciations;
DROP POLICY IF EXISTS adult_bull_appr_insert ON public.adult_bulletin_appreciations;
DROP POLICY IF EXISTS adult_bull_appr_update ON public.adult_bulletin_appreciations;
DROP POLICY IF EXISTS adult_bull_appr_delete ON public.adult_bulletin_appreciations;
DROP POLICY IF EXISTS adult_bull_appr_write  ON public.adult_bulletin_appreciations;

CREATE POLICY adult_bull_appr_select ON public.adult_bulletin_appreciations FOR SELECT
  USING (
    etablissement_id = current_etablissement_id()
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
      OR (get_user_role() = 'enseignant' AND teaches_class(class_id))
    )
  );

CREATE POLICY adult_bull_appr_write ON public.adult_bulletin_appreciations FOR ALL
  USING (
    etablissement_id = current_etablissement_id()
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
      OR (get_user_role() = 'enseignant' AND teaches_class(class_id))
    )
  )
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
      OR (get_user_role() = 'enseignant' AND teaches_class(class_id))
    )
  );

SELECT 'Lot 1 : finance reservee aux roles finance, bulletins avec role ET tenant (archiver <> apprecier).' AS status;
