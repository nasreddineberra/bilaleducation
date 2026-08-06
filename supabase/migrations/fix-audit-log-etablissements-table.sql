-- ============================================================================
-- L'audit empêchait de créer et de modifier un établissement
--
-- CONSTAT (6 août 2026, découvert en renommant un slug) : toute écriture sur
-- `etablissements` échoue en 23502 —
--   « null value in column "etablissement_id" of relation "audit_logs" ».
--
-- Le parcours d'accueil d'un client était donc INOPÉRANT : ni création, ni
-- modification d'une école depuis l'espace super-admin.
--
-- CAUSE. `fn_audit_log()` détermine l'établissement en deux temps :
--   1. le profil de `auth.uid()` ;
--   2. à défaut, la colonne `etablissement_id` de la ligne écrite.
--
-- Or l'espace super-admin travaille en **service-role** — il doit contourner la
-- RLS, le super_admin ayant `etablissement_id` NULL — donc `auth.uid()` est nul
-- et le premier temps ne donne rien. Et `etablissements` **n'a pas** de colonne
-- `etablissement_id` : elle EST l'établissement, sa clé s'appelle `id`. Le
-- second temps échoue donc aussi, et `audit_logs.etablissement_id` est NOT NULL.
--
-- CORRECTIF. Un troisième repli : quand la table auditée est `etablissements`,
-- l'établissement concerné est la ligne elle-même.
--
-- CE QUE CE CORRECTIF NE TRAITE PAS. Sept autres tables auditées n'ont pas non
-- plus de colonne `etablissement_id` : `announcement_attachments`, `cours`,
-- `cours_modules`, `enrollments`, `evaluation_order_config`, `grades`,
-- `student_warning_attachments`. Elles échoueraient dans les mêmes conditions —
-- mais l'application ne les écrit qu'avec le client SESSION, où `auth.uid()`
-- répond et où le premier temps suffit. On ne leur invente pas de repli : il
-- faudrait une jointure par table, et un rattachement deviné vaut moins qu'une
-- erreur franche. **À garder en tête avant tout script service-role sur elles.**
--
-- Idempotent : `CREATE OR REPLACE`.
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
  v_user_id := auth.uid();

  -- Snapshot infos utilisateur
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
    v_etab_id   := COALESCE(v_etab_id, (to_jsonb(NEW)->>'etablissement_id')::uuid);
  ELSIF TG_OP = 'DELETE' THEN
    v_action    := 'DELETE';
    v_entity_id := OLD.id;
    v_old       := to_jsonb(OLD);
    v_new       := NULL;
    v_etab_id   := COALESCE(v_etab_id, (to_jsonb(OLD)->>'etablissement_id')::uuid);
  END IF;

  -- Troisième repli : sur la table `etablissements`, l'établissement concerné
  -- est la ligne elle-même. C'est le seul cas où le rattachement est CERTAIN
  -- plutôt que deviné.
  IF v_etab_id IS NULL AND TG_TABLE_NAME = 'etablissements' THEN
    v_etab_id := v_entity_id;
  END IF;

  -- Supprimer un ETABLISSEMENT ne s'audite pas : `audit_logs.etablissement_id`
  -- est en ON DELETE CASCADE, la trace serait donc detruite dans la seconde par
  -- la suppression qu'elle pretend consigner. Pire, elle FAISAIT ECHOUER la
  -- suppression (violation de cle etrangere), ce qui cassait les chemins de
  -- rattrapage de `createTenant` : quand la creation du compte directeur
  -- echouait, le nettoyage de l'etablissement echouait a son tour et laissait
  -- une ecole orpheline.
  --
  -- Consequence assumee : la suppression d'une ecole n'a pas de trace. Elle en
  -- demanderait une AILLEURS — un journal d'editeur, hors du perimetre d'un
  -- audit cloisonne par etablissement. A traiter le jour ou ca comptera.
  IF NOT (TG_OP = 'DELETE' AND TG_TABLE_NAME = 'etablissements') THEN
    INSERT INTO audit_logs (etablissement_id, user_id, user_email, user_name, entity_type, entity_id, action, old_data, new_data)
    VALUES (v_etab_id, v_user_id, v_email, v_name, TG_TABLE_NAME, v_entity_id, v_action, v_old, v_new);
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

-- ── Vérification ────────────────────────────────────────────────────────────
-- Doit se dérouler sans erreur et ne rien laisser :
--
--   BEGIN;
--   INSERT INTO etablissements (nom, slug) VALUES ('TEST', 'test-xyz');
--   UPDATE etablissements SET nom = 'TEST 2' WHERE slug = 'test-xyz';
--   DELETE FROM etablissements WHERE slug = 'test-xyz';
--   ROLLBACK;
