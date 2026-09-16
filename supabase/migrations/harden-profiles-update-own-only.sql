-- ============================================================================
-- BILAL EDUCATION — `profiles` : un compte ne modifie que SON profil
-- ----------------------------------------------------------------------------
-- DEFAUT CONSTATE (16 septembre 2026, lu dans `pg_policies`).
--
-- La policy `profiles_update` autorisait TOUT compte authentifie de
-- l'etablissement a modifier N'IMPORTE QUEL profil de l'etablissement :
--
--     USING (etablissement_id = current_etablissement_id())
--
-- Ni role, ni `id = auth.uid()`. C'est le motif du 5 aout — le cloisonnement a
-- REMPLACE le controle au lieu de s'y ajouter — et `profiles` n'etait pas dans
-- les huit tables reprises ce jour-la.
--
-- Le declencheur anti-escalade (8 juillet, durci le 6 aout) protege `role`,
-- `is_active` et `etablissement_id`. Tout le reste etait ouvert : un enseignant
-- pouvait, par un appel direct a l'API REST, changer le nom, le telephone, les
-- remarques internes ou l'ADRESSE EMAIL du directeur. L'email est le plus
-- serieux : `profiles.email` est l'adresse que lisent les communications au
-- staff — rediriger celles du directeur vers soi tenait en une requete.
--
-- ── CE QUE L'APPLICATION FAIT REELLEMENT (verifie avant d'ecrire) ──────────
--
-- Les seules ecritures de `profiles` sous identite UTILISATEUR portent sur le
-- profil de l'appelant lui-meme (Mon compte : theme, email, identite).
--   . la fiche Utilisateurs ecrit sous admin/direction → policy « Admin and
--     direction can update profiles », inchangee ;
--   . le rattachement de support ecrit en cle service → hors RLS ;
--   . la synchronisation `teachers → profiles` est un declencheur
--     SECURITY DEFINER → hors RLS.
-- Restreindre a `id = auth.uid()` ne casse donc aucun chemin.
--
-- Benefice second : le super-admin DETACHE (`etablissement_id` NULL) ne
-- passait pas l'ancienne condition (`NULL = NULL` vaut NULL, donc faux) et ne
-- pouvait pas modifier son propre profil depuis l'application. Il le peut.
--
-- Le declencheur anti-escalade RESTE indispensable : sans lui, « modifier son
-- propre profil » inclurait `role`. Les deux se completent, l'un ne remplace
-- pas l'autre.
--
-- Idempotent.
-- ============================================================================

DROP POLICY IF EXISTS profiles_update ON public.profiles;

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE
  USING      (id = auth.uid())
  WITH CHECK (id = auth.uid());

COMMENT ON POLICY profiles_update ON public.profiles IS
  'Un compte ne modifie que SON profil. Les autres profils relevent de la policy admin/direction. '
  'Les colonnes sensibles (role, is_active, etablissement_id) restent gardees par le declencheur.';

SELECT 'profiles : un compte ne modifie desormais que son propre profil.' AS status;
