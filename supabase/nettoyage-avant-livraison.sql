-- ============================================================================
-- BILAL EDUCATION — Nettoyage AVANT LIVRAISON (jour J)
--
-- Vide toutes les donnees de test et GARDE la configuration de demarrage.
-- Remplace `clean-all-data.sql`, qui ne devait pas servir tel quel : il vidait le
-- registre des migrations, laissait les comptes de test utilisables et laissait
-- en ligne les fichiers des familles.
--
-- CE QUI EST GARDE (decision utilisateur du 11 octobre) : etablissement (fiche,
-- messagerie, notes et facturation editeur), comptes de connexion, annee scolaire
-- (periodes, types d'evaluation), types de presence et leurs taux, referentiel
-- des cours, interventions de support editeur, registre des migrations — plus les
-- reglages de l'etablissement (cotisations, documents requis, salles, materiel,
-- abonnements aux notifications push).
--
-- CE QUI EST VIDE : tout le reste, y compris apprenants et foyers (ils seront
-- reimportes), le releve de facturation (pris sur des donnees de test) et le
-- journal d'activite.
--
-- METHODE
--   · Liste EXPLICITE des tables gardees ; toute autre table est videe. Une table
--     ajoutee plus tard est donc videe par defaut : c'est voulu pour un nettoyage.
--   · TRUNCATE SANS CASCADE, en une seule instruction : si une table GARDEE
--     dependait d'une table videe, PostgreSQL refuse au lieu de la vider en silence.
--   · TRUNCATE ne declenche aucun trigger de ligne : ni garde, ni journal.
--   · Les FICHIERS (Storage) ne se suppriment PAS en SQL : passage par l'API.
--
-- USAGE : `v_reel := false` = passage A BLANC (rapport puis annulation, rien
-- n'est ecrit). Passer a `true` pour le nettoyage reel.
-- ============================================================================

DO $nettoyage$
DECLARE
  v_reel   boolean := false;

  v_garder text[] := ARRAY[
    'etablissements', 'etablissement_smtp', 'etablissement_notes', 'etablissement_facturation',
    'profiles', 'push_subscriptions',
    'school_years', 'periods', 'eval_type_configs',
    'presence_types', 'presence_type_rates',
    'unites_enseignement', 'cours_modules', 'cours',
    'cotisation_types', 'document_type_configs', 'rooms', 'materials',
    'support_interventions',
    'migrations_appliquees'
  ];
  v_vider   text[];
  v_rapport text := '';
  v_n       bigint;
  t         text;
BEGIN
  -- Toute table gardee doit exister : une faute de frappe la ferait vider.
  FOREACH t IN ARRAY v_garder LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'public' AND table_name = t AND table_type = 'BASE TABLE') THEN
      RAISE EXCEPTION 'Table a garder introuvable : % (verifier la liste)', t;
    END IF;
  END LOOP;

  SELECT array_agg(table_name::text ORDER BY table_name) INTO v_vider
    FROM information_schema.tables
   WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     AND table_name <> ALL (v_garder);

  v_rapport := 'A VIDER :';
  FOREACH t IN ARRAY v_vider LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO v_n;
    IF v_n > 0 THEN v_rapport := v_rapport || format(' %s=%s', t, v_n); END IF;
  END LOOP;
  v_rapport := v_rapport || ' | GARDE :';
  FOREACH t IN ARRAY v_garder LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO v_n;
    v_rapport := v_rapport || format(' %s=%s', t, v_n);
  END LOOP;

  -- Une seule instruction, SANS CASCADE.
  EXECUTE 'TRUNCATE TABLE '
       || (SELECT string_agg(format('public.%I', x), ', ') FROM unnest(v_vider) x);

  -- Controle : tout ce qui devait l'etre est vide.
  FOREACH t IN ARRAY v_vider LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO v_n;
    IF v_n > 0 THEN RAISE EXCEPTION 'Table % non videe (% lignes)', t, v_n; END IF;
  END LOOP;

  IF NOT v_reel THEN
    RAISE EXCEPTION 'PASSAGE A BLANC (rien n''est ecrit) — %', v_rapport;
  END IF;
  RAISE NOTICE 'NETTOYAGE EFFECTUE — %', v_rapport;
END
$nettoyage$;
