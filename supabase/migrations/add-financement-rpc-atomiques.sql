-- ============================================================================
-- Les ecritures d'argent deviennent ATOMIQUES
--
-- Quatre operations de « Financements -> Reglements » etaient faites de DEUX
-- ecritures successives depuis le NAVIGATEUR :
--
--   ajouter une reduction    insert fee_adjustments   puis  update family_fees
--   supprimer une reduction  delete fee_adjustments   puis  update family_fees
--   enregistrer un paiement  insert/update fee_inst.  puis  update family_fees
--   supprimer un paiement    delete fee_installments  puis  update family_fees
--
-- Entre les deux, tout peut echouer : refus RLS, coupure reseau, onglet ferme.
-- On obtient alors une reduction enregistree SANS que ce que doit la famille
-- ait change, ou un paiement encaisse dont le dossier reste « en attente ».
--
-- Le travail du 1er octobre a rendu l'incoherence VISIBLE (`verifierEcriture` +
-- un message honnete), il ne l'a pas supprimee. PostgREST n'a pas de
-- transaction multi-requetes : deux `await`, ce sont deux requetes HTTP
-- independantes. Le SEUL moyen de les rendre atomiques est une RPC, ou les deux
-- ecritures tiennent dans une seule transaction — meme raisonnement que
-- `import_foyer` le 16 aout.
--
-- ── POURQUOI `subtotal` EST UN PARAMETRE ET NON UN CALCUL ───────────────────
--
-- Mesure du 6 octobre : `family_fees.subtotal` n'est ecrit QU'A LA CREATION et
-- n'est jamais rafraichi. La base ne peut donc pas en deriver `total_due`.
--
-- Et le subtotal vivant repose sur la REMISE FRATRIE — ordre des enfants,
-- `sibling_discount_same_type`, et un enfant sans cotisation qui compte quand
-- meme dans l'ordre. Le porter en SQL dupliquerait la regle la plus subtile du
-- module : exactement le defaut du 17 juillet, ou le calcul comptable recopie
-- dans trois sous-menus etait faux dans deux d'entre eux pendant des semaines.
--
-- La source unique reste donc `src/lib/financements/compute.ts`, qui fournit le
-- subtotal. La base calcule ce qu'elle POSSEDE : la somme des ajustements, la
-- somme des paiements, le total du, le statut.
--
-- SEULE DUPLICATION ASSUMEE : `feeStatus`, cinq lignes d'arithmetique, portee
-- ici en `fin_statut_dossier`. Les deux doivent rester d'accord.
--
-- Ce que la RPC N'AJOUTE PAS, et il faut le dire : un appelant pourrait passer
-- un faux `subtotal`. Mais il ecrit deja `total_due` en direct aujourd'hui, et
-- la RLS du 29 septembre accorde l'ecriture a ces roles — ce n'est donc pas
-- pire. L'apport est l'ATOMICITE, pas une autorite nouvelle.
--
-- ── BENEFICE SECOND ────────────────────────────────────────────────────────
--
-- La RPC recevant le subtotal, elle le REECRIT a chaque passage. La ligne reste
-- donc coherente jusqu'a la bascule d'annee — ce qui compte, car des le
-- changement d'annee `total_due` cesse d'etre un cache et devient la SOURCE DE
-- VERITE des « dettes vives » (`reglements/page.tsx`, qui ne charge plus les
-- inscriptions des annees passees).
--
-- RESTE OUVERT (point E, non traite ici) : si les inscriptions d'un foyer
-- changent et qu'aucun paiement ni ajustement ne suit, rien ne rafraichit
-- `total_due`, et la valeur perimee part telle quelle en dette vive. La reponse
-- propre est un audit de « Passage d'annee » qui compare le stocke au recalcul.
--
-- ── SECURITY INVOKER, DELIBERE ─────────────────────────────────────────────
--
-- Comme `import_foyer`. La RLS posee le 29 septembre (lot 1 : lecture ET
-- ecriture reservees a admin/direction/comptable) s'applique donc, et les
-- declencheurs d'audit des trois tables captent `auth.uid()`. Une fonction
-- DEFINER ecrirait quatre lignes d'argent sans que le journal dise QUI.
--
-- Migration idempotente (`CREATE OR REPLACE`), rejouable sans effet.
-- ============================================================================

-- ── 1. Le statut d'un dossier, miroir de `feeStatus` ────────────────────────
--
-- L'ORDRE DES BRANCHES EST SIGNIFIANT et recopie celui de compute.ts :
--   paid > due && due > 0  -> overpaid
--   due <= 0               -> paid
--   paid >= due            -> paid
--   paid > 0               -> partial
--   sinon                  -> pending
-- Intervertir « due <= 0 » et « paid >= due » changerait le cas d'un dossier a
-- zero euro non paye.

CREATE OR REPLACE FUNCTION public.fin_statut_dossier(p_paid numeric, p_due numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_temp
AS $fn$
  SELECT CASE
    WHEN p_paid > p_due AND p_due > 0 THEN 'overpaid'
    WHEN p_due  <= 0                  THEN 'paid'
    WHEN p_paid >= p_due              THEN 'paid'
    WHEN p_paid >  0                  THEN 'partial'
    ELSE 'pending'
  END
$fn$;


-- ── 2. Garde commune ────────────────────────────────────────────────────────
--
-- La RLS suffirait a BLOQUER, mais elle bloque en silence : un refus ne leve
-- rien, il touche zero ligne. Cette garde donne un motif lisible — c'est tout
-- l'objet du chantier du 1er octobre.
--
-- `coalesce(get_user_role(), '')` : un role NULL (anonyme) passerait un
-- `NOT IN` sans cette precaution (regle du 7 juillet, `NULL NOT IN (...)` vaut
-- NULL, donc jamais vrai).

CREATE OR REPLACE FUNCTION public.fin_garde_dossier(p_fee_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF coalesce(get_user_role(), '') NOT IN ('admin', 'direction', 'comptable') THEN
    RAISE EXCEPTION 'Votre role ne permet pas de modifier les reglements.'
      USING ERRCODE = '42501';
  END IF;

  -- Le SELECT subit la RLS : un dossier d'un autre etablissement est invisible,
  -- donc introuvable. Le cloisonnement n'a pas a etre re-ecrit ici.
  PERFORM 1 FROM family_fees WHERE id = p_fee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dossier introuvable ou hors de votre etablissement.'
      USING ERRCODE = '23001';
  END IF;
END;
$fn$;


-- ── 3. Le recapitulatif, recalcule depuis les lignes ────────────────────────
--
-- UN SEUL ENDROIT pour les quatre operations : recopier ce bloc quatre fois,
-- c'est reproduire le defaut que cette migration repare.
--
-- `jsonb_populate_record(null::family_fees, ...)` sert a COERCER `status` vers
-- le type reel de la colonne (texte avec CHECK, ou type enumere — le depot n'a
-- plus de `schema.sql` depuis le 5 aout, on ne le suppose donc pas).

CREATE OR REPLACE FUNCTION public.fin_recalculer_dossier(p_fee_id uuid, p_subtotal numeric)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_adj    numeric;
  v_paid   numeric;
  v_due    numeric;
  v_statut text;
BEGIN
  SELECT coalesce(sum(amount), 0)      INTO v_adj  FROM fee_adjustments  WHERE family_fee_id = p_fee_id;
  SELECT coalesce(sum(amount_paid), 0) INTO v_paid FROM fee_installments WHERE family_fee_id = p_fee_id;

  -- REGLE COMPTABLE (compute.ts) : les ajustements sont NEGATIFS et reduisent
  -- ce que la famille DOIT, jamais ce qu'elle a paye.
  v_due    := p_subtotal + v_adj;
  v_statut := fin_statut_dossier(v_paid, v_due);

  UPDATE family_fees f
     SET subtotal          = p_subtotal,
         adjustments_total = v_adj,
         total_due         = v_due,
         status            = r.status
    FROM jsonb_populate_record(null::family_fees, jsonb_build_object('status', v_statut)) r
   WHERE f.id = p_fee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Le recapitulatif du dossier n''a pas pu etre mis a jour.'
      USING ERRCODE = '23001';
  END IF;

  RETURN jsonb_build_object(
    'subtotal',          p_subtotal,
    'adjustments_total', v_adj,
    'total_due',         v_due,
    'total_paid',        v_paid,
    'status',            v_statut
  );
END;
$fn$;


-- ── 4. Paiement : enregistrer (creation OU modification) ────────────────────
--
-- Le paiement arrive en `jsonb` et non en dix parametres : c'est
-- `jsonb_populate_record` qui le type d'apres la table elle-meme, y compris
-- `payment_method` et `payment_reference`. On n'a donc pas a connaitre le type
-- exact de chaque colonne — et une colonne ajoutee demain n'oblige pas a
-- changer la signature.

CREATE OR REPLACE FUNCTION public.fin_enregistrer_paiement(
  p_fee_id     uuid,
  p_subtotal   numeric,
  p_paiement   jsonb,
  p_payment_id uuid DEFAULT NULL   -- NULL = creation
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_row fee_installments;
BEGIN
  PERFORM fin_garde_dossier(p_fee_id);

  IF p_payment_id IS NULL THEN
    INSERT INTO fee_installments (
      family_fee_id, installment_number, due_date, amount_due, amount_paid,
      paid_date, payment_method, payment_reference, receipt_number, status, notes
    )
    SELECT p_fee_id, r.installment_number, r.due_date, r.amount_due, r.amount_paid,
           r.paid_date, r.payment_method, r.payment_reference, r.receipt_number,
           r.status, r.notes
      FROM jsonb_populate_record(null::fee_installments, p_paiement) r
    RETURNING * INTO v_row;
  ELSE
    UPDATE fee_installments f
       SET amount_due        = r.amount_due,
           amount_paid       = r.amount_paid,
           due_date          = r.due_date,
           paid_date         = r.paid_date,
           payment_method    = r.payment_method,
           payment_reference = r.payment_reference,
           receipt_number    = r.receipt_number,
           notes             = r.notes
      FROM jsonb_populate_record(null::fee_installments, p_paiement) r
     WHERE f.id = p_payment_id
       AND f.family_fee_id = p_fee_id   -- on ne deplace pas un paiement de dossier
    RETURNING f.* INTO v_row;

    IF v_row.id IS NULL THEN
      RAISE EXCEPTION 'Paiement introuvable dans ce dossier, ou droits insuffisants.'
        USING ERRCODE = '23001';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'paiement', to_jsonb(v_row),
    'recap',    fin_recalculer_dossier(p_fee_id, p_subtotal)
  );
END;
$fn$;


-- ── 5. Paiement : supprimer ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fin_supprimer_paiement(
  p_payment_id uuid,
  p_subtotal   numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_fee_id uuid;
BEGIN
  -- Le dossier se deduit du paiement : un appelant ne choisit pas le dossier
  -- qu'il recalcule. Le SELECT subit la RLS.
  SELECT family_fee_id INTO v_fee_id FROM fee_installments WHERE id = p_payment_id;
  IF v_fee_id IS NULL THEN
    RAISE EXCEPTION 'Paiement introuvable ou hors de votre etablissement.'
      USING ERRCODE = '23001';
  END IF;

  PERFORM fin_garde_dossier(v_fee_id);

  DELETE FROM fee_installments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ce paiement n''a pas pu etre supprime.'
      USING ERRCODE = '23001';
  END IF;

  RETURN jsonb_build_object('recap', fin_recalculer_dossier(v_fee_id, p_subtotal));
END;
$fn$;


-- ── 6. Reduction / avoir / remboursement : ajouter ──────────────────────────

CREATE OR REPLACE FUNCTION public.fin_ajouter_reduction(
  p_fee_id    uuid,
  p_subtotal  numeric,
  p_reduction jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_row fee_adjustments;
BEGIN
  PERFORM fin_garde_dossier(p_fee_id);

  INSERT INTO fee_adjustments (family_fee_id, adjustment_date, adjustment_type, label, amount)
  SELECT p_fee_id, r.adjustment_date, r.adjustment_type, r.label, r.amount
    FROM jsonb_populate_record(null::fee_adjustments, p_reduction) r
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'reduction', to_jsonb(v_row),
    'recap',     fin_recalculer_dossier(p_fee_id, p_subtotal)
  );
END;
$fn$;


-- ── 7. Reduction : supprimer ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fin_supprimer_reduction(
  p_adjustment_id uuid,
  p_subtotal      numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_fee_id uuid;
BEGIN
  SELECT family_fee_id INTO v_fee_id FROM fee_adjustments WHERE id = p_adjustment_id;
  IF v_fee_id IS NULL THEN
    RAISE EXCEPTION 'Reduction introuvable ou hors de votre etablissement.'
      USING ERRCODE = '23001';
  END IF;

  PERFORM fin_garde_dossier(v_fee_id);

  DELETE FROM fee_adjustments WHERE id = p_adjustment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cette reduction n''a pas pu etre supprimee.'
      USING ERRCODE = '23001';
  END IF;

  RETURN jsonb_build_object('recap', fin_recalculer_dossier(v_fee_id, p_subtotal));
END;
$fn$;


-- ── 8. Droits d'execution ───────────────────────────────────────────────────
--
-- REGLE DU 3 OCTOBRE : un `REVOKE ... FROM public` ne suffit pas. Supabase pose
-- un `ALTER DEFAULT PRIVILEGES` qui accorde EXECUTE NOMMEMENT a `anon`, et un
-- revoke sur le pseudo-role `public` ne retire pas une concession nominative.
-- On revoque donc `anon` explicitement, et on verifie plus bas.

DO $perm$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'fin_statut_dossier(numeric, numeric)',
    'fin_garde_dossier(uuid)',
    'fin_recalculer_dossier(uuid, numeric)',
    'fin_enregistrer_paiement(uuid, numeric, jsonb, uuid)',
    'fin_supprimer_paiement(uuid, numeric)',
    'fin_ajouter_reduction(uuid, numeric, jsonb)',
    'fin_supprimer_reduction(uuid, numeric)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END;
$perm$;


-- ── 9. Verification — la migration LEVE si elle n'a pas abouti ──────────────

DO $verif$
DECLARE
  v_manquantes text;
  v_anon       text;
  v_definer    text;
BEGIN
  -- (a) les 7 fonctions existent
  SELECT string_agg(n, ', ') INTO v_manquantes
    FROM unnest(ARRAY['fin_statut_dossier', 'fin_garde_dossier', 'fin_recalculer_dossier',
                      'fin_enregistrer_paiement', 'fin_supprimer_paiement',
                      'fin_ajouter_reduction', 'fin_supprimer_reduction']) AS n
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
      WHERE ns.nspname = 'public' AND p.proname = n
   );
  IF v_manquantes IS NOT NULL THEN
    RAISE EXCEPTION 'Fonctions manquantes : %', v_manquantes;
  END IF;

  -- (b) aucune n'est SECURITY DEFINER (l'audit doit capter l'acteur)
  SELECT string_agg(p.proname, ', ') INTO v_definer
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname LIKE 'fin\_%' AND p.prosecdef;
  IF v_definer IS NOT NULL THEN
    RAISE EXCEPTION 'Ces fonctions sont SECURITY DEFINER alors qu''elles doivent subir la RLS : %', v_definer;
  END IF;

  -- (c) anon ne peut executer aucune d'elles
  SELECT string_agg(routine_name, ', ') INTO v_anon
    FROM information_schema.routine_privileges
   WHERE routine_schema = 'public' AND grantee = 'anon' AND routine_name LIKE 'fin\_%';
  IF v_anon IS NOT NULL THEN
    RAISE EXCEPTION 'anon peut encore executer : %', v_anon;
  END IF;

  -- (d) le statut porte les memes verdicts que compute.ts, sur ses cinq cas
  IF fin_statut_dossier(150, 100) <> 'overpaid' THEN RAISE EXCEPTION 'statut : trop percu'; END IF;
  IF fin_statut_dossier(0,     0) <> 'paid'     THEN RAISE EXCEPTION 'statut : du nul'; END IF;
  IF fin_statut_dossier(100, 100) <> 'paid'     THEN RAISE EXCEPTION 'statut : solde'; END IF;
  IF fin_statut_dossier(40,  100) <> 'partial'  THEN RAISE EXCEPTION 'statut : partiel'; END IF;
  IF fin_statut_dossier(0,   100) <> 'pending'  THEN RAISE EXCEPTION 'statut : en attente'; END IF;
  -- Un du NEGATIF (remboursement superieur aux cotisations) : « paid », et non
  -- « overpaid » — c'est la branche `due <= 0`, placee AVANT `paid >= due`.
  IF fin_statut_dossier(0,  -20) <> 'paid'      THEN RAISE EXCEPTION 'statut : du negatif'; END IF;

  RAISE NOTICE 'OK — 7 fonctions, aucune DEFINER, anon revoque, statut conforme sur 6 cas.';
END;
$verif$;

-- Registre des migrations (voir supabase/migrations/README.md).
SELECT enregistrer_migration('add-financement-rpc-atomiques.sql', '42146da1679c5094516bd5633ad70dada1f184f3362098fd8154c3b8b25b6ab6');
