-- ============================================================================
-- Journal d'activité : la colonne `description` manquait
--
-- CONSTAT. `src/lib/audit.ts` (`logAudit`) insère une `description` à chaque
-- appel — la phrase lisible qui explique ce qui s'est passé. La colonne n'a
-- jamais existé : l'insertion était donc rejetée, et l'erreur avalée par le
-- `try/catch` qui rend la trace « non bloquante ». Les **32 appels** répartis
-- dans 12 fichiers n'ont JAMAIS rien écrit : relances de paiement, attestations,
-- réinitialisations 2FA, purges du journal, envois de lien de mot de passe,
-- suppressions de compte, ouverture d'intervention de support. Seules les lignes
-- brutes des déclencheurs subsistaient.
--
-- L'interface lisait déjà `log.description` en priorité (`AuditLogsClient`) :
-- c'est la base qui n'a jamais suivi. Une colonne répare les 32 appels d'un
-- coup, sans toucher au code.
--
-- Idempotent.
-- ============================================================================

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN audit_logs.description IS
  'Phrase lisible décrivant l''action, écrite par l''application (`logAudit`). '
  'Nulle sur les lignes produites par le déclencheur `fn_audit_log`, qui ne '
  'connaît que la table et les colonnes modifiées.';

-- ── Le rattachement de support ne s'écrit plus deux fois ────────────────────
--
-- Entrer dans une école ou en sortir modifie UNE colonne du profil de l'éditeur,
-- `etablissement_id`. Le déclencheur en faisait une ligne « Modification ·
-- Utilisateurs · NOM Prénom » SANS ACTEUR — l'écriture se fait obligatoirement
-- en service-role, donc sans `auth.uid()`. Elle se lisait comme la modification
-- d'un compte par un inconnu, alors que rien de tel n'avait eu lieu.
--
-- L'application écrit désormais, au même moment, une ligne explicite portant la
-- phrase ET l'acteur (« Ouverture d'une intervention de support sur X »). Garder
-- les deux, c'est doubler chaque intervention d'une ligne muette et trompeuse.
--
-- La condition est STRICTE et ne vaut que pour ce cas : compte `super_admin`,
-- et seul le rattachement change. Toute autre modification d'un profil de
-- super-admin — son rôle, son état, son identité — reste tracée.
CREATE OR REPLACE FUNCTION public.fn_audit_log()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $function$
DECLARE
  v_action    text;
  v_entity_id uuid;
  v_old       jsonb;
  v_new       jsonb;
  v_user_id   uuid;
  v_email     text;
  v_name      text;
  v_etab_id   uuid;
BEGIN
  -- Rattachement / détachement de support : l'application écrit la trace
  -- lisible, celle-ci ferait double emploi sans rien apprendre.
  IF TG_TABLE_NAME = 'profiles' AND TG_OP = 'UPDATE'
     AND OLD.role = 'super_admin'
     AND OLD.etablissement_id IS DISTINCT FROM NEW.etablissement_id
     AND to_jsonb(OLD) - 'etablissement_id' - 'updated_at'
       = to_jsonb(NEW) - 'etablissement_id' - 'updated_at'
  THEN
    RETURN NEW;
  END IF;

  v_user_id := auth.uid();

  SELECT email, last_name || ' ' || first_name, etablissement_id
    INTO v_email, v_name, v_etab_id
    FROM profiles WHERE id = v_user_id;

  IF TG_OP = 'INSERT' THEN
    v_action    := 'INSERT';
    v_entity_id := NEW.id;
    v_old       := NULL;
    v_new       := to_jsonb(NEW);
    v_etab_id   := COALESCE(v_etab_id, (to_jsonb(NEW)->>'etablissement_id')::uuid);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action    := 'UPDATE';
    v_entity_id := NEW.id;
    v_old       := to_jsonb(OLD);
    v_new       := to_jsonb(NEW);
    -- Repli sur l'ANCIENNE valeur : indispensable pour qu'une mise à jour qui
    -- vide `etablissement_id` reste possible.
    v_etab_id   := COALESCE(v_etab_id,
                            (to_jsonb(NEW)->>'etablissement_id')::uuid,
                            (to_jsonb(OLD)->>'etablissement_id')::uuid);
  ELSIF TG_OP = 'DELETE' THEN
    v_action    := 'DELETE';
    v_entity_id := OLD.id;
    v_old       := to_jsonb(OLD);
    v_new       := NULL;
    v_etab_id   := COALESCE(v_etab_id, (to_jsonb(OLD)->>'etablissement_id')::uuid);
  END IF;

  -- Sur la table `etablissements`, l'établissement concerné est la ligne
  -- elle-même : c'est le seul cas où le rattachement est certain, pas deviné.
  IF v_etab_id IS NULL AND TG_TABLE_NAME = 'etablissements' THEN
    v_etab_id := v_entity_id;
  END IF;

  -- ── Aucun établissement identifiable : on renonce à la TRACE, jamais à
  -- l'ÉCRITURE ────────────────────────────────────────────────────────────────
  --
  -- `audit_logs.etablissement_id` est NOT NULL et le journal est propre à une
  -- école : une action qui ne relève d'aucune n'a nulle part où être consignée.
  -- Jusqu'ici l'insertion échouait en 23502 et **faisait échouer l'opération
  -- observée** — un journal qui empêche ce qu'il devrait décrire.
  --
  -- Le cas se produit dès que l'acteur n'a pas d'établissement : le super-admin
  -- HORS intervention ne pouvait donc ni corriger son nom, ni changer de thème,
  -- ni régler son propre compte. Il touchait aussi le prochain script en
  -- service-role écrivant dans une table sans colonne `etablissement_id`.
  --
  -- Une trace ne vaut pas de casser l'écriture qu'elle accompagne.
  IF v_etab_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- Supprimer un établissement ne s'audite pas : la clé est en ON DELETE
  -- CASCADE, la trace serait détruite par la suppression qu'elle consigne — et
  -- elle FAISAIT ÉCHOUER cette suppression, cassant les rattrapages de
  -- `createTenant`.
  IF NOT (TG_OP = 'DELETE' AND TG_TABLE_NAME = 'etablissements') THEN
    INSERT INTO audit_logs (etablissement_id, user_id, user_email, user_name, entity_type, entity_id, action, old_data, new_data)
    VALUES (v_etab_id, v_user_id, v_email, v_name, TG_TABLE_NAME, v_entity_id, v_action, v_old, v_new);
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;
