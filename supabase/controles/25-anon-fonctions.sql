-- ============================================================================
-- CONTROLE 25 — Aucune fonction d'action executable sans connexion
--
--   les neuf fonctions d'action / de donnees  -> refusees a `anon`,
--                                               permises a `authenticated`
--   les fonctions des regles d'acces          -> permises a `anon` (resultat vide)
--   une fonction NOUVELLE creee par postgres  -> refusee a `anon`,
--                                               permise a `authenticated`
--   un appel anonyme reel                     -> « permission denied »
--
-- Migration : supabase/migrations/revoke-anon-fonctions.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================
DO $ctl$
DECLARE
  f    text;
  ok   boolean;
  msg  text;
  rapport text := '';
  nb_ko   integer := 0;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.import_foyer(jsonb, jsonb, uuid)',
    'public.create_profile_and_parent(uuid, text, text, text, text, text, boolean, uuid, text, text, text, text, text, text, text, text, text, boolean, text, text, text, text, text, text, text, text, text, boolean, text, text, text)',
    'public.cleanup_profile_only(uuid)',
    'public.cleanup_user_and_parent(uuid)',
    'public.cleanup_user_and_teacher(uuid)',
    'public.set_teacher_profile_active(uuid, boolean)',
    'public.get_verified_totp_user_ids()',
    'public.fn_ensure_reserved_presence_types(uuid, uuid)',
    'public.is_admin()'
  ] LOOP
    ok := NOT has_function_privilege('anon', f, 'EXECUTE')
          AND has_function_privilege('authenticated', f, 'EXECUTE');
    rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] action refusee a anon     ' || split_part(f, '(', 1);
    IF NOT ok THEN nb_ko := nb_ko + 1; END IF;
  END LOOP;

  FOREACH f IN ARRAY ARRAY[
    'public.current_etablissement_id()', 'public.get_user_role()',
    'public.teaches_class(uuid)', 'public.teaches_parent(uuid)', 'public.teaches_student(uuid)',
    'public.est_destinataire_annonce(uuid)', 'public.fn_effacement_en_cours()', 'public.norm_name(text)'
  ] LOOP
    ok := has_function_privilege('anon', f, 'EXECUTE');
    rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] regle d''acces gardee     ' || split_part(f, '(', 1);
    IF NOT ok THEN nb_ko := nb_ko + 1; END IF;
  END LOOP;

  -- Une fonction nouvelle, creee comme le ferait une migration.
  CREATE FUNCTION public.ctl25_nouvelle() RETURNS int LANGUAGE sql AS $f$ SELECT 1 $f$;
  ok := NOT has_function_privilege('anon', 'public.ctl25_nouvelle()', 'EXECUTE')
        AND has_function_privilege('authenticated', 'public.ctl25_nouvelle()', 'EXECUTE');
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] defaut : nouvelle fonction '
    || CASE WHEN has_function_privilege('anon', 'public.ctl25_nouvelle()', 'EXECUTE') THEN 'anon PERMIS' ELSE 'anon refuse' END;
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  -- Appel reel sous `anon`.
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM get_verified_totp_user_ids();
    msg := 'appel accepte';
  EXCEPTION WHEN OTHERS THEN msg := SQLERRM; END;
  RESET ROLE;
  ok := msg LIKE 'permission denied%' OR msg LIKE 'droit refus%';
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] appel anonyme             ' || msg;
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  RAISE EXCEPTION 'CONTROLE 25 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
