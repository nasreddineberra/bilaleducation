-- ============================================================================
-- Accès support de l'éditeur : le super-admin peut intervenir dans une école
--
-- MODÈLE. Le super-admin n'appartient à aucune école (`etablissement_id` NULL)
-- et ne voit donc rien : la RLS ne lui accorde aucune ligne. Pour dépanner un
-- client, il se RATTACHE temporairement à son école — une seule colonne change.
--
-- POURQUOI CETTE VOIE. Deux autres ont été écartées :
--   * changer son RÔLE le temps de l'intervention : une session interrompue
--     — onglet fermé, ordinateur éteint — le laisserait bloqué en `admin` d'une
--     école, sans plus aucun accès à sa console pour se rattraper. Un mécanisme
--     de support ne doit jamais enfermer celui qui l'utilise ;
--   * ajouter `super_admin` aux 155 politiques : beaucoup de surface modifiée,
--     et un risque de faute de frappe dans ce qu'il y a de plus sensible.
--
-- CE QUE FAIT CETTE MIGRATION. `get_user_role()` répond `admin` quand l'appelant
-- est super-admin ET rattaché à une école. Une seule fonction change, aucune
-- politique n'est touchée.
--
-- L'INTERRUPTEUR est le rattachement, pas le rôle : hors intervention,
-- `current_etablissement_id()` vaut NULL et aucune ligne ne correspond nulle part.
--
-- CE QUI RESTE VRAI. Le rôle en base ne change JAMAIS. Les gardes de
-- l'application — `requireRoleServer`, le layout de la console — lisent la
-- COLONNE `profiles.role` et voient donc toujours `super_admin` : la console
-- reste accessible pendant l'intervention, et c'est elle qui permet d'en sortir
-- quoi qu'il arrive. Le journal, lui, enregistre `auth.uid()` : les actions
-- restent attribuées à l'éditeur, jamais à un employé de l'école.
--
-- Idempotent.
-- ============================================================================

-- ── 1. Le rôle vu par les POLITIQUES ────────────────────────────────────────
--
-- Cette fonction n'est pas un accesseur au profil et ne l'a jamais été : c'est
-- un utilitaire de RLS. Elle répond « quel rôle les politiques doivent-elles
-- voir », ce qui n'est pas toujours le rôle inscrit dans la table.
CREATE OR REPLACE FUNCTION public.get_user_role()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $function$
  SELECT CASE
    WHEN p.role = 'super_admin' AND p.etablissement_id IS NOT NULL THEN 'admin'
    ELSE p.role
  END
  FROM profiles p
  WHERE p.id = auth.uid()
$function$;

-- ── 2. Le journal doit survivre au DÉTACHEMENT ──────────────────────────────
--
-- Quitter une école remet `profiles.etablissement_id` à NULL. Le déclencheur
-- d'audit cherche alors l'établissement dans le profil de `auth.uid()` — nul,
-- l'action se faisant en service-role — puis dans `NEW.etablissement_id`, nul
-- lui aussi. L'insertion échouerait en 23502 et **le détachement serait
-- impossible** : l'éditeur resterait enfermé dans l'école qu'il vient de quitter.
--
-- On ajoute donc un repli sur la valeur ANCIENNE : sur une mise à jour qui vide
-- le rattachement, l'établissement concerné est celui qu'on quitte. Il ne joue
-- que lorsque la nouvelle valeur est nulle, et vaut pour toute table, pas
-- seulement `profiles`.
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

-- ── Vérification ────────────────────────────────────────────────────────────
--   -- Hors intervention : le rôle réel est renvoyé.
--   -- Pendant : `admin`. Le rattachement se pose et se retire sans erreur.
--
--   BEGIN;
--   UPDATE profiles SET etablissement_id = (SELECT id FROM etablissements LIMIT 1)
--     WHERE role = 'super_admin';
--   UPDATE profiles SET etablissement_id = NULL WHERE role = 'super_admin';
--   ROLLBACK;
