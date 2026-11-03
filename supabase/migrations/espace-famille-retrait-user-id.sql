-- ============================================================================
-- Espace famille, lot 1 : retrait de `parents.user_id` (03/11)
--
-- Colonne jamais remplie (0 ligne au 03/11) : les comptes des tuteurs
-- s'ecrivent en `tutor1_user_id` / `tutor2_user_id`. Les regles d'acces et le
-- code la lisaient pourtant, d'ou un foyer introuvable pour tout parent.
-- Depuis `espace-famille-fondations.sql` les regles passent par
-- `foyer_du_compte()`, et le code par `lib/parents/foyer.ts`.
--
-- RESTRICTIVE : a jouer APRES le deploiement du code qui ne la lit plus.
-- Puis `npm run types-db` et `npm run type-check`.
-- ============================================================================

DO $garde$
BEGIN
  IF EXISTS (SELECT 1 FROM public.parents WHERE user_id IS NOT NULL) THEN
    RAISE EXCEPTION 'parents.user_id porte des valeurs : relire avant de supprimer';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
              AND coalesce(qual, '') || coalesce(with_check, '') ~ '\mp\.user_id\M') THEN
    RAISE EXCEPTION 'une regle d''acces lit encore parents.user_id';
  END IF;
END
$garde$;

DROP INDEX public.idx_parents_user_id;
ALTER TABLE public.parents DROP CONSTRAINT parents_user_id_fkey;
ALTER TABLE public.parents DROP COLUMN user_id;

DO $verif$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'parents' AND column_name = 'user_id') THEN
    RAISE EXCEPTION 'parents.user_id toujours presente';
  END IF;
END
$verif$;
SELECT enregistrer_migration('espace-famille-retrait-user-id.sql', '381fda8281d295256003e04e0fa2a5fd530e519c41f460bbac11e2f61ea687d0');
