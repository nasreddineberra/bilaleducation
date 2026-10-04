-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  REGISTRE DES MIGRATIONS APPLIQUEES                                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- ┌─ POURQUOI CETTE TABLE ───────────────────────────────────────────────────┐
-- │ 131 migrations, et RIEN EN BASE ne dit lesquelles sont appliquees. La    │
-- │ seule trace est une liste de cases a cocher dans `CLAUDE.md`, tenue a la │
-- │ main — et le 2 octobre j ai constate qu elle avait DECROCHE deux fois :  │
-- │ une migration jouee restait cochee « en attente », une autre cochee      │
-- │ n avait jamais ete rejouee apres correction.                             │
-- │                                                                          │
-- │ Un suivi tenu a la main decroche, et il decroche EN SILENCE. Sur une     │
-- │ base de production, « je ne sais pas si cette migration est en place »   │
-- │ est le pire etat possible : on n ose ni la rejouer, ni s en passer.      │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- ── CE QUE LE REGISTRE N EST PAS ───────────────────────────────────────────
-- Il dit « ce fichier a ete applique », JAMAIS « la base est dans l etat
-- attendu ». Les deux ne se confondent pas : le 5 aout, `policies.sql`
-- affirmait l inverse de ce que la base contenait. Pour l etat REEL, seuls
-- `pg_policies`, `pg_proc` et `information_schema` font foi — c est le role
-- des scripts de `supabase/controles/`.
--
-- ── POURQUOI UNE EMPREINTE, ET PAS SEULEMENT UN NOM ────────────────────────
-- Plusieurs migrations de ce projet ont ete REJOUEES APRES CORRECTION
-- (`guard-student-parent-delete`, `guard-class-delete-with-participants`).
-- Un registre qui ne porterait que le nom dirait « applique » pour les deux
-- versions, alors que la base ne porte que l une des deux. L empreinte
-- distingue « joue » de « joue DANS CETTE VERSION ».

CREATE TABLE IF NOT EXISTS migrations_appliquees (
  nom           text PRIMARY KEY,

  -- SHA-256 du contenu, **fins de ligne normalisees en LF**. Ce depot
  -- convertit LF en CRLF a la sortie de git (avertissement visible a chaque
  -- commit) : sans normalisation, la meme migration donnerait deux empreintes
  -- differentes selon la machine, et le registre signalerait des ecarts
  -- imaginaires a chaque changement de poste.
  empreinte     text NOT NULL CHECK (empreinte ~ '^[0-9a-f]{64}$'),

  appliquee_le  timestamptz NOT NULL DEFAULT now(),

  -- NULL quand la migration est jouee depuis l EDITEUR SQL, qui n a pas de
  -- session : c est le cas NORMAL et non une anomalie. La colonne ne se
  -- remplit que pour un appel venu de l application.
  applique_par  uuid REFERENCES profiles(id) ON DELETE SET NULL,

  -- ATTESTE  : quelqu un l a reellement jouee et l a vue passer.
  -- PRESUME  : declaree au remplissage initial, sans preuve. Les 131
  --            migrations anterieures au registre sont dans ce cas, SAUF
  --            celles que `CLAUDE.md` documente comme jouees et verifiees.
  -- On ne confond pas les deux : un « presume » faux se decouvre un jour, et
  -- il faut alors savoir qu on ne l avait jamais verifie.
  source        text NOT NULL DEFAULT 'atteste' CHECK (source IN ('atteste', 'presume')),

  -- Au rejeu : 'sans-effet' (gardes completes) · 'leve' (objet deja present,
  -- echec FRANC et sans degat) · 'destructeur' (a ne jamais rejouer).
  -- Mesure sur les 131 le 4 octobre : AUCUNE destructrice — toutes les
  -- ecritures de donnees sont bornees par un WHERE ou protegees par
  -- ON CONFLICT DO NOTHING. Le pire cas est un echec franc.
  rejeu         text CHECK (rejeu IN ('sans-effet', 'leve', 'destructeur')),

  note          text
);

COMMENT ON TABLE migrations_appliquees IS
  'Quelles migrations du depot ont ete appliquees a cette base. Ne dit pas '
  'que la base est dans l etat attendu : pour cela, voir supabase/controles/.';

-- ── RLS : table TECHNIQUE et GLOBALE, pas par etablissement ────────────────
--
-- Une seule base sert toutes les ecoles : une migration n appartient a aucune
-- d elles. Aucun cloisonnement tenant donc — ce serait un contresens — mais un
-- controle de role strict, car la liste des migrations renseigne sur la
-- structure interne du produit.
ALTER TABLE migrations_appliquees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS migrations_registre_select ON migrations_appliquees;
CREATE POLICY migrations_registre_select ON migrations_appliquees
  FOR SELECT USING (coalesce(get_user_role(), '') IN ('admin', 'direction'));

DROP POLICY IF EXISTS migrations_registre_write ON migrations_appliquees;
CREATE POLICY migrations_registre_write ON migrations_appliquees
  FOR ALL USING (coalesce(get_user_role(), '') = 'admin')
  WITH CHECK (coalesce(get_user_role(), '') = 'admin');

-- PAS DE TRIGGER D AUDIT, et c est delibere : `fn_audit_log()` range sa ligne
-- dans l etablissement du profil de `auth.uid()` et ECHOUE (23502) quand il
-- n y en a pas — piege paye le 6 aout. Or une migration se joue parfois depuis
-- l editeur SQL, sans session. La tracabilite vit dans `applique_par`.

-- ── ENREGISTREMENT : une seule porte d entree ──────────────────────────────
--
-- Chaque migration FUTURE se termine par un appel a cette fonction. C est la
-- discipline qui remplace la case a cocher : si l appel est dans le fichier,
-- il part avec lui et personne ne peut l oublier.
CREATE OR REPLACE FUNCTION enregistrer_migration(
  p_nom       text,
  p_empreinte text,
  p_rejeu     text DEFAULT NULL,
  p_note      text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- ┌─ LA GARDE DOIT LAISSER PASSER L EDITEUR SQL ────────────────────────┐
  -- │ C est par lui que les migrations se jouent, et il n a PAS DE        │
  -- │ SESSION : `auth.uid()` y est NULL, donc `get_user_role()` rend      │
  -- │ NULL. Une garde ecrite seulement sur le role applicatif aurait      │
  -- │ refuse le seul canal qu elle doit servir — et l editeur etant       │
  -- │ transactionnel, la migration entiere aurait ete annulee.            │
  -- │                                                                      │
  -- │ `auth.jwt() ->> 'role'`, le motif employe ailleurs dans ce projet,  │
  -- │ ne suffit pas : il est NULL depuis l editeur lui aussi. Seul        │
  -- │ `current_user` est TOUJOURS defini.                                 │
  -- │                                                                      │
  -- │ On refuse donc les DEUX roles de l API publique quand le role       │
  -- │ applicatif ne convient pas, et on laisse passer tout le reste —     │
  -- │ `postgres` (editeur SQL), `service_role`, `supabase_admin` : y      │
  -- │ acceder exige deja un acces serveur.                                │
  -- │                                                                      │
  -- │ `coalesce` reste indispensable : `NULL NOT IN (...)` vaut NULL et   │
  -- │ ne bloque donc PAS un appelant anonyme (regle du 7 juillet).        │
  -- └──────────────────────────────────────────────────────────────────────┘
  IF current_user IN ('anon', 'authenticated')
     AND coalesce(get_user_role(), '') NOT IN ('admin', 'direction') THEN
    RAISE EXCEPTION 'Enregistrement de migration reserve a l administration ou au canal serveur.';
  END IF;

  INSERT INTO migrations_appliquees (nom, empreinte, applique_par, rejeu, note, source)
  VALUES (p_nom, p_empreinte, auth.uid(), p_rejeu, p_note, 'atteste')
  ON CONFLICT (nom) DO UPDATE
    -- Une migration CORRIGEE PUIS REJOUEE doit mettre son empreinte a jour,
    -- sinon le registre signalerait un ecart a vie.
    SET empreinte    = excluded.empreinte,
        appliquee_le = now(),
        applique_par = excluded.applique_par,
        rejeu        = coalesce(excluded.rejeu, migrations_appliquees.rejeu),
        note         = coalesce(excluded.note, migrations_appliquees.note),
        source       = 'atteste';
END
$fn$;

-- `anon` ne doit pas pouvoir l APPELER, meme si la garde de role le refuse :
-- Supabase accorde EXECUTE nommement a `anon` par `ALTER DEFAULT PRIVILEGES`,
-- et un `REVOKE ... FROM public` ne retire pas une concession nominative
-- (constate le 3 octobre sur `purge_school_year`).
REVOKE ALL ON FUNCTION enregistrer_migration(text, text, text, text) FROM public;
REVOKE EXECUTE ON FUNCTION enregistrer_migration(text, text, text, text) FROM anon;

-- ── Verification ───────────────────────────────────────────────────────────
DO $verif$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables
                  WHERE schemaname = 'public' AND tablename = 'migrations_appliquees') THEN
    RAISE EXCEPTION 'La table du registre n a pas ete creee.';
  END IF;
  IF (SELECT count(*) FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'migrations_appliquees') <> 2 THEN
    RAISE EXCEPTION 'Les 2 policies du registre ne sont pas en place.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.routine_privileges
              WHERE routine_schema = 'public' AND routine_name = 'enregistrer_migration'
                AND grantee = 'anon' AND privilege_type = 'EXECUTE') THEN
    RAISE EXCEPTION 'anon peut encore executer enregistrer_migration().';
  END IF;
  RAISE NOTICE 'OK : registre cree, 2 policies, anon revoque. Remplir avec scripts/migrations-etat.mjs --remplir';
END
$verif$;

-- ── LE CERCLE DE L EMPREINTE, ET COMMENT IL EST ROMPU ──────────────────────
--
-- Une migration ne peut pas porter sa propre empreinte : ecrire l empreinte
-- dans le fichier CHANGE le fichier, donc son empreinte. Convention retenue,
-- appliquee par `scripts/migrations-etat.mjs` : **les lignes qui appellent
-- `enregistrer_migration(` sont EXCLUES du calcul**. Chaque migration peut
-- alors porter son enregistrement en derniere ligne, et un seul collage suffit.
--
-- Celle-ci ne s enregistre pas elle-meme : au moment ou on la colle, ni la
-- table ni la fonction n existent encore. Elle entre au registre avec les 131
-- autres, par `node scripts/migrations-etat.mjs --remplir`.
