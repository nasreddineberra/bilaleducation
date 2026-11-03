-- ============================================================================
-- Espace famille, lot 5a : invitations (03/11)
--
-- Plan et decisions 12 a 16 : docs/ESPACE-FAMILLE.md.
--
-- CETTE MIGRATION :
--   1. `parents.tutor1/2_invite_le` (derniere invitation) et
--      `tutor1/2_acces_configure_le` (mot de passe choisi : badge « Acces en ligne »).
--   2. `foyer_du_compte()` exige en plus un profil ACTIF : « Desactiver » coupe
--      l'acces immediatement (decision 14).
--   3. `invitations_famille` : jeton d'invitation (empreinte seule), 7 jours,
--      usage unique. SERVEUR UNIQUEMENT (RLS sans regle, droits retires).
--   4. Garde : `tutor1/2_user_id` ne designe qu'un compte `parent` de la meme ecole.
--   5. `preparer_invitation_tuteur()` : appelee par le serveur (client SESSION,
--      audit) apres la creation du compte d'authentification : profil, lien au
--      tuteur, date d'invitation, jeton (le precedent est annule).
--   6. `marquer_acces_configure()` : le parent qui vient de choisir son mot de
--      passe pose la date de configuration de SA place.
--
-- Additif : aucun compte parent n'existe ; la condition ajoutee a
-- `foyer_du_compte()` ne retire rien a personne.
-- Controle : supabase/controles/40-espace-famille-invitations.sql.
-- ============================================================================

-- ── 1. Dates sur le foyer ───────────────────────────────────────────────────
ALTER TABLE public.parents
  ADD COLUMN tutor1_invite_le timestamptz,
  ADD COLUMN tutor2_invite_le timestamptz,
  ADD COLUMN tutor1_acces_configure_le timestamptz,
  ADD COLUMN tutor2_acces_configure_le timestamptz;

-- ── 2. Profil actif exige ───────────────────────────────────────────────────
DO $ancre$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.foyer_du_compte()'::regprocedure)
     <> 'eb58649ccbed63f6ec8edb088412a25e' THEN
    RAISE EXCEPTION 'foyer_du_compte a change depuis le lot 1 : relire avant de reecrire';
  END IF;
END
$ancre$;

CREATE OR REPLACE FUNCTION public.foyer_du_compte()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT p.id
    FROM parents p
    JOIN etablissements e ON e.id = p.etablissement_id
    JOIN profiles pr ON pr.id = auth.uid() AND pr.is_active
   WHERE (p.tutor1_user_id = auth.uid() OR p.tutor2_user_id = auth.uid())
     AND p.etablissement_id = current_etablissement_id()
     AND e.option_espace_famille
     AND coalesce(get_user_role(), '') = 'parent'
$fn$;

-- ── 3. Jetons d'invitation (serveur uniquement) ─────────────────────────────
CREATE TABLE public.invitations_famille (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id uuid        NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  parent_id        uuid        NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  tutor_number     smallint    NOT NULL CHECK (tutor_number IN (1, 2)),
  profile_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  empreinte        text        NOT NULL UNIQUE,
  cree_le          timestamptz NOT NULL DEFAULT now(),
  expire_le        timestamptz NOT NULL,
  utilise_le       timestamptz,
  annule_le        timestamptz,
  cree_par         uuid
);
CREATE INDEX invitations_famille_tuteur ON public.invitations_famille (parent_id, tutor_number);
ALTER TABLE public.invitations_famille ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invitations_famille FROM PUBLIC, anon, authenticated;

-- ── 4. Un tuteur ne designe qu'un compte parent de son ecole ────────────────
CREATE OR REPLACE FUNCTION public.fn_guard_compte_tuteur_profil()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF NEW.tutor1_user_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM profiles pr WHERE pr.id = NEW.tutor1_user_id
          AND pr.role = 'parent' AND pr.etablissement_id = NEW.etablissement_id) THEN
    RAISE EXCEPTION 'Le compte du tuteur 1 doit etre un compte parent de cet etablissement.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.tutor2_user_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM profiles pr WHERE pr.id = NEW.tutor2_user_id
          AND pr.role = 'parent' AND pr.etablissement_id = NEW.etablissement_id) THEN
    RAISE EXCEPTION 'Le compte du tuteur 2 doit etre un compte parent de cet etablissement.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_guard_compte_tuteur_profil
  BEFORE INSERT OR UPDATE OF tutor1_user_id, tutor2_user_id ON public.parents
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_compte_tuteur_profil();

-- ── 5. Preparer une invitation ──────────────────────────────────────────────
-- Appelee APRES la creation du compte d'authentification (API admin, serveur).
-- Rend l'email et le nom du tuteur, pour l'email d'invitation.
CREATE OR REPLACE FUNCTION public.preparer_invitation_tuteur(
  p_parent_id uuid, p_tutor_number smallint, p_profile_id uuid, p_empreinte text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_etab   uuid := current_etablissement_id();
  p        parents%ROWTYPE;
  v_email  text;
  v_nom    text;
  v_prenom text;
  v_phone  text;
  v_lie    uuid;
BEGIN
  IF coalesce(get_user_role(), '') NOT IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire') THEN
    RAISE EXCEPTION 'Acces refuse' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_tutor_number NOT IN (1, 2) OR coalesce(p_empreinte, '') = '' THEN
    RAISE EXCEPTION 'Invitation invalide';
  END IF;
  SELECT * INTO p FROM parents WHERE id = p_parent_id AND etablissement_id = v_etab;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Foyer introuvable';
  END IF;
  IF NOT (SELECT option_espace_famille FROM etablissements WHERE id = v_etab) THEN
    RAISE EXCEPTION 'L''espace famille n''est pas ouvert pour cet etablissement.';
  END IF;

  IF p_tutor_number = 1 THEN
    v_email := p.tutor1_email; v_nom := p.tutor1_last_name; v_prenom := p.tutor1_first_name;
    v_phone := p.tutor1_phone; v_lie := p.tutor1_user_id;
  ELSE
    v_email := p.tutor2_email; v_nom := p.tutor2_last_name; v_prenom := p.tutor2_first_name;
    v_phone := p.tutor2_phone; v_lie := p.tutor2_user_id;
  END IF;
  IF coalesce(btrim(v_email), '') = '' THEN
    RAISE EXCEPTION 'Ce tuteur n''a pas d''adresse email.';
  END IF;
  IF v_lie IS NOT NULL AND v_lie <> p_profile_id THEN
    RAISE EXCEPTION 'Ce tuteur est deja relie a un autre compte.';
  END IF;

  -- Profil : cree au premier envoi, controle ensuite.
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id) THEN
    INSERT INTO profiles (id, email, role, first_name, last_name, phone, is_active, etablissement_id)
    VALUES (p_profile_id, lower(btrim(v_email)), 'parent', v_prenom, v_nom, v_phone, true, v_etab);
  ELSIF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id AND role = 'parent' AND etablissement_id = v_etab) THEN
    RAISE EXCEPTION 'Ce compte n''est pas un compte parent de cet etablissement.';
  END IF;

  IF p_tutor_number = 1 THEN
    UPDATE parents SET tutor1_user_id = p_profile_id, tutor1_invite_le = now() WHERE id = p_parent_id;
  ELSE
    UPDATE parents SET tutor2_user_id = p_profile_id, tutor2_invite_le = now() WHERE id = p_parent_id;
  END IF;

  UPDATE invitations_famille SET annule_le = now()
   WHERE parent_id = p_parent_id AND tutor_number = p_tutor_number
     AND utilise_le IS NULL AND annule_le IS NULL;
  INSERT INTO invitations_famille (etablissement_id, parent_id, tutor_number, profile_id, empreinte, expire_le, cree_par)
  VALUES (v_etab, p_parent_id, p_tutor_number, p_profile_id, p_empreinte, now() + interval '7 days', auth.uid());

  RETURN jsonb_build_object('email', lower(btrim(v_email)), 'nom', v_nom, 'prenom', v_prenom);
END;
$fn$;

-- ── 6. Acces configure ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.marquer_acces_configure()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
  UPDATE parents
     SET tutor1_acces_configure_le = CASE WHEN tutor1_user_id = auth.uid()
                                          THEN coalesce(tutor1_acces_configure_le, now()) ELSE tutor1_acces_configure_le END,
         tutor2_acces_configure_le = CASE WHEN tutor2_user_id = auth.uid()
                                          THEN coalesce(tutor2_acces_configure_le, now()) ELSE tutor2_acces_configure_le END
   WHERE id = foyer_du_compte()
$fn$;

REVOKE ALL ON FUNCTION public.fn_guard_compte_tuteur_profil() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.preparer_invitation_tuteur(uuid, smallint, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.marquer_acces_configure() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preparer_invitation_tuteur(uuid, smallint, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marquer_acces_configure() TO authenticated;

-- ── Verification ────────────────────────────────────────────────────────────
DO $verif$
BEGIN
  IF has_table_privilege('authenticated', 'public.invitations_famille', 'SELECT')
     OR has_table_privilege('anon', 'public.invitations_famille', 'SELECT') THEN
    RAISE EXCEPTION 'invitations_famille lisible hors serveur';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invitations_famille') THEN
    RAISE EXCEPTION 'invitations_famille : aucune regle attendue';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.routine_privileges
              WHERE routine_schema = 'public' AND grantee IN ('anon', 'PUBLIC')
                AND routine_name IN ('preparer_invitation_tuteur', 'marquer_acces_configure',
                                     'fn_guard_compte_tuteur_profil', 'foyer_du_compte')) THEN
    RAISE EXCEPTION 'fonctions d''invitation executables par anon ou PUBLIC';
  END IF;
END
$verif$;
SELECT enregistrer_migration('espace-famille-invitations.sql', '55cf0cc13fe796e764921f57bf09e418b8e1f04c05aac8c2538d26138771e329');
