-- ============================================================================
-- URGENT — `fn_audit_log()` cassait TOUTE écriture hors `profiles`
--
-- CAUSE. La garde ajoutée la veille (`fix-audit-log-description.sql`), qui évite
-- d'auditer le rattachement de support, était écrite ainsi :
--
--   IF TG_TABLE_NAME = 'profiles' AND TG_OP = 'UPDATE'
--      AND OLD.role = 'super_admin' AND ...
--
-- Le raisonnement paraissait sûr : la première condition écarte les autres
-- tables avant qu'on ne touche à `OLD.role`. Il est FAUX. PL/pgSQL ne teste pas
-- les conditions l'une après l'autre : il compile **l'expression entière** en une
-- seule requête SQL et lui passe `OLD` en paramètre. Tous les champs cités
-- doivent donc exister, quelle que soit la table — le court-circuit du `AND`
-- n'intervient qu'à l'exécution, bien après la résolution des noms.
--
-- PORTÉE. **37 des 38 tables auditées n'ont pas de colonne `role`.** Chaque
-- écriture y échouait en 42703 « record "old" has no field "role" » : élèves,
-- classes, notes, absences, paiements, emploi du temps, établissements. Toute
-- l'application, pendant une soirée.
--
-- CORRECTIF. Lire le rôle par `to_jsonb(OLD)->>'role'`, qui vaut NULL sur une
-- table qui n'a pas cette colonne au lieu de lever. C'est déjà la forme employée
-- plus bas dans cette même fonction pour `etablissement_id` — la garde aurait dû
-- la suivre.
--
-- LEÇON. Dans un déclencheur GÉNÉRIQUE, monté sur des dizaines de tables, on ne
-- cite jamais une colonne par son nom : on passe par `to_jsonb`. Et une garde
-- pareille se vérifie sur une table QUI N'A PAS la colonne — la veille, je ne
-- l'avais éprouvée que sur `profiles`, la seule où elle ne pouvait pas échouer.
--
-- Idempotent.
-- ============================================================================

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
  --
  -- Les champs sont lus par `to_jsonb` et JAMAIS par leur nom : cette fonction
  -- est montée sur 38 tables, dont 37 n'ont pas de colonne `role`.
  IF TG_TABLE_NAME = 'profiles' AND TG_OP = 'UPDATE'
     AND to_jsonb(OLD)->>'role' = 'super_admin'
     AND to_jsonb(OLD)->>'etablissement_id' IS DISTINCT FROM to_jsonb(NEW)->>'etablissement_id'
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

  -- Aucun établissement identifiable : on renonce à la TRACE, jamais à
  -- l'ÉCRITURE. L'insertion échouait en 23502 et faisait échouer l'opération
  -- observée — un journal qui empêche ce qu'il devrait décrire.
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
