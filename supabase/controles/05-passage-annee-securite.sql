-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  PASSAGE D ANNEE : controle de securite                                   ║
-- ║  Lecture seule. Tout est ANNULE : exception volontaire en sortie unique.  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Le passage d annee est le cycle le plus destructeur de l application : la
-- purge est son unique point de non-retour. Il sera eprouve en vraie fin
-- d annee avec la direction, mais sa SECURITE se verifie des aujourd hui.
--
-- Pourquoi en base et pas dans le depot : le 5 aout, `policies.sql` affirmait
-- l inverse de ce que la base contenait. Seules `pg_policies` et
-- `pg_get_functiondef` font foi.
--
-- ── VERROU DE SURETE ───────────────────────────────────────────────────────
-- Le controle APPELLE `purge_school_year` pour constater ses refus. Tant
-- qu aucune annee n est archivee, tout appel bute sur la garde d archivage et
-- ne detruit rien. Si une annee EST archivee, le script s arrete avant d appeler
-- quoi que ce soit : un test ne doit jamais pouvoir reussir la ou il verifie
-- qu on echoue.

DO $ctl$
DECLARE
  r        text := E'\n';
  etab     uuid;
  src      text;
  annee    uuid;
  label    text;
  nb_arch  int;
  ligne    record;
  ident    record;
  sqlstate_ text;
  msg      text;
  n        int;
BEGIN
  r := r || format('  identite du script : %s%s', current_user, E'\n');

  SELECT id INTO etab FROM etablissements ORDER BY created_at LIMIT 1;

  -- ══ 0. ETAT DES ANNEES, ET LE VERROU ═══════════════════════════════════
  r := r || E'\n═══ 0. ETAT DES ANNEES ══════════════════════════════════════════\n';
  FOR ligne IN
    SELECT label, is_current, end_date,
           closed_at IS NOT NULL AS close, archived_at IS NOT NULL AS arch,
           purged_at IS NOT NULL AS purg
      FROM school_years WHERE etablissement_id = etab ORDER BY start_date
  LOOP
    r := r || format('  %-12s courante:%-5s fin:%s  close:%-5s archivee:%-5s purgee:%s%s',
                     ligne.label, ligne.is_current, ligne.end_date,
                     ligne.close, ligne.arch, ligne.purg, E'\n');
  END LOOP;

  SELECT count(*) INTO nb_arch FROM school_years
   WHERE etablissement_id = etab AND archived_at IS NOT NULL;
  IF nb_arch > 0 THEN
    r := r || E'\n  >>> ARRET : une annee est ARCHIVEE. L appel de test pourrait REUSSIR\n';
    r := r || E'      et detruire des donnees. Aucun appel n a ete fait.\n';
    RAISE EXCEPTION '%', r;
  END IF;
  r := r || E'  -> aucune annee archivee : les appels de test ne peuvent que REFUSER.\n';

  SELECT id, school_years.label INTO annee, label
    FROM school_years WHERE etablissement_id = etab AND is_current ORDER BY start_date LIMIT 1;
  IF annee IS NULL THEN
    SELECT id, school_years.label INTO annee, label
      FROM school_years WHERE etablissement_id = etab ORDER BY start_date LIMIT 1;
  END IF;
  r := r || format('  annee servant aux essais : %s%s', label, E'\n');

  -- ══ 1. LES GARDES DE LA RPC, LUES DANS LE CATALOGUE ════════════════════
  r := r || E'\n═══ 1. purge_school_year : ses gardes ════════════════════════════\n';
  SELECT pg_get_functiondef(p.oid) INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'purge_school_year';

  IF src IS NULL THEN
    r := r || E'  ABSENTE.\n';
  ELSE
    r := r || format('  SECURITY DEFINER            : %s%s',
                     position('SECURITY DEFINER' in src) > 0, E'\n');
    r := r || format('  garde de ROLE (coalesce)    : %s%s',
                     position('coalesce(get_user_role()' in src) > 0, E'\n');
    r := r || format('  garde de TENANT             : %s%s',
                     position('current_etablissement_id()' in src) > 0, E'\n');
    r := r || format('  exige l ARCHIVAGE           : %s%s',
                     position('non archivee' in src) > 0, E'\n');
    r := r || format('  refuse l annee EN COURS     : %s   <== attendu true apres durcissement%s',
                     position('is_current' in src) > 0, E'\n');
    r := r || format('  refuse une annee DEJA PURGEE: %s   <== attendu true apres durcissement%s',
                     position('deja purgee' in src) > 0, E'\n');
  END IF;

  r := r || E'\n  -- droits d execution --\n';
  FOR ligne IN
    SELECT grantee, privilege_type FROM information_schema.routine_privileges
     WHERE routine_schema = 'public' AND routine_name = 'purge_school_year'
     ORDER BY grantee
  LOOP
    r := r || format('      %-18s %s%s', ligne.grantee, ligne.privilege_type, E'\n');
  END LOOP;

  -- ══ 2. LES POLICIES DES TABLES DU CYCLE ════════════════════════════════
  r := r || E'\n═══ 2. POLICIES (telles qu elles sont EN BASE) ═══════════════════\n';
  FOR ligne IN
    SELECT tablename, policyname, cmd,
           position('get_user_role' in coalesce(qual, with_check, '')) > 0 AS role_ok,
           position('current_etablissement_id' in coalesce(qual, with_check, '')) > 0 AS tenant_ok
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('school_years', 'year_audits',
                         'student_year_history', 'family_year_finance')
     ORDER BY tablename, policyname
  LOOP
    r := r || format('  %-22s %-34s %-7s role:%-5s tenant:%s%s',
                     ligne.tablename, ligne.policyname, ligne.cmd,
                     ligne.role_ok, ligne.tenant_ok, E'\n');
  END LOOP;

  -- ══ 3. LA PURGE, SOUS L IDENTITE DE CHAQUE ROLE ════════════════════════
  --
  -- On attend un REFUS partout. Le motif distingue ce qui a mordu : la garde
  -- de role (42501) pour qui n est ni admin ni direction, la garde d archivage
  -- pour les autres. Un succes serait une alerte — il ne peut pas survenir,
  -- le verrou du point 0 l a verifie.
  r := r || E'\n═══ 3. APPEL DE purge_school_year PAR CHAQUE ROLE ════════════════\n';
  FOR ident IN
    SELECT DISTINCT ON (role) role, id, last_name
      FROM profiles
     WHERE etablissement_id = etab AND is_active
       AND role IN ('admin', 'direction', 'comptable', 'secretaire',
                    'responsable_pedagogique', 'enseignant')
     ORDER BY role, created_at
  LOOP
    BEGIN
      SET LOCAL ROLE authenticated;
      PERFORM set_config('request.jwt.claims',
                         json_build_object('sub', ident.id, 'role', 'authenticated')::text, true);
      PERFORM purge_school_year(annee);
      RESET ROLE;
      r := r || format('  %-24s >>> AUCUN REFUS — A CORRIGER D URGENCE%s', ident.role, E'\n');
    EXCEPTION WHEN OTHERS THEN
      RESET ROLE;
      GET STACKED DIAGNOSTICS sqlstate_ = RETURNED_SQLSTATE, msg = MESSAGE_TEXT;
      r := r || format('  %-24s refus %-6s %s%s', ident.role, sqlstate_, left(msg, 58), E'\n');
    END;
    PERFORM set_config('request.jwt.claims', NULL, true);
  END LOOP;

  -- ══ 4. QUI LIT LES ARCHIVES ? ══════════════════════════════════════════
  -- `family_year_finance` porte ce que chaque foyer a paye : sa lecture doit
  -- etre reservee aux roles finance, pas ouverte a tout l etablissement.
  r := r || E'\n═══ 4. LECTURE DES TABLES D ARCHIVE PAR ROLE ═════════════════════\n';
  r := r || E'  (les tables sont vides tant qu aucune annee n est archivee :\n';
  r := r || E'   ce point mesure le DROIT, pas le contenu)\n';
  FOR ident IN
    SELECT DISTINCT ON (role) role, id
      FROM profiles
     WHERE etablissement_id = etab AND is_active
       AND role IN ('admin', 'direction', 'comptable', 'secretaire',
                    'responsable_pedagogique', 'enseignant')
     ORDER BY role, created_at
  LOOP
    BEGIN
      SET LOCAL ROLE authenticated;
      PERFORM set_config('request.jwt.claims',
                         json_build_object('sub', ident.id, 'role', 'authenticated')::text, true);
      SELECT count(*) INTO n FROM family_year_finance;
      RESET ROLE;
      r := r || format('  %-24s family_year_finance : LECTURE AUTORISEE (%s ligne(s))%s',
                       ident.role, n, E'\n');
    EXCEPTION WHEN OTHERS THEN
      RESET ROLE;
      GET STACKED DIAGNOSTICS sqlstate_ = RETURNED_SQLSTATE;
      r := r || format('  %-24s family_year_finance : refusee (%s)%s', ident.role, sqlstate_, E'\n');
    END;
    PERFORM set_config('request.jwt.claims', NULL, true);
  END LOOP;

  r := r || E'\n  Rien n a ete conserve.\n';
  RAISE EXCEPTION '%', r;
END
$ctl$;
