-- ============================================================================
-- BILAL EDUCATION — Parametres financiers : role sur `cotisation_types`,
--                   ecriture des taux ouverte au COMPTABLE
-- ----------------------------------------------------------------------------
-- Trouve le 24 septembre 2026, en ouvrant l'acces du comptable aux parametres
-- financiers (decision utilisateur : c'est lui qui tient les cotisations et les
-- taux a jour, et c'est lui que l'application alerte quand un taux manque).
--
-- ── 1. `cotisation_types` : AUCUN CONTROLE DE ROLE ─────────────────────────
--
-- La table n'avait qu'UNE policy, et elle etait ecrite ainsi :
--
--     CREATE POLICY "cotisation_types_tenant" ON cotisation_types
--       USING (etablissement_id = current_etablissement_id());
--
-- Sans clause `FOR`, donc sur les QUATRE commandes, et sans le moindre role :
-- **tout compte authentifie de l'ecole pouvait creer, modifier et SUPPRIMER
-- les types de cotisation** — un enseignant pouvait changer les tarifs de
-- toutes les familles, ou les effacer. C'est la table qui porte la facturation.
--
-- Defaut identique a celui des huit tables centrales reprises le 5 aout : le
-- cloisonnement a REMPLACE le controle de role au lieu de s'y ajouter. Les
-- gardes de l'application ne protegent rien ici — l'ecran Parametres Financiers
-- ecrit DIRECTEMENT depuis le navigateur, la limite se contourne par un appel a
-- l'API REST.
--
-- NB METHODE : le balayage qui a trouve `school_years` le meme jour n'a PAS pu
-- voir celui-ci. Il signale les tables ou un role voit ZERO ligne — il detecte
-- le trop strict, il est aveugle au trop permissif par construction
-- (`cotisation_types` affichait 9 lignes pour tout le monde). Les deux defauts
-- sont symetriques et demandent deux mesures differentes.
--
-- Perimetre d'ECRITURE retenu : admin, direction, comptable. Verifie avant
-- d'ecrire — les deux seuls ecrivains sont l'ecran Parametres Financiers
-- (`CotisationsClient`) et la duplication des cotisations a la creation d'une
-- annee (`annee-scolaire/actions.ts`), tous deux dans ce perimetre.
-- Perimetre de LECTURE : tout le personnel — NEUF fichiers la lisent (fiche
-- classe, affectations, financements, bulletins, tableaux de bord, et la
-- resolution `is_adult` des communications). La fermer serait rejouer le defaut
-- du jour a l'envers. `parent` exclu, comme partout depuis le 5 aout.
--
-- ── 2. `presence_type_rates` : ecriture ouverte au comptable ────────────────
--
-- Sa forme etait deja correcte (tenant + role, select/write separes) ; seul le
-- perimetre d'ecriture restait admin/direction. Le comptable lisait les taux
-- sans pouvoir les poser, alors que la banniere « sans taux » de la Situation
-- financiere l'invite precisement a le faire. On ne signale pas un manque a qui
-- n'a pas la main pour le combler.
--
-- L'enseignant garde la LECTURE (decision du 14 juillet : il voit ses propres
-- couts) et n'obtient aucune ecriture.
--
-- Idempotent.
-- ============================================================================

-- ── cotisation_types ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "cotisation_types_tenant" ON public.cotisation_types;
DROP POLICY IF EXISTS cotisation_types_select   ON public.cotisation_types;
DROP POLICY IF EXISTS cotisation_types_write    ON public.cotisation_types;

CREATE POLICY cotisation_types_select ON public.cotisation_types FOR SELECT
  USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable',
                                                   'responsable_pedagogique','secretaire','enseignant'])
  );

CREATE POLICY cotisation_types_write ON public.cotisation_types FOR ALL
  USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable'])
  )
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable'])
  );

-- ── presence_type_rates : le comptable pose les taux ────────────────────────

DROP POLICY IF EXISTS presence_type_rates_write ON public.presence_type_rates;

CREATE POLICY presence_type_rates_write ON public.presence_type_rates FOR ALL
  USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable'])
  )
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable'])
  );

SELECT 'Parametres financiers : cotisation_types gagne un controle de role, le comptable pose les taux.' AS status;
