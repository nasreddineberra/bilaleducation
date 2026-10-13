-- ============================================================================
-- JOURNAL D'ACTIVITE : l'identifiant de la ligne se lit par `to_jsonb`
--
-- `fn_audit_log()` est montee sur 38 tables et lisait `NEW.id` / `OLD.id` par
-- leur nom. `evaluation_order_config` n'a pas de colonne `id` (sa cle est le
-- couple classe + periode) : TOUTE ecriture y echouait en 42703. Consequence :
-- l'ordre des UE et des modules choisi par l'enseignant dans les Gabarits ne
-- s'est JAMAIS enregistre (table vide en base au 13/10), et « Enregistrer le
-- gabarit » affichait une erreur a chaque clic.
--
-- Regle deja posee le 7 aout (`OLD.role`) : dans un declencheur GENERIQUE, ne
-- jamais citer une colonne par son nom. `to_jsonb(...)->>'id'` rend NULL sur une
-- table sans `id` ; `audit_logs.entity_id` l'accepte.
--
-- On RAPIECE la definition reelle : elle porte la garde d'effacement ajoutee le
-- 13/10, qu'une recopie ecraserait. Leve si un ancrage manque. Rejouable.
-- ============================================================================
DO $do$
DECLARE
  v_def text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'fn_audit_log';
  IF v_def IS NULL THEN RAISE EXCEPTION 'fn_audit_log introuvable.'; END IF;

  IF position('NEW.id' IN v_def) = 0 AND position('OLD.id' IN v_def) = 0 THEN
    RAISE NOTICE 'fn_audit_log deja corrigee : rien a faire.';
    RETURN;
  END IF;

  IF (length(v_def) - length(replace(v_def, 'v_entity_id := NEW.id;', ''))) / length('v_entity_id := NEW.id;') <> 2
     OR position('v_entity_id := OLD.id;' IN v_def) = 0 THEN
    RAISE EXCEPTION 'fn_audit_log : ancrages inattendus, rien n''a ete modifie.';
  END IF;

  v_new := replace(v_def, 'v_entity_id := NEW.id;', 'v_entity_id := (to_jsonb(NEW) ->> ''id'')::uuid;');
  v_new := replace(v_new, 'v_entity_id := OLD.id;', 'v_entity_id := (to_jsonb(OLD) ->> ''id'')::uuid;');
  EXECUTE v_new;
END
$do$;

-- Verification : plus aucune lecture d'un champ par son nom, garde d'effacement intacte.
DO $verif$
DECLARE
  v_src text;
BEGIN
  SELECT prosrc INTO v_src FROM pg_proc
   WHERE pronamespace = 'public'::regnamespace AND proname = 'fn_audit_log';
  IF v_src ~ '(NEW|OLD)\.[a-z_]+' THEN
    RAISE EXCEPTION 'Verification : fn_audit_log lit encore un champ par son nom.';
  END IF;
  IF position('fn_effacement_en_cours' IN v_src) = 0 THEN
    RAISE EXCEPTION 'Verification : la garde d''effacement a disparu de fn_audit_log.';
  END IF;
END
$verif$;

-- Registre des migrations (voir supabase/migrations/README.md).
SELECT enregistrer_migration('fix-audit-log-entity-id.sql', 'edb915df0ea04a0b1bb928be7fbdaa304f5a4174103aab55e44b522f299a40d7');
