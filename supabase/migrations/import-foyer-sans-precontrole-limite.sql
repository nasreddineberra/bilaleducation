-- ============================================================================
-- IMPORT : LA LIMITE D'INSCRITS N'A PLUS QU'UN JUGE (26 octobre 2026)
--
-- `import_foyer` verifiait lui-meme la limite de l'abonnement, en ne comptant
-- que les ELEVES actifs. Le declencheur `fn_guard_limite_inscrits` (students,
-- parents), plus strict, compte la base facturable (eleves actifs + adultes
-- inscrits) et refuse de toute facon. Deux juges, deux comptes, deux messages :
-- « 45 apprenants actifs, 3 a importer, maximum 50 » (faux : ignore les adultes,
-- en SQL sans accents) ou le message traduit du declencheur, selon le cas.
--
-- Le pre-controle est retire : le declencheur reste seul juge ; son refus porte
-- le repere `limite_inscrits`, que l'import traduit deja (`messageLimiteInscrits`).
-- Un foyer refuse l'est EN BLOC (une transaction par foyer).
--
-- Comme `add-medical-notes-to-import.sql`, on RAPIECE la definition REELLE
-- (`pg_get_functiondef`) au lieu de recopier la fonction : seule la base fait
-- foi. Si l'ancrage a bouge, la migration LEVE et n'applique rien.
--
-- Changement RESTRICTIF ? Non : la limite reste garantie par le declencheur.
-- Aucun code applicatif ne change.
-- Controle : supabase/controles/24-import-limite-inscrits.sql.
-- ============================================================================

DO $maj$
DECLARE
  src   text;
  avant text;
  fdl   text;   -- fin de ligne de la source (CRLF si la fonction a ete creee depuis Windows)
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'import_foyer';
  IF src IS NULL THEN
    RAISE EXCEPTION 'import_foyer() est introuvable.';
  END IF;

  IF position('Limite de l''''abonnement' in src) = 0 THEN
    RAISE NOTICE 'Rien a faire : import_foyer() n a plus de pre-controle.';
    RETURN;
  END IF;

  avant := src;
  fdl := CASE WHEN position(E'\r\n' in src) > 0 THEN E'\r\n' ELSE E'\n' END;

  -- Le bloc, de son intitule jusqu'a la section suivante. L'anticipation fait
  -- consommer le blanc (l'expression est paresseuse dans son ensemble).
  src := regexp_replace(
    src,
    '-- ── La limite de licence.*?USING ERRCODE = ''check_violation'';\s*END IF;\s*END IF;\s*(?=-- ── 1\. )',
    '-- La limite de l''abonnement est gardee par le declencheur' || fdl
    || '  -- `fn_guard_limite_inscrits` (eleves actifs + adultes inscrits) : seul juge.' || fdl || fdl || '  ');

  -- Variables qui ne servaient qu'au pre-controle (la ligne entiere).
  src := regexp_replace(src, '\r?\n[ \t]*v_max[ \t]+int;', '');
  src := regexp_replace(src, '\r?\n[ \t]*v_actifs[ \t]+int;', '');

  IF src = avant OR position('Limite de l''''abonnement' in src) > 0
     OR src ~ 'v_max|v_actifs' THEN
    RAISE EXCEPTION 'Les ancrages ont bouge : pre-controle non retire. Rien applique.';
  END IF;

  EXECUTE src;
END
$maj$;

SELECT enregistrer_migration('import-foyer-sans-precontrole-limite.sql', '4c13e723fed262b47423eb1177d41e93a8c19e889516e3c8388baa3fff4a4921');
